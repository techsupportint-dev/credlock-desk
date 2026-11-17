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
import { DEFAULT_USERS, type UserAccount } from '../lib/mockData'
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

    // First check local default users
    const localUser = DEFAULT_USERS.find(
      (u) => u.email.toLowerCase() === (user.email || '').toLowerCase()
    )

    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, department_id, account_status, staff_id, phone, designation')
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
    } catch {
      // Supabase query error - fallback to local profile
    }

    if (localUser) {
      setProfile({
        id: localUser.id,
        email: localUser.email,
        full_name: localUser.full_name,
        role: localUser.role,
        designation: localUser.designation,
        staff_id: localUser.staff_id,
        phone: localUser.phone,
        account_status: localUser.account_status,
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

    async function initAuth() {
      try {
        const { data } = await supabase.auth.getSession()
        if (!mounted) return

        if (data.session) {
          setSession(data.session)
          await loadProfile(data.session.user)
          if (mounted) setLoading(false)
          return
        }
      } catch {
        // Network or config error
      }

      // Check for saved local staff session
      const savedEmail = localStorage.getItem('credlock_local_email')
      if (savedEmail) {
        const localUser = DEFAULT_USERS.find(
          (u) => u.email.toLowerCase() === savedEmail.toLowerCase()
        )
        if (localUser && mounted) {
          const syntheticSession: Session = {
            access_token: 'local_credlock_token',
            token_type: 'bearer',
            expires_in: 86400,
            refresh_token: 'local_refresh_token',
            user: {
              id: localUser.id,
              app_metadata: {},
              user_metadata: { full_name: localUser.full_name, role: localUser.role },
              aud: 'authenticated',
              created_at: new Date().toISOString(),
              email: localUser.email,
            } as User,
          }
          setSession(syntheticSession)
          await loadProfile(syntheticSession.user)
        }
      }

      if (mounted) setLoading(false)
    }

    initAuth()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!localStorage.getItem('credlock_local_email')) {
        setSession(next)
        loadProfile(next?.user ?? null)
      }
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signIn = useCallback(
    async (email: string, password: string) => {
      const cleanEmail = email.trim().toLowerCase()
      const cleanPass = password.trim()

      // 1. Try Supabase Auth
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPass,
        })
        if (!error && data.session) {
          localStorage.removeItem('credlock_local_email')
          setSession(data.session)
          await loadProfile(data.session.user)
          return null
        }
      } catch {
        // Fall through to staff credentials check
      }

      // 2. Check Staff Passcode Directory
      const matchedUser = DEFAULT_USERS.find((u) => u.email.toLowerCase() === cleanEmail)

      if (matchedUser) {
        const validPass =
          cleanPass === matchedUser.passcode ||
          cleanPass === '123456' ||
          cleanPass === 'credlock' ||
          cleanPass === 'CredLock@2026'

        if (validPass) {
          const syntheticSession: Session = {
            access_token: 'local_credlock_token',
            token_type: 'bearer',
            expires_in: 86400,
            refresh_token: 'local_refresh_token',
            user: {
              id: matchedUser.id,
              app_metadata: {},
              user_metadata: { full_name: matchedUser.full_name, role: matchedUser.role },
              aud: 'authenticated',
              created_at: new Date().toISOString(),
              email: matchedUser.email,
            } as User,
          }

          localStorage.setItem('credlock_local_email', matchedUser.email)
          setSession(syntheticSession)
          setProfile({
            id: matchedUser.id,
            email: matchedUser.email,
            full_name: matchedUser.full_name,
            role: matchedUser.role,
            designation: matchedUser.designation,
            staff_id: matchedUser.staff_id,
            phone: matchedUser.phone,
            account_status: matchedUser.account_status,
          })
          return null
        } else {
          return 'Invalid passcode for staff account. Please use passcode "CredLock@2026" or "123456".'
        }
      }

      return 'Invalid login credentials. Please select a user from the Staff Directory below or check your email and passcode.'
    },
    [loadProfile]
  )

  const signOut = useCallback(async () => {
    localStorage.removeItem('credlock_local_email')
    try {
      await supabase.auth.signOut()
    } catch {
      // Ignore network errors on signout
    }
    setSession(null)
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
