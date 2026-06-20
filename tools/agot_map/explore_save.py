# -*- coding: utf-8 -*-
"""Explore la structure d'une sauvegarde CK3 (non-ironman)."""
import io, re, sys, zipfile

SAVE = sys.argv[1] if len(sys.argv) > 1 else \
    r"D:/Documents/Paradox Interactive/Crusader Kings III/save games/After The Doom.ck3"

raw = open(SAVE, "rb").read()
off = raw.find(b"PK\x03\x04")
z = zipfile.ZipFile(io.BytesIO(raw[off:]))
gs = z.read("gamestate").decode("utf-8", "replace")
print("gamestate:", len(gs), "chars")

# Sections de premier niveau (clé en colonne 0 suivie de ={ ), dédupliquées.
print("\n=== sections de 1er niveau ===")
seen = set()
for m in re.finditer(r"(?m)^([a-z_]+)=\{", gs):
    k = m.group(1)
    if k in seen:
        continue
    seen.add(k)
    print(f"  {k:28} @ {m.start()}")

def block_after(key):
    """Retourne l'offset juste après 'key={' au niveau 0."""
    m = re.search(r"(?m)^" + re.escape(key) + r"=\{", gs)
    return m.end() if m else None

# Échantillon : landed_titles
print("\n=== landed_titles (échantillon) ===")
i = block_after("landed_titles")
if i:
    print(gs[i:i + 600])

# Échantillon : living (personnages vivants)
print("\n=== living (échantillon) ===")
i = block_after("living")
if i:
    print(gs[i:i + 500])

# Échantillon : dynasties / maisons
print("\n=== dynasties (échantillon) ===")
i = block_after("dynasties")
if i:
    print(gs[i:i + 500])

# Échantillon : coat_of_arms
print("\n=== coat_of_arms (échantillon) ===")
i = block_after("coat_of_arms")
if i:
    print(gs[i:i + 600])
