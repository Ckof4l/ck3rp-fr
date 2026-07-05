import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { HOUSES, getHouse, regionColor, rkStyle } from '../lib/houses'
import { CHANNELS } from '../lib/channels'
import { listPlayers, holdersByHouse } from '../lib/directory'
import type { Profile } from '../types/database'
import { Seal } from '../components/Seal'

/* ============================================================================
   Le Recensement — l'état du royaume en chiffres : joueurs par royaume,
   couronnes en place, maisons tenues, activité des salons.
   ========================================================================== */

interface Totals {
  posts: number
  comments: number
  chronicles: number
  byChannel: Record<string, number>
}

async function countRows(table: string, channel?: string): Promise<number> {
  let q = supabase.from(table).select('*', { count: 'exact', head: true })
  if (channel) q = q.eq('channel', channel)
  const { count } = await q
  return count ?? 0
}

export function Recensement() {
  const [players, setPlayers] = useState<Profile[]>([])
  const [totals, setTotals] = useState<Totals | null>(null)

  useEffect(() => {
    listPlayers().then(setPlayers)
    const regions = CHANNELS.filter((c) => c.kind === 'region')
    Promise.all([
      countRows('posts'),
      countRows('post_comments'),
      countRows('chronicles'),
      ...regions.map((c) => countRows('posts', c.key)),
    ]).then(([posts, comments, chronicles, ...per]) => {
      const byChannel: Record<string, number> = {}
      regions.forEach((c, i) => {
        byChannel[c.key] = per[i]
      })
      setTotals({ posts, comments, chronicles, byChannel })
    })
  }, [])

  // Citoyens du royaume : inscrits, hors observateurs.
  const citizens = useMemo(() => players.filter((p) => p.onboarded && !p.is_observer), [players])
  const kings = useMemo(() => citizens.filter((p) => p.is_king), [citizens])
  const holders = useMemo(() => holdersByHouse(players), [players])
  const totalHouses = Object.keys(HOUSES).length - 1 // hors « autre »

  const byRegion = useMemo(() => {
    const map: Record<string, number> = {}
    for (const p of citizens) {
      const region = getHouse(p.house).region
      map[region] = (map[region] ?? 0) + 1
    }
    const regions = CHANNELS.filter((c) => c.kind === 'region')
    return regions.map((c) => ({
      channel: c,
      players: map[c.region!] ?? 0,
      letters: totals?.byChannel[c.key] ?? 0,
    }))
  }, [citizens, totals])

  const maxPlayers = Math.max(1, ...byRegion.map((r) => r.players))

  if (!players.length && !totals) return <div className="empty">Les Mestres comptent les têtes…</div>

  return (
    <section>
      <h2 className="section-h">📊 Le Recensement du Royaume</h2>
      <p className="channel-desc">Ce que les registres de la Citadelle disent des Sept Royaumes, tenus à jour à l'instant.</p>

      <div className="census-grid">
        <div className="card census-stat">
          <div className="census-n">{citizens.length}</div>
          <div className="census-l">Joueurs inscrits</div>
        </div>
        <div className="card census-stat">
          <div className="census-n">{totals?.posts ?? '…'}</div>
          <div className="census-l">Lettres publiées</div>
        </div>
        <div className="card census-stat">
          <div className="census-n">{totals?.comments ?? '…'}</div>
          <div className="census-l">Commentaires</div>
        </div>
        <div className="card census-stat">
          <div className="census-n">{totals?.chronicles ?? '…'}</div>
          <div className="census-l">Chroniques</div>
        </div>
        <div className="card census-stat">
          <div className="census-n">{Object.keys(holders).length}<span className="census-sub">/{totalHouses}</span></div>
          <div className="census-l">Maisons tenues</div>
        </div>
      </div>

      <h3 className="section-h" style={{ fontSize: 12, marginTop: 28 }}>🏰 Par royaume</h3>
      <div className="card" style={{ padding: 16 }}>
        {byRegion.map(({ channel, players: n, letters }) => (
          <Link key={channel.key} to={`/c/${channel.key}`} className="census-row">
            <img className="census-blason" src={`/blasons/regions/${channel.key}.png?v=4`} alt="" />
            <span className="census-region">{channel.name}</span>
            <span className="census-bar-track">
              <span
                className="census-bar"
                style={{ width: `${(n / maxPlayers) * 100}%`, background: regionColor(channel.region) }}
              />
            </span>
            <span className="census-count">
              {n} joueur{n > 1 ? 's' : ''} · {letters} lettre{letters > 1 ? 's' : ''}
            </span>
          </Link>
        ))}
      </div>

      <h3 className="section-h" style={{ fontSize: 12, marginTop: 28 }}>👑 Les couronnes en place</h3>
      {!kings.length ? (
        <div className="empty">Aucun trône n'est occupé. Les couronnes attendent.</div>
      ) : (
        <div className="ravens">
          {kings.map((k) => (
            <Link key={k.id} to={`/personnage/${k.id}`} className="raven-row" style={rkStyle(k.house)}>
              <Seal house={k.house} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div>
                  <b>{k.character_name}</b> <span className="badge king">👑 Roi</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                  Maison {getHouse(k.house).nom} · {getHouse(k.house).region}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
