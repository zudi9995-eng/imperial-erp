import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import type {
  CashAccount, Category, Customer, PaymentTerm, PipelineStage, PriceTier,
  Product, Profile, Supplier, Unit, Warehouse,
} from './types'

export interface Refs {
  warehouses: Warehouse[]
  categories: Category[]
  units: Unit[]
  tiers: PriceTier[]
  terms: PaymentTerm[]
  accounts: CashAccount[]
  stages: PipelineStage[]
  profiles: Profile[]
  loading: boolean
  reload: () => Promise<void>
}

/** Spravochniklar — sahifa ochilganda bir marta yuklanadi. */
export function useRefs(): Refs {
  const [state, setState] = useState<Omit<Refs, 'reload'>>({
    warehouses: [], categories: [], units: [], tiers: [], terms: [],
    accounts: [], stages: [], profiles: [], loading: true,
  })

  const reload = useCallback(async () => {
    const [w, c, u, t, pt, a, st, pr] = await Promise.all([
      supabase.from('ip_warehouses').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('ip_categories').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('ip_units').select('*').order('sort_order'),
      supabase.from('ip_price_tiers').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('ip_payment_terms').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('ip_cash_accounts').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('ip_pipeline_stages').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('ip_profiles').select('*').eq('is_active', true).order('full_name'),
    ])
    setState({
      warehouses: (w.data as Warehouse[]) ?? [],
      categories: (c.data as Category[]) ?? [],
      units:      (u.data as Unit[]) ?? [],
      tiers:      (t.data as PriceTier[]) ?? [],
      terms:      (pt.data as PaymentTerm[]) ?? [],
      accounts:   (a.data as CashAccount[]) ?? [],
      stages:     (st.data as PipelineStage[]) ?? [],
      profiles:   (pr.data as Profile[]) ?? [],
      loading: false,
    })
  }, [])

  useEffect(() => { void reload() }, [reload])

  return { ...state, reload }
}

/** Tovarlar ro'yxati (qidiruv uchun) */
export function useProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const { data } = await supabase
      .from('ip_products').select('*').eq('is_active', true).order('name')
    setProducts((data as Product[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { void reload() }, [reload])
  return { products, loading, reload }
}

/** Mijozlar (RLS o'zi menejernikini filtrlaydi) */
export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const { data } = await supabase
      .from('ip_customers').select('*').eq('is_active', true).order('name')
    setCustomers((data as Customer[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { void reload() }, [reload])
  return { customers, loading, reload }
}

export function useSuppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const { data } = await supabase
      .from('ip_suppliers').select('*').eq('is_active', true).order('name')
    setSuppliers((data as Supplier[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { void reload() }, [reload])
  return { suppliers, loading, reload }
}

/** Amaldagi narxlar: product_id -> tier_id -> narx */
export async function fetchPrices(tierId?: number | null) {
  let q = supabase.from('ip_current_prices').select('product_id, tier_id, price')
  if (tierId) q = q.eq('tier_id', tierId)
  const { data } = await q
  const map = new Map<string, number>()
  for (const r of (data ?? []) as { product_id: number; tier_id: number; price: number }[]) {
    map.set(`${r.product_id}:${r.tier_id}`, Number(r.price))
  }
  return map
}

/** Supabase xatosini o'zbekchaga o'giradi */
export function translateDbError(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('omborda tovar yetarli emas')) return msg
  if (m.includes('marja') && m.includes('minimal')) return msg
  if (m.includes('duplicate key')) return 'Bu qiymat allaqachon mavjud'
  if (m.includes('still referenced')) return "O'chirib bo'lmaydi: bog'langan hujjatlar bor"
  if (m.includes('violates foreign key')) return "Bog'langan yozuv topilmadi"
  if (m.includes('violates not-null')) {
    // Qaysi ustun ekanini ko'rsatamiz — aks holda qidirib topib bo'lmaydi
    const col = /column "([^"]+)"/i.exec(msg)?.[1]
    return col
      ? `To'ldirilishi shart bo'lgan maydon bo'sh: ${col}`
      : "To'ldirilishi shart bo'lgan maydon bo'sh"
  }
  if (m.includes('row-level security') || m.includes('permission denied')) {
    return "Ruxsat yo'q — bu amalni faqat ta'sischi bajaradi"
  }
  if (m.includes('violates check constraint')) return 'Qiymat shartga mos emas'
  if (m.includes('failed to fetch') || m.includes('networkerror')) return "Internet aloqasi yo'q"
  return msg
}

/**
 * Edge Function chaqiruvi.
 * supabase.functions.invoke 2xx bo'lmasa `data` ni null qiladi va
 * "non-2xx status code" degan umumiy xabar beradi — haqiqiy sabab
 * javob tanasida qoladi. Shuni ochib beramiz.
 */
export async function invokeFn<T = unknown>(
  name: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body })

  if (error) {
    const ctx = (error as { context?: unknown }).context
    if (ctx && typeof (ctx as Response).json === 'function') {
      try {
        const parsed = await (ctx as Response).json() as
          { error?: string; message?: string }
        // Funksiya tushuntirish yuborgan bo'lsa shuni ko'rsatamiz,
        // quruq kod ('no_key') emas
        if (parsed?.message) throw new Error(String(parsed.message))
        if (parsed?.error) throw new Error(String(parsed.error))
      } catch (e) {
        if (e instanceof Error && e.message && !/json/i.test(e.message)) throw e
      }
    }
    throw new Error(translateDbError(error.message))
  }

  const payload = data as { error?: string; message?: string } | null
  if (payload?.error) throw new Error(payload.message ?? payload.error)
  return data as T
}
