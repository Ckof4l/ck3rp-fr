import { supabase } from './supabase'

/* ============================================================================
   Le Trône de Fer & les allégeances.
   ========================================================================== */

export interface King {
  id: string
  character_name: string
  house: string
}

export interface ThroneClaim {
  house_key: string
  claimant_profile: string
  justification: string | null
  created_at: string
  claimant?: { character_name: string } | null
}

export interface Fealty {
  vassal_house: string
  liege_house: string
  sworn_by: string | null
  sworn?: { character_name: string } | null
}

function asError(step: string, e: unknown): Error {
  if (e && typeof e === 'object' && 'message' in e) {
    const o = e as { message?: string; code?: string }
    return new Error(`[${step}] ${o.message}${o.code ? ` (${o.code})` : ''}`)
  }
  return new Error(`[${step}] ${String(e)}`)
}

/* ── Rois & prétendants ────────────────────────────────────────────────── */

export async function listKings(): Promise<King[]> {
  const { data } = await supabase
    .from('profiles')
    .select('id, character_name, house')
    .eq('is_king', true)
    .order('character_name')
  return (data as King[]) ?? []
}

export async function listThroneClaims(): Promise<ThroneClaim[]> {
  const { data } = await supabase
    .from('throne_claims')
    .select('house_key, claimant_profile, justification, created_at, claimant:profiles!throne_claims_claimant_profile_fkey(character_name)')
    .order('created_at', { ascending: true })
  return (data as unknown as ThroneClaim[]) ?? []
}

export async function declareClaim(meId: string, house: string, justification: string): Promise<void> {
  const { error } = await supabase
    .from('throne_claims')
    .upsert({ house_key: house, claimant_profile: meId, justification: justification.trim() || null }, { onConflict: 'house_key' })
  if (error) throw asError('revendication', error)
}

export async function withdrawClaim(house: string): Promise<void> {
  const { error } = await supabase.from('throne_claims').delete().eq('house_key', house)
  if (error) throw asError('revendication', error)
}

/* ── Allégeances ───────────────────────────────────────────────────────── */

export async function listFealty(): Promise<Fealty[]> {
  const { data } = await supabase
    .from('fealty')
    .select('vassal_house, liege_house, sworn_by, sworn:profiles!fealty_sworn_by_fkey(character_name)')
  return (data as unknown as Fealty[]) ?? []
}

export async function swearFealty(meId: string, vassalHouse: string, liegeHouse: string): Promise<void> {
  const { error } = await supabase
    .from('fealty')
    .upsert({ vassal_house: vassalHouse, liege_house: liegeHouse, sworn_by: meId }, { onConflict: 'vassal_house' })
  if (error) throw asError('allégeance', error)
}

export async function breakFealty(vassalHouse: string): Promise<void> {
  const { error } = await supabase.from('fealty').delete().eq('vassal_house', vassalHouse)
  if (error) throw asError('allégeance', error)
}
