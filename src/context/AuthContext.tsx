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
      // Filet de sécurité OAuth Discord. Au retour, Discord renvoie le jeton
      // dans le hash (#access_token). On a constaté que ni la détection auto de
      // supabase-js ni setSession() n'établissent la session ici : leur appel
      // interne à /auth/v1/user repart en 401 (la clé API n'est pas transmise
      // avec le nouveau format sb_publishable_). On contourne donc : on va
      // chercher l'utilisateur par un fetch direct (qui, lui, transmet bien la
      // clé), on construit la session, on l'écrit dans le stockage de
      // supabase-js, puis getSession() la relit normalement.
      const hash = window.location.hash
      if (hash.includes('access_token')) {
        const p = new URLSearchParams(hash.replace(/^#/, ''))
        const access_token = p.get('access_token')
        const refresh_token = p.get('refresh_token')
        const expires_in = Number(p.get('expires_in') || 3600)
        if (access_token && refresh_token) {
          try {
            const apiUrl = import.meta.env.VITE_SUPABASE_URL as string
            const apiKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
            const res = await fetch(`${apiUrl}/auth/v1/user`, {
              headers: { apikey: apiKey, Authorization: `Bearer ${access_token}` },
            })
            if (res.ok) {
              const user = await res.json()
              const ref = new URL(apiUrl).hostname.split('.')[0]
              const stored = {
                access_token,
                refresh_token,
                token_type: 'bearer',
                expires_in,
                expires_at: Math.floor(Date.now() / 1000) + expires_in,
                user,
              }
              window.localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(stored))
            }
          } catch {
            /* réseau / jeton invalide : on retombe sur getSession ci-dessous */
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
