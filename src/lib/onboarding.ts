import { supabase } from './supabase'

/* ============================================================================
   Connexion Discord & finalisation d'inscription.
   ========================================================================== */

/** Lance la connexion via Discord (OAuth). Retour sur l'URL courante. */
export async function signInWithDiscord(): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'discord',
    options: { redirectTo: window.location.origin },
  })
  return { error: error?.message ?? null }
}

/** Maisons déjà revendiquées (clé → personnage), pour griser le sélecteur. */
export async function takenHouses(): Promise<Record<string, string>> {
  const { data } = await supabase.rpc('taken_houses')
  const map: Record<string, string> = {}
  for (const row of (data ?? []) as { house_key: string; character_name: string }[]) {
    map[row.house_key] = row.character_name
  }
  return map
}

/** Finalise l'inscription : choix du personnage et de la maison. */
export async function completeOnboarding(character: string, house: string, discord: string): Promise<void> {
  const { error } = await supabase.rpc('complete_onboarding', {
    p_character: character,
    p_house: house,
    p_discord: discord,
  })
  if (error) throw new Error(error.message)
}
