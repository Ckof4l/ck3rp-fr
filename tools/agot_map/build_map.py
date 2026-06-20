# -*- coding: utf-8 -*-
"""
Construit les données de la carte interactive AGOT pour le site ck3rp-fr.

Entrées (mod AGOT) :
  - map_data/provinces.png      : chaque province = 1 couleur RGB unique
  - map_data/definition.csv     : province_id ; R ; G ; B ; b_barony ; x
  - common/landed_titles/*.txt  : hiérarchie e_ > k_ > d_ > c_ > b_ (+ couleurs)
  - localization/{english,french}/**  : noms affichables des titres

Sorties (public/carte/) :
  - political.png : carte colorée par ROYAUME (de jure) — affichage direct
  - index.png     : province_id encodé en RGB (R=id&255, G=id>>8) — hit-test
  - map.json      : { meta, kingdoms{key:{name,color}}, provinces{id:{c,k}} }
"""
import csv, json, os, re, sys
from PIL import Image

MOD = r"D:/Games/steamapps/workshop/content/1158310/2962333032"
OUT = r"D:/ck3fr-rp/public/carte"
SCALE = 3  # 9216x6144 -> 3072x2048

TITLE_RE = re.compile(r'^[ekdcb]_')

# Noms FR des grandes régions de Westeros (palier EMPIRE dans l'AGOT).
REGION_FR = {
    "e_the_north":        "Le Nord",
    "e_the_vale":         "Le Val",
    "e_the_westerlands":  "Les Terres de l'Ouest",
    "e_the_riverlands":   "Le Conflans",
    "e_the_reach":        "Le Bief",
    "e_dorne":            "Dorne",
    "e_the_iron_islands": "Les Îles de Fer",
    "e_the_stormlands":   "Les Terres de l'Orage",
    "e_the_crownlands":   "Les Terres de la Couronne",
    "e_the_wall":         "Le Mur",
}

def pretty(key):
    """Nom lisible dérivé d'une clé de titre (fallback hors Westeros)."""
    s = key.split("_", 1)[1] if "_" in key else key
    return s.replace("_", " ").title()

# ---------------------------------------------------------------- localization
def load_loc():
    names = {}
    for lang in ("english", "french"):
        root = os.path.join(MOD, "localization", lang)
        if not os.path.isdir(root):
            continue
        for dirpath, _, files in os.walk(root):
            for fn in files:
                if not fn.endswith(".yml"):
                    continue
                try:
                    with open(os.path.join(dirpath, fn), encoding="utf-8-sig") as f:
                        for line in f:
                            m = re.match(r'\s*([ekdcb]_[a-z0-9_]+):\d*\s*"(.*?)"', line)
                            if m:
                                key, val = m.group(1), m.group(2)
                                # priorité : on garde la 1re trouvée (english d'abord)
                                if key not in names and val.strip():
                                    names[key] = val
                except Exception:
                    pass
    return names

# ---------------------------------------------------------- landed_titles parse
TOKEN_RE = re.compile(r'"[^"]*"|[{}=]|[^\s{}=]+')

def tokenize(text):
    for line in text.splitlines():
        h = line.find('#')
        if h != -1:
            line = line[:h]
        for t in TOKEN_RE.findall(line):
            yield t

def parse_titles():
    """Retourne province_id -> dict(barony,county,duchy,kingdom) + kingdoms{key:color/name}."""
    prov2title = {}          # province_id -> {b,c,d,k}
    title_color = {}         # title_key -> [r,g,b]
    folder = os.path.join(MOD, "common", "landed_titles")
    files = sorted(f for f in os.listdir(folder) if f.endswith(".txt"))

    for fn in files:
        with open(os.path.join(folder, fn), encoding="utf-8-sig") as f:
            text = f.read()
        toks = list(tokenize(text))
        i, n = 0, len(toks)
        stack = []        # frames: {"key":..., "is_title":bool}
        title_stack = []  # juste les clés de titres en cours (b/c/d/k/e)
        pending_key = None

        while i < n:
            t = toks[i]
            if t == "{":
                key = pending_key
                is_title = bool(key and TITLE_RE.match(key))
                stack.append({"key": key, "is_title": is_title})
                if is_title:
                    title_stack.append(key)
                pending_key = None
                i += 1
            elif t == "}":
                if stack:
                    fr = stack.pop()
                    if fr["is_title"] and title_stack:
                        title_stack.pop()
                pending_key = None
                i += 1
            elif t == "=":
                i += 1
            else:
                # lookahead : "ident = {"  ou  "ident = value"
                if i + 1 < n and toks[i + 1] == "=":
                    if i + 2 < n and toks[i + 2] == "{":
                        # "color = { r g b }" : on le lie au titre courant.
                        if t == "color" and title_stack:
                            try:
                                r, g, b = int(toks[i + 3]), int(toks[i + 4]), int(toks[i + 5])
                                title_color.setdefault(title_stack[-1], [r, g, b])
                            except (ValueError, IndexError):
                                pass
                        pending_key = t
                        i += 1
                        continue
                    # affectation simple : ident = value
                    attr, val = t, toks[i + 2] if i + 2 < n else None
                    if attr == "province" and title_stack and val:
                        try:
                            pid = int(val)
                            cur = {"b": None, "c": None, "d": None, "k": None, "e": None}
                            for k in title_stack:
                                cur[k[0]] = k  # b/c/d/k/e -> bucket par préfixe
                            prov2title[pid] = cur
                        except ValueError:
                            pass
                        i += 3
                        continue
                    if attr == "color" and title_stack:
                        # color = { r g b }
                        if i + 2 < n and toks[i + 2] == "{":
                            try:
                                r = int(toks[i + 3]); g = int(toks[i + 4]); b = int(toks[i + 5])
                                cur_title = title_stack[-1]
                                title_color.setdefault(cur_title, [r, g, b])
                            except (ValueError, IndexError):
                                pass
                    i += 2
                    continue
                i += 1

    return prov2title, title_color

# ----------------------------------------------------------------------- main
def main():
    os.makedirs(OUT, exist_ok=True)
    print("1/5 localisation…")
    names = load_loc()
    print(f"    {len(names)} noms de titres")

    print("2/5 landed_titles…")
    prov2title, title_color = parse_titles()
    print(f"    {len(prov2title)} provinces reliées à un titre")

    print("3/5 definition.csv…")
    defn = {}  # province_id -> (r,g,b)
    with open(os.path.join(MOD, "map_data", "definition.csv"), encoding="utf-8-sig") as f:
        for row in csv.reader(f, delimiter=';'):
            if len(row) < 5 or not row[0].isdigit():
                continue
            pid = int(row[0])
            try:
                defn[pid] = (int(row[1]), int(row[2]), int(row[3]))
            except ValueError:
                pass
    print(f"    {len(defn)} provinces définies")

    # rgb (province) -> province_id
    rgb2pid = {rgb: pid for pid, rgb in defn.items()}

    # Région = palier EMPIRE (les « grands royaumes »), repli sur le royaume.
    def region_of(t):
        return t.get("e") or t.get("k")

    regions = {}
    for pid, t in prov2title.items():
        r = region_of(t)
        if r and r not in regions:
            col = title_color.get(r, [128, 128, 128])
            name = REGION_FR.get(r) or names.get(r) or pretty(r)
            regions[r] = {"name": name, "color": col}

    print("4/5 rendu des images…")
    src = Image.open(os.path.join(MOD, "map_data", "provinces.png")).convert("RGB")
    small = src.resize((src.width // SCALE, src.height // SCALE), Image.NEAREST)
    W, H = small.size
    px = small.load()

    political = Image.new("RGB", (W, H), (12, 16, 24))
    index = Image.new("RGB", (W, H), (0, 0, 0))
    pol = political.load()
    idx = index.load()

    provinces_json = {}
    for y in range(H):
        for x in range(W):
            rgb = px[x, y]
            pid = rgb2pid.get(rgb)
            if pid is None:
                continue
            t = prov2title.get(pid)
            r = region_of(t) if t else None
            if not r:
                continue  # mer / hors région -> fond
            pol[x, y] = tuple(regions[r]["color"])
            idx[x, y] = (pid & 255, (pid >> 8) & 255, 0)
            if pid not in provinces_json:
                c = t.get("c")
                provinces_json[pid] = {
                    "c": names.get(c, c) if c else None,
                    "ck": c,  # clé du comté (jointure avec la sauvegarde)
                    "r": r,
                }

    political.save(os.path.join(OUT, "political.png"))
    index.save(os.path.join(OUT, "index.png"))
    print(f"    images {W}x{H}")

    print("5/5 map.json…")
    data = {
        "meta": {"width": W, "height": H, "scale": SCALE},
        "regions": regions,
        "provinces": provinces_json,
    }
    with open(os.path.join(OUT, "map.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    print(f"    {len(regions)} régions, {len(provinces_json)} provinces terrestres")
    print("OK ->", OUT)

if __name__ == "__main__":
    main()
