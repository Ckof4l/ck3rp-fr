# -*- coding: utf-8 -*-
"""Ajoute des maisons de tout l'univers : rend leur blason + génère les entrées houses.ts."""
import os, collections
import render_coa as rc
from PIL import Image

OUT = r"D:/ck3fr-rp/public/blasons"
SIZE = 128

# (clé site, nom, région, nom dynastie mod, devise)
HOUSES = [
    # ── Le Nord ──
    ("bolton",    "Bolton",     "Le Nord", "Bolton",     "Nos lames sont aiguisées."),
    ("umber",     "Omble",      "Le Nord", "Umber",      "Ici nous tenons."),
    ("mormont",   "Mormont",    "Le Nord", "Mormont",    "Ici nous tenons."),
    ("glover",    "Glover",     "Le Nord", "Glover",     "Notre main protège."),
    ("hornwood",  "Corbois",    "Le Nord", "Hornwood",   "Droits comme la lance."),
    ("cerwyn",    "Cerwyn",     "Le Nord", "Cerwyn",     "Hachés mais debout."),
    ("tallhart",  "Tallhart",   "Le Nord", "Tallhart",   "Fiers et grands."),
    ("dustin",    "Dustin",     "Le Nord", "Dustin",     "Les barrons se souviennent."),
    # ── Le Trident ──
    ("blackwood", "Blackwood",  "Le Trident", "Blackwood", "Le corbeau n'oublie pas."),
    ("mallister", "Mallister",  "Le Trident", "Mallister", "Au-dessus du reste."),
    ("vance",     "Vance",      "Le Trident", "Vance",     "Garde contre la nuit."),
    ("piper",     "Piper",      "Le Trident", "Piper",     "Brave et docile."),
    ("darry",     "Darry",      "Le Trident", "Darry",     "Le laboureur reste."),
    ("whent",     "Whent",      "Le Trident", "Whent",     "Noires chauves-souris d'Harrenhal."),
    # ── Le Roc ──
    ("clegane",   "Clegane",    "Le Roc", "Clegane",   "Les chiens mordent."),
    ("marbrand",  "Marpheux",   "Le Roc", "Marbrand",  "Brûlants et fiers."),
    ("crakehall", "Crakehall", "Le Roc", "Crakehall", "Aucun sanglier ne recule."),
    ("westerling","Westerling","Le Roc", "Westerling","Honneur, pas honneurs."),
    ("payne",     "Payne",      "Le Roc", "Payne",     "Silencieux et loyaux."),
    ("swyft",     "Swyft",      "Le Roc", "Swyft",     "Vif et rusé."),
    # ── La Montagne et le Val ──
    ("royce",     "Royce",      "La Montagne et le Val", "Royce",     "Nous nous souvenons."),
    ("corbray",   "Corbray",    "La Montagne et le Val", "Corbray",   "Dame Désespoir veille."),
    ("waynwood",  "Waynwood",   "La Montagne et le Val", "Waynwood",  "La roue tourne."),
    ("hunter",    "Hunter",     "La Montagne et le Val", "Hunter",    "La meute ne faiblit pas."),
    ("redfort",   "Fort-Rouge", "La Montagne et le Val", "Redfort",   "Solide comme la pierre."),
    ("belmore",   "Belmore",    "La Montagne et le Val", "Belmore",   "Les cloches sonnent vrai."),
    # ── Le Bief ──
    ("tyrell",    "Tyrell",     "Le Bief", "Tyrell",    "Plus fort en grandissant."),
    ("tarly",     "Tarly",      "Le Bief", "Tarly",     "Premiers au combat."),
    ("florent",   "Florent",    "Le Bief", "Florent",   "Le renard veille."),
    ("oakheart",  "Cœur-de-Chêne", "Le Bief", "Oakheart", "Fidèle et fort."),
    ("fossoway",  "Fossoway",   "Le Bief", "Fossoway",  "Mûr et savoureux."),
    ("caswell",   "Caswell",    "Le Bief", "Caswell",   "La porte du Bief."),
    # ── Dorne ──
    ("yronwood",  "Yronwood",   "Dorne", "Yronwood",  "Nous gardons la voie."),
    ("fowler",    "Fowler",     "Dorne", "Fowler",    "Laissez-les voler."),
    ("allyrion",  "Allyrion",   "Dorne", "Allyrion",  "Aucune épine ne nous arrête."),
    ("jordayne",  "Jordayne",   "Dorne", "Jordayne",  "L'esprit avant la lame."),
    ("santagar",  "Santagar",   "Dorne", "Santagar",  "Le tacheté frappe."),
    ("manwoody",  "Manwoody",   "Dorne", "Manwoody",  "La mort vient des sables."),
    ("uller",     "Uller",      "Dorne", "Uller",     "Brûlante est la vengeance."),
    # ── Les Îles de Fer ──
    ("botley",    "Botley",     "Les Îles de Fer", "Botley",      "Sous les flots, la richesse."),
    ("goodbrother","Bonfrère",  "Les Îles de Fer", "Goodbrother", "Le cor de guerre résonne."),
    ("drumm",     "Tambur",     "Les Îles de Fer", "Drumm",       "Le tambour de la bataille."),
    ("blacktyde", "Néguemarée", "Les Îles de Fer", "Blacktyde",   "Noire est la marée."),
    ("wynch",     "Wynch",      "Les Îles de Fer", "Wynch",       "Le fer ne plie pas."),
    # ── Peyredragon ──
    ("sunglass",  "Sunglass",   "Peyredragon", "Sunglass",   "La lumière des Sept."),
    ("massey",    "Massey",     "Peyredragon", "Massey",     "Gardiens du détroit."),
    ("rosby",     "Rosby",      "Peyredragon", "Rosby",      "Le blé et le bois."),
    ("stokeworth","Stokeworth", "Peyredragon", "Stokeworth", "Fiers et prospères."),
    ("darklyn",   "Darklyn",    "Peyredragon", "Darklyn",    "Sombreval ne plie pas."),
]


def field_color(img):
    """Couleur du champ (coin) → hex pour le sceau."""
    px = img.convert("RGB")
    c = px.getpixel((6, 6))
    return "#%02X%02X%02X" % c


def main():
    os.makedirs(OUT, exist_ok=True)
    entries, miss = [], []
    for key, nom, region, dynn, devise in HOUSES:
        body = None
        for cand in (f"dynn_{dynn}", f"house_{dynn}"):
            body = rc.extract_def(cand)
            if body:
                break
        if not body:
            miss.append(key)
            continue
        d = rc.parse_block(body)
        img = rc.render(d, size=SIZE)
        img.save(os.path.join(OUT, f"{key}.png"))
        col = field_color(img)
        esc = nom.replace("'", "\\'")
        entries.append(
            f"  {key+':':12}{{ key: '{key}', nom: '{esc}', region: '{region}', "
            f"sig: '🛡️', col: '{col}', canon: '', devise: \"{devise}\" }},"
        )
    with open("_houses_entries.txt", "w", encoding="utf-8") as f:
        f.write("\n".join(entries))
    print(f"{len(entries)} entrees ecrites dans _houses_entries.txt -- MANQUANTES:", miss)

if __name__ == "__main__":
    main()
