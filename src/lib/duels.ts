import { supabase } from './supabase'

/* ============================================================================
   Le Sort — duel à pile ou face entre deux joueurs. Tirage serveur, public.
   Convention : le challenger prend PILE, l'adversaire prend FACE.
   ========================================================================== */

export type DuelStatus = 'pending' | 'done' | 'declined'

export interface Party {
  character_name: string
  house: string
}

export interface Duel {
  id: string
  challenger: string
  opponent: string
  reason: string | null
  status: DuelStatus
  result: string | null
  winner: string | null
  /** Joueur qui a tiré le côté « Pile » (assigné au hasard à l'acceptation). */
  pile_profile: string | null
  created_at: string
  resolved_at: string | null
  challengerP?: Party | null
  opponentP?: Party | null
}

function asError(step: string, e: unknown): Error {
  if (e && typeof e === 'object' && 'message' in e) {
    const o = e as { message?: string; code?: string }
    return new Error(`[${step}] ${o.message}${o.code ? ` (${o.code})` : ''}`)
  }
  return new Error(`[${step}] ${String(e)}`)
}

const SELECT =
  `id, challenger, opponent, reason, status, result, winner, pile_profile, created_at, resolved_at,
   challengerP:profiles!duels_challenger_fkey(character_name, house),
   opponentP:profiles!duels_opponent_fkey(character_name, house)`

export async function listDuels(): Promise<Duel[]> {
  const { data, error } = await supabase
    .from('duels')
    .select(SELECT)
    .order('created_at', { ascending: false })
    .limit(60)
  if (error) throw asError('registre', error)
  return (data as unknown as Duel[]) ?? []
}

/** Défier un adversaire précis ; renvoie l'id du duel créé. */
export async function createDuel(opponentId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('create_duel', { p_opponent: opponentId, p_reason: reason })
  if (error) throw asError('défi', error)
}

/** Réponse de l'adversaire : accepter lance la pièce. Renvoie le résultat. */
export async function resolveDuel(duelId: string, accept: boolean): Promise<string> {
  const { data, error } = await supabase.rpc('resolve_duel', { p_duel: duelId, p_accept: accept })
  if (error) throw asError('réponse', error)
  return data as string
}

export async function deleteDuel(id: string): Promise<void> {
  const { error } = await supabase.from('duels').delete().eq('id', id)
  if (error) throw asError('suppression', error)
}
