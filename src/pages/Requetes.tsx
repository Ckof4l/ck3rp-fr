import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getHouse } from '../lib/houses'
import { fmtDate } from '../lib/format'
import { supabase } from '../lib/supabase'
import {
  listMyTickets,
  listAllTickets,
  getTicket,
  createTicket,
  decideTicket,
  deleteTicket,
  listTicketMessages,
  addTicketMessage,
  type Ticket,
  type TicketMessage,
  type TicketStatus,
} from '../lib/tickets'
import { Seal } from '../components/Seal'
import { HelpCard } from '../components/HelpCard'

/* ============================================================================
   Requêtes — les joueurs soumettent une action RP, les Mestres valident/refusent.
   ========================================================================== */

const CATEGORIES = [
  'Alliance',
  'Guerre',
  'Trêve / Paix',
  'Mariage',
  'Vassalité / Serment',
  'Trahison / Complot',
  'Titre / Adoubement',
  'Succession / Héritage',
  'Commerce / Pacte',
  'Tournoi',
  'Religion',
  'Construction',
  'Événement',
  'Autre',
]

function StatusBadge({ status }: { status: TicketStatus }) {
  if (status === 'accepted') return <span className="tk-badge ok">✓ Acceptée</span>
  if (status === 'refused') return <span className="tk-badge no">✗ Refusée</span>
  return <span className="tk-badge wait">⏳ En attente</span>
}

export function Requetes() {
  const { profile } = useAuth()
  const meId = profile!.id
  const isAdmin = !!profile?.is_admin
  const canSubmit = !profile?.is_observer

  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [composing, setComposing] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [pendingOnly, setPendingOnly] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    setTickets(isAdmin ? await listAllTickets() : await listMyTickets(meId))
    setLoading(false)
  }, [isAdmin, meId])

  useEffect(() => {
    refresh()
    // Un Mestre suit toute la file ; un joueur ne suit que ses propres requêtes
    // (inutile de recharger sa liste quand un autre joueur soumet la sienne).
    const filter = isAdmin ? undefined : `author_profile=eq.${meId}`
    const ch = supabase
      .channel(`tickets:${meId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets', filter }, () => refresh())
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [refresh, meId, isAdmin])

  if (openId) {
    return (
      <TicketDetail
        ticketId={openId}
        meId={meId}
        isAdmin={isAdmin}
        canWrite={canSubmit}
        onBack={() => setOpenId(null)}
        onChanged={refresh}
        onDeleted={() => {
          setOpenId(null)
          refresh()
        }}
      />
    )
  }

  const shown = isAdmin && pendingOnly ? tickets.filter((t) => t.status === 'pending') : tickets
  const pendingCount = tickets.filter((t) => t.status === 'pending').length

  return (
    <section>
      <h2 className="section-h">🎫 Requêtes</h2>
      <p className="channel-desc">
        {isAdmin
          ? 'Valide ou refuse les actions RP proposées par les joueurs.'
          : 'Soumets une action à valider par les Mestres (alliance, guerre, mariage…).'}
      </p>

      <HelpCard id="requetes" title="Les Requêtes — comment ça marche ?">
        {isAdmin ? (
          <>
            Les joueurs te soumettent des actions RP à valider.
            <ul>
              <li>Onglet <b>📋 À traiter</b> : ouvre une requête, écris un <b>motif</b> (facultatif), puis <b>✓ Valide</b> ou <b>✗ Refuse</b>.</li>
              <li>Tu peux <b>discuter</b> avec le joueur avant de trancher. Il voit ta décision <b>en direct</b>.</li>
              <li>Tu retrouves aussi la file dans la <b>Citadelle → 🎫 Requêtes</b>.</li>
            </ul>
          </>
        ) : (
          <>
            Demande aux Mestres de valider une action de ton personnage.
            <ul>
              <li><b>✒️ Nouvelle requête</b> : choisis une <b>catégorie</b> (alliance, guerre, mariage…), un sujet et les détails.</li>
              <li>Suis son <b>statut</b> : ⏳ En attente → ✓ Acceptée / ✗ Refusée, avec la réponse du Mestre.</li>
              <li>Tu peux <b>discuter</b> avec les Mestres dans le fil de la requête.</li>
            </ul>
          </>
        )}
      </HelpCard>

      {canSubmit &&
        (composing ? (
          <TicketForm
            meId={meId}
            onDone={async () => {
              setComposing(false)
              await refresh()
            }}
            onCancel={() => setComposing(false)}
          />
        ) : (
          <button className="btn-seal" style={{ marginBottom: 18 }} onClick={() => setComposing(true)}>
            ✒️ Nouvelle requête
          </button>
        ))}

      {isAdmin && (
        <div className="subnav" style={{ marginBottom: 14 }}>
          <button className={pendingOnly ? 'on' : ''} onClick={() => setPendingOnly(true)}>
            📋 À traiter {pendingCount > 0 && <span className="pill">{pendingCount}</span>}
          </button>
          <button className={!pendingOnly ? 'on' : ''} onClick={() => setPendingOnly(false)}>
            Toutes
          </button>
        </div>
      )}

      {loading ? (
        <div className="empty">Ouverture du registre…</div>
      ) : !shown.length ? (
        <div className="empty">
          {isAdmin ? 'Aucune requête à traiter. 🕊️' : 'Tu n\'as soumis aucune requête.'}
        </div>
      ) : (
        <div className="ravens">
          {shown.map((t) => {
            const h = getHouse(t.author?.house)
            return (
              <button key={t.id} className="raven-row" onClick={() => setOpenId(t.id)}>
                <Seal house={t.author?.house} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {t.category && <span className="scope-tag">{t.category}</span>}
                    <span style={{ color: '#E7DBBE', fontSize: 15 }}>{t.subject}</span>
                    <StatusBadge status={t.status} />
                    <span style={{ marginLeft: 'auto', fontSize: 12, color: '#9C8F71' }}>{fmtDate(t.created_at)}</span>
                  </div>
                  <div style={{ color: '#9C8F71', fontSize: 12 }}>
                    {isAdmin ? `${t.author?.character_name ?? 'Inconnu'} · Maison ${h.nom}` : `Maison ${h.nom}`}
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

/* ── Nouvelle requête ──────────────────────────────────────────────────── */

function TicketForm({ meId, onDone, onCancel }: { meId: string; onDone: () => void; onCancel: () => void }) {
  const [category, setCategory] = useState(CATEGORIES[0])
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')

  async function submit() {
    if (!subject.trim()) return setStatus('Donne un sujet à ta requête.')
    setBusy(true)
    setStatus('Envoi…')
    try {
      await createTicket({ meId, category, subject, body })
      onDone()
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "L'envoi a échoué.")
      setBusy(false)
    }
  }

  return (
    <div className="composer" style={{ marginBottom: 22 }}>
      <div className="field">
        <label>Catégorie</label>
        <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Sujet</label>
        <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="ex. Alliance Stark – Lannister" />
      </div>
      <div className="field">
        <label>Détails de la requête</label>
        <textarea className="input" style={{ minHeight: 100 }} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Explique l'action que tu veux faire valider…" />
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn-seal" disabled={busy} onClick={submit}>✒️ Soumettre aux Mestres</button>
        <button className="btn-ghost" disabled={busy} onClick={onCancel}>Annuler</button>
        {status && <span className="sent-ok">{status}</span>}
      </div>
    </div>
  )
}

/* ── Détail d'une requête ──────────────────────────────────────────────── */

function TicketDetail({
  ticketId,
  meId,
  isAdmin,
  canWrite,
  onBack,
  onChanged,
  onDeleted,
}: {
  ticketId: string
  meId: string
  isAdmin: boolean
  canWrite: boolean
  onBack: () => void
  onChanged: () => void
  onDeleted: () => void
}) {
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [messages, setMessages] = useState<TicketMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [reply, setReply] = useState('')
  const [resolution, setResolution] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [t, ms] = await Promise.all([getTicket(ticketId), listTicketMessages(ticketId)])
    setTicket(t)
    setMessages(ms)
    setLoading(false)
  }, [ticketId])

  useEffect(() => {
    load()
    const ch = supabase
      .channel(`ticket:${ticketId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ticket_messages', filter: `ticket_id=eq.${ticketId}` }, () => listTicketMessages(ticketId).then(setMessages))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tickets', filter: `id=eq.${ticketId}` }, () => getTicket(ticketId).then(setTicket))
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [ticketId, load])

  async function sendReply() {
    if (!reply.trim()) return
    setBusy(true)
    try {
      await addTicketMessage({ meId, ticketId, body: reply })
      setReply('')
      setMessages(await listTicketMessages(ticketId))
    } finally {
      setBusy(false)
    }
  }

  async function decide(status: 'accepted' | 'refused') {
    setBusy(true)
    try {
      await decideTicket(ticketId, status, resolution, meId)
      await load()
      onChanged()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Action impossible.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="empty">Ouverture de la requête…</div>
  if (!ticket) return <div className="empty">Cette requête est introuvable.</div>

  const h = getHouse(ticket.author?.house)
  const canDelete = isAdmin // un joueur ne retire pas ses propres traces

  return (
    <div>
      <button className="linkbtn" onClick={onBack}>← Retour aux requêtes</button>

      <div className="card" style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <Seal house={ticket.author?.house} size="lg" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {ticket.category && <span className="scope-tag">{ticket.category}</span>}
              <span style={{ fontFamily: 'var(--display)', fontSize: 18, color: 'var(--parch)' }}>{ticket.subject}</span>
              <StatusBadge status={ticket.status} />
            </div>
            <div style={{ color: '#9C8F71', fontSize: 12, marginTop: 2 }}>
              {ticket.author?.character_name ?? 'Inconnu'} · Maison {h.nom} · {fmtDate(ticket.created_at)}
            </div>
          </div>
          {canDelete && (
            <button className="tiny danger" onClick={() => confirm('Supprimer cette requête ?') && deleteTicket(ticketId).then(onDeleted)}>
              🗑️ Supprimer
            </button>
          )}
        </div>
        {ticket.body && <div className="pact-body" style={{ marginTop: 12, marginBottom: 0 }}>{ticket.body}</div>}
      </div>

      {/* Verdict */}
      {ticket.status !== 'pending' && (
        <div className={`verdict ${ticket.status}`}>
          <b>{ticket.status === 'accepted' ? '✓ Requête acceptée' : '✗ Requête refusée'}</b>
          {ticket.resolver ? ` par ${ticket.resolver.character_name}` : ''}
          {ticket.resolution && <div className="verdict-note">« {ticket.resolution} »</div>}
        </div>
      )}

      {/* Décision admin */}
      {isAdmin && ticket.status === 'pending' && (
        <div className="death-form" style={{ marginTop: 16 }}>
          <h3 style={{ color: '#C7B894' }}>Décision du Mestre</h3>
          <div className="field">
            <label>Motif / réponse (facultatif)</label>
            <input className="input" value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="ex. Accordé, mais sous condition de…" />
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="tiny good" disabled={busy} onClick={() => decide('accepted')}>✓ Valider</button>
            <button className="tiny danger" disabled={busy} onClick={() => decide('refused')}>✗ Refuser</button>
          </div>
        </div>
      )}

      {/* Discussion */}
      <h3 className="section-h" style={{ fontSize: 12, marginTop: 24 }}>Discussion</h3>
      <div className="thread">
        {messages.map((m) => (
          <div key={m.id} className={`msg${m.author_profile === meId ? ' mine' : ''}`}>
            <div className="msg-head">
              <Seal house={m.author?.house} size="sm" />
              <span className="msg-who">{m.author_profile === meId ? 'Toi' : m.author?.character_name ?? 'Inconnu'}</span>
              <span className="msg-date">{fmtDate(m.created_at)}</span>
            </div>
            <div className="msg-body">{m.body}</div>
          </div>
        ))}
        {!messages.length && <div className="empty" style={{ padding: 20 }}>Aucun message. Pose une question ou précise ta requête.</div>}
      </div>

      {canWrite && (
        <div className="replybox">
          <textarea className="input" style={{ minHeight: 70 }} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Écris un message…" />
          <div style={{ marginTop: 8 }}>
            <button className="btn-seal" disabled={busy} onClick={sendReply}>💬 Envoyer</button>
          </div>
        </div>
      )}
    </div>
  )
}
