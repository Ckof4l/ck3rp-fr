import { supabase } from './supabase'

/* ============================================================================
   Pactes & Diplomatie — traités entre maisons et signatures.
   ========================================================================== */

export interface PactSignatory {
  house_key: string
  signed_by: string | null
  signed_at: string | null
  signer?: { character_name: string } | null
}

export interface Pact {
  id: string
  author_profile: string
  title: string
  body: string
  created_at: string
  author?: { character_name: string; house: string } | null
  houses: PactSignatory[]
}

function asError(step: string, e: unknown): Error {
  if (e && typeof e === 'object' && 'message' in e) {
    const o = e as { message?: string; code?: string }
    return new Error(`[${step}] ${o.message}${o.code ? ` (${o.code})` : ''}`)
  }
  return new Error(`[${step}] ${String(e)}`)
}

export async function listPacts(): Promise<Pact[]> {
  const { data, error } = await supabase
    .from('pacts')
    .select(
      `id, author_profile, title, body, created_at,
       author:profiles!pacts_author_profile_fkey(character_name, house),
       houses:pact_houses(house_key, signed_by, signed_at, signer:profiles!pact_houses_signed_by_fkey(character_name))`,
    )
    .order('created_at', { ascending: false })
  if (error) throw asError('lecture', error)
  return (data as unknown as Pact[]) ?? []
}

export async function createPact(p: {
  meId: string
  myHouse: string
  title: string
  body: string
  houses: string[]
}): Promise<void> {
  // Traité + maisons signataires écrits atomiquement côté serveur (RPC) :
  // l'auteur signe d'office pour sa maison, les autres restent en attente.
  const { error } = await supabase.rpc('create_pact', {
    p_title: p.title,
    p_body: p.body,
    p_my_house: p.myHouse,
    p_houses: p.houses,
  })
  if (error) throw asError('création', error)
}

export async function signPact(pactId: string, myHouse: string, meId: string): Promise<void> {
  const { error } = await supabase
    .from('pact_houses')
    .update({ signed_by: meId, signed_at: new Date().toISOString() })
    .eq('pact_id', pactId)
    .eq('house_key', myHouse)
  if (error) throw asError('signature', error)
}

export async function deletePact(id: string): Promise<void> {
  const { error } = await supabase.from('pacts').delete().eq('id', id)
  if (error) throw asError('suppression', error)
}
