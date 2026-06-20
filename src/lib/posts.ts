import { supabase } from './supabase'
import { uploadLetterImage } from './image'

/* ============================================================================
   Salons — couche d'accès aux posts et commentaires.
   ========================================================================== */

export interface PostAuthor {
  id: string
  character_name: string
  house: string
}

export interface PostRow {
  id: string
  channel: string
  author_profile: string
  title: string | null
  body: string
  image_path: string | null
  created_at: string
  updated_at: string | null
  pinned: boolean
  is_private: boolean
  is_hrp: boolean
  author?: PostAuthor | null
  commentCount?: number
}

export interface CommentRow {
  id: string
  post_id: string
  author_profile: string
  body: string
  created_at: string
  updated_at: string | null
  author?: PostAuthor | null
}

const POST_COLS = 'id, channel, author_profile, title, body, image_path, created_at, updated_at, pinned, is_private, is_hrp'
const AUTHOR_EMBED = 'author:profiles!posts_author_profile_fkey(id, character_name, house)'
const C_AUTHOR_EMBED = 'author:profiles!post_comments_author_profile_fkey(id, character_name, house)'

function asError(step: string, e: unknown): Error {
  if (e && typeof e === 'object' && 'message' in e) {
    const o = e as { message?: string; code?: string; details?: string; hint?: string }
    const extra = [o.code, o.details, o.hint].filter(Boolean).join(' · ')
    return new Error(`[${step}] ${o.message}${extra ? ` (${extra})` : ''}`)
  }
  return new Error(`[${step}] ${String(e)}`)
}

/* ── Posts ─────────────────────────────────────────────────────────────── */

export async function listPosts(channel: string): Promise<PostRow[]> {
  const { data, error } = await supabase
    .from('posts')
    .select(`${POST_COLS}, ${AUTHOR_EMBED}, comments:post_comments(count)`)
    .eq('channel', channel)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw asError('lecture', error)
  return (data as unknown as (PostRow & { comments?: { count: number }[] })[]).map((p) => ({
    ...p,
    commentCount: p.comments?.[0]?.count ?? 0,
  }))
}

export async function createPost(p: {
  meId: string
  channel: string
  title: string
  body: string
  imageFile?: File | null
  isPrivate?: boolean
  isHrp?: boolean
}): Promise<string> {
  let image_path: string | null = null
  if (p.imageFile) {
    try {
      image_path = await uploadLetterImage(p.imageFile, p.meId)
    } catch (e) {
      throw asError('image', e)
    }
  }
  const { data, error } = await supabase
    .from('posts')
    .insert({
      channel: p.channel,
      author_profile: p.meId,
      title: p.title.trim() || null,
      body: p.body,
      image_path,
      is_private: !!p.isPrivate,
      is_hrp: !!p.isHrp,
    })
    .select('id')
    .single()
  if (error) throw asError('publication', error)
  return (data as { id: string }).id
}

export async function updatePost(id: string, patch: { title: string; body: string }): Promise<void> {
  const { error } = await supabase
    .from('posts')
    .update({ title: patch.title.trim() || null, body: patch.body, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw asError('édition', error)
}

export async function setPinned(id: string, pinned: boolean): Promise<void> {
  const { error } = await supabase.from('posts').update({ pinned }).eq('id', id)
  if (error) throw asError('épinglage', error)
}

export async function deletePost(id: string): Promise<void> {
  const { error } = await supabase.from('posts').delete().eq('id', id)
  if (error) throw asError('suppression', error)
}

/* ── Commentaires ──────────────────────────────────────────────────────── */

export async function listComments(postId: string): Promise<CommentRow[]> {
  const { data, error } = await supabase
    .from('post_comments')
    .select(`id, post_id, author_profile, body, created_at, updated_at, ${C_AUTHOR_EMBED}`)
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
  if (error) throw asError('commentaires', error)
  return (data as unknown as CommentRow[]) ?? []
}

export async function addComment(p: { meId: string; postId: string; body: string }): Promise<void> {
  const { error } = await supabase
    .from('post_comments')
    .insert({ post_id: p.postId, author_profile: p.meId, body: p.body.trim() })
  if (error) throw asError('commentaire', error)
}

export async function updateComment(id: string, body: string): Promise<void> {
  const { error } = await supabase
    .from('post_comments')
    .update({ body: body.trim(), updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw asError('édition', error)
}

export async function deleteComment(id: string): Promise<void> {
  const { error } = await supabase.from('post_comments').delete().eq('id', id)
  if (error) throw asError('suppression', error)
}
