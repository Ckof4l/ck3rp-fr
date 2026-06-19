import { supabase } from './supabase'

/* ============================================================================
   Mon destin — mort & renaissance du personnage (la maison ne change pas) et
   nécrologie du royaume.
   ========================================================================== */

export interface Grave {
  id: string
  character_name: string
  house: string
  cause: string | null
  died_at: string
}

function asError(step: string, e: unknown): Error {
  if (e && typeof e === 'object' && 'message' in e) {
    const o = e as { message?: string; code?: string }
    return new Error(`[${step}] ${o.message}${o.code ? ` (${o.code})` : ''}`)
  }
  return new Error(`[${step}] ${String(e)}`)
}

/**
 * Le personnage meurt : on l'inhume (cimetière) puis on renaît sous un nouveau
 * prénom, dans la MÊME maison. `reborn_at` repart à maintenant.
 */
export async function rebirth(p: {
  meId: string
  oldCharacter: string
  house: string
  cause: string
  newName: string
}): Promise<void> {
  // Inhumation + nouveau prénom écrits atomiquement côté serveur (RPC) :
  // jamais de cimetière incohérent si une des deux écritures échoue.
  const { error } = await supabase.rpc('rebirth', {
    p_old_character: p.oldCharacter,
    p_cause: p.cause,
    p_new_name: p.newName,
  })
  if (error) throw asError('renaissance', error)
}

export async function listMyGraveyard(meId: string): Promise<Grave[]> {
  const { data, error } = await supabase
    .from('graveyard')
    .select('id, character_name, house, cause, died_at')
    .eq('profile_id', meId)
    .order('died_at', { ascending: false })
  if (error) throw asError('cimetière', error)
  return (data as Grave[]) ?? []
}

export async function listRealmGraveyard(): Promise<Grave[]> {
  const { data, error } = await supabase
    .from('graveyard')
    .select('id, character_name, house, cause, died_at')
    .order('died_at', { ascending: false })
    .limit(50)
  if (error) throw asError('nécrologie', error)
  return (data as Grave[]) ?? []
}

/** RGPD : supprime définitivement le compte et toutes ses données. */
export async function deleteMyAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_my_account')
  if (error) throw asError('suppression', error)
}
