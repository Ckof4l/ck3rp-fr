import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { listNotifications, markAllNotifsRead, markNotifRead, type Notif } from '../lib/notifications'
import { getChannel } from '../lib/channels'
import { fmtDate } from '../lib/format'
import { Seal } from './Seal'

/* ============================================================================
   La cloche — notifications de mentions @joueur, en temps réel.
   Clic sur une entrée → ouvre la lettre dans son salon (?post=…).
   ========================================================================== */

export function NotifBell() {
  const { profile } = useAuth()
  const meId = profile?.id
  const nav = useNavigate()
  const [items, setItems] = useState<Notif[]>([])
  const [open, setOpen] = useState(false)
  const unread = items.filter((n) => !n.read_at).length

  const refresh = useCallback(async () => {
    if (meId) setItems(await listNotifications())
  }, [meId])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!meId) return
    const ch = supabase
      .channel(`notifs:${meId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `profile_id=eq.${meId}` },
        () => refresh(),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [meId, refresh])

  async function openNotif(n: Notif) {
    setOpen(false)
    if (!n.read_at) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)))
      markNotifRead(n.id)
    }
    if (n.channel && n.post_id) nav(`/c/${n.channel}?post=${n.post_id}`)
  }

  async function allRead() {
    setItems((prev) => prev.map((x) => (x.read_at ? x : { ...x, read_at: new Date().toISOString() })))
    markAllNotifsRead()
  }

  if (!meId) return null

  return (
    <div className="notif-wrap">
      <button
        className="notif-btn"
        title="Notifications"
        aria-label={`Notifications${unread ? ` (${unread} non lues)` : ''}`}
        onClick={() => setOpen((o) => !o)}
      >
        🔔
        {unread > 0 && <span className="notif-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <>
          <div className="notif-scrim" onClick={() => setOpen(false)} />
          <div className="notif-menu">
            <div className="notif-head">
              <span className="kicker" style={{ margin: 0 }}>On parle de toi</span>
              {unread > 0 && (
                <button className="linkbtn" onClick={allRead}>
                  Tout marquer lu
                </button>
              )}
            </div>
            {!items.length ? (
              <div className="notif-empty">Nul ne t'a encore mentionné.</div>
            ) : (
              items.map((n) => (
                <button key={n.id} className={`notif-item${n.read_at ? '' : ' unread'}`} onClick={() => openNotif(n)}>
                  <Seal house={n.actor?.house} size="sm" />
                  <span className="notif-body">
                    <span className="notif-line">
                      <b>{n.actor?.character_name ?? 'Quelqu’un'}</b> t'a mentionné
                      {n.channel ? ` · ${getChannel(n.channel)?.name ?? n.channel}` : ''}
                    </span>
                    {n.excerpt && <span className="notif-excerpt">« {n.excerpt} »</span>}
                    <span className="notif-date">{fmtDate(n.created_at)}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
