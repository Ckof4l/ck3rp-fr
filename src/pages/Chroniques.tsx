import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getHouse } from '../lib/houses'
import { fmtDate } from '../lib/format'
import { supabase } from '../lib/supabase'
import { listChronicles, addChronicle, deleteChronicle, type Chronicle } from '../lib/realm'
import { Seal } from '../components/Seal'
import { CharLink } from '../components/CharLink'
import { AutoTextarea } from '../components/AutoTextarea'
import { Lettrine } from '../components/Lettrine'

/* ============================================================================
   Les Chroniques — annales des événements marquants du royaume.
   ========================================================================== */

export function Chroniques() {
  const { profile } = useAuth()
  const meId = profile!.id
  const isAdmin = !!profile?.is_admin

  const [items, setItems] = useState<Chronicle[]>([])
  const [loading, setLoading] = useState(true)
  const [composing, setComposing] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setItems(await listChronicles())
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    const ch = supabase
      .channel('chronicles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chronicles' }, () => refresh())
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [refresh])

  return (
    <section>
      <h2 className="section-h">📖 Les Chroniques du royaume</h2>
      <p className="channel-desc">Les grands événements qui ont marqué l'histoire des Sept Royaumes.</p>

      {isAdmin &&
        (composing ? (
          <ChronicleForm meId={meId} onDone={async () => { setComposing(false); await refresh() }} onCancel={() => setComposing(false)} />
        ) : (
          <button className="btn-seal" style={{ marginBottom: 18 }} onClick={() => setComposing(true)}>
            ✒️ Consigner un événement
          </button>
        ))}

      {loading ? (
        <div className="empty">Ouverture des annales…</div>
      ) : !items.length ? (
        <div className="empty">Aucune chronique pour l'instant. L'histoire reste à écrire.</div>
      ) : (
        <div className="chronicles">
          {items.map((c) => {
            const h = getHouse(c.author?.house)
            return (
              <article key={c.id} className="chronicle">
                <div className="chr-date">{c.event_date ? new Date(c.event_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : fmtDate(c.created_at)}</div>
                <div className="chr-body">
                  <h3 className="chr-title">{c.title}</h3>
                  {c.body && (c.title ? <Lettrine>{c.body}</Lettrine> : <div className="pact-body">{c.body}</div>)}
                  <div className="chr-author">
                    <Seal house={c.author?.house} size="sm" /> Consigné par <CharLink id={c.author_profile}>{c.author?.character_name ?? 'un mestre'}</CharLink> · Maison {h.nom}
                  </div>
                  {isAdmin && (
                    <button className="tiny danger" style={{ marginTop: 8 }} onClick={() => confirm('Supprimer cette chronique ?') && deleteChronicle(c.id).then(refresh)}>
                      🗑️ Supprimer
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

function ChronicleForm({ meId, onDone, onCancel }: { meId: string; onDone: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')

  async function submit() {
    if (!title.trim()) return setStatus('Donne un titre à l\'événement.')
    setBusy(true)
    try {
      await addChronicle({ meId, title, body, eventDate })
      onDone()
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Échec.')
      setBusy(false)
    }
  }

  return (
    <div className="composer" style={{ marginBottom: 22 }}>
      <div className="field">
        <label>Titre de l'événement</label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ex. La bataille du Trident" />
      </div>
      <div className="field">
        <label>Date (facultatif)</label>
        <input className="input" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
      </div>
      <div className="field">
        <label>Récit</label>
        <AutoTextarea className="input" style={{ minHeight: 110 }} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Ce qui s'est passé…" />
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn-seal" disabled={busy} onClick={submit}>📖 Consigner</button>
        <button className="btn-ghost" disabled={busy} onClick={onCancel}>Annuler</button>
        {status && <span className="sent-ok">{status}</span>}
      </div>
    </div>
  )
}
