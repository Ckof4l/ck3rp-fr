import { supabase } from './supabase'

/* ============================================================================
   Le Sort — dés & pile ou face. Tirage côté serveur, registre public.
   ========================================================================== */

export type RollKind = 'coin' | 'd6' | 'd20' | 'd100'

export interface Roll {
  id: string
  profile_id: string
  kind: RollKind
  label: string | null
  result: string
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

export async function listRolls(): Promise<Roll[]> {
  const { data, error } = await supabase
    .from('rolls')
    .select('id, profile_id, kind, label, result, created_at, author:profiles!rolls_profile_id_fkey(character_name, house)')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw asError('registre', error)
  return (data as unknown as Roll[]) ?? []
}

/** Lance un tirage côté serveur et renvoie le résultat. */
export async function rollDice(kind: RollKind, label: string): Promise<string> {
  const { data, error } = await supabase.rpc('roll_dice', { p_kind: kind, p_label: label })
  if (error) throw asError('tirage', error)
  return data as string
}

export async function deleteRoll(id: string): Promise<void> {
  const { error } = await supabase.from('rolls').delete().eq('id', id)
  if (error) throw asError('suppression', error)
}
