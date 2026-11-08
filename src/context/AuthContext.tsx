import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile, Role } from '../types'

interface AuthState {
  session: Session | null
  user: User | null
  profile: Profile | null
  role: Role
  loading: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (user: User | null) => {
    if (!user?.email) {
      setProfile(null)
      return
    }
    const { data } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, department_id, account_status')
      .eq('email', user.email)
      .maybeSingle()

    if (data) {
      setProfile(data as Profile)
      return
    }

    const { data: teamRow } = await supabase
      .from('team')
      .select('id, email, name, role')
      .eq('email', user.email)
      .maybeSingle()

    if (teamRow) {
      setProfile({
        id: teamRow.id,
        email: teamRow.email,
        full_name: teamRow.name,
        role: teamRow.role,
      })
      return
    }

    setProfile({
      id: user.id,
      email: user.email,
      full_name: user.email,
      role: 'Viewer',
    })
  }, [])

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      loadProfile(data.session?.user ?? null).finally(() => {
        if (mounted) setLoading(false)
      })
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      loadProfile(next?.user ?? null)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signIn = useCallback(async (email: string, password: string) => {
    const { getSupabaseConfigHint, supabaseConfigured } = await import('../lib/supabase')
    if (!supabaseConfigured) {
      return getSupabaseConfigHint() || 'Supabase is not configured.'
    }
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) return error.message
      return null
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (/failed to fetch|networkerror|load failed/i.test(msg)) {
        return (
          'Cannot reach Supabase (network). Check: (1) .env has the correct VITE_SUPABASE_URL, ' +
          '(2) you restarted npm run dev after editing .env, ' +
          '(3) internet/VPN/firewall is not blocking *.supabase.co'
        )
      }
      return msg
    }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }, [])

  const refreshProfile = useCallback(async () => {
    await loadProfile(session?.user ?? null)
  }, [loadProfile, session?.user])

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      role: profile?.role || 'Viewer',
      loading,
      signIn,
      signOut,
      refreshProfile,
    }),
    [session, profile, loading, signIn, signOut, refreshProfile]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
