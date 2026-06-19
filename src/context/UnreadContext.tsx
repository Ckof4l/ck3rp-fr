import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { fetchUnreadCounts, markChannelSeen } from '../lib/unread'
import { countUnread } from '../lib/letters'
import { countPendingTickets } from '../lib/tickets'
import { useAuth } from './AuthContext'

/* ============================================================================
   Contexte des non-lus — alimente les pastilles de la barre latérale et se
   met à jour en temps réel (nouveaux posts, nouveaux/lus corbeaux).
   ========================================================================== */

interface UnreadState {
  counts: Record<string, number>
  corbeaux: number
  tickets: number
  refresh: () => Promise<void>
  markSeen: (channel: string) => Promise<void>
}

const UnreadContext = createContext<UnreadState | undefined>(undefined)

export function UnreadProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const meId = profile?.id
  const isAdmin = !!profile?.is_admin
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [corbeaux, setCorbeaux] = useState(0)
  const [tickets, setTickets] = useState(0)

  const refresh = useCallback(async () => {
    if (!meId) return
    const [c, u, t] = await Promise.all([
      fetchUnreadCounts(),
      countUnread(meId),
      isAdmin ? countPendingTickets() : Promise.resolve(0),
    ])
    setCounts(c)
    setCorbeaux(u)
    setTickets(t)
  }, [meId, isAdmin])

  const markSeen = useCallback(
    async (channel: string) => {
      if (!meId) return
      await markChannelSeen(meId, channel)
      setCounts((prev) => ({ ...prev, [channel]: 0 }))
    },
    [meId],
  )

  // Les posts arrivent de tout le serveur : on regroupe les rafales pour éviter
  // une tempête de requêtes quand plusieurs joueurs publient en même temps.
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const debouncedRefresh = useCallback(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      refresh()
    }, 600)
  }, [refresh])

  useEffect(() => {
    if (!meId) return
    refresh()
    const ch = supabase
      .channel(`unread:${meId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, debouncedRefresh)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'raven_recipients', filter: `profile_id=eq.${meId}` },
        () => refresh(),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => refresh())
      .subscribe()
    return () => {
      clearTimeout(debounceRef.current)
      supabase.removeChannel(ch)
    }
  }, [meId, refresh, debouncedRefresh])

  const value = useMemo<UnreadState>(
    () => ({ counts, corbeaux, tickets, refresh, markSeen }),
    [counts, corbeaux, tickets, refresh, markSeen],
  )

  return <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useUnread(): UnreadState {
  const ctx = useContext(UnreadContext)
  if (!ctx) throw new Error('useUnread doit être utilisé dans un <UnreadProvider>')
  return ctx
}
