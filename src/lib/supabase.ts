import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/* ============================================================================
   Client Supabase — point d'entrée unique vers Postgres / Auth / Storage /
   Realtime. Les clés viennent du fichier .env (voir .env.example).
   ========================================================================== */

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * `true` tant que les clés ne sont pas renseignées. L'interface peut alors
 * afficher un message d'accueil plutôt que de planter au démarrage.
 */
export const supabaseConfigured = Boolean(url && anonKey)

/**
 * Si les clés sont absentes, on crée tout de même un client avec des valeurs
 * factices pour que les imports ne cassent pas — mais aucun appel ne réussira
 * tant que le `.env` n'est pas rempli (`supabaseConfigured` le signale).
 */
export const supabase: SupabaseClient = createClient(
  url ?? 'https://placeholder.supabase.co',
  anonKey ?? 'placeholder-anon-key',
  {
    auth: {
      // persistSession + autoRefreshToken + stockage localStorage explicite :
      // la session ET son jeton de rafraîchissement survivent à la fermeture du
      // navigateur, donc on reste connecté d'une visite à l'autre.
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      // ⚠️ flux explicitement « implicit ». Le défaut de supabase-js est PKCE,
      // qui renvoie `?code=` à échanger via un « vérificateur » — échange qui
      // échouait au retour de Discord en prod (le code restait coincé dans
      // l'URL). Le flux implicit renvoie directement le jeton dans le `#hash`,
      // parsé par detectSessionInUrl, sans échange. Ne pas remettre PKCE sans
      // avoir testé tout l'aller-retour Discord en production.
      flowType: 'implicit',
    },
  },
)

/**
 * Nom du bucket Storage où sont déposées les images des lettres/proclamations.
 * (L'identifiant interne reste « corbeaux » : invisible aux joueurs, et déjà créé
 *  côté base — le renommer casserait le bucket existant.)
 */
export const IMAGE_BUCKET = 'corbeaux'

/** Construit l'URL publique d'une image stockée à partir de son chemin. */
export function publicImageUrl(path: string | null | undefined): string | null {
  if (!path) return null
  return supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl
}
