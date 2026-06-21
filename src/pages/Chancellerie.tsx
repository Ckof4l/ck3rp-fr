import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getHouse, housesByRegion, rkStyle } from '../lib/houses'
import { fmtDate } from '../lib/format'
import { publicImageUrl, supabase } from '../lib/supabase'
import {
  archiveThread,
  countUnread,
  deleteLetter,
  getThread,
  listArchivedThreadIds,
  listInbox,
  listSent,
  markThreadRead,
  sendLetter,
  unarchiveThread,
  type InboxItem,
  type Letter,
  type PartyLite,
  type SentItem,
} from '../lib/letters'
import { Seal } from '../components/Seal'
import { CharLink } from '../components/CharLink'
import { HelpCard } from '../components/HelpCard'
import { ZoomImg } from '../components/ZoomImg'
import type { RavenScope } from '../types/database'

/* ============================================================================
   La Chancellerie — hub de messagerie scellée.
   Conversations (fils), recherche, archivage · Reçues / Envoyées / Écrire.
   ========================================================================== */

type View = 'inbox' | 'sent' | 'compose' | 'thread'

interface ThreadRow {
  threadId: string
  latest: Letter
  unreadCount: number
  count: number
  label: string
  house: string | null
}

export function Chancellerie() {
  const { profile } = useAuth()
  const meId = profile!.id
  const meHouse = profile!.house

  const [searchParams, setSearchParams] = useSearchParams()
  const presetTo = searchParams.get('to')

  const [view, setView] = useState<View>('inbox')
  const [inbox, setInbox] = useState<InboxItem[]>([])
  const [sent, setSent] = useState<SentItem[]>([])
  const [unread, setUnread] = useState(0)
  const [archived, setArchived] = useState<Set<string>>(new Set())
  const [showArchived, setShowArchived] = useState(false)
  const [search, setSearch] = useState('')
  const [openThread, setOpenThread] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  const refresh = useCallback(async () => {
    setLoading(true)
    const [i, s, u, a] = await Promise.all([
      listInbox(meId),
      listSent(meId),
      countUnread(meId),
      listArchivedThreadIds(meId),
    ])
    setInbox(i)
    setSent(s)
    setUnread(u)
    setArchived(a)
    setLoading(false)
  }, [meId])

  const refreshInbox = useCallback(async () => {
    const [i, u] = await Promise.all([listInbox(meId), countUnread(meId)])
    setInbox(i)
    setUnread(u)
  }, [meId])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Arrivée depuis une fiche avec ?to=<id> → ouvre directement la rédaction.
  useEffect(() => {
    if (presetTo) setView('compose')
  }, [presetTo])

  function clearPreset() {
    if (presetTo) setSearchParams({}, { replace: true })
  }

  // ── Temps réel : nouvelle lettre reçue (INSERT) ou lettre retirée par un
  //    Mestre (DELETE en cascade) → recharge + signale aux vues ouvertes.
  //    (read_at étant un UPDATE déclenché par moi-même, on l'ignore ici.)
  useEffect(() => {
    const onChange = () => {
      refreshInbox()
      setTick((t) => t + 1)
    }
    const channel = supabase
      .channel(`inbox:${meId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'raven_recipients', filter: `profile_id=eq.${meId}` },
        onChange,
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'raven_recipients', filter: `profile_id=eq.${meId}` },
        onChange,
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [meId, refreshInbox])

  // Regroupe les lettres en fils (le plus récent en tête).
  const inboxThreads = useMemo(() => buildInboxThreads(inbox), [inbox])
  const sentThreads = useMemo(() => buildSentThreads(sent, meHouse), [sent, meHouse])

  const visible = useCallback(
    (rows: ThreadRow[]) =>
      rows
        .filter((r) => (showArchived ? archived.has(r.threadId) : !archived.has(r.threadId)))
        .filter((r) => matchesSearch(r, search)),
    [archived, showArchived, search],
  )

  function openThreadView(threadId: string) {
    setOpenThread(threadId)
    setView('thread')
  }

  const rows = view === 'sent' ? sentThreads : inboxThreads

  return (
    <section>
      <h2 className="section-h">La Chancellerie · les lettres des Sept Royaumes</h2>

      <HelpCard id="chancellerie" title="Les Corbeaux — comment ça marche ?">
        La messagerie <b>privée</b> entre joueurs.
        <ul>
          <li><b>Écrire une lettre</b> à <b>une personne</b>, à <b>une maison entière</b>, ou à <b>tout le royaume</b>.</li>
          <li>Tu peux joindre une <b>image</b>. Le destinataire voit quand sa lettre est <b>lue</b>.</li>
          <li>Les échanges se regroupent en <b>conversations</b> : ouvre-en une pour répondre.</li>
          <li><b>🔍 Recherche</b> et <b>🗄️ archivage</b> pour ranger tes fils. Les nouvelles lettres arrivent <b>en direct</b>.</li>
        </ul>
      </HelpCard>

      <div className="subnav">
        <button className={view === 'inbox' ? 'on' : ''} onClick={() => setView('inbox')}>
          📥 Reçues {unread > 0 && <span className="pill">{unread}</span>}
        </button>
        <button className={view === 'sent' ? 'on' : ''} onClick={() => setView('sent')}>
          📤 Envoyées
        </button>
        <button className={view === 'compose' ? 'on' : ''} onClick={() => setView('compose')}>
          ✒️ Écrire une lettre
        </button>
      </div>

      {(view === 'inbox' || view === 'sent') && (
        <div className="letters-toolbar">
          <input
            className="input search"
            placeholder="🔍 Rechercher (objet, texte, nom)…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            className={`linkbtn${showArchived ? ' on' : ''}`}
            onClick={() => setShowArchived((v) => !v)}
            title="Afficher les fils archivés"
          >
            🗄️ {showArchived ? 'Archivées' : 'Actives'}
          </button>
        </div>
      )}

      {view === 'compose' ? (
        <Compose
          meId={meId}
          presetTo={presetTo}
          onSent={async () => {
            clearPreset()
            await refresh()
            setView('sent')
          }}
          onCancel={() => {
            clearPreset()
            setView('inbox')
          }}
        />
      ) : view === 'thread' && openThread ? (
        <ThreadView
          threadId={openThread}
          meId={meId}
          tick={tick}
          archived={archived.has(openThread)}
          onBack={() => setView('inbox')}
          onChanged={refresh}
          onToggleArchive={async () => {
            if (archived.has(openThread)) await unarchiveThread(meId, openThread)
            else await archiveThread(meId, openThread)
            await refresh()
          }}
        />
      ) : loading ? (
        <div className="empty">Ouverture des registres…</div>
      ) : (
        <ThreadList dir={view === 'sent' ? 'out' : 'in'} rows={visible(rows)} onOpen={openThreadView} />
      )}
    </section>
  )
}

/* ── Regroupement en fils ──────────────────────────────────────────────── */

function buildInboxThreads(items: InboxItem[]): ThreadRow[] {
  const map = new Map<string, ThreadRow>()
  for (const { letter, read } of items) {
    const ex = map.get(letter.thread_id)
    if (!ex) {
      map.set(letter.thread_id, {
        threadId: letter.thread_id,
        latest: letter,
        unreadCount: read ? 0 : 1,
        count: 1,
        label: letter.sender?.character_name ?? 'Inconnu',
        house: letter.sender?.house ?? null,
      })
    } else {
      ex.count += 1
      if (!read) ex.unreadCount += 1
    }
  }
  return [...map.values()]
}

function buildSentThreads(items: SentItem[], meHouse: string): ThreadRow[] {
  const map = new Map<string, ThreadRow>()
  for (const { letter, toLabel } of items) {
    const ex = map.get(letter.thread_id)
    if (!ex) {
      map.set(letter.thread_id, {
        threadId: letter.thread_id,
        latest: letter,
        unreadCount: 0,
        count: 1,
        label: letter.scope === 'house' ? `À la maison ${getHouse(letter.to_scope).nom}` : toLabel,
        house: letter.scope === 'house' ? letter.to_scope : meHouse,
      })
    } else {
      ex.count += 1
    }
  }
  return [...map.values()]
}

function matchesSearch(r: ThreadRow, q: string): boolean {
  if (!q.trim()) return true
  const s = q.toLowerCase()
  return (
    (r.latest.subject ?? '').toLowerCase().includes(s) ||
    r.latest.body.toLowerCase().includes(s) ||
    r.label.toLowerCase().includes(s)
  )
}

/* ── Liste des fils ────────────────────────────────────────────────────── */

function ThreadList({
  dir,
  rows,
  onOpen,
}: {
  dir: 'in' | 'out'
  rows: ThreadRow[]
  onOpen: (threadId: string) => void
}) {
  if (!rows.length) {
    return (
      <div className="empty">
        {dir === 'in'
          ? 'Aucune lettre reçue ici. La Chancellerie est calme.'
          : 'Tu n\'as encore envoyé aucune lettre ici.'}
      </div>
    )
  }
  return (
    <div className="ravens">
      {rows.map((r) => (
        <button
          key={r.threadId}
          className={`raven-row${r.unreadCount > 0 ? ' unread' : ''}`}
          style={rkStyle(r.house)}
          onClick={() => onOpen(r.threadId)}
        >
          <Seal house={r.house} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontSize: 15, color: '#E7DBBE' }}>{r.label}</span>
              <ScopeTag letter={r.latest} />
              {r.count > 1 && <span className="thread-count">{r.count}</span>}
              {r.unreadCount > 0 && <span className="pill">{r.unreadCount}</span>}
              <span style={{ marginLeft: 'auto', fontSize: 12, color: '#9C8F71', flex: 'none' }}>
                {fmtDate(r.latest.sent_at)}
              </span>
            </div>
            <Subject letter={r.latest} />
          </div>
        </button>
      ))}
    </div>
  )
}

function ScopeTag({ letter }: { letter: Letter }) {
  if (letter.scope === 'realm') return <span className="scope-tag">⚑ royaume</span>
  if (letter.scope === 'house') return <span className="scope-tag">maison {getHouse(letter.to_scope).nom}</span>
  return null
}

function Subject({ letter }: { letter: Letter }) {
  return (
    <>
      <div style={{ fontFamily: 'var(--display)', fontSize: 15, color: 'var(--parch)', margin: '3px 0 2px' }}>
        {letter.subject || '(sans objet)'}
      </div>
      <div
        style={{
          fontSize: 14,
          color: '#A99C7E',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {letter.image_path ? '📎 ' : ''}
        {letter.body.slice(0, 90) || (letter.image_path ? '(image)' : '')}
      </div>
    </>
  )
}

/* ── Vue conversation (fil) ────────────────────────────────────────────── */

interface ReplyRoute {
  scope: RavenScope
  toProfileId?: string
  toHouse?: string | null
  otherName?: string
}

function ThreadView({
  threadId,
  meId,
  tick,
  archived,
  onBack,
  onChanged,
  onToggleArchive,
}: {
  threadId: string
  meId: string
  tick: number
  archived: boolean
  onBack: () => void
  onChanged: () => void
  onToggleArchive: () => void
}) {
  const { profile } = useAuth()
  const isAdmin = !!profile?.is_admin
  const [messages, setMessages] = useState<Letter[] | null>(null)
  const [route, setRoute] = useState<ReplyRoute | null>(null)

  const load = useCallback(async () => {
    const msgs = await getThread(threadId)
    setMessages(msgs)
    // Marque le fil comme lu (seules mes lignes non lues sont touchées).
    await markThreadRead(
      msgs.map((m) => m.id),
      meId,
    )
    onChanged()
    setRoute(await resolveReplyRoute(msgs, meId))
  }, [threadId, meId, onChanged])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, tick])

  async function handleDelete(id: string) {
    await deleteLetter(id)
    const msgs = await getThread(threadId)
    onChanged()
    if (!msgs.length) return onBack()
    setMessages(msgs)
  }

  if (!messages) return <div className="empty">Décachetage du fil…</div>
  if (!messages.length) return <div className="empty">Ce fil est introuvable.</div>

  const subject = messages[0].subject || '(sans objet)'

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="linkbtn" onClick={onBack}>
          ← Retour
        </button>
        <button className="linkbtn" onClick={onToggleArchive}>
          {archived ? '📂 Désarchiver' : '🗄️ Archiver'}
        </button>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--display)', color: 'var(--gold-dim)', fontSize: 13 }}>
          {subject}
        </span>
      </div>

      <div className="thread">
        {messages.map((m) => (
          <Message
            key={m.id}
            letter={m}
            mine={m.from_profile === meId}
            canDelete={m.from_profile === meId || isAdmin}
            onDelete={() => handleDelete(m.id)}
          />
        ))}
      </div>

      {route ? (
        <ReplyBox meId={meId} threadId={threadId} route={route} onSent={load} />
      ) : (
        <p className="hint">Tu ne peux pas répondre à ce fil.</p>
      )}
    </div>
  )
}

function Message({ letter, mine, canDelete, onDelete }: { letter: Letter; mine: boolean; canDelete?: boolean; onDelete?: () => void | Promise<void> }) {
  const h = getHouse(letter.sender?.house)
  const img = publicImageUrl(letter.image_path)
  return (
    <div className={`msg${mine ? ' mine' : ''}`} style={rkStyle(letter.sender?.house)}>
      <div className="msg-head">
        <Seal house={letter.sender?.house} size="sm" />
        <span className="msg-who">{mine ? 'Toi' : <CharLink id={letter.from_profile}>{letter.sender?.character_name ?? 'Inconnu'}</CharLink>}</span>
        <span className="msg-house">Maison {h.nom}</span>
        <span className="msg-date">{fmtDate(letter.sent_at)}</span>
        {canDelete && onDelete && (
          <button
            className="c-del"
            title="Supprimer ce corbeau"
            style={{ marginLeft: 'auto' }}
            onClick={() => confirm('Supprimer ce corbeau ? (définitif)') && onDelete()}
          >
            ✕
          </button>
        )}
      </div>
      <div className="msg-body">{letter.body}</div>
      {img && <ZoomImg className="letter-img" src={img} alt="pièce jointe" />}
    </div>
  )
}

/** Détermine vers qui/quoi part une réponse, d'après l'origine du fil. */
async function resolveReplyRoute(messages: Letter[], meId: string): Promise<ReplyRoute | null> {
  const origin = messages[0]
  if (origin.scope === 'realm') return { scope: 'realm' }
  if (origin.scope === 'house') return { scope: 'house', toHouse: origin.to_scope }

  // Fil privé : trouver l'autre participant.
  const other = messages.find((m) => m.from_profile !== meId)
  if (other?.sender) return { scope: 'user', toProfileId: other.from_profile, otherName: other.sender.character_name }

  // Tout vient de moi : on récupère le destinataire d'origine.
  const ids = messages.map((m) => m.id)
  const { data } = await supabase
    .from('raven_recipients')
    .select('profile_id, profile:profiles(character_name)')
    .in('raven_id', ids)
    .neq('profile_id', meId)
    .limit(1)
  const r = (data as unknown as { profile_id: string; profile: { character_name: string } | null }[] | null)?.[0]
  if (r) return { scope: 'user', toProfileId: r.profile_id, otherName: r.profile?.character_name }
  return null
}

function ReplyBox({
  meId,
  threadId,
  route,
  onSent,
}: {
  meId: string
  threadId: string
  route: ReplyRoute
  onSent: () => void
}) {
  const [body, setBody] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')

  const dest =
    route.scope === 'realm'
      ? 'au royaume'
      : route.scope === 'house'
        ? `à la maison ${getHouse(route.toHouse).nom}`
        : `à ${route.otherName ?? 'ce mestre'}`

  function pickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setImageFile(f)
    setImageUrl(URL.createObjectURL(f))
  }

  async function send() {
    if (!body.trim() && !imageFile) {
      setStatus('Écris une réponse ou joins une image.')
      return
    }
    setBusy(true)
    setStatus('Envoi…')
    try {
      await sendLetter({
        meId,
        scope: route.scope,
        toProfileId: route.toProfileId ?? null,
        toHouse: route.toHouse ?? null,
        subject: '',
        body: body.trim(),
        imageFile,
        threadId,
      })
      setBody('')
      setImageFile(null)
      setImageUrl(null)
      setStatus('')
      onSent()
    } catch (e) {
      console.error('Réponse échouée :', e)
      setStatus(e instanceof Error ? e.message : "L'envoi a échoué.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="replybox">
      <div className="reply-to">Répondre {dest}</div>
      <textarea
        className="input"
        style={{ minHeight: 90 }}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Ta réponse…"
      />
      {imageUrl && (
        <div className="img-prev" style={{ marginTop: 8 }}>
          <img src={imageUrl} alt="aperçu" />
          <button
            className="rm"
            type="button"
            onClick={() => {
              setImageFile(null)
              setImageUrl(null)
            }}
          >
            ✕
          </button>
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
        <button className="btn-seal" disabled={busy} onClick={send}>
          ✒️ Répondre
        </button>
        <label className="attach-btn">
          📎 Image
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={pickImage} />
        </label>
        {status && <span className="sent-ok">{status}</span>}
      </div>
    </div>
  )
}

/* ── Composer une nouvelle lettre ──────────────────────────────────────── */

function Compose({
  meId,
  presetTo,
  onSent,
  onCancel,
}: {
  meId: string
  presetTo?: string | null
  onSent: () => void
  onCancel: () => void
}) {
  const [scope, setScope] = useState<RavenScope>('user')
  const [players, setPlayers] = useState<PartyLite[]>([])
  const [toProfileId, setToProfileId] = useState(presetTo ?? '')
  const [toHouse, setToHouse] = useState('stark')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, character_name, house, username')
      .neq('id', meId)
      .order('character_name')
      .then(({ data }) => {
        const list = (data as PartyLite[] | null) ?? []
        setPlayers(list)
        if (!presetTo && list[0]) setToProfileId((cur) => cur || list[0].id)
      })
  }, [meId])

  const housesWithPlayers = useMemo(
    () => new Set(players.map((p) => p.house).filter((hk) => hk && hk !== 'autre')),
    [players],
  )

  function pickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith('image/')) {
      setStatus("Ce fichier n'est pas une image.")
      return
    }
    setImageFile(f)
    setImageUrl(URL.createObjectURL(f))
    setStatus('')
  }

  async function send() {
    if (!body.trim() && !imageFile) {
      setStatus('Une lettre ne peut partir sans texte ni image.')
      return
    }
    if (scope === 'user' && !toProfileId) {
      setStatus('Choisis un destinataire.')
      return
    }
    setBusy(true)
    setStatus('Scellage et envoi…')
    try {
      const res = await sendLetter({
        meId,
        scope,
        toProfileId: scope === 'user' ? toProfileId : null,
        toHouse: scope === 'house' ? toHouse : null,
        subject,
        body: body.trim(),
        imageFile,
      })
      if (res.recipientCount === 0 && scope !== 'user') {
        setStatus(
          scope === 'realm'
            ? 'Lettre scellée — mais aucun autre mestre ne peuple encore le royaume.'
            : 'Lettre scellée — mais cette maison n\'a aucun membre pour l\'instant.',
        )
        setBusy(false)
        setTimeout(onSent, 1500)
        return
      }
      onSent()
    } catch (e) {
      console.error('Envoi de lettre échoué :', e)
      setStatus(e instanceof Error ? e.message : "L'envoi a échoué.")
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="field">
        <label>Destinataire</label>
        <div className="dest-pick">
          <button className={scope === 'user' ? 'on' : ''} onClick={() => setScope('user')} type="button">
            Une personne
          </button>
          <button className={scope === 'house' ? 'on' : ''} onClick={() => setScope('house')} type="button">
            Une maison
          </button>
          <button className={scope === 'realm' ? 'on' : ''} onClick={() => setScope('realm')} type="button">
            Le royaume
          </button>
        </div>
      </div>

      {scope === 'user' && (
        <div className="field">
          <label>À quel mestre ?</label>
          {players.length ? (
            <select className="input" value={toProfileId} onChange={(e) => setToProfileId(e.target.value)}>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.character_name} — Maison {getHouse(p.house).nom}
                </option>
              ))}
            </select>
          ) : (
            <p className="hint">Aucun autre mestre n'a encore rejoint la Citadelle.</p>
          )}
        </div>
      )}

      {scope === 'house' && (
        <div className="field">
          <label>À quelle maison ?</label>
          <select className="input" value={toHouse} onChange={(e) => setToHouse(e.target.value)}>
            {housesByRegion().map(({ region, houses }) => (
              <optgroup key={region} label={region}>
                {houses
                  .filter((hh) => hh.key !== 'autre')
                  .map((hh) => (
                    <option key={hh.key} value={hh.key}>
                      {hh.nom}
                      {housesWithPlayers.has(hh.key) ? '' : ' (vide)'}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </div>
      )}

      {scope === 'realm' && (
        <p className="hint" style={{ marginTop: 0 }}>
          Ta lettre sera portée à <b>tous les mestres</b> du royaume.
        </p>
      )}

      <div className="field">
        <label>Objet</label>
        <input
          className="input"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="ex. Sur la défense du Trident"
        />
      </div>
      <div className="field">
        <label>Message</label>
        <textarea
          className="input"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Écris ta missive…"
        />
      </div>

      <div className="field">
        <label>Image (facultatif)</label>
        <label className="attach-btn">
          📎 Joindre une image
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={pickImage} />
        </label>
        {imageUrl && (
          <div className="img-prev">
            <img src={imageUrl} alt="aperçu" />
            <button
              className="rm"
              onClick={() => {
                setImageFile(null)
                setImageUrl(null)
              }}
              title="Retirer"
              type="button"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <button className="btn-seal" disabled={busy} onClick={send}>
          ✒️ Sceller &amp; envoyer
        </button>
        <button className="btn-ghost" disabled={busy} onClick={onCancel} type="button">
          Annuler
        </button>
        {status && <span className="sent-ok">{status}</span>}
      </div>
    </div>
  )
}
