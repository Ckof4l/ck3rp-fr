import { useState } from 'react'
import { createReport } from '../lib/admin'
import type { ReportTargetType } from '../types/database'

/* Bouton « Signaler » — déplie un petit champ motif puis envoie à la file de
   modération des Grands Mestres. */

export function ReportButton({
  meId,
  targetType,
  targetId,
}: {
  meId: string
  targetType: ReportTargetType
  targetId: string
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  if (done) return <span className="report-done">⚑ Signalé</span>

  async function send() {
    setBusy(true)
    try {
      await createReport({ meId, targetType, targetId, reason })
      setDone(true)
      setOpen(false)
    } catch {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button className="report-link" onClick={() => setOpen(true)} title="Signaler aux Grands Mestres">
        ⚑ Signaler
      </button>
    )
  }

  return (
    <div className="report-box">
      <input
        className="input"
        style={{ fontSize: 14, padding: '8px 10px' }}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Motif (facultatif)…"
        autoFocus
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
        <button className="tiny danger" disabled={busy} onClick={send}>
          Envoyer le signalement
        </button>
        <button className="tiny" onClick={() => setOpen(false)}>
          Annuler
        </button>
      </div>
    </div>
  )
}
