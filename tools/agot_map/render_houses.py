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
    "velaryon": ["Velaryon"], "celtigar": ["Celtigar"],
}

# Clé CoA imposée pour certaines maisons (meilleure variante que dynn_).
OVERRIDE = {
    "martell": "house_Martell",  # soleil rouge + lance d'or (contraste correct)
}

def main():
    os.makedirs(OUT, exist_ok=True)
    ok, miss = [], []
    for key, names in MAP.items():
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
