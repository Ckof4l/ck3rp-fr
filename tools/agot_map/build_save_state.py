# -*- coding: utf-8 -*-
"""
Lit une sauvegarde CK3 (mod AGOT) et produit l'« état de la partie » pour la carte :
  - public/carte/political_save.png : provinces colorées par ROYAUME DE FACTO réel
  - public/carte/save.json          : { meta, realms, provinces{pid:{realm,holder}}, stats }

Jointure : map.json (province -> clé de comté `ck`) × save (comté -> détenteur -> royaume).
"""
import io, json, os, re, sys, zipfile
from PIL import Image

MOD = r"D:/Games/steamapps/workshop/content/1158310/2962333032"
OUT = r"D:/ck3fr-rp/public/carte"
SAVE = sys.argv[1] if len(sys.argv) > 1 else \
    r"D:/Documents/Paradox Interactive/Crusader Kings III/save games/After The Doom.ck3"

# Nom d'époque affiché pour cette save (modifiable par save ; plusieurs époques jouables).
ERA = sys.argv[2] if len(sys.argv) > 2 else "An 1 après le Fléau"

# Teinte fixe imposée à certaines grandes régions (par-dessus la couleur de facto).
REGION_TINT = {
    "e_the_north":      (236, 238, 240),  # blanc
    "e_the_reach":      (76, 165, 80),    # vert
    "e_the_riverlands": (34, 68, 140),    # bleu sombre (Trident)
}

# ---------------------------------------------------------------- couleurs nommées
GAME = r"D:/Games/steamapps/common/Crusader Kings III/game"

def load_named_colors():
    cols = {}
    files = []
    # jeu de base d'abord, mod ensuite (le mod a priorité, donc chargé après).
    for base in (GAME, MOD):
        folder = os.path.join(base, "common", "named_colors")
        if os.path.isdir(folder):
            files += [os.path.join(folder, f) for f in os.listdir(folder) if f.endswith(".txt")]
    # couleurs de base du jeu (quelques fallback usuels)
    cols.update({"white": (255, 255, 255), "black": (20, 20, 20), "red": (170, 40, 40),
                 "green": (40, 140, 50), "blue": (40, 70, 160), "yellow": (220, 200, 60)})
    def conv(kind, a, b, c):
        if kind == "rgb":
            return (int(a), int(b), int(c))
        # hsv (0..1) ou hsv360
        import colorsys
        if kind == "hsv360":
            h, s, v = a / 360.0, b / 100.0, c / 100.0
        else:
            h, s, v = a, b, c
        r, g, bb = colorsys.hsv_to_rgb(h, s, v)
        return (int(r * 255), int(g * 255), int(bb * 255))
    for fp in files:
        try:
            txt = open(fp, encoding="utf-8-sig").read()
        except Exception:
            continue
        for m in re.finditer(r'([A-Za-z0-9_]+)\s*=\s*(rgb|hsv360|hsv)?\s*\{\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s*\}', txt):
            name, kind = m.group(1), m.group(2) or "rgb"
            try:
                cols[name] = conv(kind, float(m.group(3)), float(m.group(4)), float(m.group(5)))
            except Exception:
                pass
    return cols

# ---------------------------------------------------------------- découpe par accolades
def top_entries(text, start):
    """Itère les blocs `ID={...}` de niveau 1 à partir de l'offset `start` (juste après '{')."""
    i, n = start, len(text)
    depth = 0
    while i < n:
        c = text[i]
        if c == '{':
            depth += 1; i += 1
        elif c == '}':
            if depth == 0:
                return
            depth -= 1; i += 1
        elif depth == 0:
            m = re.match(r'\s*([A-Za-z0-9_]+)=\{', text[i:i + 80])
            if m:
                key = m.group(1)
                bstart = i + m.end()
                # avance jusqu'à la fermeture du bloc
                d, j = 1, bstart
                while j < n and d:
                    if text[j] == '{': d += 1
                    elif text[j] == '}': d -= 1
                    j += 1
                yield key, text[bstart:j - 1]
                i = j
            else:
                i += 1
        else:
            i += 1

def section_start(gs, key):
    m = re.search(r'(?m)^' + re.escape(key) + r'=\{', gs)
    return m.end() if m else None

# ---------------------------------------------------------------- main
def main():
    print("Lecture de la sauvegarde…")
    raw = open(SAVE, "rb").read()
    off = raw.find(b"PK\x03\x04")
    gs = zipfile.ZipFile(io.BytesIO(raw[off:])).read("gamestate").decode("utf-8", "replace")

    meta_date = (re.search(r'meta_date=([\d.]+)', gs) or [None, "?"])[1]
    player = (re.search(r'meta_player_name="([^"]*)"', gs) or [None, "?"])[1]

    named = load_named_colors()
    def resolve_color(tok):
        tok = tok.strip()
        m = re.match(r'rgb\s*\{\s*(\d+)\s+(\d+)\s+(\d+)', tok)
        if m:
            return (int(m.group(1)), int(m.group(2)), int(m.group(3)))
        tok = tok.strip('"')
        return named.get(tok)

    print("Blasons (couleur de chaque royaume)…")
    coa_color = {}  # coa_id -> (r,g,b)
    s = gs.find("coat_of_arms_manager_database=")
    if s != -1:
        s = gs.find("{", s) + 1
        for cid, blk in top_entries(gs, s):
            m = re.search(r'color1=("?[\w]+"?|rgb\s*\{[^}]*\})', blk)
            if m:
                c = resolve_color(m.group(1))
                if c:
                    coa_color[cid] = c

    print("Titres (détenteurs + vassalité de facto)…")
    titles = {}        # id -> dict
    key_to_id = {}
    s0 = section_start(gs, "landed_titles")
    m2 = re.search(r'landed_titles=\{', gs[s0:])  # le sous-bloc qui contient les titres
    s = s0 + m2.end()
    for tid, blk in top_entries(gs, s):
        if not tid.isdigit():
            continue
        d = {"key": None, "holder": None, "dfl": None, "coa": None, "name": None}
        mk = re.search(r'\bkey=([A-Za-z0-9_]+)', blk)
        if mk: d["key"] = mk.group(1)
        mh = re.search(r'\bholder=(\d+)', blk)
        if mh: d["holder"] = mh.group(1)
        md = re.search(r'\bde_facto_liege=(\d+)', blk)
        if md: d["dfl"] = md.group(1)
        mc = re.search(r'\bcoat_of_arms_id=(\d+)', blk)
        if mc: d["coa"] = mc.group(1)
        mn = re.search(r'title_name_data=\{\s*name="([^"]*)"', blk)
        if mn: d["name"] = mn.group(1)
        titles[tid] = d
        if d["key"]:
            key_to_id.setdefault(d["key"], tid)

    # royaume de facto = sommet de la chaîne de_facto_liege
    def realm_of(tid):
        seen = set()
        cur = tid
        while cur and cur in titles and titles[cur]["dfl"] and cur not in seen:
            seen.add(cur)
            cur = titles[cur]["dfl"]
        return cur

    print("Détenteurs : noms des personnages…")
    holder_ids = {t["holder"] for t in titles.values() if t["holder"]}
    # maisons (dynn_*) : id -> nom lisible
    house_name = {}
    ds = section_start(gs, "dynasties")
    if ds:
        dh = gs.find("dynasty_house=", ds)
        if dh != -1:
            dh = gs.find("{", dh) + 1
            for hid, blk in top_entries(gs, dh):
                m = re.search(r'name="(?:dynn_)?([^"]*)"', blk)
                if m and hid.isdigit():
                    house_name[hid] = m.group(1).replace("_", " ")

    # noms des détenteurs (cherche chaque id dans tout le gamestate)
    holder_name = {}
    holder_house = {}
    for cid in holder_ids:
        m = re.search(r'(?m)^' + cid + r'=\{', gs)
        if not m:
            continue
        seg = gs[m.end():m.end() + 1500]
        fn = re.search(r'first_name="([^"]*)"', seg)
        dh = re.search(r'dynasty_house=(\d+)', seg)
        if fn: holder_name[cid] = fn.group(1)
        if dh: holder_house[cid] = dh.group(1)

    def holder_label(cid):
        if not cid:
            return None
        nm = holder_name.get(cid, "?")
        hs = house_name.get(holder_house.get(cid, ""), "")
        return f"{nm} {hs}".strip()

    # comté -> royaume
    print("Calcul des royaumes par comté…")
    county_realm = {}  # cKey -> {realmKey,realmName,color,holder}
    realms = {}
    for tid, t in titles.items():
        if not t["key"] or not t["key"].startswith("c_") or not t["holder"]:
            continue
        rtid = realm_of(tid)
        rt = titles.get(rtid, {})
        rkey = rt.get("key") or ("realm_" + str(rtid))
        color = coa_color.get(rt.get("coa")) or (130, 130, 130)
        rname = rt.get("name") or rkey
        if rkey not in realms:
            realms[rkey] = {"name": rname, "color": list(color),
                            "ruler": holder_label(rt.get("holder"))}
        county_realm[t["key"]] = {"realm": rkey, "holder": holder_label(t["holder"])}

    # seigneurs par royaume (souverain + vassaux : titres roi/duc/comté détenus)
    print("Seigneurs (vassaux) par royaume…")
    TIER = {"k": 3, "d": 2, "c": 1}
    realm_lords = {}
    for tid, t in titles.items():
        k, h = t["key"], t["holder"]
        if not k or not h or k[0] not in "kdc":
            continue
        rk = titles.get(realm_of(tid), {}).get("key")
        if not rk:
            continue
        realm_lords.setdefault(rk, []).append((TIER.get(k[0], 0), holder_label(h), t.get("name") or k))
    for rk, lst in realm_lords.items():
        seen, out = set(), []
        for tier, name, title in sorted(lst, key=lambda x: -x[0]):
            if not name or name in seen:
                continue
            seen.add(name)
            out.append({"name": name, "title": title})
            if len(out) >= 40:
                break
        if rk in realms:
            realms[rk]["lords"] = out

    # ---- statistiques ----
    print("Statistiques (personnages, maisons)…")
    ls = section_start(gs, "living")
    le = section_start(gs, "dead_unprunable") or len(gs)
    living_txt = gs[ls:le]
    n_living = len(re.findall(r'(?m)^\d+=\{', living_txt))
    n_houses = len(house_name)
    n_realms = len(realms)
    n_titled = sum(1 for t in titles.values() if t["holder"])

    # ---- rendu de l'image recolorée ----
    print("Rendu political_save.png…")
    data = json.load(open(os.path.join(OUT, "map.json"), encoding="utf-8"))
    W, H = data["meta"]["width"], data["meta"]["height"]
    prov = data["provinces"]
    idx = Image.open(os.path.join(OUT, "index.png")).convert("RGB")
    ipx = idx.load()
    out = Image.new("RGB", (W, H), (12, 16, 24))
    opx = out.load()
    prov_json = {}
    for y in range(H):
        for x in range(W):
            r, g, b = ipx[x, y]
            pid = r + (g << 8)
            if not pid:
                continue
            info = prov.get(str(pid))
            if not info:
                continue
            tint = REGION_TINT.get(info.get("r"))  # Nord blanc / Bief vert / Trident bleu
            cr = county_realm.get(info.get("ck"))
            if not cr:
                opx[x, y] = tint or (70, 70, 78)  # terre sans détenteur connu
                continue
            opx[x, y] = tint or tuple(realms[cr["realm"]]["color"])
            if str(pid) not in prov_json:
                prov_json[str(pid)] = {"realm": cr["realm"], "holder": cr["holder"]}
    out.save(os.path.join(OUT, "political_save.png"))

    save_json = {
        "meta": {"date": meta_date, "player": player, "era": ERA,
                 "characters": n_living, "houses": n_houses,
                 "realms": n_realms, "titled": n_titled},
        "regions": realms,  # même forme que map.json (clé -> {name,color,ruler})
        "provinces": prov_json,
    }
    json.dump(save_json, open(os.path.join(OUT, "save.json"), "w", encoding="utf-8"),
              ensure_ascii=False, separators=(",", ":"))

    print(f"OK — date {meta_date}, joueur {player}")
    print(f"     {n_living} vivants · {n_houses} maisons · {n_realms} royaumes de facto · {n_titled} titres détenus")

if __name__ == "__main__":
    main()
