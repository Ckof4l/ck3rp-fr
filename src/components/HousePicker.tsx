import { housesByRegion, FREE_HOUSE_KEY } from '../lib/houses'
import { Seal } from './Seal'

/* ============================================================================
   Sélecteur de maison groupé par région. Les maisons déjà revendiquées sont
   verrouillées (sauf « autre / libre », toujours ouverte).
   ========================================================================== */

export function HousePicker({
  selected,
  taken,
  onPick,
}: {
  selected: string
  /** clé de maison → nom du personnage qui la tient */
  taken: Record<string, string>
  onPick: (key: string) => void
}) {
  return (
    <div>
      {housesByRegion().map(({ region, houses }) => (
        <div key={region}>
          <div className="region-h">{region}</div>
          <div className="houses">
            {houses.map((h) => {
              const locked = !!taken[h.key] && h.key !== selected && h.key !== FREE_HOUSE_KEY
              if (locked) {
                return (
                  <div
                    key={h.key}
                    className="house locked"
                    style={{ ['--seal' as string]: h.col }}
                    title={`Tenue par ${taken[h.key]}`}
                  >
                    <Seal house={h.key} size="md" />
                    <span className="nm">{h.nom}</span>
                    <span className="lockmark">occupée</span>
                  </div>
                )
              }
              return (
                <button
                  key={h.key}
                  type="button"
                  className={`house${h.key === selected ? ' on' : ''}`}
                  style={{ ['--seal' as string]: h.col }}
                  onClick={() => onPick(h.key)}
                >
                  <Seal house={h.key} size="md" />
                  <span className="nm">{h.nom}</span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
