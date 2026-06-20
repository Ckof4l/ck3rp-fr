# -*- coding: utf-8 -*-
"""
Moteur de rendu héraldique CK3 (mod AGOT) → PNG.
Un blason = un PATTERN de fond (recoloré) + des EMBLÈMES recolorés et composés.

Encodage observé (espace Pillow, RGBA) :
  • patterns : couleurs-marqueurs plates → (255,0,0)=color1, (255,255,0)=color2, (255,255,255)=color3
  • emblèmes : canal B=masque color1, G=masque color2, R=masque color3 ; A=forme
"""
import os, re
from PIL import Image

GAME = r"D:/Games/steamapps/common/Crusader Kings III/game"
MODS = [
    r"D:/Games/steamapps/workshop/content/1158310/2962333032",  # AGOT
    r"D:/Games/steamapps/workshop/content/1158310/3149692324",  # AGOT Bookmarked
]
SIZE = 256

# ---------------------------------------------------------------- couleurs nommées
_named = None
def named_colors():
    global _named
    if _named is not None:
        return _named
    cols = {"white": (255, 255, 255), "black": (20, 20, 20), "red": (150, 40, 40),
            "green": (60, 140, 60), "blue": (40, 70, 160), "yellow": (220, 200, 60)}
    import colorsys
    for base in [GAME] + MODS:
        folder = os.path.join(base, "common", "named_colors")
        if not os.path.isdir(folder):
            continue
        for fn in os.listdir(folder):
            if not fn.endswith(".txt"):
                continue
            try:
                txt = open(os.path.join(folder, fn), encoding="utf-8-sig").read()
            except Exception:
                continue
            for m in re.finditer(r'([A-Za-z0-9_]+)\s*=\s*(rgb|hsv360|hsv)?\s*\{\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\}', txt):
                name, kind = m.group(1), m.group(2) or "rgb"
                a, b, c = float(m.group(3)), float(m.group(4)), float(m.group(5))
                if kind == "rgb":
                    cols[name] = (int(a), int(b), int(c))
                else:
                    h, s, v = (a / 360, b / 100, c / 100) if kind == "hsv360" else (a, b, c)
                    rr, gg, bb = colorsys.hsv_to_rgb(h, s, v)
                    cols[name] = (int(rr * 255), int(gg * 255), int(bb * 255))
    _named = cols
    return cols

def color(tok, default=(128, 128, 128)):
    tok = tok.strip()
    m = re.match(r'rgb\s*\{\s*(\d+)\s+(\d+)\s+(\d+)', tok)
    if m:
        return (int(m.group(1)), int(m.group(2)), int(m.group(3)))
    m = re.match(r'hsv\s*\{\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)', tok)
    if m:
        import colorsys
        rr, gg, bb = colorsys.hsv_to_rgb(float(m.group(1)), float(m.group(2)), float(m.group(3)))
        return (int(rr * 255), int(gg * 255), int(bb * 255))
    return named_colors().get(tok.strip('"'), default)

# ---------------------------------------------------------------- textures
def find_texture(name):
    for kind in ("colored_emblems", "textured_emblems", "patterns"):
        for base in MODS + [GAME]:
            p = os.path.join(base, "gfx", "coat_of_arms", kind, name)
            if os.path.exists(p):
                return p
    return None

# ---------------------------------------------------------------- parsing d'une déf
def parse_block(text):
    """Parse un bloc de déf CoA (le contenu entre les accolades du titre)."""
    d = {"pattern": None, "colors": {}, "emblems": []}
    mp = re.search(r'pattern\s*=\s*"([^"]+)"', text)
    if mp:
        d["pattern"] = mp.group(1)
    for i in (1, 2, 3, 4):
        m = re.search(r'(?<!_)color' + str(i) + r'\s*=\s*("[^"]*"|rgb\s*\{[^}]*\}|hsv\s*\{[^}]*\}|[A-Za-z0-9_]+)', text)
        if m:
            d["colors"][i] = m.group(1)
    # emblèmes (colored_emblem = { ... })
    for em in re.finditer(r'colored_emblem\s*=\s*\{(.*?)\}\s*(?=colored_emblem|\Z)', text, re.S):
        body = em.group(1)
        e = {"texture": None, "colors": {}, "instances": []}
        mt = re.search(r'texture\s*=\s*"([^"]+)"', body)
        if mt:
            e["texture"] = mt.group(1)
        for i in (1, 2, 3):
            m = re.search(r'color' + str(i) + r'\s*=\s*("[^"]*"|rgb\s*\{[^}]*\}|hsv\s*\{[^}]*\}|[A-Za-z0-9_]+)', body)
            if m:
                e["colors"][i] = m.group(1)
        for inst in re.finditer(r'instance\s*=\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}', body):
            ib = inst.group(1)
            pos = re.search(r'position\s*=\s*\{\s*([\d.]+)\s+([\d.]+)', ib)
            sca = re.search(r'scale\s*=\s*\{\s*(-?[\d.]+)\s+(-?[\d.]+)', ib)
            rot = re.search(r'rotation\s*=\s*(-?\d+)', ib)
            e["instances"].append({
                "pos": (float(pos.group(1)), float(pos.group(2))) if pos else (0.5, 0.5),
                "scale": (float(sca.group(1)), float(sca.group(2))) if sca else (1.0, 1.0),
                "rot": int(rot.group(1)) if rot else 0,
            })
        if not e["instances"]:
            e["instances"].append({"pos": (0.5, 0.5), "scale": (1.0, 1.0), "rot": 0})
        d["emblems"].append(e)
    return d

# ---------------------------------------------------------------- rendu
def recolor_pattern(pat, c1, c2, c3):
    pat = pat.resize((SIZE, SIZE), Image.NEAREST).convert("RGBA")
    px = pat.load()
    out = Image.new("RGB", (SIZE, SIZE), c1)
    op = out.load()
    for y in range(SIZE):
        for x in range(SIZE):
            r, g, b, _ = px[x, y]
            if r > 180 and g < 100:
                op[x, y] = c1
            elif r > 180 and g > 180 and b < 100:
                op[x, y] = c2
            elif r > 180 and g > 180 and b > 180:
                op[x, y] = c3
            else:
                op[x, y] = c1
    return out

def render_emblem(path, c1, c2, c3):
    em = Image.open(path).convert("RGBA").resize((SIZE, SIZE), Image.LANCZOS)
    px = em.load()
    out = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    op = out.load()
    for y in range(SIZE):
        for x in range(SIZE):
            r, g, b, a = px[x, y]
            if a < 8:
                continue
            m = max(r, g, b)
            if m == 0:
                continue
            col = c1 if b == m else (c2 if g == m else c3)
            shade = 0.60 + 0.40 * (m / 255)
            op[x, y] = (int(col[0] * shade), int(col[1] * shade), int(col[2] * shade), a)
    return out

def render(defn, size=SIZE):
    c1 = color(defn["colors"].get(1, "white"))
    c2 = color(defn["colors"].get(2, "black"))
    c3 = color(defn["colors"].get(3, "red"))
    patname = defn["pattern"] or "pattern_solid.dds"
    patpath = find_texture(patname)
    field = recolor_pattern(Image.open(patpath), c1, c2, c3) if patpath else Image.new("RGB", (SIZE, SIZE), c1)
    img = field.convert("RGBA")
    for e in defn["emblems"]:
        tp = find_texture(e["texture"]) if e["texture"] else None
        if not tp:
            continue
        ec1 = color(e["colors"].get(1, "white"))
        ec2 = color(e["colors"].get(2, "black"))
        ec3 = color(e["colors"].get(3, "red"))
        base = render_emblem(tp, ec1, ec2, ec3)
        for inst in e["instances"]:
            sx, sy = inst["scale"]
            w = max(1, int(SIZE * abs(sx))); h = max(1, int(SIZE * abs(sy)))
            layer = base.resize((w, h), Image.LANCZOS)
            if sx < 0:
                layer = layer.transpose(Image.FLIP_LEFT_RIGHT)
            if inst["rot"]:
                layer = layer.rotate(-inst["rot"], expand=True, resample=Image.BICUBIC)
            cx, cy = int(SIZE * inst["pos"][0]), int(SIZE * inst["pos"][1])
            img.alpha_composite(layer, (cx - layer.width // 2, cy - layer.height // 2))
    if size != SIZE:
        img = img.resize((size, size), Image.LANCZOS)
    return img

# ---------------------------------------------------------------- extraction d'un titre
def extract_def(key):
    """Cherche la déf CoA d'un titre/clé dans les fichiers du mod (brace-aware)."""
    for base in MODS:
        folder = os.path.join(base, "common", "coat_of_arms", "coat_of_arms")
        if not os.path.isdir(folder):
            continue
        for fn in os.listdir(folder):
            if not fn.endswith(".txt"):
                continue
            txt = open(os.path.join(folder, fn), encoding="utf-8-sig").read()
            m = re.search(r'(?m)^' + re.escape(key) + r'\s*=\s*\{', txt)
            if not m:
                continue
            i = m.end(); depth = 1
            while i < len(txt) and depth:
                if txt[i] == '{': depth += 1
                elif txt[i] == '}': depth -= 1
                i += 1
            return txt[m.end():i - 1]
    return None

if __name__ == "__main__":
    import sys
    key = sys.argv[1] if len(sys.argv) > 1 else "k_winterfell"
    body = extract_def(key)
    if not body:
        print("déf introuvable:", key); sys.exit(1)
    d = parse_block(body)
    print("pattern:", d["pattern"], "colors:", d["colors"], "emblems:", len(d["emblems"]))
    img = render(d)
    out = r"D:/ck3fr-rp/tools/agot_map/_test_" + key + ".png"
    img.save(out)
    print("écrit:", out)
