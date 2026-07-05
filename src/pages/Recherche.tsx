import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { HOUSES, getHouse, rkStyle, type House } from '../lib/houses'
import { getChannel } from '../lib/channels'
import { listPlayers, holdersByHouse } from '../lib/directory'
import { fmtDate } from '../lib/format'
import type { Profile } from '../types/database'
import { Seal } from '../components/Seal'

/* ============================================================================
   Recherche — un seul champ qui fouille tout le royaume : maisons (armorial),
   joueurs (la cour), lettres des salons et chroniques.
   ========================================================================== */

interface FoundPost {
  id: string
  channel: string
  title: string | null
  body: string
  created_at: string
  author?: { id: string; character_name: string; house: string } | null
}

interface FoundChronicle {
  id: string
  title: string
  body: string
  event_date: string | null
  created_at: string
}

/** Extrait ~120 caractères autour de la première occurrence (aperçu contextuel). */
function excerptAround(body: string, needle: string): string {
  const i = body.toLowerCase().indexOf(needle.toLowerCase())
  const start = Math.max(0, (i < 0 ? 0 : i) - 40)
  const s = body.replace(/\s+/g, ' ').slice(start, start + 140).trim()
  return (start > 0 ? '…' : '') + s + (start + 140 < body.length ? '…' : '')
}

export function Recherche() {
  const [q, setQ] = useState('')
  const [players, setPlayers] = useState<Profile[]>([])
  const [posts, setPosts] = useState<FoundPost[]>([])
  const [chronicles, setChronicles] = useState<FoundChronicle[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    listPlayers().then(setPlayers)
  }, [])

  const needle = q.trim()

  // Les recherches distantes (lettres, chroniques) partent après une pause de
  // frappe ; les maisons et joueurs se filtrent en local, instantanément.
  useEffect(() => {
    if (needle.length < 2) {
      setPosts([])
      setChronicles([])
      return
    }
    const t = setTimeout(async () => {
      setBusy(true)
      // Motif ilike : on neutralise la syntaxe PostgREST (virgules) et les
      // jokers, et chaque espace devient un joker (recherche de séquence).
      const pat = '%' + needle.replace(/[%_,()]/g, ' ').trim().split(/\s+/).join('%') + '%'
      const [p, c] = await Promise.all([
        supabase
          .from('posts')
          .select('id, channel, title, body, created_at, author:profiles!posts_author_profile_fkey(id, character_name, house)')
          .or(`title.ilike.${pat},body.ilike.${pat}`)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('chronicles')
          .select('id, title, body, event_date, created_at')
          .or(`title.ilike.${pat},body.ilike.${pat}`)
          .order('created_at', { ascending: false })
          .limit(8),
      ])
      setPosts((p.data as unknown as FoundPost[]) ?? [])
      setChronicles((c.data as unknown as FoundChronicle[]) ?? [])
      setBusy(false)
    }, 350)
    return () => clearTimeout(t)
  }, [needle])

  const holders = useMemo(() => holdersByHouse(players), [players])

  const foundHouses = useMemo<House[]>(() => {
    if (needle.length < 2) return []
    const n = needle.toLowerCase()
    return Object.values(HOUSES).filter(
      (h) => h.key !== 'autre' && (h.nom.toLowerCase().includes(n) || h.region.toLowerCase().includes(n) || h.devise.toLowerCase().includes(n)),
    ).slice(0, 12)
  }, [needle])

  const foundPlayers = useMemo<Profile[]>(() => {
    if (needle.length < 2) return []
    const n = needle.toLowerCase()
    return players
      .filter((p) => p.onboarded)
      .filter((p) => p.character_name.toLowerCase().includes(n) || getHouse(p.house).nom.toLowerCase().includes(n))
      .slice(0, 12)
  }, [needle, players])

  const nothing = needle.length >= 2 && !busy && !foundHouses.length && !foundPlayers.length && !posts.length && !chronicles.length

  return (
    <section>
      <h2 className="section-h">🔍 Recherche</h2>
      <p className="channel-desc">Maisons, joueurs, lettres des salons et chroniques — tout le royaume en un champ.</p>

      <input
        className="input"
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="ex. Baratheon, une devise, un nom de personnage, un mot d'une lettre…"
      />

      {needle.length < 2 ? (
        <div className="empty">Saisis au moins deux caractères.</div>
      ) : (
        <>
          {foundHouses.length > 0 && (
            <>
              <h3 className="section-h" style={{ fontSize: 12, marginTop: 24 }}>🛡️ Maisons</h3>
              <div className="ravens">
                {foundHouses.map((h) => {
                  const holder = holders[h.key]
                  const inner = (
                    <>
                      <Seal house={h.key} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div><b>Maison {h.nom}</b> · <span style={{ color: 'var(--muted)' }}>{h.region}</span></div>
                        <div style={{ color: 'var(--gold-dim)', fontStyle: 'italic', fontSize: 13 }}>« {h.devise} »</div>
                        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                          {holder ? <>Tenue par {holder.character_name}</> : 'Maison libre'}
                        </div>
                      </div>
                    </>
                  )
                  return holder ? (
                    <Link key={h.key} to={`/personnage/${holder.id}`} className="raven-row" style={rkStyle(h.key)}>
                      {inner}
                    </Link>
                  ) : (
                    <div key={h.key} className="raven-row" style={rkStyle(h.key)}>
                      {inner}
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {foundPlayers.length > 0 && (
            <>
              <h3 className="section-h" style={{ fontSize: 12, marginTop: 24 }}>🎭 Joueurs</h3>
              <div className="ravens">
                {foundPlayers.map((p) => (
                  <Link key={p.id} to={`/personnage/${p.id}`} className="raven-row" style={rkStyle(p.house)}>
                    <Seal house={p.house} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div>
                        <b>{p.character_name}</b>
                        {p.is_king && <span className="badge king" style={{ marginLeft: 8 }}>👑 Roi</span>}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--muted)' }}>Maison {getHouse(p.house).nom} · {getHouse(p.house).region}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}

          {posts.length > 0 && (
            <>
              <h3 className="section-h" style={{ fontSize: 12, marginTop: 24 }}>✉️ Lettres des salons</h3>
              <div className="ravens">
                {posts.map((p) => (
                  <Link key={p.id} to={`/c/${p.channel}?post=${p.id}`} className="raven-row" style={rkStyle(p.author?.house)}>
                    <Seal house={p.author?.house} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div>
                        {p.title ? <b>{p.title}</b> : <b>{p.author?.character_name ?? 'Inconnu'}</b>}
                        <span style={{ color: 'var(--muted)' }}> · {getChannel(p.channel)?.name ?? p.channel} · {fmtDate(p.created_at)}</span>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--muted)' }}>{excerptAround(p.body, needle)}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}

          {chronicles.length > 0 && (
            <>
              <h3 className="section-h" style={{ fontSize: 12, marginTop: 24 }}>📖 Chroniques</h3>
              <div className="ravens">
                {chronicles.map((c) => (
                  <Link key={c.id} to="/chroniques" className="raven-row">
                    <span className="si" style={{ fontSize: 22 }}>📖</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div><b>{c.title}</b> <span style={{ color: 'var(--muted)' }}>· {fmtDate(c.event_date ?? c.created_at)}</span></div>
                      <div style={{ fontSize: 13, color: 'var(--muted)' }}>{excerptAround(c.body, needle)}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}

          {busy && <div className="empty">Les Mestres fouillent les archives…</div>}
          {nothing && <div className="empty">Rien dans les archives pour « {needle} ».</div>}
        </>
      )}
    </section>
  )
}
