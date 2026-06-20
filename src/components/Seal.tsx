import { useEffect, useState } from 'react'
import { getHouse, shade } from '../lib/houses'

/* Sceau d'une maison — affiche le blason PNG (/blasons/<clé>.png) s'il existe,
   sinon le sceau de cire avec l'emblème emoji. */

type SealSize = 'sm' | 'md' | 'lg' | 'xl'

export function Seal({
  house,
  size = 'md',
  title,
}: {
  house: string | null | undefined
  size?: SealSize
  title?: string
}) {
  const h = getHouse(house)
  const [noImg, setNoImg] = useState(false)
  // React réutilise les noeuds dans les listes : on réessaie le blason quand la maison change.
  useEffect(() => setNoImg(false), [h.key])
  const cls = size === 'md' ? 'seal' : `seal ${size}`
  return (
    <span
      className={cls}
      title={title ?? `Maison ${h.nom}`}
      style={{ background: `radial-gradient(circle at 40% 35%, ${h.col}, ${shade(h.col, -40)})` }}
    >
      {noImg ? (
        h.sig
      ) : (
        <img className="seal-img" src={`/blasons/${h.key}.png?v=2`} alt="" onError={() => setNoImg(true)} />
      )}
    </span>
  )
}
