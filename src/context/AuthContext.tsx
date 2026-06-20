import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from '../lib/supabase'
import type { Profile } from '../types/database'

/* ============================================================================
   Contexte d'authentification — expose la session Supabase et le profil
   (personnage / maison / rôles) du joueur connecté.
   ========================================================================== */

/** Présent quand le compte connecté est banni (blocage Discord permanent). */
export interface BanInfo {
  reason: string | null
  banned_at: string
}

interface AuthState {
  session: Session | null
  profile: Profile | null
  ban: BanInfo | null
  loading: boolean
  configured: boolean
  /** Recharge le profil depuis la base (après mort/renaissance, modération…). */
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [ban, setBan] = useState<BanInfo | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (userId: string) => {
    let { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    if (!data) {
      // Session valide sans profil : soit le compte est BANNI (blocage permanent),
      // soit il a juste été exclu (reset) → on recrée un profil vierge. ensure_profile
      // refuse de recréer pour un banni, donc on vérifie d'abord la liste des bannis.
      const { data: b } = await supabase
        .from('banned_users')
        .select('reason, banned_at')
        .eq('user_id', userId)
        .maybeSingle()
      if (b) {
        setBan(b as BanInfo)
        setProfile(null)
        return
      }
      await supabase.rpc('ensure_profile')
      const retry = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
      data = retry.data
    }
    setBan(null)
    setProfile((data as Profile | null) ?? null)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (session?.user) await loadProfile(session.user.id)
  }, [session, loadProfile])

  useEffect(() => {
    // Sans clés configurées, on ne tente aucun appel réseau.
    if (!supabaseConfigured) {
      setLoading(false)
      return
    }

    let mounted = true

    // Filet de sécurité : quoi qu'il arrive (getSession ou loadProfile qui pend,
    // réseau, jeton bloqué), le spinner ne doit JAMAIS tourner indéfiniment.
    const safety = setTimeout(() => {
      if (mounted) setLoading(false)
    }, 6000)

    // detectSessionInUrl traite le retour OAuth (#access_token) ; getSession
    // récupère la session (de l'URL au 1ᵉʳ retour, du stockage ensuite).
    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!mounted) return
        setSession(data.session)
        // Le chargement du profil ne doit pas pouvoir bloquer le spinner :
        // s'il traîne, on laisse l'app s'ouvrir (le profil arrivera en arrière-plan).
        if (data.session?.user) {
          await Promise.race([
            loadProfile(data.session.user.id),
            new Promise((r) => setTimeout(r, 5000)),
          ])
        }
      })
      // Une session illisible (réseau, jeton expiré) ne doit pas figer le spinner.
      .catch(() => {})
      .finally(() => {
        if (mounted) {
          clearTimeout(safety)
          setLoading(false)
        }
      })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return
      setSession(newSession)
      // IMPORTANT : ne JAMAIS appeler d'autres méthodes supabase directement dans
      // ce callback — il s'exécute sous le verrou d'auth et un appel imbriqué peut
      // le deadlocker (spinner figé). On diffère donc loadProfile hors du callback.
      if (newSession?.user) {
        const uid = newSession.user.id
        setTimeout(() => { if (mounted) loadProfile(uid) }, 0)
      } else {
        setProfile(null)
        setBan(null)
      }
    })

    return () => {
      mounted = false
      clearTimeout(safety)
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
    setBan(null)
  }, [])

  const value = useMemo<AuthState>(
    () => ({ session, profile, ban, loading, configured: supabaseConfigured, refreshProfile, signOut }),
    [session, profile, ban, loading, refreshProfile, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans un <AuthProvider>')
  return ctx
}
