import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getHouse } from '../lib/houses'
import { getChannel, playerRealm } from '../lib/channels'
import { fmtDate } from '../lib/format'
import { supabase } from '../lib/supabase'
import { listPolls, createPoll, castVote, closePoll, deletePoll, validatePoll, type Poll } from '../lib/polls'
import { Seal } from '../components/Seal'
import { CharLink } from '../components/CharLink'
import { HelpCard } from '../components/HelpCard'

/* ============================================================================
   Scrutins par royaume. Le Roi ouvre, son royaume vote, résultats scellés
   jusqu'à la clôture (compte à rebours).
   ========================================================================== */

function realmName(key: string): string {
  return getChannel(key)?.name ?? key
}
function realmIcon(key: string): string {
  return getChannel(key)?.icon ?? '🏰'
}

function countdown(closesAt: string, now: number): string {
  let s = Math.max(0, Math.floor((new Date(closesAt).getTime() - now) / 1000))
  if (s <= 0) return 'clos'
  const d = Math.floor(s / 86400); s -= d * 86400
  const h = Math.floor(s / 3600); s -= h * 3600
  const m = Math.floor(s / 60); s -= m * 60
  if (d) return `${d}j ${h}h`
  if (h) return `${h}h ${m}m`
  if (m) return `${m}m ${s}s`
  return `${s}s`
}

export function Scrutins() {
  const { profile } = useAuth()
  const meId = profile!.id
  const myRealm = playerRealm(profile)
  const isKing = !!profile?.is_king && !!myRealm
  const isAdmin = !!profile?.is_admin
  const notObserver = !profile?.is_observer
  // Peut voter à ce scrutin : non-observateur, et (global) ou (mon royaume).
  const canVotePoll = (p: Poll) => notObserver && (p.is_global || (!!myRealm && p.realm === myRealm))

  const [polls, setPolls] = useState<Poll[]>([])
  const [loading, setLoading] = useState(true)
  const [composing, setComposing] = useState(false)
  const [now, setNow] = useState(() => Date.now())

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

  // Horloge : fait avancer les comptes à rebours, et recharge quand un scrutin
  // vient d'atteindre sa clôture (pour révéler les votes).
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    if (polls.some((p) => !p.revealed && new Date(p.closes_at).getTime() <= now)) refresh()
  }, [now, polls, refresh])

  // Mon royaume d'abord, puis les autres ; récents en tête.
  const sorted = [...polls].sort((a, b) => {
    const am = a.realm === myRealm ? 0 : 1
    const bm = b.realm === myRealm ? 0 : 1
    if (am !== bm) return am - bm
    return b.created_at.localeCompare(a.created_at)
  })

  return (
    <section>
      <h2 className="section-h">🗳️ Scrutins des royaumes</h2>
      <p className="channel-desc">
        Chaque royaume vote ses grandes décisions. {myRealm ? <>Ton royaume : <b>{realmIcon(myRealm)} {realmName(myRealm)}</b>.</> : "Tu n'appartiens à aucun royaume."}
      </p>

      <HelpCard id="scrutins" title="Les Scrutins — comment ça marche ?">
        <ul>
          <li>Seul le <b>Roi</b> d'un royaume ouvre un scrutin, avec une <b>date de clôture</b>.</li>
          <li>Tu <b>votes</b> dans les scrutins de <b>ton</b> royaume (une voix, modifiable jusqu'à la clôture).</li>
          <li>Tu <b>vois</b> les scrutins des autres royaumes, mais tu n'y votes pas.</li>
          <li>Les résultats restent <b>scellés</b> jusqu'à la fin du compte à rebours, puis se révèlent.</li>
        </ul>
      </HelpCard>

      {(isKing || isAdmin) &&
        (composing ? (
          <PollForm
            realm={myRealm}
            canKingdom={isKing}
            canGlobal={isAdmin}
            onDone={async () => { setComposing(false); await refresh() }}
            onCancel={() => setComposing(false)}
          />
        ) : (
          <button className="btn-seal" style={{ marginBottom: 18 }} onClick={() => setComposing(true)}>
            ✒️ Ouvrir un scrutin
          </button>
        ))}

      {loading ? (
        <div className="empty">Dépouillement en cours…</div>
      ) : !sorted.length ? (
        <div className="empty">Aucun scrutin pour l'instant.</div>
      ) : (
        <div className="feed">
          {sorted.map((p) => (
            <PollCard
              key={p.id}
              poll={p}
              meId={meId}
              now={now}
              isAdmin={isAdmin}
              mineRealm={p.is_global || p.realm === myRealm}
              canVote={canVotePoll(p)}
              canManage={isAdmin || p.author_profile === meId}
              canDelete={isAdmin}
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
  now,
  isAdmin,
  mineRealm,
  canVote,
  canManage,
  canDelete,
  onChanged,
}: {
  poll: Poll
  meId: string
  now: number
  isAdmin: boolean
  mineRealm: boolean
  canVote: boolean
  canManage: boolean
  canDelete: boolean
  onChanged: () => void
}) {
  const h = getHouse(poll.author?.house)
  const [busy, setBusy] = useState(false)
  const winner = poll.revealed ? poll.options.reduce<string | null>((best, o) => (
    (poll.counts[o.id] ?? 0) > (best ? poll.counts[best] ?? 0 : -1) ? o.id : best
  ), null) : null

  async function vote(optionId: string) {
    if (!canVote || !poll.open || busy) return
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
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span className="kicker" style={{ fontSize: 11 }}>
          {poll.is_global ? '🌍 Tous les royaumes' : `${realmIcon(poll.realm)} ${realmName(poll.realm)}`}
        </span>
        <span className="tk-badge" style={{ background: poll.is_hrp ? '#2a2f3a' : '#2f2a22', color: poll.is_hrp ? '#9DB4D0' : '#D8C088' }}>
          {poll.is_hrp ? 'HRP' : 'RP'}
        </span>
        <h3 className="pact-title" style={{ margin: 0 }}>{poll.title}</h3>
        {poll.status === 'pending' ? (
          <span className="tk-badge wait">⏳ En attente d'un Mestre</span>
        ) : poll.status === 'refused' ? (
          <span className="tk-badge no">✗ Refusé par un Mestre</span>
        ) : poll.open ? (
          <span className="tk-badge wait">🔒 Scellé · {countdown(poll.closes_at, now)}</span>
        ) : (
          <span className="tk-badge ok">✓ Dépouillé</span>
        )}
        <span style={{ marginLeft: 'auto', color: '#9C8F71', fontSize: 12 }}>{fmtDate(poll.created_at)}</span>
      </div>
      {poll.description && <p className="pact-body" style={{ marginTop: 6 }}>{poll.description}</p>}

      <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
        {poll.options.map((o) => {
          const n = poll.counts[o.id] ?? 0
          const pct = poll.total ? Math.round((n / poll.total) * 100) : 0
          const mine = poll.myChoice === o.id
          const win = winner === o.id
          const clickable = canVote && poll.open
          return (
            <button
              key={o.id}
              onClick={() => vote(o.id)}
              disabled={!clickable || busy}
              style={{
                position: 'relative', textAlign: 'left', padding: '10px 12px', borderRadius: 8,
                border: `1px solid ${mine || win ? 'var(--gold)' : 'var(--line)'}`,
                background: 'transparent', overflow: 'hidden',
                cursor: clickable ? 'pointer' : 'default', color: 'inherit', font: 'inherit',
              }}
            >
              {poll.revealed && (
                <span aria-hidden style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: win ? '#c9a24b33' : '#ffffff10', transition: 'width .3s ease' }} />
              )}
              <span style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span>{mine ? '✓ ' : win ? '👑 ' : ''}{o.label}</span>
                {poll.revealed && <span style={{ color: '#C7B894', whiteSpace: 'nowrap' }}>{n} · {pct}%</span>}
              </span>
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
        <span style={{ color: '#9C8F71', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Seal house={poll.author?.house} size="sm" /> Ouvert par <CharLink id={poll.author_profile}>{poll.author?.character_name ?? 'le Roi'}</CharLink> · Maison {h.nom}
          {poll.revealed && <> · {poll.total} voix</>}
        </span>
        {!poll.revealed && !mineRealm && <span className="hint" style={{ margin: 0 }}>👁️ Autre royaume — lecture seule.</span>}
        {!poll.revealed && mineRealm && poll.open && !canVote && <span className="hint" style={{ margin: 0 }}>Observateur — lecture seule.</span>}
        {!poll.revealed && mineRealm && poll.open && canVote && (
          <span style={{ color: '#C7B894', fontSize: 12 }}>{poll.hasVoted ? '✓ Ton vote est enregistré (modifiable).' : 'Clique un choix pour voter.'}</span>
        )}
        {(canManage || canDelete || (isAdmin && poll.status === 'pending')) && (
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {isAdmin && poll.status === 'pending' && (
              <>
                <button className="tiny good" onClick={() => validatePoll(poll.id, true).then(onChanged)}>✓ Valider</button>
                <button className="tiny danger" onClick={() => validatePoll(poll.id, false).then(onChanged)}>✗ Refuser</button>
              </>
            )}
            {canManage && poll.open && <button className="tiny" onClick={() => closePoll(poll.id).then(onChanged)}>🔓 Clore & révéler</button>}
            {canDelete && <button className="tiny danger" onClick={() => confirm('Supprimer ce scrutin et ses votes ?') && deletePoll(poll.id).then(onChanged)}>🗑️ Supprimer</button>}
          </span>
        )}
      </div>
    </div>
  )
}

function PollForm({
  realm,
  canKingdom,
  canGlobal,
  onDone,
  onCancel,
}: {
  realm: string | null
  canKingdom: boolean
  canGlobal: boolean
  onDone: () => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isGlobal, setIsGlobal] = useState(canGlobal && !canKingdom)
  const [isHrp, setIsHrp] = useState(false)
  const [options, setOptions] = useState<string[]>(['', ''])
  const [closesAt, setClosesAt] = useState(() => {
    const d = new Date(Date.now() + 24 * 3600 * 1000)
    d.setSeconds(0, 0)
    // Format local YYYY-MM-DDTHH:mm pour l'input datetime-local.
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  })
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')

  function setOpt(i: number, v: string) {
    setOptions((prev) => prev.map((o, j) => (j === i ? v : o)))
  }

  async function submit() {
    const clean = options.map((o) => o.trim()).filter(Boolean)
    if (!title.trim()) return setStatus('Donne un titre au scrutin.')
    if (clean.length < 2) return setStatus('Il faut au moins deux choix.')
    const iso = new Date(closesAt).toISOString()
    if (new Date(iso).getTime() <= Date.now()) return setStatus('La clôture doit être dans le futur.')
    if (isGlobal && !canGlobal) return setStatus('Réservé aux Mestres.')
    if (!isGlobal && (!canKingdom || !realm)) return setStatus("Tu ne peux pas ouvrir de scrutin de royaume.")
    setBusy(true)
    try {
      await createPoll(title, description, clean, iso, isGlobal, isHrp)
      onDone()
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Échec.')
      setBusy(false)
    }
  }

  return (
    <div className="composer" style={{ marginBottom: 22 }}>
      {canKingdom && canGlobal && (
        <div className="field">
          <label>Portée</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className={isGlobal ? 'tiny' : 'tiny good'} onClick={() => setIsGlobal(false)}>
              {realm ? `${realmIcon(realm)} ${realmName(realm)}` : 'Mon royaume'}
            </button>
            <button type="button" className={isGlobal ? 'tiny good' : 'tiny'} onClick={() => setIsGlobal(true)}>🌍 Tous les royaumes</button>
          </div>
        </div>
      )}
      <div className="field">
        <label>Étiquette</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className={isHrp ? 'tiny' : 'tiny good'} onClick={() => setIsHrp(false)}>RP</button>
          <button type="button" className={isHrp ? 'tiny good' : 'tiny'} onClick={() => setIsHrp(true)}>HRP</button>
        </div>
      </div>
      <div className="field">
        <label>Question {isGlobal ? '(tous les royaumes)' : realm ? `(royaume : ${realmName(realm)})` : ''}</label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ex. Faut-il rejoindre la guerre du Nord ?" />
      </div>
      <div className="field">
        <label>Précisions (facultatif)</label>
        <textarea className="input" style={{ minHeight: 70 }} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Contexte, enjeux…" />
      </div>
      <div className="field">
        <label>Clôture (les résultats se révèlent à cette date)</label>
        <input className="input" type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
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
