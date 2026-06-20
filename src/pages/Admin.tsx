import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getHouse, housesByRegion, FREE_HOUSE_KEY } from '../lib/houses'
import { fmtDate } from '../lib/format'
import {
  listProfiles,
  setRole,
  excludeProfile,
  banUserHard,
  unbanUser,
  listBanned,
  mutePlayer,
  unmutePlayer,
  setPlayer,
  overview,
  listOpenReports,
  fetchReportTarget,
  deleteReportedTarget,
  resolveReport,
  clearChannel,
  clearCorbeaux,
  purgeContent,
  listAllLetters,
  deleteLetter,
  logAdmin,
  listAuditLog,
  type ReportRow,
  type ReportTarget,
  type AdminLetter,
  type AuditEntry,
  type BannedUser,
} from '../lib/admin'
import { CHANNELS } from '../lib/channels'
import { listAllTickets, decideTicket, type Ticket } from '../lib/tickets'
import { publicImageUrl } from '../lib/supabase'
import { getAnnouncement, setAnnouncement, clearAnnouncement } from '../lib/realm'
import type { Profile } from '../types/database'
import { Seal } from '../components/Seal'
import { CharLink } from '../components/CharLink'
import { ChannelIcon } from '../components/ChannelIcon'

/* ============================================================================
   La Citadelle — administration & modération.
   Onglets : Mestres · Signalements · Zone de danger.
   ========================================================================== */

type Tab = 'mestres' | 'reports' | 'tickets' | 'corbeaux' | 'bannis' | 'journal' | 'danger'

export function Admin() {
  const { profile, refreshProfile } = useAuth()
  const [tab, setTab] = useState<Tab>('mestres')
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [reports, setReports] = useState<ReportRow[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [letters, setLetters] = useState<AdminLetter[]>([])
  const [banned, setBanned] = useState<BannedUser[]>([])
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [stats, setStats] = useState({ players: 0, houses: 0, posts: 0, letters: 0, pacts: 0, openPolls: 0, openReports: 0, pendingTickets: 0 })
  const [loading, setLoading] = useState(true)

  const ro = !!profile?.is_observer && !profile?.is_admin

  const refresh = useCallback(async () => {
    setLoading(true)
    const [ps, rs, ov, tk, lt, bn, au] = await Promise.all([
      listProfiles(),
      listOpenReports(),
      overview(),
      listAllTickets(),
      listAllLetters(),
      listBanned(),
      listAuditLog(),
    ])
    setProfiles(ps)
    setReports(rs)
    setStats(ov)
    setTickets(tk)
    setLetters(lt)
    setBanned(bn)
    setAudit(au)
    setLoading(false)
  }, [])

  const nameOf = useCallback((id: string) => profiles.find((p) => p.id === id)?.character_name ?? 'inconnu', [profiles])

  useEffect(() => {
    refresh()
  }, [refresh])

  if (!profile?.is_admin && !profile?.is_observer) return <Navigate to="/c/decret-royal" replace />

  const isFounder = !!profile.is_founder
  const roleLabel = ro ? 'Observateur (lecture seule)' : isFounder ? 'Grand Mestre' : 'Mestre'

  async function act(fn: () => Promise<void>, affectsSelf = false, log?: string) {
    if (ro) return
    try {
      await fn()
      if (log) await logAdmin(log)
      if (affectsSelf) await refreshProfile()
      await refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Action impossible.')
    }
  }

  return (
    <section>
      <h2 className="section-h">La Citadelle · {roleLabel}</h2>

      <div className="stat-row">
        <Stat n={stats.players} l="Joueurs" />
        <Stat n={stats.houses} l="Maisons" />
        <Stat n={stats.posts} l="Posts" />
        <Stat n={stats.letters} l="Lettres" />
        <Stat n={stats.pacts} l="Pactes" />
        <Stat n={stats.openPolls} l="Scrutins" highlight={stats.openPolls > 0} />
        <Stat n={stats.openReports} l="Signalements" highlight={stats.openReports > 0} />
        <Stat n={stats.pendingTickets} l="Requêtes" highlight={stats.pendingTickets > 0} />
      </div>

      {ro && (
        <div className="empty" style={{ padding: 14, marginBottom: 18 }}>
          👁️ Mode observateur — tu peux tout consulter, mais aucune action n'est possible.
        </div>
      )}

      {isFounder && <AnnouncementControl meId={profile.id} />}

      <div className="subnav">
        <button className={tab === 'mestres' ? 'on' : ''} onClick={() => setTab('mestres')}>
          ⚜️ Mestres
        </button>
        <button className={tab === 'reports' ? 'on' : ''} onClick={() => setTab('reports')}>
          ⚑ Signalements {stats.openReports > 0 && <span className="pill">{stats.openReports}</span>}
        </button>
        <button className={tab === 'tickets' ? 'on' : ''} onClick={() => setTab('tickets')}>
          🎫 Requêtes {stats.pendingTickets > 0 && <span className="pill">{stats.pendingTickets}</span>}
        </button>
        <button className={tab === 'corbeaux' ? 'on' : ''} onClick={() => setTab('corbeaux')}>
          🐦‍⬛ Corbeaux
        </button>
        <button className={tab === 'bannis' ? 'on' : ''} onClick={() => setTab('bannis')}>
          🚫 Bannis {banned.length > 0 && <span className="pill">{banned.length}</span>}
        </button>
        <button className={tab === 'journal' ? 'on' : ''} onClick={() => setTab('journal')}>
          📜 Journal
        </button>
        {!ro && (
          <button className={tab === 'danger' ? 'on' : ''} onClick={() => setTab('danger')}>
            🧹 Nettoyage
          </button>
        )}
      </div>

      {loading ? (
        <div className="empty">Ouverture des registres…</div>
      ) : tab === 'mestres' ? (
        <MestresList
          profiles={profiles}
          meId={profile.id}
          ro={ro}
          isFounder={isFounder}
          actions={{
            onRole: (id, patch, self) =>
              act(() => setRole(id, patch), self, `Rôle modifié (${Object.keys(patch).join(', ')}) → ${nameOf(id)}`),
            onBan: (id) => {
              const reason = prompt(
                `BANNIR ${nameOf(id)} ?\n\nBlocage PERMANENT du compte Discord : la personne ne pourra plus se reconnecter ni se réinscrire (jusqu'à un débannissement). Son contenu sera supprimé.\n\nMotif (facultatif) :`,
              )
              if (reason !== null) act(() => banUserHard(id, reason), false, `Banni (définitif) : ${nameOf(id)}`)
            },
            onExclude: (id) => {
              if (confirm(`Exclure ${nameOf(id)} ?\n\nSon personnage et son contenu sont supprimés, mais la personne PEUT revenir (elle repassera l'inscription).`))
                act(() => excludeProfile(id), false, `Exclu (reset) : ${nameOf(id)}`)
            },
            onMute: (id, minutes) => act(() => mutePlayer(id, minutes), false, `Sourdine ${minutes} min → ${nameOf(id)}`),
            onUnmute: (id) => act(() => unmutePlayer(id), false, `Sourdine levée → ${nameOf(id)}`),
            onSave: (id, character, house) => act(() => setPlayer(id, character, house), false, `Joueur édité → ${character} (${house})`),
          }}
        />
      ) : tab === 'reports' ? (
        <ReportsList reports={reports} ro={ro} onChanged={refresh} />
      ) : tab === 'tickets' ? (
        <TicketsQueue tickets={tickets} meId={profile.id} ro={ro} onChanged={refresh} />
      ) : tab === 'corbeaux' ? (
        <LettersOversight letters={letters} ro={ro} onChanged={refresh} />
      ) : tab === 'bannis' ? (
        <BannedList
          banned={banned}
          ro={ro}
          onUnban={(id, name) => {
            if (confirm(`Débannir ${name} ? La personne pourra se réinscrire.`))
              act(() => unbanUser(id), false, `Débanni : ${name}`)
          }}
        />
      ) : tab === 'journal' ? (
        <AuditList entries={audit} />
      ) : (
        <NettoyageZone isFounder={isFounder} onChanged={refresh} />
      )}
    </section>
  )
}

/* ── Requêtes (file de validation) ─────────────────────────────────────── */

function TicketsQueue({
  tickets,
  meId,
  ro,
  onChanged,
}: {
  tickets: Ticket[]
  meId: string
  ro: boolean
  onChanged: () => void
}) {
  const [showAll, setShowAll] = useState(false)
  const shown = showAll ? tickets : tickets.filter((t) => t.status === 'pending')

  return (
    <div>
      <div className="subnav" style={{ marginBottom: 14 }}>
        <button className={!showAll ? 'on' : ''} onClick={() => setShowAll(false)}>
          📋 À traiter
        </button>
        <button className={showAll ? 'on' : ''} onClick={() => setShowAll(true)}>
          Toutes
        </button>
      </div>
      {!shown.length ? (
        <div className="empty">{showAll ? 'Aucune requête.' : 'Aucune requête à traiter. 🕊️'}</div>
      ) : (
        <div className="ravens">
          {shown.map((t) => (
            <TicketRow key={t.id} ticket={t} meId={meId} ro={ro} onChanged={onChanged} />
          ))}
        </div>
      )}
    </div>
  )
}

function TicketRow({
  ticket,
  meId,
  ro,
  onChanged,
}: {
  ticket: Ticket
  meId: string
  ro: boolean
  onChanged: () => void
}) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const h = getHouse(ticket.author?.house)

  async function decide(status: 'accepted' | 'refused') {
    setBusy(true)
    try {
      await decideTicket(ticket.id, status, reason, meId)
      await logAdmin(`Requête ${status === 'accepted' ? 'acceptée' : 'refusée'} : ${ticket.subject}`)
      onChanged()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Action impossible.')
      setBusy(false)
    }
  }

  return (
    <div className="report-card" style={{ borderColor: 'var(--line)' }}>
      <div className="report-head">
        {ticket.category && <span className="scope-tag">{ticket.category}</span>}
        <span style={{ color: '#E7DBBE', fontSize: 15 }}>{ticket.subject}</span>
        {ticket.status === 'accepted' && <span className="tk-badge ok">✓ Acceptée</span>}
        {ticket.status === 'refused' && <span className="tk-badge no">✗ Refusée</span>}
        {ticket.status === 'pending' && <span className="tk-badge wait">⏳ En attente</span>}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#9C8F71' }}>{fmtDate(ticket.created_at)}</span>
      </div>
      <div style={{ color: '#9C8F71', fontSize: 12, marginBottom: 8 }}>
        {ticket.author?.character_name ?? 'Inconnu'} · Maison {h.nom}
      </div>
      {ticket.body && <div className="report-target">{ticket.body}</div>}

      {ticket.status !== 'pending' && ticket.resolution && (
        <div className="verdict-note" style={{ marginTop: 8 }}>
          « {ticket.resolution} »{ticket.resolver ? ` — ${ticket.resolver.character_name}` : ''}
        </div>
      )}

      {!ro && ticket.status === 'pending' && (
        <div style={{ marginTop: 10 }}>
          <input
            className="input"
            style={{ fontSize: 14, padding: '8px 10px', marginBottom: 8 }}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motif / réponse (facultatif)…"
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="tiny good" disabled={busy} onClick={() => decide('accepted')}>
              ✓ Valider
            </button>
            <button className="tiny danger" disabled={busy} onClick={() => decide('refused')}>
              ✗ Refuser
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ n, l, highlight }: { n: number; l: string; highlight?: boolean }) {
  return (
    <div className="stat">
      <div className="stat-n" style={highlight ? { color: 'var(--weirwood-br)' } : undefined}>
        {n}
      </div>
      <div className="stat-l">{l}</div>
    </div>
  )
}

/* ── Journal d'audit ───────────────────────────────────────────────────── */

function AuditList({ entries }: { entries: AuditEntry[] }) {
  if (!entries.length) return <div className="empty">Aucune action consignée pour l'instant.</div>
  return (
    <div className="ravens">
      {entries.map((a) => (
        <div key={a.id} className="report-card" style={{ borderColor: 'var(--line)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <span style={{ color: '#E7DBBE', fontSize: 14 }}>{a.action}</span>
            <span style={{ marginLeft: 'auto', color: '#9C8F71', fontSize: 12 }}>{fmtDate(a.created_at)}</span>
          </div>
          <div style={{ color: '#9C8F71', fontSize: 12, marginTop: 2 }}>par {a.actor?.character_name ?? 'un mestre'}</div>
        </div>
      ))}
    </div>
  )
}

/* ── Bannière d'annonce ────────────────────────────────────────────────── */

function AnnouncementControl({ meId }: { meId: string }) {
  const [current, setCurrent] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getAnnouncement().then((a) => setCurrent(a?.message ?? null))
  }, [])

  async function post() {
    if (!msg.trim()) return
    setBusy(true)
    try {
      await setAnnouncement(meId, msg)
      await logAdmin('Annonce posée : ' + msg.trim())
      setCurrent(msg.trim())
      setMsg('')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Action impossible.')
    } finally {
      setBusy(false)
    }
  }

  async function clear() {
    setBusy(true)
    try {
      await clearAnnouncement()
      await logAdmin('Annonce retirée')
      setCurrent(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="announce-box">
      <h3 className="section-h" style={{ fontSize: 12, marginBottom: 8 }}>📢 Bannière d'annonce (haut du site, pour tous)</h3>
      {current ? (
        <p style={{ color: '#C7B894', margin: '0 0 8px' }}>Active : « {current} »</p>
      ) : (
        <p className="hint" style={{ marginTop: 0 }}>Aucune bannière affichée.</p>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          className="input"
          style={{ flex: 1, minWidth: 220 }}
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          placeholder="ex. Grand tournoi ce soir à 21h !"
        />
        <button className="tiny good" disabled={busy} onClick={post}>Afficher</button>
        {current && <button className="tiny danger" disabled={busy} onClick={clear}>Retirer</button>}
      </div>
    </div>
  )
}

/* ── Mestres ───────────────────────────────────────────────────────────── */

interface MestresActions {
  onRole: (id: string, patch: Partial<Profile>, self: boolean) => void
  onBan: (id: string) => void
  onExclude: (id: string) => void
  onMute: (id: string, minutes: number) => void
  onUnmute: (id: string) => void
  onSave: (id: string, character: string, house: string) => void
}

function MestresList({
  profiles,
  meId,
  ro,
  isFounder,
  actions,
}: {
  profiles: Profile[]
  meId: string
  ro: boolean
  isFounder: boolean
  actions: MestresActions
}) {
  return (
    <div className="ravens">
      {profiles.map((p) => (
        <MestreRow key={p.id} p={p} self={p.id === meId} ro={ro} isFounder={isFounder} actions={actions} />
      ))}
    </div>
  )
}

function MestreRow({
  p,
  self,
  ro,
  isFounder,
  actions,
}: {
  p: Profile
  self: boolean
  ro: boolean
  isFounder: boolean
  actions: MestresActions
}) {
  const h = getHouse(p.house)
  const [editing, setEditing] = useState(false)
  const [editChar, setEditChar] = useState(p.character_name)
  const [editHouse, setEditHouse] = useState(p.house)
  const muted = !!p.muted_until && new Date(p.muted_until) > new Date()

  return (
    <div className="mestre-row">
      <Seal house={p.house} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <CharLink id={p.id} className="charlink-strong">{p.character_name}</CharLink>
          {p.is_king && <span className="badge king">👑 Roi</span>}
          {p.is_founder ? (
            <span className="badge gm">Grand Mestre</span>
          ) : (
            p.is_admin && <span className="badge">Mestre</span>
          )}
          {p.is_observer && <span className="badge obs">Observateur</span>}
          {muted && <span className="badge" style={{ background: 'linear-gradient(#6E6A66,#3A3340)', color: '#fff' }}>🔇 Muet</span>}
        </div>
        <div style={{ color: '#9C8F71', fontSize: 12 }}>
          @{p.username} · Maison {h.nom} · {h.region}
          {p.discord ? ` · 🎮 ${p.discord}` : ''}
          {muted && p.muted_until ? ` · muet jusqu'au ${new Date(p.muted_until).toLocaleString('fr-FR')}` : ''}
        </div>

        {editing && !ro && (
          <div className="composer" style={{ marginTop: 10 }}>
            <div className="field" style={{ marginBottom: 8 }}>
              <label>Personnage</label>
              <input className="input" value={editChar} onChange={(e) => setEditChar(e.target.value)} />
            </div>
            <div className="field" style={{ marginBottom: 8 }}>
              <label>Maison</label>
              <select className="input" value={editHouse} onChange={(e) => setEditHouse(e.target.value)}>
                <option value={FREE_HOUSE_KEY}>{getHouse(FREE_HOUSE_KEY).nom}</option>
                {housesByRegion().map(({ region, houses }) => (
                  <optgroup key={region} label={region}>
                    {houses.filter((hh) => hh.key !== FREE_HOUSE_KEY).map((hh) => (
                      <option key={hh.key} value={hh.key}>{hh.nom}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="tiny good" onClick={() => { actions.onSave(p.id, editChar, editHouse); setEditing(false) }}>Enregistrer</button>
              <button className="tiny" onClick={() => setEditing(false)}>Annuler</button>
            </div>
          </div>
        )}

        {/* Le Grand Mestre est intouchable par quiconque n'est pas Grand Mestre. */}
        {!ro && !editing && p.is_founder && !isFounder && !self && (
          <div className="mestre-actions">
            <span className="hint" style={{ margin: 0 }}>👑 Grand Mestre — intouchable.</span>
          </div>
        )}

        {!ro && !editing && !(p.is_founder && !isFounder && !self) && (
          <div className="mestre-actions">
            {isFounder && (
              <button className="tiny" disabled={self} style={self ? { opacity: 0.4 } : undefined}
                onClick={() => actions.onRole(p.id, { is_founder: !p.is_founder }, self)}>
                ⚜️ {p.is_founder ? 'Destituer Grand Mestre' : 'Sacrer Grand Mestre'}
              </button>
            )}
            <button className={`tiny${p.is_king ? '' : ' good'}`} onClick={() => actions.onRole(p.id, { is_king: !p.is_king }, self)}>
              👑 {p.is_king ? 'Destituer le Roi' : 'Sacrer Roi'}
            </button>
            <button className="tiny" disabled={self} style={self ? { opacity: 0.4 } : undefined}
              onClick={() => actions.onRole(p.id, { is_admin: !p.is_admin }, self)}>
              🔗 {p.is_admin ? 'Retirer Mestre' : 'Nommer Mestre'}
            </button>
            <button className="tiny" disabled={self} style={self ? { opacity: 0.4 } : undefined}
              onClick={() => actions.onRole(p.id, { is_observer: !p.is_observer }, self)}>
              👁️ {p.is_observer ? 'Retirer Observateur' : 'Observateur'}
            </button>
            <button className="tiny" onClick={() => { setEditChar(p.character_name); setEditHouse(p.house); setEditing(true) }}>
              ✏️ Éditer
            </button>
            {muted ? (
              <button className="tiny good" disabled={self} style={self ? { opacity: 0.4 } : undefined} onClick={() => actions.onUnmute(p.id)}>
                🔊 Lever la sourdine
              </button>
            ) : (
              <>
                <button className="tiny" disabled={self} style={self ? { opacity: 0.4 } : undefined} onClick={() => actions.onMute(p.id, 60)}>🔇 1h</button>
                <button className="tiny" disabled={self} style={self ? { opacity: 0.4 } : undefined} onClick={() => actions.onMute(p.id, 1440)}>🔇 1j</button>
                <button className="tiny" disabled={self} style={self ? { opacity: 0.4 } : undefined} onClick={() => actions.onMute(p.id, 10080)}>🔇 7j</button>
              </>
            )}
            {/* Hiérarchie : un Mestre ne peut exclure/bannir ni un Mestre ni un Grand Mestre. */}
            {!p.is_founder && (!p.is_admin || isFounder) && (
              <>
                <button className="tiny" disabled={self} style={self ? { opacity: 0.4 } : undefined} onClick={() => actions.onExclude(p.id)}>
                  👋 Exclure
                </button>
                <button className="tiny danger" disabled={self} style={self ? { opacity: 0.4 } : undefined} onClick={() => actions.onBan(p.id)}>
                  🚫 Bannir
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Bannis ────────────────────────────────────────────────────────────── */

function BannedList({
  banned,
  ro,
  onUnban,
}: {
  banned: BannedUser[]
  ro: boolean
  onUnban: (userId: string, name: string) => void
}) {
  if (!banned.length) return <div className="empty">Aucun compte banni. 🕊️</div>
  return (
    <div className="ravens">
      {banned.map((b) => {
        const name = b.character_name || b.discord || `compte ${b.user_id.slice(0, 8)}`
        return (
          <div key={b.user_id} className="mestre-row">
            <span className="si" style={{ fontSize: 22 }}>🚫</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ color: '#E7DBBE', fontSize: 15 }}>{name}</span>
                {b.discord && <span className="badge" style={{ background: '#2a2f3a', color: '#9DB4D0' }}>🎮 {b.discord}</span>}
              </div>
              <div style={{ color: '#9C8F71', fontSize: 12 }}>
                Banni le {fmtDate(b.banned_at)}
                {b.by?.character_name ? ` · par ${b.by.character_name}` : ''}
              </div>
              {b.reason && <div style={{ color: '#A99C7E', fontSize: 13, fontStyle: 'italic', marginTop: 2 }}>« {b.reason} »</div>}
            </div>
            {!ro && (
              <button className="tiny good" onClick={() => onUnban(b.user_id, name)}>↩️ Débannir</button>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ── Signalements ──────────────────────────────────────────────────────── */

function ReportsList({
  reports,
  ro,
  onChanged,
}: {
  reports: ReportRow[]
  ro: boolean
  onChanged: () => void
}) {
  if (!reports.length) return <div className="empty">Aucun signalement en attente. La paix règne. 🕊️</div>
  return (
    <div className="ravens">
      {reports.map((r) => (
        <ReportCard key={r.id} report={r} ro={ro} onChanged={onChanged} />
      ))}
    </div>
  )
}

function ReportCard({
  report,
  ro,
  onChanged,
}: {
  report: ReportRow
  ro: boolean
  onChanged: () => void
}) {
  const [target, setTarget] = useState<ReportTarget | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetchReportTarget(report.target_type, report.target_id).then(setTarget)
  }, [report])

  const kind =
    report.target_type === 'comment' ? 'Commentaire'
    : report.target_type === 'post' ? 'Post'
    : report.target_type === 'profile' ? 'Joueur'
    : 'Lettre'

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    try {
      await fn()
      onChanged()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Action impossible.')
      setBusy(false)
    }
  }

  return (
    <div className="report-card">
      <div className="report-head">
        <span className="scope-tag">⚑ {kind}</span>
        <span style={{ color: '#9C8F71', fontSize: 12 }}>
          signalé par {report.reporter?.character_name ?? 'Inconnu'} · {fmtDate(report.created_at)}
        </span>
      </div>
      {report.reason && <div className="report-reason">« {report.reason} »</div>}

      <div className="report-target">
        {target == null ? (
          'Chargement du contenu…'
        ) : !target.exists ? (
          <span style={{ color: '#8E8268' }}>Contenu déjà supprimé.</span>
        ) : (
          <>
            <div style={{ color: '#9C8F71', fontSize: 12, marginBottom: 3 }}>
              par {target.author ?? 'Inconnu'}
              {target.channel ? ` · salon ${target.channel}` : ''}
            </div>
            {target.title && <div style={{ fontFamily: 'var(--display)', color: 'var(--parch)' }}>{target.title}</div>}
            <div style={{ color: '#C7B894' }}>{target.body?.slice(0, 280) || '(sans texte)'}</div>
          </>
        )}
      </div>

      {!ro && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          {report.target_type === 'profile' ? (
            <a className="tiny" href={`/personnage/${report.target_id}`}>👤 Voir la fiche</a>
          ) : (
            target?.exists && (
              <button
                className="tiny danger"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await deleteReportedTarget(report.target_type, report.target_id)
                    await resolveReport(report.id)
                  })
                }
              >
                🗑️ Supprimer le contenu
              </button>
            )
          )}
          <button className="tiny good" disabled={busy} onClick={() => run(() => resolveReport(report.id))}>
            ✅ Classer sans suite
          </button>
        </div>
      )}
    </div>
  )
}

/* ── Corbeaux (lecture de tous les messages privés — Mestre) ───────────── */

function LettersOversight({
  letters,
  ro,
  onChanged,
}: {
  letters: AdminLetter[]
  ro: boolean
  onChanged: () => void
}) {
  const [open, setOpen] = useState<string | null>(null)

  function toLabel(l: AdminLetter): string {
    if (l.scope === 'realm') return 'à tout le royaume'
    if (l.scope === 'house') return `à la maison ${getHouse(l.to_scope).nom}`
    const names = (l.recipients ?? []).map((r) => r.profile?.character_name).filter(Boolean)
    return names.length ? `à ${names.join(', ')}` : 'à un destinataire'
  }

  if (!letters.length) return <div className="empty">Aucun corbeau n'a encore été échangé.</div>

  return (
    <div>
      <p className="hint" style={{ marginTop: 0, marginBottom: 12 }}>
        🔓 En tant que Mestre, tu peux lire tous les corbeaux privés (les 100 plus récents). À utiliser avec discernement.
      </p>
      <div className="ravens">
        {letters.map((l) => {
          const isOpen = open === l.id
          const img = isOpen ? publicImageUrl(l.image_path) : null
          return (
            <div key={l.id} className="report-card" style={{ borderColor: 'var(--line)' }}>
              <button
                className="raven-row"
                style={{ border: 0, background: 'transparent', padding: 0 }}
                onClick={() => setOpen(isOpen ? null : l.id)}
              >
                <Seal house={l.sender?.house} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <span style={{ color: '#E7DBBE', fontSize: 15 }}>{l.sender?.character_name ?? 'Inconnu'}</span>
                    <span style={{ color: '#9C8F71', fontSize: 12 }}>→ {toLabel(l)}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 12, color: '#9C8F71' }}>{fmtDate(l.sent_at)}</span>
                  </div>
                  <div style={{ fontFamily: 'var(--display)', fontSize: 14, color: 'var(--parch)', marginTop: 2 }}>
                    {l.subject || '(sans objet)'}
                  </div>
                </div>
              </button>
              {isOpen && (
                <div style={{ marginTop: 10 }}>
                  <div className="report-target" style={{ whiteSpace: 'pre-wrap' }}>{l.body || '(vide)'}</div>
                  {img && <img className="letter-img" src={img} alt="pièce jointe" style={{ marginTop: 10 }} />}
                  {!ro && (
                    <button
                      className="tiny danger"
                      style={{ marginTop: 10 }}
                      onClick={() => {
                        if (confirm('Supprimer ce corbeau définitivement ?'))
                          deleteLetter(l.id).then(onChanged)
                      }}
                    >
                      🗑️ Supprimer
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Nettoyage (granulaire pour Mestres, total pour Grand Mestre) ───────── */

function NettoyageZone({ isFounder, onChanged }: { isFounder: boolean; onChanged: () => void }) {
  const [busy, setBusy] = useState('')

  async function run(label: string, confirmMsg: string, fn: () => Promise<void>, okMsg: string) {
    if (!confirm(confirmMsg)) return
    setBusy(label)
    try {
      await fn()
      await logAdmin('Nettoyage : ' + label)
      onChanged()
      alert(okMsg)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Action impossible.')
    } finally {
      setBusy('')
    }
  }

  return (
    <div>
      <h3 className="section-h" style={{ fontSize: 12 }}>Vider un salon</h3>
      <p className="hint" style={{ marginTop: 0, marginBottom: 14 }}>
        Efface le contenu d'<b>un seul salon</b> à la fois. Les comptes et les maisons sont conservés.
      </p>

      <div className="clean-list">
        <div className="clean-row">
          <span>🐦‍⬛ Corbeaux <span style={{ color: '#9C8F71' }}>(toutes les lettres privées)</span></span>
          <button
            className="tiny danger"
            disabled={!!busy}
            onClick={() =>
              run('corbeaux', 'Vider TOUS les corbeaux (lettres privées de tout le monde) ?', clearCorbeaux, 'Corbeaux vidés.')
            }
          >
            {busy === 'corbeaux' ? '…' : '🧹 Vider'}
          </button>
        </div>

        {CHANNELS.map((c) => (
          <div key={c.key} className="clean-row">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <ChannelIcon channel={c} /> {c.name}
            </span>
            <button
              className="tiny danger"
              disabled={!!busy}
              onClick={() =>
                run(
                  c.key,
                  `Vider tout le contenu du salon « ${c.name} » ?`,
                  () => clearChannel(c.key),
                  `Salon « ${c.name} » vidé.`,
                )
              }
            >
              {busy === c.key ? '…' : '🧹 Vider'}
            </button>
          </div>
        ))}
      </div>

      {isFounder ? (
        <div className="danger-zone" style={{ marginTop: 26 }}>
          <h3 className="section-h" style={{ fontSize: 12, color: '#E7A79F', marginBottom: 10 }}>
            ☠️ Réinitialisation totale — Grand Mestre
          </h3>
          <p style={{ color: '#A99C7E', fontSize: 14, lineHeight: 1.55, margin: '0 0 14px' }}>
            Efface <b>tout le contenu RP d'un coup</b> (tous les salons + tous les corbeaux + commentaires
            + signalements). Les <b>comptes</b> sont conservés. Réservé au Grand Mestre. Irréversible.
          </p>
          <button
            className="tiny danger"
            disabled={!!busy}
            onClick={async () => {
              if (!confirm("Tout effacer d'un coup (tout le RP) ?")) return
              if (!confirm('Dernière confirmation — action irréversible. Continuer ?')) return
              setBusy('purge')
              try {
                await purgeContent()
                await logAdmin('Réinitialisation totale du contenu RP')
                onChanged()
                alert('Tout le contenu RP a été réinitialisé.')
              } catch (e) {
                alert(e instanceof Error ? e.message : 'Action impossible.')
              } finally {
                setBusy('')
              }
            }}
          >
            {busy === 'purge' ? '…' : '☠️ Tout réinitialiser d\'un coup'}
          </button>
        </div>
      ) : (
        <p className="hint" style={{ marginTop: 24 }}>
          🔒 Seul le <b>Grand Mestre</b> (fondateur) peut tout effacer d'un coup.
        </p>
      )}
    </div>
  )
}
