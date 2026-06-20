import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getHouse } from '../lib/houses'
import { fmtDate } from '../lib/format'
import { supabase } from '../lib/supabase'
import { listDuels, createDuel, resolveDuel, cancelDuel, deleteDuel, type Duel } from '../lib/duels'
import { listPlayers } from '../lib/directory'
import type { Profile } from '../types/database'
import { Seal } from '../components/Seal'
import { CharLink } from '../components/CharLink'
import { HelpCard } from '../components/HelpCard'

/* ============================================================================
   Le Sort — duel à pile ou face entre deux joueurs. Challenger = Pile.
   ========================================================================== */

export function Sort() {
  const { profile } = useAuth()
  const meId = profile!.id
  const isAdmin = !!profile?.is_admin
  const canPlay = !profile?.is_observer
  const [params, setParams] = useSearchParams()
  const defi = params.get('defi')

  const [duels, setDuels] = useState<Duel[]>([])
  const [players, setPlayers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setDuels(await listDuels())
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    listPlayers().then(setPlayers)
    const ch = supabase
      .channel('duels')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'duels' }, () => refresh())
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [refresh])

  const incoming = duels.filter((d) => d.status === 'pending' && d.opponent === meId)
  const outgoing = duels.filter((d) => d.status === 'pending' && d.challenger === meId)
  const resolved = duels.filter((d) => d.status !== 'pending')

  return (
    <section>
      <h2 className="section-h">🪙 Le Sort · duel à pile ou face</h2>
      <p className="channel-desc">Trancher un différend au hasard, entre deux mains. La pièce est lancée par le destin lui-même.</p>

      <HelpCard id="sort" title="Le Sort — comment ça marche ?">
        <ul>
          <li>Tu <b>défies un joueur précis</b> (avec un enjeu si tu veux).</li>
          <li>L'adversaire <b>accepte</b> (la pièce est alors lancée par le serveur) ou <b>refuse</b>.</li>
          <li>À l'acceptation, les côtés <b>Pile / Face sont tirés au hasard</b> entre les deux joueurs, puis la pièce désigne le vainqueur.</li>
          <li>Tirage <b>infalsifiable</b> et registre <b>public</b>.</li>
        </ul>
      </HelpCard>

      {canPlay ? (
        <ChallengeForm
          meId={meId}
          players={players}
          initialOpponent={defi}
          onConsumeInitial={() => { params.delete('defi'); setParams(params, { replace: true }) }}
          onDone={refresh}
        />
      ) : (
        <p className="hint">Mode observateur — tu peux lire le registre mais pas défier.</p>
      )}

      {incoming.length > 0 && (
        <>
          <h3 className="section-h" style={{ fontSize: 12, marginTop: 8 }}>⚔️ Défis reçus</h3>
          <div className="ravens" style={{ marginBottom: 18 }}>
            {incoming.map((d) => (
              <IncomingDuel key={d.id} duel={d} onChanged={refresh} />
            ))}
          </div>
        </>
      )}

      {outgoing.length > 0 && (
        <>
          <h3 className="section-h" style={{ fontSize: 12 }}>⏳ Défis lancés</h3>
          <div className="ravens" style={{ marginBottom: 18 }}>
            {outgoing.map((d) => (
              <div key={d.id} className="report-card" style={{ borderColor: 'var(--line)' }}>
                <DuelLine duel={d} />
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
                  <span style={{ color: '#9C8F71', fontSize: 12 }}>En attente de la réponse de l'adversaire…</span>
                  <button className="tiny danger" style={{ marginLeft: 'auto' }} onClick={() => cancelDuel(d.id).then(refresh)}>✖ Annuler</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <h3 className="section-h" style={{ fontSize: 12 }}>📜 Registre des duels</h3>
      {loading ? (
        <div className="empty">Ouverture du registre…</div>
      ) : !resolved.length ? (
        <div className="empty">Aucun duel tranché pour l'instant.</div>
      ) : (
        <div className="ravens">
          {resolved.map((d) => (
            <div key={d.id} className="report-card" style={{ borderColor: 'var(--line)' }}>
              <DuelLine duel={d} />
              {d.status === 'declined' ? (
                <div style={{ color: '#9C8F71', fontSize: 13, marginTop: 6 }}>🚫 Défi refusé.</div>
              ) : (
                <div style={{ marginTop: 6, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--display)', fontSize: 18, color: 'var(--gold)' }}>🪙 {d.result}</span>
                  <span style={{ color: '#E7DBBE' }}>
                    Vainqueur : <b>{(d.winner === d.challenger ? d.challengerP : d.opponentP)?.character_name ?? '—'}</b>
                  </span>
                </div>
              )}
              <div style={{ color: '#9C8F71', fontSize: 12, marginTop: 4 }}>{fmtDate(d.resolved_at ?? d.created_at)}</div>
              {isAdmin && (
                <button className="tiny danger" style={{ marginTop: 8 }} onClick={() => deleteDuel(d.id).then(refresh)}>🗑️ Retirer</button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

/** Ligne du duel. Les côtés Pile/Face ne s'affichent qu'une fois tirés (à la
    résolution) — avant, ils ne sont pas encore attribués. */
function DuelLine({ duel }: { duel: Duel }) {
  const assigned = !!duel.pile_profile
  const pileIsChal = duel.pile_profile === duel.challenger
  const left = assigned && !pileIsChal ? duel.opponentP : duel.challengerP
  const leftId = assigned && !pileIsChal ? duel.opponent : duel.challenger
  const right = leftId === duel.challenger ? duel.opponentP : duel.challengerP
  const rightId = leftId === duel.challenger ? duel.opponent : duel.challenger
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <Seal house={left?.house} size="sm" />
      <span style={{ color: '#E7DBBE' }}><CharLink id={leftId}>{left?.character_name ?? 'Inconnu'}</CharLink></span>
      {assigned && <span className="kicker" style={{ fontSize: 11 }}>Pile</span>}
      <span style={{ color: '#9C8F71' }}>⚔️</span>
      <Seal house={right?.house} size="sm" />
      <span style={{ color: '#E7DBBE' }}><CharLink id={rightId}>{right?.character_name ?? 'Inconnu'}</CharLink></span>
      {assigned && <span className="kicker" style={{ fontSize: 11 }}>Face</span>}
      {duel.reason && <span style={{ fontStyle: 'italic', color: '#9C8F71', fontSize: 12, width: '100%' }}>« {duel.reason} »</span>}
    </div>
  )
}

function IncomingDuel({ duel, onChanged }: { duel: Duel; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)

  async function respond(accept: boolean) {
    setBusy(true)
    try {
      await resolveDuel(duel.id, accept)
      await onChanged()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Action impossible.')
      setBusy(false)
    }
  }

  return (
    <div className="report-card" style={{ borderColor: 'var(--gold-dim)' }}>
      <DuelLine duel={duel} />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button className="btn-seal" disabled={busy} onClick={() => respond(true)}>🪙 Accepter & lancer</button>
        <button className="btn-ghost" disabled={busy} onClick={() => respond(false)}>Refuser</button>
      </div>
    </div>
  )
}

function ChallengeForm({
  meId,
  players,
  initialOpponent,
  onConsumeInitial,
  onDone,
}: {
  meId: string
  players: Profile[]
  initialOpponent?: string | null
  onConsumeInitial?: () => void
  onDone: () => void
}) {
  const [opponent, setOpponent] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')

  const others = players.filter((p) => p.id !== meId)

  // Pré-sélection depuis « Défier au Sort » sur une fiche de personnage.
  useEffect(() => {
    if (initialOpponent && initialOpponent !== meId && others.some((p) => p.id === initialOpponent)) {
      setOpponent(initialOpponent)
      onConsumeInitial?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOpponent, players])

  async function submit() {
    if (!opponent) return setStatus('Choisis un adversaire.')
    setBusy(true)
    setStatus('')
    try {
      await createDuel(opponent, reason)
      setOpponent('')
      setReason('')
      onDone()
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Échec.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="composer" style={{ marginBottom: 22 }}>
      <div className="field">
        <label>Adversaire</label>
        <select className="input" value={opponent} onChange={(e) => setOpponent(e.target.value)}>
          <option value="">— Choisis un joueur —</option>
          {others.map((p) => (
            <option key={p.id} value={p.id}>
              {p.character_name} ({getHouse(p.house).nom})
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Enjeu du duel (facultatif)</label>
        <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="ex. Le contrôle du péage du Trident" />
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
        <button className="btn-seal" disabled={busy} onClick={submit}>🪙 Lancer le défi</button>
        {status && <span className="sent-ok">{status}</span>}
      </div>
    </div>
  )
}
