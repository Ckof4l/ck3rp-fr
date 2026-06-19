import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, supabaseConfigured, oauthTokens } from '../lib/supabase'
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
      // Filet de sécurité OAuth Discord. Les jetons ont été capturés très tôt
      // (lib/supabase.ts, avant tout nettoyage d'URL). Ni la détection auto de
      // supabase-js ni setSession() n'établissent la session ici : leur appel
      // interne à /auth/v1/user repart en 401 (la clé API n'est pas transmise
      // avec le nouveau format sb_publishable_). On contourne : fetch direct de
      // l'utilisateur (qui, lui, transmet la clé → 200), on écrit la session au
      // format supabase-js dans le stockage, puis getSession() la relit.
      console.log('[CK3FR auth] oauthTokens =', oauthTokens ? 'présents' : 'ABSENTS')
      if (oauthTokens) {
        try {
          const apiUrl = import.meta.env.VITE_SUPABASE_URL as string
          const apiKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
          const res = await fetch(`${apiUrl}/auth/v1/user`, {
            headers: { apikey: apiKey, Authorization: `Bearer ${oauthTokens.access_token}` },
          })
          console.log('[CK3FR auth] fetch /user status =', res.status)
          if (res.ok) {
            const user = await res.json()
            const ref = new URL(apiUrl).hostname.split('.')[0]
            const stored = {
              access_token: oauthTokens.access_token,
              refresh_token: oauthTokens.refresh_token,
              token_type: 'bearer',
              expires_in: oauthTokens.expires_in,
              expires_at: Math.floor(Date.now() / 1000) + oauthTokens.expires_in,
              user,
            }
            window.localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(stored))
            console.log('[CK3FR auth] session écrite dans le storage ✓ clé sb-' + ref + '-auth-token')
          }
        } catch (e) {
          console.log('[CK3FR auth] ERREUR fetch/écriture:', e)
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
