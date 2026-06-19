import { supabase } from './supabase'

/* ============================================================================
   Non-lus par salon — comptage et marquage « vu ».
   ========================================================================== */

export async function fetchUnreadCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase.rpc('unread_counts')
  if (error) return {}
  const map: Record<string, number> = {}
  for (const r of (data ?? []) as { channel: string; n: number }[]) {
    map[r.channel] = Number(r.n)
  }
  return map
}

export async function markChannelSeen(meId: string, channel: string): Promise<void> {
  await supabase
    .from('channel_reads')
    .upsert({ profile_id: meId, channel, last_seen_at: new Date().toISOString() }, { onConflict: 'profile_id,channel' })
}
