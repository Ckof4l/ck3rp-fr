import { supabase } from './supabase'
import type { Profile } from '../types/database'
import type { Grave } from './destin'

/* ============================================================================
   Annuaire — joueurs, maisons tenues, fiches de personnage.
   ========================================================================== */

export interface PlayerPost {
  id: string
  channel: string
  title: string | null
  body: string
  created_at: string
}

/** Tous les joueurs (lisible par tout utilisateur connecté). */
export async function listPlayers(): Promise<Profile[]> {
  const { data } = await supabase.from('profiles').select('*').order('character_name', { ascending: true })
  return (data as Profile[]) ?? []
}

/** Carte maison → joueur qui la tient (clé de maison → profil). */
export function holdersByHouse(players: Profile[]): Record<string, Profile> {
  const map: Record<string, Profile> = {}
  for (const p of players) {
    if (p.house && p.house !== 'autre') map[p.house] = p
  }
  return map
}

export async function getPlayer(id: string): Promise<Profile | null> {
  const { data } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle()
  return (data as Profile | null) ?? null
}

export async function listPlayerPosts(id: string): Promise<PlayerPost[]> {
  const { data } = await supabase
    .from('posts')
    .select('id, channel, title, body, created_at')
    .eq('author_profile', id)
    .order('created_at', { ascending: false })
    .limit(20)
  return (data as PlayerPost[]) ?? []
}

export async function listPlayerGraves(id: string): Promise<Grave[]> {
  const { data } = await supabase
    .from('graveyard')
    .select('id, character_name, house, cause, died_at')
    .eq('profile_id', id)
    .order('died_at', { ascending: false })
  return (data as Grave[]) ?? []
}
