import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getHouse } from '../lib/houses'
import { fmtDate } from '../lib/format'
import { supabase } from '../lib/supabase'
import { listPolls, createPoll, castVote, closePoll, deletePoll, type Poll } from '../lib/polls'
import { Seal } from '../components/Seal'
import { HelpCard } from '../components/HelpCard'

/* ============================================================================
   Scrutins — les grands votes du royaume. Un Mestre ouvre, chacun vote une fois.
   ========================================================================== */

export function Scrutins() {
  const { profile } = useAuth()
  const meId = profile!.id
  const isAdmin = !!profile?.is_admin
  const canVote = !profile?.is_observer

  const [polls, setPolls] = useState<Poll[]>([])
  const [loading, setLoading] = useState(true)
  const [composing, setComposing] = useState(false)

  const refresh = useCallback(async () => {
    setPolls(await listPolls(meId))
    setLoading(false)
  }, [meId])

  useEffect(() => {
    refresh()
    const ch = supabase
      .channel('polls')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'polls' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_votes' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_options' }, () => refresh())
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [refresh])

  return (
    <section>
      <h2 className="section-h">🗳️ Scrutins du royaume</h2>
      <p className="channel-desc">Les grands votes : alliances, guerres, lois du royaume. Chacun n'a qu'une voix.</p>

      <HelpCard id="scrutins" title="Les Scrutins — comment ça marche ?">
        <ul>
          <li>Un <b>Mestre</b> ouvre un scrutin avec ses choix.</li>
          <li>Chaque joueur dispose d'<b>une seule voix</b> ; tu peux changer ton vote tant que le scrutin est ouvert.</li>
          <li>Les résultats sont <b>publics</b> et se mettent à jour <b>en direct</b>.</li>
        </ul>
      </HelpCard>

      {isAdmin &&
        (composing ? (
          <PollForm onDone={async () => { setComposing(false); await refresh() }} onCancel={() => setComposing(false)} />
        ) : (
          <button className="btn-seal" style={{ marginBottom: 18 }} onClick={() => setComposing(true)}>
            ✒️ Ouvrir un scrutin
          </button>
        ))}

      {loading ? (
        <div className="empty">Dépouillement en cours…</div>
      ) : !polls.length ? (
        <div className="empty">Aucun scrutin pour l'instant.</div>
      ) : (
        <div className="feed">
          {polls.map((p) => (
            <PollCard
              key={p.id}
              poll={p}
              meId={meId}
              canVote={canVote}
              canManage={isAdmin || p.author_profile === meId}
              onChanged={refresh}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function PollCard({
  poll,
  meId,
  canVote,
  canManage,
  onChanged,
}: {
  poll: Poll
  meId: string
  canVote: boolean
  canManage: boolean
  onChanged: () => void
}) {
  const h = getHouse(poll.author?.house)
  const open = poll.status === 'open'
  const [busy, setBusy] = useState(false)

  async function vote(optionId: string) {
    if (!open || !canVote || busy) return
    setBusy(true)
    try {
      await castVote(poll.id, optionId, meId)
      await onChanged()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Vote impossible.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card" style={{ marginBottom: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <h3 className="pact-title" style={{ margin: 0 }}>{poll.title}</h3>
        <span className={`tk-badge ${open ? 'wait' : 'no'}`}>{open ? '🗳️ Ouvert' : '🔒 Clos'}</span>
        <span style={{ marginLeft: 'auto', color: '#9C8F71', fontSize: 12 }}>{fmtDate(poll.created_at)}</span>
      </div>
      {poll.description && <p className="pact-body" style={{ marginTop: 6 }}>{poll.description}</p>}

      <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
        {poll.options.map((o) => {
          const n = poll.counts[o.id] ?? 0
          const pct = poll.total ? Math.round((n / poll.total) * 100) : 0
          const mine = poll.myChoice === o.id
          return (
            <button
              key={o.id}
              onClick={() => vote(o.id)}
              disabled={!open || !canVote || busy}
              className="vote-option"
              style={{
                position: 'relative',
                textAlign: 'left',
                padding: '10px 12px',
                borderRadius: 8,
                border: `1px solid ${mine ? 'var(--gold)' : 'var(--line)'}`,
                background: 'transparent',
                overflow: 'hidden',
                cursor: open && canVote ? 'pointer' : 'default',
                color: 'inherit',
                font: 'inherit',
              }}
            >
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: `${pct}%`,
                  background: mine ? '#c9a24b33' : '#ffffff10',
                  transition: 'width .3s ease',
                }}
              />
              <span style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span>{mine ? '✓ ' : ''}{o.label}</span>
                <span style={{ color: '#C7B894', whiteSpace: 'nowrap' }}>{n} · {pct}%</span>
              </span>
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
        <span style={{ color: '#9C8F71', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Seal house={poll.author?.house} size="sm" /> Ouvert par {poll.author?.character_name ?? 'un mestre'} · Maison {h.nom} · {poll.total} voix
        </span>
        {!canVote && <span className="hint" style={{ margin: 0 }}>Mode observateur — lecture seule.</span>}
        {canManage && (
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {open && (
              <button className="tiny" onClick={() => closePoll(poll.id).then(onChanged)}>🔒 Clore</button>
            )}
            <button
              className="tiny danger"
              onClick={() => confirm('Supprimer ce scrutin et tous ses votes ?') && deletePoll(poll.id).then(onChanged)}
            >
              🗑️ Supprimer
            </button>
          </span>
        )}
      </div>
    </div>
  )
}

function PollForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [options, setOptions] = useState<string[]>(['', ''])
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')

  function setOpt(i: number, v: string) {
    setOptions((prev) => prev.map((o, j) => (j === i ? v : o)))
  }

  async function submit() {
    const clean = options.map((o) => o.trim()).filter(Boolean)
    if (!title.trim()) return setStatus('Donne un titre au scrutin.')
    if (clean.length < 2) return setStatus('Il faut au moins deux choix.')
    setBusy(true)
    try {
      await createPoll(title, description, clean)
      onDone()
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Échec.')
      setBusy(false)
    }
  }

  return (
    <div className="composer" style={{ marginBottom: 22 }}>
      <div className="field">
        <label>Question du scrutin</label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ex. Faut-il déclarer la guerre aux Lannister ?" />
      </div>
      <div className="field">
        <label>Précisions (facultatif)</label>
        <textarea className="input" style={{ minHeight: 70 }} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Contexte, enjeux…" />
      </div>
      <div className="field">
        <label>Choix</label>
        {options.map((o, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            <input className="input" style={{ flex: 1 }} value={o} onChange={(e) => setOpt(i, e.target.value)} placeholder={`Choix ${i + 1}`} />
            {options.length > 2 && (
              <button className="tiny danger" type="button" onClick={() => setOptions((prev) => prev.filter((_, j) => j !== i))}>✕</button>
            )}
          </div>
        ))}
        {options.length < 8 && (
          <button className="tiny" type="button" onClick={() => setOptions((prev) => [...prev, ''])}>+ Ajouter un choix</button>
        )}
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
        <button className="btn-seal" disabled={busy} onClick={submit}>🗳️ Ouvrir le scrutin</button>
        <button className="btn-ghost" disabled={busy} onClick={onCancel}>Annuler</button>
        {status && <span className="sent-ok">{status}</span>}
      </div>
    </div>
  )
}
