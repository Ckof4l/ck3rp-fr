import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getHouse, housesByRegion, FREE_HOUSE_KEY } from '../lib/houses'
import { supabase } from '../lib/supabase'
import {
  listKings,
  listThroneClaims,
  declareClaim,
  withdrawClaim,
  listFealty,
  swearFealty,
  breakFealty,
  type King,
  type ThroneClaim,
  type Fealty,
} from '../lib/politics'
import { Seal } from '../components/Seal'
import { CharLink } from '../components/CharLink'
import { HelpCard } from '../components/HelpCard'

/* ============================================================================
   Le Trône de Fer — Rois, prétendants et allégeances entre maisons.
   ========================================================================== */

export function Politique() {
  const { profile } = useAuth()
  const meId = profile!.id
  const myHouse = profile!.house
  const hasHouse = !!myHouse && myHouse !== FREE_HOUSE_KEY

  const [kings, setKings] = useState<King[]>([])
  const [claims, setClaims] = useState<ThroneClaim[]>([])
  const [fealty, setFealty] = useState<Fealty[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const [k, c, f] = await Promise.all([listKings(), listThroneClaims(), listFealty()])
    setKings(k)
    setClaims(c)
    setFealty(f)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    const ch = supabase
      .channel('politics')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'throne_claims' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fealty' }, () => refresh())
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [refresh])

  const myClaim = claims.find((c) => c.house_key === myHouse)
  const myFealty = fealty.find((f) => f.vassal_house === myHouse)

  // Regroupe les allégeances par liège.
  const byLiege = useMemo(() => {
    const map: Record<string, Fealty[]> = {}
    for (const f of fealty) {
      ;(map[f.liege_house] ??= []).push(f)
    }
    return Object.entries(map).sort((a, b) => b[1].length - a[1].length)
  }, [fealty])

  if (loading) return <div className="empty">Consultation des registres du royaume…</div>

  return (
    <section>
      <h2 className="section-h">👑 Le Trône de Fer</h2>

      <HelpCard id="trone" title="Le Trône de Fer — comment ça marche ?">
        <ul>
          <li><b>Revendique le Trône de Fer</b> au nom de ta maison (avec une justification).</li>
          <li>Les <b>Rois</b> sont les joueurs sacrés par un Mestre.</li>
          <li><b>Jure allégeance</b> à une autre maison (ton liège) — ou romps ce serment.</li>
          <li>Tu ne gères que <b>ta propre maison</b>.</li>
        </ul>
      </HelpCard>

      {/* Prétendants */}
      <h3 className="section-h" style={{ fontSize: 12 }}>⚔️ Prétendants au Trône de Fer</h3>
      {claims.length ? (
        <div className="ravens" style={{ marginBottom: 14 }}>
          {claims.map((c) => {
            const h = getHouse(c.house_key)
            return (
              <div key={c.house_key} className="raven-row">
                <Seal house={c.house_key} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#E7DBBE', fontSize: 15 }}>Maison {h.nom}</div>
                  <div style={{ color: '#9C8F71', fontSize: 12 }}>Porté par <CharLink id={c.claimant_profile}>{c.claimant?.character_name ?? 'un seigneur'}</CharLink></div>
                  {c.justification && <div className="pact-body" style={{ marginTop: 6, marginBottom: 0 }}>« {c.justification} »</div>}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="empty" style={{ marginBottom: 14 }}>Nul n'ose encore revendiquer le Trône de Fer.</div>
      )}

      {hasHouse && (
        <ClaimControl meId={meId} myHouse={myHouse} myClaim={myClaim} onChanged={refresh} />
      )}

      {/* Rois */}
      <h3 className="section-h" style={{ fontSize: 12, marginTop: 26 }}>👑 Les Rois des Sept Royaumes</h3>
      {kings.length ? (
        <div className="armorial-grid" style={{ marginBottom: 14 }}>
          {kings.map((k) => {
            const h = getHouse(k.house)
            return (
              <Link key={k.id} to={`/personnage/${k.id}`} className="armorial-card" style={{ textDecoration: 'none' }}>
                <Seal house={k.house} size="lg" />
                <div style={{ minWidth: 0 }}>
                  <div className="armorial-name">👑 {k.character_name}</div>
                  <div className="armorial-devise">Maison {h.nom} · {h.region}</div>
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="empty" style={{ marginBottom: 14 }}>Aucun Roi n'a encore été sacré.</div>
      )}

      {/* Allégeances */}
      <h3 className="section-h" style={{ fontSize: 12, marginTop: 26 }}>🤝 Les Allégeances</h3>
      {byLiege.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 14 }}>
          {byLiege.map(([liege, vassals]) => {
            const lh = getHouse(liege)
            return (
              <div key={liege} className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <Seal house={liege} /> <b style={{ color: '#E7DBBE' }}>Maison {lh.nom}</b>
                  <span style={{ color: '#9C8F71', fontSize: 12 }}>· {vassals.length} vassal(aux)</span>
                </div>
                <div className="pact-houses">
                  {vassals.map((v) => (
                    <span key={v.vassal_house} className="pact-house">
                      <Seal house={v.vassal_house} size="sm" /> {getHouse(v.vassal_house).nom}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="empty" style={{ marginBottom: 14 }}>Aucune allégeance n'a encore été jurée.</div>
      )}

      {hasHouse && (
        <FealtyControl meId={meId} myHouse={myHouse} myFealty={myFealty} onChanged={refresh} />
      )}
    </section>
  )
}

/* ── Contrôle : ma revendication ───────────────────────────────────────── */

function ClaimControl({ meId, myHouse, myClaim, onChanged }: { meId: string; myHouse: string; myClaim?: ThroneClaim; onChanged: () => void }) {
  const [just, setJust] = useState(myClaim?.justification ?? '')
  const [busy, setBusy] = useState(false)
  const h = getHouse(myHouse)

  async function act(fn: () => Promise<void>) {
    setBusy(true)
    try { await fn(); onChanged() } catch (e) { alert(e instanceof Error ? e.message : 'Action impossible.') } finally { setBusy(false) }
  }

  return (
    <div className="composer">
      {myClaim ? (
        <>
          <p style={{ margin: '0 0 8px', color: '#C7B894' }}>La Maison {h.nom} revendique le Trône de Fer.</p>
          <button className="tiny danger" disabled={busy} onClick={() => act(() => withdrawClaim(myHouse))}>Retirer ma prétention</button>
        </>
      ) : (
        <>
          <div className="field" style={{ marginBottom: 8 }}>
            <label>Revendiquer le Trône de Fer (Maison {h.nom})</label>
            <input className="input" value={just} onChange={(e) => setJust(e.target.value)} placeholder="Ta justification (lignée, conquête, prophétie…)" />
          </div>
          <button className="btn-seal" disabled={busy} onClick={() => act(() => declareClaim(meId, myHouse, just))}>👑 Revendiquer le Trône</button>
        </>
      )}
    </div>
  )
}

/* ── Contrôle : mon allégeance ─────────────────────────────────────────── */

function FealtyControl({ meId, myHouse, myFealty, onChanged }: { meId: string; myHouse: string; myFealty?: Fealty; onChanged: () => void }) {
  const [liege, setLiege] = useState('')
  const [busy, setBusy] = useState(false)
  const h = getHouse(myHouse)

  async function act(fn: () => Promise<void>) {
    setBusy(true)
    try { await fn(); onChanged() } catch (e) { alert(e instanceof Error ? e.message : 'Action impossible.') } finally { setBusy(false) }
  }

  return (
    <div className="composer">
      {myFealty ? (
        <>
          <p style={{ margin: '0 0 8px', color: '#C7B894' }}>
            La Maison {h.nom} a juré allégeance à la <b>Maison {getHouse(myFealty.liege_house).nom}</b>.
          </p>
          <button className="tiny danger" disabled={busy} onClick={() => act(() => breakFealty(myHouse))}>Rompre l'allégeance</button>
        </>
      ) : (
        <>
          <div className="field" style={{ marginBottom: 8 }}>
            <label>Jurer allégeance à une maison (au nom de la Maison {h.nom})</label>
            <select className="input" value={liege} onChange={(e) => setLiege(e.target.value)}>
              <option value="">— Choisis un liège —</option>
              {housesByRegion().map(({ region, houses }) => (
                <optgroup key={region} label={region}>
                  {houses.filter((hh) => hh.key !== FREE_HOUSE_KEY && hh.key !== myHouse).map((hh) => (
                    <option key={hh.key} value={hh.key}>{hh.nom}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <button className="btn-seal" disabled={busy || !liege} onClick={() => act(() => swearFealty(meId, myHouse, liege))}>🤝 Jurer allégeance</button>
        </>
      )}
    </div>
  )
}
