import {
  createContext, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { clearShared } from './shared'
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
  /** Ruxsat bormi. Ta'sischida har doim true. */
  can: (code: string) => boolean
  /** 'all' — hamma ma'lumot, 'own' — faqat o'ziniki */
  scope: 'all' | 'own'
  permissions: Set<string>
  roleName: string | null
  /** Foydalanuvchi qaysi kompaniyada va u qanday holatda */
  company: CompanyInfo | null
  /** 'ready' bo'lmasa platformaga kirib bo'lmaydi */
  accessState: AccessState
  isPlatformAdmin: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  bootstrapOwner: (fullName: string) => Promise<void>
  refreshProfile: () => Promise<void>
  /** Yangi hisob ochib, kompaniya arizasini yozadi */
  signUpCompany: (v: {
    email: string; password: string; fullName: string
    company: string; phone?: string; inn?: string
  }) => Promise<void>
}

export interface CompanyInfo {
  id: number
  name: string
  status: 'pending' | 'active' | 'suspended' | 'rejected'
  reject_reason: string | null
}

export type AccessState =
  | 'loading' | 'anon' | 'no_profile' | 'orphan' | 'pending'
  | 'rejected' | 'suspended' | 'inactive' | 'ready'

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [noOwnerYet, setNoOwnerYet] = useState(false)
  const [perms, setPerms] = useState<Set<string>>(new Set())
  const [scope, setScope] = useState<'all' | 'own'>('own')
  const [roleName, setRoleName] = useState<string | null>(null)
  const [company, setCompany] = useState<CompanyInfo | null>(null)
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

    const cid = (data as { company_id?: number } | null)?.company_id ?? null
    if (cid) {
      const { data: c } = await supabase.from('ip_companies')
        .select('id, name, status, reject_reason').eq('id', cid).maybeSingle()
      setCompany((c as CompanyInfo | null) ?? null)
    } else {
      setCompany(null)
    }

    if (data) {
      const prof = data as Profile
      if (prof.role === 'owner') {
        // Ta'sischi — hamma ruxsat
        const { data: all } = await supabase.from('ip_permissions').select('code')
        setPerms(new Set((all ?? []).map((p: { code: string }) => p.code)))
        setScope('all')
        setRoleName("Ta'sischi")
      } else if (prof.role_id) {
        const [rp, rl] = await Promise.all([
          supabase.from('ip_role_permissions').select('permission_code').eq('role_id', prof.role_id),
          supabase.from('ip_roles').select('name, data_scope').eq('id', prof.role_id).maybeSingle(),
        ])
        setPerms(new Set((rp.data ?? []).map((r: { permission_code: string }) => r.permission_code)))
        const role = rl.data as { name: string; data_scope: 'all' | 'own' } | null
        setScope(role?.data_scope ?? 'own')
        setRoleName(role?.name ?? null)
      } else {
        setPerms(new Set())
        setScope(prof.role === 'manager' ? 'own' : 'all')
        setRoleName(null)
      }
    } else {
      setPerms(new Set())
      setScope('own')
      setRoleName(null)
    }

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
      // Spravochnik keshi foydalanuvchiga bog'liq (RLS menejerga faqat
      // o'z mijozini ko'rsatadi) — kirish/chiqishda tozalanadi
      if (_evt === 'SIGNED_IN' || _evt === 'SIGNED_OUT' || _evt === 'USER_UPDATED') {
        clearShared()
      }
      setSession(s)
      if (s?.user) {
        await loadProfile(s.user.id)
      } else {
        setProfile(null)
        setCompany(null)
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
    permissions: perms,
    scope,
    roleName,
    company,
    isPlatformAdmin: Boolean(
      (profile as (Profile & { is_platform_admin?: boolean }) | null)?.is_platform_admin),
    accessState: computeAccess(loading, session, profile, company),
    can: (code: string) => profile?.role === 'owner' || perms.has(code),

    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw new Error(translateAuthError(error.message))
    },

    async signOut() {
      await supabase.auth.signOut()
      clearShared()
      setProfile(null)
      setCompany(null)
    },

    async signUpCompany(v) {
      const { error: e1 } = await supabase.auth.signUp({
        email: v.email.trim(), password: v.password,
      })
      if (e1) throw new Error(translateAuthError(e1.message))

      // Email tasdiqlash yoqilgan bo'lsa sessiya hali yo'q
      const { data: sess } = await supabase.auth.getSession()
      if (!sess.session) {
        const { error: e2 } = await supabase.auth.signInWithPassword({
          email: v.email.trim(), password: v.password,
        })
        if (e2) throw new Error(translateAuthError(e2.message))
      }

      const { error: e3 } = await supabase.rpc('ip_request_company', {
        p_company: v.company.trim(),
        p_full_name: v.fullName.trim(),
        p_phone: v.phone?.trim() || null,
        p_inn: v.inn?.trim() || null,
        p_email: v.email.trim(),
      })
      if (e3) throw new Error(e3.message)

      const { data: u } = await supabase.auth.getUser()
      if (u.user) await loadProfile(u.user.id)
    },

    async bootstrapOwner(fullName) {
      const { error } = await supabase.rpc('ip_bootstrap_owner', { p_full_name: fullName })
      if (error) throw new Error(error.message)
      if (session?.user) await loadProfile(session.user.id)
    },

    async refreshProfile() {
      if (session?.user) await loadProfile(session.user.id)
    },
  }), [session, profile, noOwnerYet, loading, perms, scope, roleName])

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

/**
 * Foydalanuvchi platformaga kira oladimi.
 * Har bir holat kirish ekranida boshqacha ko'rsatiladi.
 */
function computeAccess(
  loading: boolean,
  session: Session | null,
  profile: Profile | null,
  company: CompanyInfo | null,
): AccessState {
  if (loading) return 'loading'
  if (!session) return 'anon'
  if (!profile) return 'no_profile'
  // Profil bor, lekin kompaniyasi yo'q — bu xodim. Unga kompaniya
  // ro'yxatdan o'tkazish taklif qilinmaydi, aks holda o'zini alohida
  // kompaniya qilib qo'yadi.
  if (!company) return 'orphan'
  if (company.status === 'pending') return 'pending'
  if (company.status === 'rejected') return 'rejected'
  if (company.status === 'suspended') return 'suspended'
  if (!profile.is_active) return 'inactive'
  return 'ready'
}
