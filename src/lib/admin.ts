import { supabase } from './supabase'
import type { Profile, ReportTargetType } from '../types/database'

/* ============================================================================
   La Citadelle — couche d'accès à l'administration & la modération.
   ========================================================================== */

function asError(step: string, e: unknown): Error {
  if (e && typeof e === 'object' && 'message' in e) {
    const o = e as { message?: string; code?: string }
    return new Error(`[${step}] ${o.message}${o.code ? ` (${o.code})` : ''}`)
  }
  return new Error(`[${step}] ${String(e)}`)
}

/* ── Mestres ───────────────────────────────────────────────────────────── */

export async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw asError('mestres', error)
  return (data as Profile[]) ?? []
}

export async function setRole(
  id: string,
  patch: Partial<Pick<Profile, 'is_admin' | 'is_king' | 'is_observer'>>,
): Promise<void> {
  const { error } = await supabase.from('profiles').update(patch).eq('id', id)
  if (error) throw asError('rôle', error)
}

export async function banProfile(id: string): Promise<void> {
  const { error } = await supabase.from('profiles').delete().eq('id', id)
  if (error) throw asError('bannissement', error)
}

export async function mutePlayer(id: string, minutes: number): Promise<void> {
  const { error } = await supabase.rpc('admin_mute', { p_target: id, p_minutes: minutes })
  if (error) throw asError('sourdine', error)
}

export async function unmutePlayer(id: string): Promise<void> {
  const { error } = await supabase.rpc('admin_unmute', { p_target: id })
  if (error) throw asError('sourdine', error)
}

export async function setPlayer(id: string, character: string, house: string): Promise<void> {
  const { error } = await supabase.rpc('admin_set_player', { p_target: id, p_character: character, p_house: house })
  if (error) throw asError('édition', error)
}

/* ── Statistiques ──────────────────────────────────────────────────────── */

export async function overview(): Promise<{
  players: number
  posts: number
  letters: number
  openReports: number
  pendingTickets: number
}> {
  const head = { count: 'exact' as const, head: true }
  const [players, posts, letters, openReports, pendingTickets] = await Promise.all([
    supabase.from('profiles').select('*', head),
    supabase.from('posts').select('*', head),
    supabase.from('ravens').select('*', head),
    supabase.from('reports').select('*', head).eq('resolved', false),
    supabase.from('tickets').select('*', head).eq('status', 'pending'),
  ])
  return {
    players: players.count ?? 0,
    posts: posts.count ?? 0,
    letters: letters.count ?? 0,
    openReports: openReports.count ?? 0,
    pendingTickets: pendingTickets.count ?? 0,
  }
}

/* ── Signalements ──────────────────────────────────────────────────────── */

export interface ReportRow {
  id: string
  target_type: ReportTargetType
  target_id: string
  reason: string
  created_at: string
  resolved: boolean
  reporter?: { character_name: string; house: string } | null
}

export interface ReportTarget {
  exists: boolean
  channel?: string | null
  author?: string | null
  title?: string | null
  body?: string | null
}

export async function createReport(p: {
  meId: string
  targetType: ReportTargetType
  targetId: string
  reason: string
}): Promise<void> {
  const { error } = await supabase.from('reports').insert({
    reporter_profile: p.meId,
    target_type: p.targetType,
    target_id: p.targetId,
    reason: p.reason.trim(),
  })
  if (error) throw asError('signalement', error)
}

export async function listOpenReports(): Promise<ReportRow[]> {
  const { data, error } = await supabase
    .from('reports')
    .select(
      'id, target_type, target_id, reason, created_at, resolved, reporter:profiles!reports_reporter_profile_fkey(character_name, house)',
    )
    .eq('resolved', false)
    .order('created_at', { ascending: false })
  if (error) throw asError('signalements', error)
  return (data as unknown as ReportRow[]) ?? []
}

export async function fetchReportTarget(
  type: ReportTargetType,
  id: string,
): Promise<ReportTarget> {
  if (type === 'post') {
    const { data } = await supabase
      .from('posts')
      .select('channel, title, body, author:profiles!posts_author_profile_fkey(character_name)')
      .eq('id', id)
      .maybeSingle()
    const t = data as unknown as { channel: string; title: string | null; body: string; author: { character_name: string } | null } | null
    return t
      ? { exists: true, channel: t.channel, title: t.title, body: t.body, author: t.author?.character_name }
      : { exists: false }
  }
  if (type === 'comment') {
    const { data } = await supabase
      .from('post_comments')
      .select('body, author:profiles!post_comments_author_profile_fkey(character_name)')
      .eq('id', id)
      .maybeSingle()
    const t = data as unknown as { body: string; author: { character_name: string } | null } | null
    return t ? { exists: true, body: t.body, author: t.author?.character_name } : { exists: false }
  }
  if (type === 'profile') {
    const { data } = await supabase
      .from('profiles')
      .select('character_name, house, discord')
      .eq('id', id)
      .maybeSingle()
    const t = data as unknown as { character_name: string; house: string; discord: string | null } | null
    return t
      ? { exists: true, author: t.character_name, body: `Maison ${t.house}${t.discord ? ` · Discord : ${t.discord}` : ''}` }
      : { exists: false }
  }
  return { exists: false }
}

export async function deleteReportedTarget(type: ReportTargetType, id: string): Promise<void> {
  const table = type === 'post' ? 'posts' : type === 'comment' ? 'post_comments' : 'ravens'
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) throw asError('suppression', error)
}

export async function resolveReport(id: string): Promise<void> {
  const { error } = await supabase.from('reports').update({ resolved: true }).eq('id', id)
  if (error) throw asError('résolution', error)
}

/* ── Journal d'audit ───────────────────────────────────────────────────── */

export interface AuditEntry {
  id: string
  action: string
  created_at: string
  actor?: { character_name: string } | null
}

/** Consigne une action de Mestre (silencieux en cas d'échec). */
export async function logAdmin(action: string): Promise<void> {
  try {
    await supabase.rpc('log_admin', { p_action: action })
  } catch {
    /* le journal ne doit jamais bloquer une action */
  }
}

export async function listAuditLog(): Promise<AuditEntry[]> {
  const { data } = await supabase
    .from('audit_log')
    .select('id, action, created_at, actor:profiles!audit_log_actor_profile_fkey(character_name)')
    .order('created_at', { ascending: false })
    .limit(100)
  return (data as unknown as AuditEntry[]) ?? []
}

/* ── Corbeaux (oversight Mestre) ───────────────────────────────────────── */

export interface AdminLetter {
  id: string
  scope: string
  to_scope: string | null
  subject: string | null
  body: string
  image_path: string | null
  sent_at: string
  sender?: { character_name: string; house: string } | null
  recipients?: { profile: { character_name: string } | null }[]
}

export async function listAllLetters(): Promise<AdminLetter[]> {
  const { data, error } = await supabase
    .from('ravens')
    .select(
      'id, scope, to_scope, subject, body, image_path, sent_at, sender:profiles!ravens_from_profile_fkey(character_name, house), recipients:raven_recipients(profile:profiles(character_name))',
    )
    .order('sent_at', { ascending: false })
    .limit(100)
  if (error) throw asError('corbeaux', error)
  return (data as unknown as AdminLetter[]) ?? []
}

export async function deleteLetter(id: string): Promise<void> {
  const { error } = await supabase.from('ravens').delete().eq('id', id)
  if (error) throw asError('suppression', error)
}

/* ── Nettoyage granulaire (Mestres) ────────────────────────────────────── */

const ALL_FILTER = '00000000-0000-0000-0000-000000000000'

/** Vide tous les posts (et leurs commentaires) d'un salon. */
export async function clearChannel(channel: string): Promise<void> {
  const { error } = await supabase.from('posts').delete().eq('channel', channel)
  if (error) throw asError('nettoyage', error)
}

/** Vide tous les corbeaux (lettres privées) et leurs destinataires. */
export async function clearCorbeaux(): Promise<void> {
  const { error } = await supabase.from('ravens').delete().neq('id', ALL_FILTER)
  if (error) throw asError('nettoyage', error)
}

/* ── Zone de danger (Grand Mestre) ─────────────────────────────────────── */

export async function purgeContent(): Promise<void> {
  const { error } = await supabase.rpc('admin_purge_content')
  if (error) throw asError('réinitialisation', error)
}
