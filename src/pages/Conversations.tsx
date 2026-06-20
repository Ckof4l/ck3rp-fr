import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getHouse } from '../lib/houses'
import { fmtDate } from '../lib/format'
import { supabase } from '../lib/supabase'
import { listPlayers } from '../lib/directory'
import {
  listConversations,
  createConversation,
  listMessages,
  sendMessage,
  deleteConversation,
  leaveConversation,
  listMembers,
  addMember,
  type Conversation,
  type ConvMessage,
  type ConvMember,
} from '../lib/conversations'
import type { Profile } from '../types/database'
import { Seal } from '../components/Seal'
import { CharLink } from '../components/CharLink'
import { HelpCard } from '../components/HelpCard'

/* ============================================================================
   Conversations — salons de discussion libres, publics ou privés.
   ========================================================================== */

export function Conversations() {
  const { profile } = useAuth()
  const meId = profile!.id
  const canCreate = !profile?.is_observer

  const [convs, setConvs] = useState<Conversation[]>([])
  const [players, setPlayers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)
  const [composing, setComposing] = useState(false)

  const refresh = useCallback(async () => {
    setConvs(await listConversations())
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    listPlayers().then(setPlayers)
    const ch = supabase
      .channel('conversations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_members' }, () => refresh())
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [refresh])

  const open = openId ? convs.find((c) => c.id === openId) : null
  if (open) {
    return (
      <ConversationView
        conv={open}
        meId={meId}
        players={players}
        canWrite={canCreate}
        isAdmin={!!profile?.is_admin}
        onBack={() => setOpenId(null)}
        onDeleted={() => { setOpenId(null); refresh() }}
      />
    )
  }

  return (
    <section>
      <h2 className="section-h">💬 Conversations</h2>
      <p className="channel-desc">Des salons de discussion libres : ouverts à tous, ou privés entre joueurs choisis.</p>

      <HelpCard id="conversations" title="Les Conversations — comment ça marche ?">
        <ul>
          <li><b>Publique</b> : visible et ouverte à tous les joueurs.</li>
          <li><b>Privée</b> : seuls les joueurs que tu invites la voient et y écrivent.</li>
          <li>Les messages arrivent <b>en temps réel</b>.</li>
        </ul>
      </HelpCard>

      {canCreate &&
        (composing ? (
          <CreateForm
            meId={meId}
            players={players}
            onDone={async (id) => { setComposing(false); await refresh(); if (id) setOpenId(id) }}
            onCancel={() => setComposing(false)}
          />
        ) : (
          <button className="btn-seal" style={{ marginBottom: 18 }} onClick={() => setComposing(true)}>
            ✒️ Ouvrir une conversation
          </button>
        ))}

      {loading ? (
        <div className="empty">Ouverture des salons…</div>
      ) : !convs.length ? (
        <div className="empty">Aucune conversation pour l'instant. Lance la première !</div>
      ) : (
        <div className="ravens">
          {convs.map((c) => {
            const h = getHouse(c.creatorP?.house)
            return (
              <button key={c.id} className="raven-row" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => setOpenId(c.id)}>
                <span className="si" style={{ fontSize: 20 }}>{c.is_private ? '🔒' : '💬'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ color: '#E7DBBE', fontSize: 15 }}>{c.title}</span>
                    <span className={`tk-badge ${c.is_private ? 'no' : 'ok'}`}>{c.is_private ? 'Privée' : 'Publique'}</span>
                  </div>
                  <div style={{ color: '#9C8F71', fontSize: 12 }}>
                    Par {c.creatorP?.character_name ?? 'un joueur'} · Maison {h.nom} · {c.memberCount} membre(s) · {fmtDate(c.created_at)}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}

export function ConversationView({
  conv,
  meId,
  players,
  canWrite,
  isAdmin,
  onBack,
  onDeleted,
}: {
  conv: Conversation
  meId: string
  players: Profile[]
  canWrite: boolean
  isAdmin: boolean
  onBack?: () => void
  onDeleted?: () => void
}) {
  const [messages, setMessages] = useState<ConvMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [members, setMembers] = useState<ConvMember[]>([])
  const [showMembers, setShowMembers] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  const loadMembers = useCallback(async () => {
    setMembers(await listMembers(conv.id))
  }, [conv.id])
  useEffect(() => {
    if (conv.is_private) loadMembers()
  }, [conv.is_private, loadMembers])

  const load = useCallback(async () => {
    setMessages(await listMessages(conv.id))
    setLoading(false)
  }, [conv.id])

  useEffect(() => {
    load()
    const ch = supabase
      .channel(`conv:${conv.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversation_messages', filter: `conversation_id=eq.${conv.id}` },
        () => load(),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [conv.id, load])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  async function send() {
    if (!text.trim() || busy) return
    setBusy(true)
    try {
      await sendMessage(conv.id, text, meId)
      setText('')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Envoi impossible.')
    } finally {
      setBusy(false)
    }
  }

  const canManage = isAdmin || conv.creator === meId

  return (
    <section>
      {onBack && <button className="linkbtn" onClick={onBack}>← Conversations</button>}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: onBack ? 12 : 0 }}>
        <span className="si" style={{ fontSize: 20 }}>{conv.is_global ? '🗨️' : conv.is_private ? '🔒' : '💬'}</span>
        <h2 className="section-h" style={{ margin: 0 }}>{conv.title}</h2>
        {!conv.is_global && (
          <span className={`tk-badge ${conv.is_private ? 'no' : 'ok'}`}>{conv.is_private ? 'Privée' : 'Publique'}</span>
        )}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {!conv.is_global && onDeleted && conv.creator !== meId && (
            <button className="tiny" onClick={() => leaveConversation(conv.id, meId).then(onDeleted)}>Quitter</button>
          )}
          {!conv.is_global && onDeleted && canManage && (
            <button className="tiny danger" onClick={() => confirm('Supprimer cette conversation ?') && deleteConversation(conv.id).then(onDeleted)}>🗑️ Supprimer</button>
          )}
        </span>
      </div>

      {conv.is_private && (
        <div style={{ marginTop: 10 }}>
          <button className="tiny" onClick={() => setShowMembers((v) => !v)}>
            👥 Membres ({members.length}) {showMembers ? '▲' : '▼'}
          </button>
          {showMembers && (
            <div className="card" style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: canManage ? 12 : 0 }}>
                {members.map((m) => (
                  <span key={m.profile_id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#E7DBBE', fontSize: 13 }}>
                    <Seal house={m.member?.house} size="sm" /> <CharLink id={m.profile_id}>{m.member?.character_name ?? '—'}</CharLink>
                  </span>
                ))}
              </div>
              {canManage && (
                <InviteRow
                  players={players.filter((p) => !members.some((m) => m.profile_id === p.id))}
                  onAdd={async (id) => { await addMember(conv.id, id); await loadMembers() }}
                />
              )}
            </div>
          )}
        </div>
      )}

      <div className="comments" style={{ marginTop: 14, maxHeight: '60vh', overflowY: 'auto' }}>
        {loading ? (
          <div className="empty">Chargement…</div>
        ) : !messages.length ? (
          <div className="empty" style={{ padding: 24 }}>Aucun message. Sois le premier à écrire.</div>
        ) : (
          messages.map((m) => {
            const h = getHouse(m.author?.house)
            const mine = m.author_profile === meId
            return (
              <div key={m.id} className="comment" style={mine ? { background: '#ffffff08', borderRadius: 8 } : undefined}>
                <Seal house={m.author?.house} size="sm" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="c-meta">
                    <CharLink id={m.author_profile} className="c-who">{m.author?.character_name ?? 'Inconnu'}</CharLink>
                    <span className="c-house">Maison {h.nom}</span>
                    <span className="c-date">{fmtDate(m.created_at)}</span>
                  </div>
                  <div className="c-body">{m.body}</div>
                </div>
              </div>
            )
          })
        )}
        <div ref={endRef} />
      </div>

      {canWrite ? (
        <div className="replybox" style={{ marginTop: 12 }}>
          <textarea
            className="input"
            style={{ minHeight: 64 }}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Écris ton message…"
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send() }}
          />
          <div style={{ marginTop: 8 }}>
            <button className="btn-seal" disabled={busy} onClick={send}>✒️ Envoyer</button>
          </div>
        </div>
      ) : (
        <p className="hint">Mode observateur — lecture seule.</p>
      )}
    </section>
  )
}

function CreateForm({
  meId,
  players,
  onDone,
  onCancel,
}: {
  meId: string
  players: Profile[]
  onDone: (id?: string) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [members, setMembers] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')

  const others = players.filter((p) => p.id !== meId)

  function toggle(id: string) {
    setMembers((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function submit() {
    if (!title.trim()) return setStatus('Donne un titre.')
    setBusy(true)
    setStatus('')
    try {
      await createConversation(title, isPrivate, isPrivate ? members : [])
      onDone()
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Échec.')
      setBusy(false)
    }
  }

  return (
    <div className="composer" style={{ marginBottom: 22 }}>
      <div className="field">
        <label>Titre de la conversation</label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ex. Complot contre les Lannister" />
      </div>
      <div className="field">
        <label>Visibilité</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className={isPrivate ? 'tiny' : 'tiny good'} onClick={() => setIsPrivate(false)}>💬 Publique</button>
          <button type="button" className={isPrivate ? 'tiny good' : 'tiny'} onClick={() => setIsPrivate(true)}>🔒 Privée</button>
        </div>
        <p className="hint" style={{ marginTop: 4 }}>
          {isPrivate ? 'Seuls les membres invités la verront.' : 'Visible et ouverte à tous les joueurs.'}
        </p>
      </div>
      {isPrivate && (
        <div className="field">
          <label>Inviter ({members.length} sélectionné·s)</label>
          <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 8, padding: 8 }}>
            {others.map((p) => (
              <label key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 2px', cursor: 'pointer' }}>
                <input type="checkbox" checked={members.includes(p.id)} onChange={() => toggle(p.id)} />
                <Seal house={p.house} size="sm" />
                <span style={{ color: '#E7DBBE' }}>{p.character_name}</span>
                <span style={{ color: '#9C8F71', fontSize: 12 }}>({getHouse(p.house).nom})</span>
              </label>
            ))}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
        <button className="btn-seal" disabled={busy} onClick={submit}>✒️ Créer</button>
        <button className="btn-ghost" disabled={busy} onClick={onCancel}>Annuler</button>
        {status && <span className="sent-ok">{status}</span>}
      </div>
    </div>
  )
}

function InviteRow({ players, onAdd }: { players: Profile[]; onAdd: (id: string) => Promise<void> }) {
  const [sel, setSel] = useState('')
  const [busy, setBusy] = useState(false)
  if (!players.length) return <p className="hint" style={{ margin: 0 }}>Tous les joueurs sont déjà membres.</p>
  async function add() {
    if (!sel || busy) return
    setBusy(true)
    try {
      await onAdd(sel)
      setSel('')
    } catch (e) {
      alert(e instanceof Error ? e.message : "Invitation impossible.")
    } finally {
      setBusy(false)
    }
  }
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <select className="input" style={{ flex: 1, minWidth: 180 }} value={sel} onChange={(e) => setSel(e.target.value)}>
        <option value="">— Inviter un joueur —</option>
        {players.map((p) => (
          <option key={p.id} value={p.id}>{p.character_name} ({getHouse(p.house).nom})</option>
        ))}
      </select>
      <button className="tiny good" disabled={!sel || busy} onClick={add}>➕ Inviter</button>
    </div>
  )
}
