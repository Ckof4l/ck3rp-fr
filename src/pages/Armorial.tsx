import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { housesByRegion, FREE_HOUSE_KEY, rkStyle } from '../lib/houses'
import { listPlayers, holdersByHouse } from '../lib/directory'
import { Seal } from '../components/Seal'
import type { Profile } from '../types/database'

/* ============================================================================
   Armorial des Sept Royaumes — toutes les maisons, par région, avec leur
   devise et le joueur qui les tient (ou « Libre »).
   ========================================================================== */

export function Armorial() {
  const [holders, setHolders] = useState<Record<string, Profile>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listPlayers().then((ps) => {
      setHolders(holdersByHouse(ps))
      setLoading(false)
    })
  }, [])

  return (
    <section>
      <h2 className="section-h">📜 Armorial des Sept Royaumes</h2>
      <p className="channel-desc">Toutes les maisons du jeu, leur devise, et qui les tient.</p>

      {housesByRegion().map(({ region, houses }) => (
        <div key={region} style={{ marginBottom: 22 }}>
          <h3 className="section-h" style={{ fontSize: 12 }}>{region}</h3>
          <div className="armorial-grid">
            {houses
              .filter((h) => h.key !== FREE_HOUSE_KEY)
              .map((h) => {
                const holder = holders[h.key]
                const body = (
                  <>
                    <Seal house={h.key} size="lg" />
                    <div style={{ minWidth: 0 }}>
                      <div className="armorial-name">Maison {h.nom}</div>
                      <div className="armorial-devise">« {h.devise} »</div>
                      {loading ? (
                        <div className="armorial-holder muted">…</div>
                      ) : holder ? (
                        <div className="armorial-holder held">
                          {holder.is_king ? '👑 ' : ''}
                          {holder.character_name}
                        </div>
                      ) : (
                        <div className="armorial-holder free">Libre</div>
                      )}
                    </div>
                  </>
                )
                // Fiche entièrement cliquable vers le profil quand un joueur la tient.
                return holder ? (
                  <Link key={h.key} to={`/personnage/${holder.id}`} className="armorial-card linked" style={rkStyle(h.key)}>
                    {body}
                  </Link>
                ) : (
                  <div key={h.key} className="armorial-card" style={rkStyle(h.key)}>{body}</div>
                )
              })}
          </div>
        </div>
      ))}
    </section>
  )
}
