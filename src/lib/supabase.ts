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
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      // ⚠️ flux explicitement « implicit » : Discord renvoie le jeton dans le
      // `#hash` (et non `?code=` du flux PKCE par défaut, dont l'échange
      // échouait en prod). La détection auto est DÉSACTIVÉE car elle ne
      // ramassait pas le jeton quand Discord ajoute des paramètres en plus
      // (provider_token, sb=…) : on l'établit nous-mêmes au démarrage via
      // setSession (voir AuthContext.tsx). Ne pas remettre PKCE/detectSessionInUrl
      // sans retester tout l'aller-retour Discord en production.
      detectSessionInUrl: false,
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
