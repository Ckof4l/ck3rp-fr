import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getHouse, housesByRegion, FREE_HOUSE_KEY } from '../lib/houses'
import { fmtDate } from '../lib/format'
import { supabase } from '../lib/supabase'
import { listPacts, createPact, signPact, deletePact, type Pact } from '../lib/pacts'
import { Seal } from '../components/Seal'
import { HelpCard } from '../components/HelpCard'

/* ============================================================================
   Pactes & Diplomatie — traités entre maisons.
   ========================================================================== */

export function Pactes() {
  const { profile } = useAuth()
  const meId = profile!.id
  const myHouse = profile!.house
  const isAdmin = !!profile?.is_admin
  const canPropose = !profile?.is_observer

  const [pacts, setPacts] = useState<Pact[]>([])
  const [loading, setLoading] = useState(true)
  const [composing, setComposing] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setPacts(await listPacts())
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    const ch = supabase
      .channel('pacts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pacts' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pact_houses' }, () => refresh())
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [refresh])

  return (
    <section>
      <h2 className="section-h">🤝 Pactes &amp; Diplomatie</h2>
      <p className="channel-desc">Les traités, alliances et serments qui lient les maisons des Sept Royaumes.</p>

      <HelpCard id="pactes" title="Les Pactes — comment ça marche ?">
        Scelle des traités officiels entre maisons.
        <ul>
          <li><b>✒️ Proposer un pacte</b> : un titre, les termes, et <b>coche les maisons signataires</b>. Ta maison signe d'office.</li>
          <li>Chaque maison ratifie via l'un de ses joueurs : si <b>ta maison</b> est concernée, un bouton <b>✍️ Signer</b> apparaît.</li>
          <li>Un pacte devient <b>✓ Ratifié</b> quand toutes les maisons ont signé.</li>
          <li>L'auteur (ou un Mestre) peut <b>dénoncer</b> un pacte.</li>
        </ul>
      </HelpCard>

      {canPropose &&
        (composing ? (
          <PactForm
            meId={meId}
            myHouse={myHouse}
            onDone={async () => {
              setComposing(false)
              await refresh()
            }}
            onCancel={() => setComposing(false)}
          />
        ) : (
          <button className="btn-seal" style={{ marginBottom: 18 }} onClick={() => setComposing(true)}>
            ✒️ Proposer un pacte
          </button>
        ))}

      {loading ? (
        <div className="empty">Ouverture des archives diplomatiques…</div>
      ) : !pacts.length ? (
        <div className="empty">Aucun pacte n'a encore été scellé. La diplomatie attend ses artisans.</div>
      ) : (
        <div className="feed">
          {pacts.map((p) => (
            <PactCard
              key={p.id}
              pact={p}
              meId={meId}
              myHouse={myHouse}
              isAdmin={isAdmin}
              onChanged={refresh}
            />
          ))}
        </div>
      )}
    </section>
  )
}

/* ── Carte d'un pacte ──────────────────────────────────────────────────── */

function PactCard({
  pact,
  meId,
  myHouse,
  isAdmin,
  onChanged,
}: {
  pact: Pact
  meId: string
  myHouse: string
  isAdmin: boolean
  onChanged: () => void
}) {
  const signed = pact.houses.filter((h) => h.signed_by).length
  const total = pact.houses.length
  const ratified = total > 0 && signed === total
  const myRow = pact.houses.find((h) => h.house_key === myHouse)
  const canSign = myRow && !myRow.signed_by
  const canDelete = isAdmin // un joueur ne retire pas ses propres traces

  async function act(fn: () => Promise<void>) {
    try {
      await fn()
      onChanged()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Action impossible.')
    }
  }

  return (
    <div className="pact-card">
      <div className="pact-head">
        <h3 className="pact-title">{pact.title}</h3>
        <span className={`pact-status${ratified ? ' ok' : ''}`}>
          {ratified ? '✓ Ratifié' : `✍️ ${signed}/${total} signatures`}
        </span>
      </div>
      <div className="pact-meta">
        Proposé par {pact.author?.character_name ?? 'Inconnu'}
        {pact.author?.house ? ` · Maison ${getHouse(pact.author.house).nom}` : ''} · {fmtDate(pact.created_at)}
      </div>

      {pact.body && <div className="pact-body">{pact.body}</div>}

      <div className="pact-houses">
        {pact.houses.map((h) => {
          const hh = getHouse(h.house_key)
          return (
            <span
              key={h.house_key}
              className={`pact-house${h.signed_by ? ' signed' : ''}`}
              title={
                h.signed_by
                  ? `Signé par ${h.signer?.character_name ?? '?'}`
                  : 'En attente de signature'
              }
            >
              <Seal house={h.house_key} size="sm" />
              {hh.nom} {h.signed_by ? '✓' : '⏳'}
            </span>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        {canSign && (
          <button className="btn-seal" onClick={() => act(() => signPact(pact.id, myHouse, meId))}>
            ✍️ Signer pour la Maison {getHouse(myHouse).nom}
          </button>
        )}
        {canDelete && (
          <button className="tiny danger" onClick={() => confirm('Dénoncer (supprimer) ce pacte ?') && act(() => deletePact(pact.id))}>
            🗑️ Dénoncer
          </button>
        )}
      </div>
    </div>
  )
}

/* ── Proposer un pacte ─────────────────────────────────────────────────── */

function PactForm({
  meId,
  myHouse,
  onDone,
  onCancel,
}: {
  meId: string
  myHouse: string
  onDone: () => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function submit() {
    if (!title.trim()) return setStatus('Donne un titre au pacte.')
    if (selected.size === 0) return setStatus('Choisis au moins une autre maison signataire.')
    setBusy(true)
    setStatus('Scellage du pacte…')
    try {
      await createPact({ meId, myHouse, title, body, houses: [...selected] })
      onDone()
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'La création a échoué.')
      setBusy(false)
    }
  }

  return (
    <div className="composer" style={{ marginBottom: 22 }}>
      <div className="field">
        <label>Titre du pacte</label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ex. Pacte du Nord et du Trident" />
      </div>
      <div className="field">
        <label>Termes du traité</label>
        <textarea className="input" style={{ minHeight: 110 }} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Les clauses, serments et engagements…" />
      </div>
      <div className="field">
        <label>Maisons signataires (en plus de la tienne, {getHouse(myHouse).nom})</label>
        <div className="pact-pick">
          {housesByRegion().map(({ region, houses }) => (
            <div key={region}>
              <div className="region-h">{region}</div>
              <div className="pact-pick-row">
                {houses
                  .filter((h) => h.key !== FREE_HOUSE_KEY && h.key !== myHouse)
                  .map((h) => (
                    <button
                      key={h.key}
                      type="button"
                      className={`pact-pick-item${selected.has(h.key) ? ' on' : ''}`}
                      onClick={() => toggle(h.key)}
                    >
                      <Seal house={h.key} size="sm" /> {h.nom}
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn-seal" disabled={busy} onClick={submit}>
          ✒️ Sceller le pacte
        </button>
        <button className="btn-ghost" disabled={busy} onClick={onCancel}>
          Annuler
        </button>
        {status && <span className="sent-ok">{status}</span>}
      </div>
    </div>
  )
}
