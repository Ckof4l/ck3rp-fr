import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getHouse, rkStyle } from '../lib/houses'
import { fmtDate } from '../lib/format'
import { listPlayers } from '../lib/directory'
import { Seal } from '../components/Seal'
import type { Profile } from '../types/database'

/* ============================================================================
   La Cour — liste publique des joueurs et de leurs personnages.
   ========================================================================== */

export function Cour() {
  const [players, setPlayers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listPlayers().then((ps) => {
      setPlayers(ps)
      setLoading(false)
    })
  }, [])

  return (
    <section>
      <h2 className="section-h">👥 La Cour · les joueurs</h2>
      <p className="channel-desc">
        {loading ? 'Appel des mestres…' : `${players.length} mestre(s) prêtent serment dans les Sept Royaumes.`}
      </p>

      <div className="ravens">
        {players.map((p) => {
          const h = getHouse(p.house)
          return (
            <Link key={p.id} to={`/personnage/${p.id}`} className="raven-row" style={{ textDecoration: 'none', ...rkStyle(p.house) }}>
              <Seal house={p.house} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ color: '#E7DBBE', fontSize: 15 }}>{p.character_name}</span>
                  {p.is_king && <span className="badge king">👑 Roi</span>}
                  {p.is_founder ? (
                    <span className="badge gm">Grand Mestre</span>
                  ) : (
                    p.is_admin && <span className="badge">Mestre</span>
                  )}
                  {p.is_observer && <span className="badge obs">Observateur</span>}
                </div>
                <div style={{ color: '#9C8F71', fontSize: 12 }}>
                  Maison {h.nom} · {h.region} · en jeu depuis le {fmtDate(p.created_at)}
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
