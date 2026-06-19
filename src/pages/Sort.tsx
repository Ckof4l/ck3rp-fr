import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getHouse } from '../lib/houses'
import { fmtDate } from '../lib/format'
import { supabase } from '../lib/supabase'
import { listRolls, rollDice, deleteRoll, type Roll, type RollKind } from '../lib/rolls'
import { Seal } from '../components/Seal'
import { HelpCard } from '../components/HelpCard'

/* ============================================================================
   Le Sort — trancher au hasard (dés, pile ou face). Tirage serveur, public.
   ========================================================================== */

const KINDS: { kind: RollKind; icon: string; label: string }[] = [
  { kind: 'coin', icon: '🪙', label: 'Pile ou Face' },
  { kind: 'd6', icon: '🎲', label: 'Dé à 6' },
  { kind: 'd20', icon: '🎲', label: 'Dé à 20' },
  { kind: 'd100', icon: '🎲', label: 'Dé à 100' },
]

function rollLabel(k: RollKind): string {
  return KINDS.find((x) => x.kind === k)?.label ?? k
}

export function Sort() {
  const { profile } = useAuth()
  const isAdmin = !!profile?.is_admin
  const canRoll = !profile?.is_observer

  const [rolls, setRolls] = useState<Roll[]>([])
  const [loading, setLoading] = useState(true)
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [last, setLast] = useState<{ kind: RollKind; result: string } | null>(null)

  const refresh = useCallback(async () => {
    setRolls(await listRolls())
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    const ch = supabase
      .channel('rolls')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rolls' }, () => refresh())
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [refresh])

  async function roll(kind: RollKind) {
    if (!canRoll || busy) return
    setBusy(true)
    setLast(null)
    try {
      const result = await rollDice(kind, label)
      setLast({ kind, result })
      setLabel('')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Tirage impossible.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <h2 className="section-h">🎲 Le Sort</h2>
      <p className="channel-desc">Quand la raison ne tranche plus, laisse le hasard décider. Tirage scellé, visible de tous.</p>

      <HelpCard id="sort" title="Le Sort — comment ça marche ?">
        <ul>
          <li>Choisis une raison (facultatif), puis lance une <b>pièce</b> ou un <b>dé</b>.</li>
          <li>Le résultat est tiré <b>par le serveur</b> et inscrit au registre : <b>impossible à truquer ni à effacer</b>.</li>
          <li>Tous les tirages sont <b>publics</b> — parfait pour trancher un duel, un ordre de marche, un héritage…</li>
        </ul>
      </HelpCard>

      {canRoll ? (
        <div className="card" style={{ marginBottom: 22 }}>
          <div className="field">
            <label>Raison du tirage (facultatif)</label>
            <input
              className="input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="ex. Qui attaque en premier ?"
            />
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
            {KINDS.map((k) => (
              <button key={k.kind} className="btn-seal" disabled={busy} onClick={() => roll(k.kind)}>
                {k.icon} {k.label}
              </button>
            ))}
          </div>
          {last && (
            <div className="roll-result" style={{ marginTop: 16, textAlign: 'center' }}>
              <div className="kicker">{rollLabel(last.kind)}</div>
              <div style={{ fontFamily: 'var(--display)', fontSize: 44, color: 'var(--gold)', lineHeight: 1.1 }}>
                {last.result}
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="hint">Mode observateur — tu peux lire le registre mais pas tirer.</p>
      )}

      <h3 className="section-h" style={{ fontSize: 12, marginTop: 8 }}>📜 Registre des tirages</h3>
      {loading ? (
        <div className="empty">Ouverture du registre…</div>
      ) : !rolls.length ? (
        <div className="empty">Aucun tirage pour l'instant.</div>
      ) : (
        <div className="ravens">
          {rolls.map((r) => {
            const h = getHouse(r.author?.house)
            return (
              <div key={r.id} className="report-card" style={{ borderColor: 'var(--line)' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Seal house={r.author?.house} size="sm" />
                  <span style={{ color: '#E7DBBE' }}>{r.author?.character_name ?? 'Inconnu'}</span>
                  <span style={{ color: '#9C8F71', fontSize: 12 }}>Maison {h.nom}</span>
                  <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span className="kicker" style={{ fontSize: 11 }}>{rollLabel(r.kind)}</span>
                    <span style={{ fontFamily: 'var(--display)', fontSize: 20, color: 'var(--gold)' }}>{r.result}</span>
                  </span>
                </div>
                <div style={{ color: '#9C8F71', fontSize: 12, marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {r.label && <span style={{ fontStyle: 'italic' }}>« {r.label} »</span>}
                  <span style={{ marginLeft: 'auto' }}>{fmtDate(r.created_at)}</span>
                </div>
                {isAdmin && (
                  <button className="tiny danger" style={{ marginTop: 8 }} onClick={() => deleteRoll(r.id).then(refresh)}>
                    🗑️ Retirer
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
