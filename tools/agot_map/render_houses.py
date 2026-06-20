# -*- coding: utf-8 -*-
"""Rend les blasons de toutes les maisons du site → public/blasons/<clé>.png (128px)."""
import os
import render_coa as rc

OUT = r"D:/ck3fr-rp/public/blasons"
SIZE = 128

# clé de maison du site -> noms de dynastie candidats dans le mod
MAP = {
    "stark": ["Stark"], "forestier": ["Forrester"], "manderly": ["Manderly"], "reed": ["Reed"],
    "karstark": ["Karstark"], "durrandon": ["Durrandon"], "connington": ["Connington"],
    "frey": ["Frey"], "bracken": ["Bracken"], "tully": ["Tully"], "lannister": ["Lannister"],
    "brax": ["Brax"], "reyne": ["Reyne"], "lefford": ["Lefford"], "arryn": ["Arryn"],
    "grafton": ["Grafton"], "melcolm": ["Melcolm"], "hersy": ["Hersy", "Hardyng"],
    "jardinier": ["Gardener"], "hightower": ["Hightower"], "redwyne": ["Redwyne"],
    "rowan": ["Rowan"], "martell": ["Martell"], "dayne": ["Dayne"],
    "noirmont": ["Blackmont"], "ferboy": ["Qorgyle", "Wyl", "Vaith"], "chenu": ["Greyiron", "Hoare", "Drumm"],
    "greyjoy": ["Greyjoy"], "harloi": ["Harlaw"], "targaryen": ["Targaryen"],
    "velaryon": ["Velaryon"], "celtigar": ["Celtigar"], "mooton": ["Mooton"],
}

# Clé CoA imposée pour certaines maisons (meilleure variante que dynn_).
OVERRIDE = {
    "martell": "house_Martell",  # soleil rouge + lance d'or (contraste correct)
}

# Blasons reconstruits à la main quand l'original est illisible en petit.
CUSTOM = {
    # Celtigar : l'original est un champ semé de 35 crabes (bouillie en petit).
    # On garde un seul gros crabe doré sur champ rouge — lisible et héraldique.
    "celtigar": {
        "pattern": "pattern_solid.dds",
        "colors": {1: "agot_red", 2: "agot_red", 3: "agot_red"},
        "emblems": [{
            "texture": "cl_celtigar_crab.dds",
            "colors": {1: "agot_gold", 2: "agot_gold", 3: "agot_gold"},
            "instances": [{"pos": (0.5, 0.5), "scale": (0.82, 0.82), "rot": 0}],
        }],
    },
    # Ferboy (Qorgyle) : un seul gros scorpion d'or sur rouge — lisible.
    "ferboy": {
        "pattern": "pattern_solid.dds",
        "colors": {1: "rgb {142 36 36}", 2: "rgb {142 36 36}", 3: "rgb {142 36 36}"},
        "emblems": [{
            "texture": "do_qorgyle_scorpion.dds",
            "colors": {1: "agot_gold", 2: "agot_gold", 3: "agot_gold"},
            "instances": [{"pos": (0.5, 0.5), "scale": (0.8, 0.8), "rot": 0}],
        }],
    },
    # Velaryon : hippocampe blanc bien visible sur sarcelle sombre.
    "velaryon": {
        "pattern": "pattern_solid.dds",
        "colors": {1: "rgb {34 100 100}", 2: "rgb {34 100 100}", 3: "rgb {34 100 100}"},
        "emblems": [{
            "texture": "cl_velaryon.dds",
            "colors": {1: "rgb {240 240 232}", 2: "rgb {240 240 232}", 3: "rgb {240 240 232}"},
            "instances": [{"pos": (0.5, 0.5), "scale": (0.88, 0.88), "rot": 0}],
        }],
    },
    # Mooton : saumon rouge bien visible sur champ crème/or.
    "mooton": {
        "pattern": "pattern_solid.dds",
        "colors": {1: "rgb {232 222 196}", 2: "rgb {232 222 196}", 3: "rgb {232 222 196}"},
        "emblems": [{
            "texture": "rl_mooton_salmon.dds",
            "colors": {1: "rgb {160 44 40}", 2: "rgb {160 44 40}", 3: "rgb {160 44 40}"},
            "instances": [{"pos": (0.5, 0.5), "scale": (0.82, 0.82), "rot": 0}],
        }],
    },
}

def main():
    os.makedirs(OUT, exist_ok=True)
    ok, miss = [], []
    for key, names in MAP.items():
        if key in CUSTOM:
            rc.render(CUSTOM[key], size=SIZE).save(os.path.join(OUT, f"{key}.png"))
            ok.append(f"{key}<-custom")
            continue
        cands = ([OVERRIDE[key]] if key in OVERRIDE else []) \
            + [f"dynn_{n}" for n in names] + [f"house_{n}" for n in names] + [f"k_{n.lower()}" for n in names]
        body = None
        used = None
        for c in cands:
            body = rc.extract_def(c)
            if body:
                used = c
                break
        if not body:
            miss.append(key)
            continue
        d = rc.parse_block(body)
        img = rc.render(d, size=SIZE)
        img.save(os.path.join(OUT, f"{key}.png"))
        ok.append(f"{key}<-{used}")
    print(f"OK ({len(ok)}):", ", ".join(ok))
    print(f"MANQUANTS ({len(miss)}):", ", ".join(miss))

if __name__ == "__main__":
    main()
