import { supabase } from './supabase'

/* ============================================================================
   Requêtes (tickets) — soumission, suivi, validation par les Mestres.
   ========================================================================== */

export type TicketStatus = 'pending' | 'accepted' | 'refused'

export interface PartyMini {
  character_name: string
  house: string
}

export interface Ticket {
  id: string
  author_profile: string
  category: string | null
  subject: string
  body: string
  status: TicketStatus
  resolution: string | null
  resolved_by: string | null
  created_at: string
  resolved_at: string | null
  author?: PartyMini | null
  resolver?: { character_name: string } | null
}

export interface TicketMessage {
  id: string
  ticket_id: string
  author_profile: string
  body: string
  created_at: string
  author?: PartyMini | null
}

function asError(step: string, e: unknown): Error {
  if (e && typeof e === 'object' && 'message' in e) {
    const o = e as { message?: string; code?: string }
    return new Error(`[${step}] ${o.message}${o.code ? ` (${o.code})` : ''}`)
  }
  return new Error(`[${step}] ${String(e)}`)
}

const SELECT =
  `id, author_profile, category, subject, body, status, resolution, resolved_by, created_at, resolved_at,
   author:profiles!tickets_author_profile_fkey(character_name, house),
   resolver:profiles!tickets_resolved_by_fkey(character_name)`

/** Mes requêtes (joueur). */
export async function listMyTickets(meId: string): Promise<Ticket[]> {
  const { data, error } = await supabase
    .from('tickets')
    .select(SELECT)
    .eq('author_profile', meId)
    .order('created_at', { ascending: false })
  if (error) throw asError('requêtes', error)
  return (data as unknown as Ticket[]) ?? []
}

/** Toutes les requêtes (Mestre). */
export async function listAllTickets(): Promise<Ticket[]> {
  const { data, error } = await supabase
    .from('tickets')
    .select(SELECT)
    .order('created_at', { ascending: false })
  if (error) throw asError('requêtes', error)
  return (data as unknown as Ticket[]) ?? []
}

export async function getTicket(id: string): Promise<Ticket | null> {
  const { data } = await supabase.from('tickets').select(SELECT).eq('id', id).maybeSingle()
  return (data as unknown as Ticket | null) ?? null
}

export async function createTicket(p: {
  meId: string
  category: string
  subject: string
  body: string
}): Promise<void> {
  const { error } = await supabase.from('tickets').insert({
    author_profile: p.meId,
    category: p.category || null,
    subject: p.subject.trim(),
    body: p.body.trim(),
  })
  if (error) throw asError('création', error)
}

export async function decideTicket(
  id: string,
  status: 'accepted' | 'refused',
  resolution: string,
  meId: string,
): Promise<void> {
  const { error } = await supabase
    .from('tickets')
    .update({
      status,
      resolution: resolution.trim() || null,
      resolved_by: meId,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw asError('décision', error)
}

export async function deleteTicket(id: string): Promise<void> {
  const { error } = await supabase.from('tickets').delete().eq('id', id)
  if (error) throw asError('suppression', error)
}

export async function countPendingTickets(): Promise<number> {
  const { count } = await supabase
    .from('tickets')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
  return count ?? 0
}

/* ── Discussion ────────────────────────────────────────────────────────── */

export async function listTicketMessages(ticketId: string): Promise<TicketMessage[]> {
  const { data, error } = await supabase
    .from('ticket_messages')
    .select('id, ticket_id, author_profile, body, created_at, author:profiles!ticket_messages_author_profile_fkey(character_name, house)')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true })
  if (error) throw asError('discussion', error)
  return (data as unknown as TicketMessage[]) ?? []
}

export async function addTicketMessage(p: { meId: string; ticketId: string; body: string }): Promise<void> {
  const { error } = await supabase
    .from('ticket_messages')
    .insert({ ticket_id: p.ticketId, author_profile: p.meId, body: p.body.trim() })
  if (error) throw asError('message', error)
}

/** Retire un message d'une requête (son auteur ou un Mestre — RLS). */
export async function deleteTicketMessage(id: string): Promise<void> {
  const { error } = await supabase.from('ticket_messages').delete().eq('id', id)
  if (error) throw asError('suppression', error)
}
