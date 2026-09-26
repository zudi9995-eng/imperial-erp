import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react'
import { supabase } from './supabase'
import type { Setting } from './types'
import { useAuth } from './auth'

interface SettingsState {
  all: Setting[]
  loading: boolean
  /** Raqamli sozlama. Topilmasa fallback qaytaradi. */
  n: (key: string, fallback?: number) => number
  /** Matnli sozlama. */
  s: (key: string, fallback?: string) => string
  /** Mantiqiy sozlama. */
  b: (key: string, fallback?: boolean) => boolean
  /** Xom qiymat. */
  raw: (key: string) => unknown
  save: (key: string, value: unknown) => Promise<void>
  reload: () => Promise<void>
}

const Ctx = createContext<SettingsState | null>(null)

export const SETTING_GROUPS: { key: string; label: string; icon: string }[] = [
  { key: 'umumiy',   label: 'Umumiy',        icon: 'Building2' },
  { key: 'moliya',   label: 'Moliya',        icon: 'Wallet' },
  { key: 'sotuv',    label: 'Sotuv va narx', icon: 'ShoppingCart' },
  { key: 'ombor',    label: 'Ombor',         icon: 'Package' },
  { key: 'hr',       label: 'Xodimlar (HR)', icon: 'Users' },
  { key: 'ai',       label: 'AI',            icon: 'Sparkles' },
  { key: 'telegram', label: 'Telegram',      icon: 'Send' },
]

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { session, profile } = useAuth()
  const [all, setAll] = useState<Setting[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!session) { setAll([]); setLoading(false); return }
    const { data, error } = await supabase
      .from('ip_settings')
      .select('*')
      .order('sort_order')
    if (error) console.warn('Sozlamalarni o\'qishda xato:', error.message)
    setAll((data as Setting[] | null) ?? [])
    setLoading(false)
  }, [session])

  useEffect(() => { void reload() }, [reload, profile?.id])

  const map = useMemo(() => {
    const m = new Map<string, unknown>()
    for (const s of all) m.set(s.key, s.value)
    return m
  }, [all])

  const value = useMemo<SettingsState>(() => ({
    all,
    loading,
    raw: (key) => map.get(key),
    n: (key, fallback = 0) => {
      const v = map.get(key)
      const num = typeof v === 'number' ? v : Number(v)
      return Number.isFinite(num) ? num : fallback
    },
    s: (key, fallback = '') => {
      const v = map.get(key)
      return typeof v === 'string' ? v : v == null ? fallback : String(v)
    },
    b: (key, fallback = false) => {
      const v = map.get(key)
      return typeof v === 'boolean' ? v : v == null ? fallback : v === 'true'
    },
    async save(key, val) {
      const { error } = await supabase
        .from('ip_settings')
        .update({ value: val as never, updated_by: session?.user.id ?? null })
        .eq('key', key)
      if (error) throw new Error(error.message)
      setAll((prev) => prev.map((s) => (s.key === key ? { ...s, value: val } : s)))
    },
    reload,
  }), [all, loading, map, reload, session])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSettings(): SettingsState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useSettings faqat SettingsProvider ichida ishlaydi')
  return v
}
