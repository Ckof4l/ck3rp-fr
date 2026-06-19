import { supabase } from './supabase'

/* ============================================================================
   Royaume — bannière d'annonce globale & chroniques (événements marquants).
   ========================================================================== */

export interface Announcement {
  id: string
  message: string
  created_at: string
}

export interface Chronicle {
  id: string
  title: string
  body: string
  event_date: string | null
  created_at: string
  author?: { character_name: string; house: string } | null
}

function asError(step: string, e: unknown): Error {
  if (e && typeof e === 'object' && 'message' in e) {
    const o = e as { message?: string; code?: string }
    return new Error(`[${step}] ${o.message}${o.code ? ` (${o.code})` : ''}`)
  }
  return new Error(`[${step}] ${String(e)}`)
}

/* ── Bannière ──────────────────────────────────────────────────────────── */

export async function getAnnouncement(): Promise<Announcement | null> {
  const { data } = await supabase
    .from('announcements')
    .select('id, message, created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as Announcement | null) ?? null
}

export async function setAnnouncement(_meId: string, message: string): Promise<void> {
  // Remplacement atomique côté serveur (RPC) : au plus une bannière à la fois.
  const { error } = await supabase.rpc('set_announcement', { p_message: message })
  if (error) throw asError('annonce', error)
}

export async function clearAnnouncement(): Promise<void> {
  const { error } = await supabase.from('announcements').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (error) throw asError('annonce', error)
}

/* ── Chroniques ────────────────────────────────────────────────────────── */

export async function listChronicles(): Promise<Chronicle[]> {
  const { data, error } = await supabase
    .from('chronicles')
    .select('id, title, body, event_date, created_at, author:profiles!chronicles_author_profile_fkey(character_name, house)')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw asError('chroniques', error)
  return (data as unknown as Chronicle[]) ?? []
}

export async function addChronicle(p: { meId: string; title: string; body: string; eventDate: string }): Promise<void> {
  const { error } = await supabase.from('chronicles').insert({
    author_profile: p.meId,
    title: p.title.trim(),
    body: p.body.trim(),
    event_date: p.eventDate || null,
  })
  if (error) throw asError('chronique', error)
}

export async function deleteChronicle(id: string): Promise<void> {
  const { error } = await supabase.from('chronicles').delete().eq('id', id)
  if (error) throw asError('suppression', error)
}
