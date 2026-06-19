import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getHouse } from '../lib/houses'
import { getChannel } from '../lib/channels'
import { fmtDate } from '../lib/format'
import { getPlayer, listPlayerPosts, listPlayerGraves, type PlayerPost } from '../lib/directory'
import type { Grave } from '../lib/destin'
import type { Profile } from '../types/database'
import { Seal } from '../components/Seal'
import { ReportButton } from '../components/ReportButton'
import { ChannelIcon } from '../components/ChannelIcon'

/* ============================================================================
   Fiche de personnage — maison, devise, rôles, posts récents, anciens vies.
   ========================================================================== */

export function Personnage() {
  const { id } = useParams<{ id: string }>()
  const { profile: me } = useAuth()
  const navigate = useNavigate()
  const [player, setPlayer] = useState<Profile | null>(null)
  const [posts, setPosts] = useState<PlayerPost[]>([])
  const [graves, setGraves] = useState<Grave[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    let ignore = false
    setLoading(true)
    Promise.all([getPlayer(id), listPlayerPosts(id), listPlayerGraves(id)])
      .then(([p, ps, gs]) => {
        if (ignore) return
        setPlayer(p)
        setPosts(ps)
        setGraves(gs)
      })
      .catch(() => {
        if (!ignore) setPlayer(null)
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [id])

  if (loading) return <div className="empty">Ouverture du registre…</div>
  if (!player) return <div className="empty">Ce mestre est introuvable.</div>

  const h = getHouse(player.house)

  return (
    <section>
      <Link to="/joueurs" className="linkbtn">← La Cour</Link>

      <div className="card" style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginTop: 14 }}>
        <Seal house={player.house} size="xl" />
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--display)', fontSize: 22, color: 'var(--parch)' }}>
              {player.character_name}
            </span>
            {player.is_king && <span className="badge king">👑 Roi</span>}
            {player.is_founder ? (
              <span className="badge gm">Grand Mestre</span>
            ) : (
              player.is_admin && <span className="badge">Mestre</span>
            )}
            {player.is_observer && <span className="badge obs">Observateur</span>}
          </div>
          <div style={{ color: '#9C8F71', fontSize: 13, marginTop: 2 }}>
            Maison {h.nom} · {h.region}
          </div>
          {player.discord && (
            <div style={{ color: '#9C8F71', fontSize: 13, marginTop: 2 }}>
              <span style={{ color: '#7A8Fd0' }}>🎮 Discord :</span> {player.discord}
            </div>
          )}
          <div className="winter" style={{ marginTop: 6 }}>« {h.devise} »</div>
        </div>
      </div>

      {me && player.id !== me.id && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn-seal" onClick={() => navigate('/chancellerie?to=' + player.id)}>
            🐦‍⬛ Envoyer un corbeau
          </button>
          <ReportButton meId={me.id} targetType="profile" targetId={player.id} />
        </div>
      )}

      <h3 className="section-h" style={{ fontSize: 12, marginTop: 24 }}>Derniers écrits publics</h3>
      {posts.length ? (
        <div className="ravens">
          {posts.map((p) => {
            const c = getChannel(p.channel)
            return (
              <Link key={p.id} to={`/c/${p.channel}`} className="raven-row" style={{ textDecoration: 'none' }}>
                <ChannelIcon channel={c} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                    <span style={{ color: '#C7B894', fontSize: 13 }}>{c?.name ?? p.channel}</span>
                    <span style={{ marginLeft: 'auto', color: '#9C8F71', fontSize: 12 }}>{fmtDate(p.created_at)}</span>
                  </div>
                  {p.title && <div style={{ fontFamily: 'var(--display)', color: 'var(--parch)' }}>{p.title}</div>}
                  <div style={{ color: '#A99C7E', fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.body.slice(0, 100) || '(image)'}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="empty" style={{ padding: 24 }}>Aucun écrit public pour le moment.</div>
      )}

      {graves.length > 0 && (
        <>
          <h3 className="section-h" style={{ fontSize: 12, marginTop: 24 }}>⚰️ Vies passées</h3>
          <div className="ravens">
            {graves.map((g) => {
              const gh = getHouse(g.house)
              return (
                <div key={g.id} className="grave-row">
                  <Seal house={g.house} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#C7B894', fontSize: 15 }}>
                      {g.character_name} <span style={{ color: '#8E8268' }}>— Maison {gh.nom}</span>
                    </div>
                    {g.cause && <div style={{ color: '#8E8268', fontSize: 13, fontStyle: 'italic' }}>« {g.cause} »</div>}
                  </div>
                  <div style={{ color: '#8E8268', fontSize: 12, flex: 'none' }}>✝ {fmtDate(g.died_at)}</div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}
