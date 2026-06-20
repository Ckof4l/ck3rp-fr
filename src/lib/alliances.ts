import { supabase } from './supabase'

/* ============================================================================
   Alliances entre joueurs — proposées par un joueur, validées par les Mestres.
   ========================================================================== */

export type AllianceStatus = 'pending' | 'accepted' | 'refused'

export interface PartyMini {
  character_name: string
  house: string
}

export interface Alliance {
  id: string
  proposer_profile: string
  target_profile: string
  message: string | null
  status: AllianceStatus
  resolved_by: string | null
  created_at: string
  resolved_at: string | null
  proposer?: PartyMini | null
  target?: PartyMini | null
  resolver?: { character_name: string } | null
}

function asError(step: string, e: unknown): Error {
  if (e && typeof e === 'object' && 'message' in e) {
    const o = e as { message?: string; code?: string }
    return new Error(`[${step}] ${o.message}${o.code ? ` (${o.code})` : ''}`)
  }
  return new Error(`[${step}] ${String(e)}`)
}

const SELECT =
  `id, proposer_profile, target_profile, message, status, resolved_by, created_at, resolved_at,
   proposer:profiles!alliances_proposer_profile_fkey(character_name, house),
   target:profiles!alliances_target_profile_fkey(character_name, house),
   resolver:profiles!alliances_resolved_by_fkey(character_name)`

/** Toutes les alliances visibles par moi (la RLS filtre : actives publiques +
   mes propres demandes + tout pour les Mestres). */
export async function listAlliances(): Promise<Alliance[]> {
  const { data, error } = await supabase
    .from('alliances')
    .select(SELECT)
    .order('created_at', { ascending: false })
  if (error) throw asError('alliances', error)
  return (data as unknown as Alliance[]) ?? []
}

/** Proposer une alliance à un joueur (passe en attente de validation Mestre). */
export async function proposeAlliance(targetId: string, message: string): Promise<void> {
  const { error } = await supabase.rpc('propose_alliance', { p_target: targetId, p_message: message })
  if (error) throw asError('proposition', error)
}

/** Valider / refuser une demande (Mestre). */
export async function decideAlliance(id: string, accept: boolean): Promise<void> {
  const { error } = await supabase.rpc('decide_alliance', { p_id: id, p_accept: accept })
  if (error) throw asError('décision', error)
}

/** Retirer une demande (le proposeur si en attente, ou un Mestre). */
export async function deleteAlliance(id: string): Promise<void> {
  const { error } = await supabase.from('alliances').delete().eq('id', id)
  if (error) throw asError('suppression', error)
}

export async function countPendingAlliances(): Promise<number> {
  const { count } = await supabase
    .from('alliances')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
  return count ?? 0
}
