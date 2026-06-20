import { supabase } from './supabase'
import { uploadLetterImage } from './image'
import type { RavenScope } from '../types/database'

/* ============================================================================
   La Chancellerie — couche d'accès aux lettres (table `ravens`) et à leurs
   destinataires (`raven_recipients`).
   ========================================================================== */

/** Aperçu d'expéditeur/destinataire embarqué dans une lettre. */
export interface PartyLite {
  id: string
  character_name: string
  house: string
  username: string
}

/** Une lettre telle qu'affichée dans une liste ou en lecture. */
export interface Letter {
  id: string
  thread_id: string
  from_profile: string
  scope: RavenScope
  to_scope: string | null
  subject: string | null
  body: string
  image_path: string | null
  sent_at: string
  sender?: PartyLite | null
}

export interface InboxItem {
  letter: Letter
  read: boolean
}

export interface SentItem {
  letter: Letter
  /** Étiquette « À … » (personne, maison ou royaume). */
  toLabel: string
  recipientCount: number
}

const LETTER_COLS =
  'id, thread_id, from_profile, scope, to_scope, subject, body, image_path, sent_at'
const SENDER_EMBED = `sender:profiles!ravens_from_profile_fkey(id, character_name, house, username)`

/* ── Envoi ─────────────────────────────────────────────────────────────── */

export interface SendParams {
  meId: string
  scope: RavenScope
  /** Destinataire si scope='user'. */
  toProfileId?: string | null
  /** Clé de maison si scope='house'. */
  toHouse?: string | null
  subject: string
  body: string
  imageFile?: File | null
  /** Pour une réponse : conserve le fil d'origine. */
  threadId?: string | null
}

/** Transforme une erreur Supabase (objet { message, … }) en Error lisible. */
function asError(step: string, e: unknown): Error {
  if (e && typeof e === 'object' && 'message' in e) {
    const o = e as { message?: string; details?: string; hint?: string; code?: string }
    const extra = [o.code, o.details, o.hint].filter(Boolean).join(' · ')
    return new Error(`[${step}] ${o.message}${extra ? ` (${extra})` : ''}`)
  }
  return new Error(`[${step}] ${String(e)}`)
}

export async function sendLetter(p: SendParams): Promise<{ id: string; recipientCount: number }> {
  let image_path: string | null = null
  if (p.imageFile) {
    try {
      image_path = await uploadLetterImage(p.imageFile, p.meId)
    } catch (e) {
      throw asError('image', e)
    }
  }

  // Corbeau + destinataires sont écrits atomiquement côté serveur (RPC),
  // pour ne jamais laisser une lettre sans destinataire en cas de panne.
  const { data, error } = await supabase.rpc('send_letter', {
    p_scope: p.scope,
    p_subject: p.subject,
    p_body: p.body,
    p_to_profile: p.scope === 'user' ? p.toProfileId ?? null : null,
    p_to_house: p.scope === 'house' ? p.toHouse ?? null : null,
    p_image_path: image_path,
    p_thread_id: p.threadId ?? null,
  })
  if (error) throw asError('lettre', error)
  const res = data as { id: string; recipient_count: number }
  return { id: res.id, recipientCount: res.recipient_count }
}

/* ── Listes ────────────────────────────────────────────────────────────── */

export async function listInbox(meId: string): Promise<InboxItem[]> {
  const { data, error } = await supabase
    .from('raven_recipients')
    .select(`read_at, letter:ravens!inner(${LETTER_COLS}, ${SENDER_EMBED})`)
    .eq('profile_id', meId)
  if (error) throw error
  const items = (data as unknown as { read_at: string | null; letter: Letter }[])
    .map((r) => ({ letter: r.letter, read: r.read_at != null }))
    .sort((a, b) => b.letter.sent_at.localeCompare(a.letter.sent_at))
  return items
}

export async function listSent(meId: string): Promise<SentItem[]> {
  const { data, error } = await supabase
    .from('ravens')
    .select(LETTER_COLS)
    .eq('from_profile', meId)
    .order('sent_at', { ascending: false })
  if (error) throw error
  const letters = data as unknown as Letter[]

  // Pour les envois directs, on récupère le nom du destinataire.
  const userLetters = letters.filter((l) => l.scope === 'user').map((l) => l.id)
  const recByLetter = new Map<string, { count: number; firstName: string | null }>()
  if (userLetters.length) {
    const { data: recs } = await supabase
      .from('raven_recipients')
      .select('raven_id, profile:profiles(character_name)')
      .in('raven_id', userLetters)
    for (const r of (recs ?? []) as unknown as {
      raven_id: string
      profile: { character_name: string } | null
    }[]) {
      const cur = recByLetter.get(r.raven_id) ?? { count: 0, firstName: null }
      cur.count += 1
      cur.firstName ??= r.profile?.character_name ?? null
      recByLetter.set(r.raven_id, cur)
    }
  }

  return letters.map((l) => {
    let toLabel = 'Au royaume'
    let recipientCount = 0
    if (l.scope === 'house') toLabel = `À la maison ${l.to_scope ?? ''}`
    else if (l.scope === 'user') {
      const info = recByLetter.get(l.id)
      toLabel = info?.firstName ? `À ${info.firstName}` : 'À un destinataire'
      recipientCount = info?.count ?? 0
    }
    return { letter: l, toLabel, recipientCount }
  })
}

export async function countUnread(meId: string): Promise<number> {
  const { count, error } = await supabase
    .from('raven_recipients')
    .select('raven_id', { count: 'exact', head: true })
    .eq('profile_id', meId)
    .is('read_at', null)
  if (error) return 0
  return count ?? 0
}

/* ── Lecture ───────────────────────────────────────────────────────────── */

export async function getLetter(id: string): Promise<Letter | null> {
  const { data, error } = await supabase
    .from('ravens')
    .select(`${LETTER_COLS}, ${SENDER_EMBED}`)
    .eq('id', id)
    .maybeSingle()
  if (error) return null
  return (data as unknown as Letter | null) ?? null
}

export async function markRead(ravenId: string, meId: string): Promise<void> {
  await supabase
    .from('raven_recipients')
    .update({ read_at: new Date().toISOString() })
    .eq('raven_id', ravenId)
    .eq('profile_id', meId)
    .is('read_at', null)
}

/* ── Fils de discussion ────────────────────────────────────────────────── */

/** Toutes les lettres d'un fil visibles par moi (la RLS filtre), chronologiques. */
export async function getThread(threadId: string): Promise<Letter[]> {
  const { data, error } = await supabase
    .from('ravens')
    .select(`${LETTER_COLS}, ${SENDER_EMBED}`)
    .eq('thread_id', threadId)
    .order('sent_at', { ascending: true })
  if (error) throw error
  return (data as unknown as Letter[]) ?? []
}

/** Marque comme lues toutes mes lettres reçues d'un fil. */
export async function markThreadRead(ravenIds: string[], meId: string): Promise<void> {
  if (!ravenIds.length) return
  await supabase
    .from('raven_recipients')
    .update({ read_at: new Date().toISOString() })
    .eq('profile_id', meId)
    .in('raven_id', ravenIds)
    .is('read_at', null)
}

/* ── Archivage personnel des fils ──────────────────────────────────────── */

export async function listArchivedThreadIds(meId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('archives')
    .select('thread_id')
    .eq('profile_id', meId)
  if (error) return new Set()
  return new Set((data as { thread_id: string }[]).map((r) => r.thread_id))
}

export async function archiveThread(meId: string, threadId: string): Promise<void> {
  await supabase
    .from('archives')
    .upsert({ profile_id: meId, thread_id: threadId }, { onConflict: 'profile_id,thread_id' })
}

export async function unarchiveThread(meId: string, threadId: string): Promise<void> {
  await supabase.from('archives').delete().eq('profile_id', meId).eq('thread_id', threadId)
}

/* ── Suppression d'une lettre ──────────────────────────────────────────────
   L'expéditeur retire son propre corbeau, un Mestre n'importe lequel (RLS).
   Les destinataires (raven_recipients) partent en cascade. */
export async function deleteLetter(id: string): Promise<void> {
  const { error } = await supabase.from('ravens').delete().eq('id', id)
  if (error) throw asError('suppression', error)
}
