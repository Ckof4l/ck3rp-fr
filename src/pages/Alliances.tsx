import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getHouse, rkStyle } from '../lib/houses'
import { fmtDate } from '../lib/format'
import { supabase } from '../lib/supabase'
import { listPlayers } from '../lib/directory'
import {
  listAlliances,
  proposeAlliance,
  decideAlliance,
  deleteAlliance,
  type Alliance,
} from '../lib/alliances'
import type { Profile } from '../types/database'
import { Seal } from '../components/Seal'
import { CharLink } from '../components/CharLink'
import { HelpCard } from '../components/HelpCard'

/* ============================================================================
   Alliances — un joueur propose une alliance à un autre ; un Mestre la valide.
   ========================================================================== */

export function Alliances() {
  const { profile } = useAuth()
  const meId = profile!.id
  const isAdmin = !!profile?.is_admin
  const canPropose = !profile?.is_observer

  const [alliances, setAlliances] = useState<Alliance[]>([])
  const [players, setPlayers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setAlliances(await listAlliances())
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    listPlayers().then(setPlayers)
    const ch = supabase
      .channel('alliances')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alliances' }, () => refresh())
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [refresh])

  const active = alliances.filter((a) => a.status === 'accepted')
  const pending = alliances.filter((a) => a.status === 'pending')
  const mine = alliances.filter(
    (a) => a.status !== 'accepted' && (a.proposer_profile === meId || a.target_profile === meId),
  )

  return (
    <section>
      <h2 className="section-h">🤝 Alliances</h2>
      <p className="channel-desc">Tisse des liens entre maisons. Une alliance proposée n'est scellée qu'une fois validée par un Mestre.</p>

      <HelpCard id="alliances" title="Les Alliances — comment ça marche ?">
        <ul>
          <li><b>Propose</b> une alliance au joueur de ton choix (ici ou depuis sa fiche).</li>
          <li>Un <b>Mestre</b> doit la <b>valider</b> : tu ne peux pas la sceller toi-même.</li>
          <li>Une fois acceptée, l'alliance devient <b>publique</b> et apparaît ci-dessous.</li>
        </ul>
      </HelpCard>

      {canPropose && <ProposeForm meId={meId} players={players} onDone={refresh} />}

      {/* File de validation (Mestres) */}
      {isAdmin && pending.length > 0 && (
        <>
          <h3 className="section-h" style={{ fontSize: 12, marginTop: 8 }}>⚖️ À valider</h3>
          <div className="ravens" style={{ marginBottom: 18 }}>
            {pending.map((a) => (
              <AllianceCard key={a.id} a={a} meId={meId} isAdmin onChanged={refresh} />
            ))}
          </div>
        </>
      )}

      {/* Mes demandes en cours (non-admin, ou admin partie prenante) */}
      {mine.length > 0 && (
        <>
          <h3 className="section-h" style={{ fontSize: 12 }}>📨 Mes demandes</h3>
          <div className="ravens" style={{ marginBottom: 18 }}>
            {mine.map((a) => (
              <AllianceCard key={a.id} a={a} meId={meId} isAdmin={isAdmin} onChanged={refresh} />
            ))}
          </div>
        </>
      )}

      <h3 className="section-h" style={{ fontSize: 12 }}>📜 Alliances scellées</h3>
      {loading ? (
        <div className="empty">Ouverture du registre…</div>
      ) : !active.length ? (
        <div className="empty">Aucune alliance scellée pour l'instant.</div>
      ) : (
        <div className="ravens">
          {active.map((a) => (
            <AllianceCard key={a.id} a={a} meId={meId} isAdmin={isAdmin} onChanged={refresh} />
          ))}
        </div>
      )}
    </section>
  )
}

/* ── Carte d'une alliance ──────────────────────────────────────────────── */

function AllianceCard({
  a,
  meId,
  isAdmin,
  onChanged,
}: {
  a: Alliance
  meId: string
  isAdmin: boolean
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const ph = getHouse(a.proposer?.house)
  const th = getHouse(a.target?.house)
  const canDelete = isAdmin || (a.proposer_profile === meId && a.status === 'pending')

  async function decide(accept: boolean) {
    setBusy(true)
    try {
      await decideAlliance(a.id, accept)
      onChanged()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Action impossible.')
      setBusy(false)
    }
  }

  return (
    <div className="report-card" style={{ borderColor: 'var(--line)', ...rkStyle(a.proposer?.house) }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Seal house={a.proposer?.house} size="sm" />
        <span style={{ color: '#E7DBBE' }}><CharLink id={a.proposer_profile}>{a.proposer?.character_name ?? 'Inconnu'}</CharLink></span>
        <span style={{ color: '#9C8F71' }}>🤝</span>
        <Seal house={a.target?.house} size="sm" />
        <span style={{ color: '#E7DBBE' }}><CharLink id={a.target_profile}>{a.target?.character_name ?? 'Inconnu'}</CharLink></span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#9C8F71' }}>{fmtDate(a.created_at)}</span>
      </div>
      <div style={{ color: '#9C8F71', fontSize: 12, marginTop: 4 }}>
        Maison {ph.nom} · Maison {th.nom}
      </div>
      {a.message && <div className="pact-body" style={{ marginTop: 8, marginBottom: 0 }}>« {a.message} »</div>}

      {a.status === 'pending' && (
        <div style={{ marginTop: 8, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="tk-badge wait">⏳ En attente d'un Mestre</span>
          {isAdmin && (
            <>
              <button className="tiny good" disabled={busy} onClick={() => decide(true)}>✓ Valider</button>
              <button className="tiny danger" disabled={busy} onClick={() => decide(false)}>✗ Refuser</button>
            </>
          )}
          {canDelete && !isAdmin && (
            <button className="tiny danger" onClick={() => confirm('Retirer ta demande ?') && deleteAlliance(a.id).then(onChanged)}>🗑️ Retirer</button>
          )}
        </div>
      )}
      {a.status === 'refused' && (
        <div style={{ marginTop: 8 }}><span className="tk-badge no">✗ Refusée par un Mestre</span></div>
      )}
      {a.status === 'accepted' && (
        <div style={{ marginTop: 8, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="tk-badge ok">✓ Alliance scellée</span>
          {a.resolver && <span style={{ color: '#9C8F71', fontSize: 12 }}>validée par {a.resolver.character_name}</span>}
          {isAdmin && (
            <button className="tiny danger" style={{ marginLeft: 'auto' }} onClick={() => confirm('Rompre cette alliance ?') && deleteAlliance(a.id).then(onChanged)}>🗑️ Rompre</button>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Proposer une alliance ─────────────────────────────────────────────── */

function ProposeForm({ meId, players, onDone }: { meId: string; players: Profile[]; onDone: () => void }) {
  const [params, setParams] = useSearchParams()
  const [target, setTarget] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')

  const others = players.filter((p) => p.id !== meId)

  // Pré-sélection depuis « Proposer une alliance » sur une fiche de personnage.
  const propose = params.get('propose')
  useEffect(() => {
    if (propose && propose !== meId && others.some((p) => p.id === propose)) {
      setTarget(propose)
      params.delete('propose')
      setParams(params, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propose, players])

  async function submit() {
    if (!target) return setStatus('Choisis un joueur.')
    setBusy(true)
    setStatus('')
    try {
      await proposeAlliance(target, message)
      setTarget('')
      setMessage('')
      setStatus('Proposition envoyée — en attente de validation d\'un Mestre.')
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
        <label>Proposer une alliance à</label>
        <select className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="">— Choisis un joueur —</option>
          {others.map((p) => (
            <option key={p.id} value={p.id}>
              {p.character_name} ({getHouse(p.house).nom})
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Mot d'accompagnement (facultatif)</label>
        <input className="input" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="ex. Unissons nos bannières contre l'hiver." />
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
        <button className="btn-seal" disabled={busy} onClick={submit}>🤝 Proposer l'alliance</button>
        {status && <span className="sent-ok">{status}</span>}
      </div>
    </div>
  )
}
