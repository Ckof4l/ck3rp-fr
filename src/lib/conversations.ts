import { supabase } from './supabase'

/* ============================================================================
   Conversations — salons de discussion libres, publics ou privés.
   ========================================================================== */

export interface Party {
  character_name: string
  house: string
}

export interface Conversation {
  id: string
  title: string
  creator: string
  is_private: boolean
  created_at: string
  creatorP?: Party | null
  memberCount: number
}

export interface ConvMessage {
  id: string
  conversation_id: string
  author_profile: string
  body: string
  created_at: string
  author?: Party | null
}

function asError(step: string, e: unknown): Error {
  if (e && typeof e === 'object' && 'message' in e) {
    const o = e as { message?: string; code?: string }
    return new Error(`[${step}] ${o.message}${o.code ? ` (${o.code})` : ''}`)
  }
  return new Error(`[${step}] ${String(e)}`)
}

export async function listConversations(): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select(
      `id, title, creator, is_private, created_at,
       creatorP:profiles!conversations_creator_fkey(character_name, house),
       members:conversation_members(count)`,
    )
    .order('created_at', { ascending: false })
  if (error) throw asError('conversations', error)
  type Row = Omit<Conversation, 'memberCount'> & { members: { count: number }[] }
  return (data as unknown as Row[]).map((c) => ({ ...c, memberCount: c.members?.[0]?.count ?? 0 }))
}

export async function createConversation(title: string, isPrivate: boolean, memberIds: string[]): Promise<void> {
  const { error } = await supabase.rpc('create_conversation', {
    p_title: title,
    p_private: isPrivate,
    p_members: memberIds,
  })
  if (error) throw asError('création', error)
}

export async function listMessages(convId: string): Promise<ConvMessage[]> {
  const { data, error } = await supabase
    .from('conversation_messages')
    .select('id, conversation_id, author_profile, body, created_at, author:profiles!conversation_messages_author_profile_fkey(character_name, house)')
    .eq('conversation_id', convId)
    .order('created_at', { ascending: true })
  if (error) throw asError('messages', error)
  return (data as unknown as ConvMessage[]) ?? []
}

export async function sendMessage(convId: string, body: string, meId: string): Promise<void> {
  const { error } = await supabase
    .from('conversation_messages')
    .insert({ conversation_id: convId, author_profile: meId, body: body.trim() })
  if (error) throw asError('envoi', error)
}

export async function deleteConversation(id: string): Promise<void> {
  const { error } = await supabase.from('conversations').delete().eq('id', id)
  if (error) throw asError('suppression', error)
}

export async function leaveConversation(convId: string, meId: string): Promise<void> {
  const { error } = await supabase
    .from('conversation_members')
    .delete()
    .eq('conversation_id', convId)
    .eq('profile_id', meId)
  if (error) throw asError('départ', error)
}
