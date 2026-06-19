import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from '../lib/supabase'
import type { Profile } from '../types/database'

/* ============================================================================
   Contexte d'authentification — expose la session Supabase et le profil
   (personnage / maison / rôles) du joueur connecté.
   ========================================================================== */

interface AuthState {
  session: Session | null
  profile: Profile | null
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
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
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

    async function bootstrap() {
      // Filet de sécurité OAuth Discord : la détection automatique de
      // supabase-js ne ramasse pas toujours le jeton du hash (#access_token)
      // quand Discord ajoute des paramètres en plus (provider_token, sb=…).
      // On l'établit donc nous-mêmes, puis on nettoie l'URL.
      const hash = window.location.hash
      if (hash.includes('access_token')) {
        const p = new URLSearchParams(hash.replace(/^#/, ''))
        const access_token = p.get('access_token')
        const refresh_token = p.get('refresh_token')
        if (access_token && refresh_token) {
          try {
            await supabase.auth.setSession({ access_token, refresh_token })
          } catch {
            /* jeton invalide/expiré : on retombe sur getSession ci-dessous */
          }
          window.history.replaceState(null, '', window.location.pathname + window.location.search)
        }
      }

      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      setSession(data.session)
      if (data.session?.user) await loadProfile(data.session.user.id)
    }

    bootstrap()
      // Une session illisible (réseau, jeton expiré) ne doit pas figer le spinner.
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false)
      })

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return
      setSession(newSession)
      if (newSession?.user) await loadProfile(newSession.user.id)
      else setProfile(null)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
  }, [])

  const value = useMemo<AuthState>(
    () => ({ session, profile, loading, configured: supabaseConfigured, refreshProfile, signOut }),
    [session, profile, loading, refreshProfile, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans un <AuthProvider>')
  return ctx
}
