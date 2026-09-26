import {
  createContext, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Profile, Role } from './types'

interface AuthState {
  session: Session | null
  profile: Profile | null
  /** true = tizimda auth foydalanuvchi bor, lekin ip_profiles da yo'q */
  needsProfile: boolean
  /** true = umuman hech qanday xodim yo'q, birinchi kirish */
  noOwnerYet: boolean
  loading: boolean
  role: Role | null
  isOwner: boolean
  isManager: boolean
  isAccountant: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  bootstrapOwner: (fullName: string) => Promise<void>
  refreshProfile: () => Promise<void>
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [noOwnerYet, setNoOwnerYet] = useState(false)
  const [loading, setLoading] = useState(true)

  async function loadProfile(userId: string) {
    const { data, error } = await supabase
      .from('ip_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      // RLS profil yo'qligida ham xato bermaydi, lekin ehtimolga qarshi
      console.warn('Profilni o\'qishda xato:', error.message)
    }
    setProfile((data as Profile | null) ?? null)

    if (!data) {
      // Hech kim yo'qmi? Bo'lsa — birinchi kirish, o'zini ta'sischi qiladi
      const { count } = await supabase
        .from('ip_profiles')
        .select('id', { count: 'exact', head: true })
      setNoOwnerYet((count ?? 0) === 0)
    } else {
      setNoOwnerYet(false)
    }
  }

  useEffect(() => {
    let alive = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return
      setSession(data.session)
      if (data.session?.user) await loadProfile(data.session.user.id)
      if (alive) setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (_evt, s) => {
      if (!alive) return
      setSession(s)
      if (s?.user) {
        await loadProfile(s.user.id)
      } else {
        setProfile(null)
        setNoOwnerYet(false)
      }
      setLoading(false)
    })

    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthState>(() => ({
    session,
    profile,
    needsProfile: !!session && !profile,
    noOwnerYet,
    loading,
    role: profile?.role ?? null,
    isOwner: profile?.role === 'owner',
    isManager: profile?.role === 'manager',
    isAccountant: profile?.role === 'accountant',

    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw new Error(translateAuthError(error.message))
    },

    async signOut() {
      await supabase.auth.signOut()
      setProfile(null)
    },

    async bootstrapOwner(fullName) {
      const { error } = await supabase.rpc('ip_bootstrap_owner', { p_full_name: fullName })
      if (error) throw new Error(error.message)
      if (session?.user) await loadProfile(session.user.id)
    },

    async refreshProfile() {
      if (session?.user) await loadProfile(session.user.id)
    },
  }), [session, profile, noOwnerYet, loading])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth faqat AuthProvider ichida ishlaydi')
  return v
}

function translateAuthError(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Email yoki parol xato'
  if (m.includes('email not confirmed')) return 'Email tasdiqlanmagan'
  if (m.includes('too many requests')) return 'Juda ko\'p urinish — bir daqiqa kutib turing'
  if (m.includes('network')) return 'Internet aloqasi yo\'q'
  return msg
}
