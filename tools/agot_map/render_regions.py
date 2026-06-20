# -*- coding: utf-8 -*-
"""Blasons des grandes régions (pays) → public/blasons/regions/<clé-salon>.png (128px).
Champ = couleur de la région + un seul emblème iconique (style épuré, comme les familles)."""
import os
import render_coa as rc

OUT = r"D:/ck3fr-rp/public/blasons/regions"
SIZE = 128

def fld(c):
    return f"rgb {{{c[0]} {c[1]} {c[2]}}}" if isinstance(c, tuple) else c

# clé de salon -> champ + emblème + couleurs d'emblème (color1=B, color2=G, color3=R)
REGIONS = {
    "le-nord":         dict(field=(236, 238, 240), tex="no_stark_wolf.dds",      ec=("agot_grey", "agot_grey_light", "agot_grey"),   scale=0.92),
    "le-val":          dict(field="agot_blue_light", tex="ce_falcon.dds",         ec=("white", "white", "white"),                     scale=0.80),
    "le-roc":          dict(field="agot_red",        tex="ce_lion_rampant.dds",   ec=("agot_gold", "agot_gold", "agot_gold"),         scale=0.86),
    "le-trident":      dict(field=(34, 68, 140),     tex="ce_trident.dds",        ec=("agot_grey_light", "white", "white"),           scale=0.82),
    "le-bief":         dict(field=(76, 165, 80),     tex="ce_hand.dds",           ec=("agot_gold", "agot_gold", "agot_gold"),         scale=0.74),
    "dorne":           dict(field="agot_orange",     tex="do_nymeros_martell.dds", ec=("agot_red", "agot_gold", "agot_red"),          scale=0.88),
    "les-iles-de-fer": dict(field="agot_black",      tex="ce_greyjoy.dds",        ec=("agot_gold", "agot_gold", "agot_gold"),         scale=0.86),
    "peyredragon":     dict(field="agot_black",      tex="ce_dragon.dds",         ec=("agot_red", "agot_red", "agot_red"),            scale=0.88),
}

def main():
    os.makedirs(OUT, exist_ok=True)
    for key, r in REGIONS.items():
        d = {
            "pattern": "pattern_solid.dds",
            "colors": {1: fld(r["field"]), 2: fld(r["field"]), 3: fld(r["field"])},
            "emblems": [{
                "texture": r["tex"],
                "colors": {1: r["ec"][0], 2: r["ec"][1], 3: r["ec"][2]},
                "instances": [{"pos": (0.5, 0.5), "scale": (r["scale"], r["scale"]), "rot": 0}],
            }],
        }
        rc.render(d, size=SIZE).save(os.path.join(OUT, f"{key}.png"))
        print("ok", key)

if __name__ == "__main__":
    main()
