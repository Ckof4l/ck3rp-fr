import { supabase } from './supabase'

/* ============================================================================
   Notifications — la cloche de la barre du haut (mentions @joueur).
   La RLS garantit qu'on ne voit et ne modifie que les siennes.
   ========================================================================== */

export interface Notif {
  id: string
  profile_id: string
  actor_profile: string | null
  kind: string
  channel: string | null
  post_id: string | null
  excerpt: string | null
  created_at: string
  read_at: string | null
  actor?: { id: string; character_name: string; house: string } | null
}

export async function listNotifications(limit = 20): Promise<Notif[]> {
  const { data } = await supabase
    .from('notifications')
    .select(
      'id, profile_id, actor_profile, kind, channel, post_id, excerpt, created_at, read_at, actor:profiles!notifications_actor_profile_fkey(id, character_name, house)',
    )
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data as unknown as Notif[]) ?? []
}

export async function markNotifRead(id: string): Promise<void> {
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).is('read_at', null)
}

export async function markAllNotifsRead(): Promise<void> {
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)
}
