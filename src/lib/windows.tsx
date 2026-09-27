import {
  createContext, useCallback, useContext, useMemo, useRef, useState,
  type ReactNode,
} from 'react'

/**
 * 1C dagi ochiq oynalar ro'yxati.
 *
 * Hujjat ochilganda u yopilmaguncha tirik qoladi: boshqa oynaga o'tib
 * qaytsangiz, kiritilgan qatorlar, kursor — hammasi joyida turadi.
 * Buning uchun oynalar DOM dan olib tashlanmaydi, faqat yashiriladi.
 *
 * Oynalar faqat shu sessiya davomida yashaydi — sahifa yangilansa
 * yo'qoladi. Saqlanmagan hujjat bo'lsa, yopishdan oldin so'raladi.
 */

export type WinKind = 'order' | 'sale' | 'sale-edit' | 'purchase' | 'return'

export interface DocWindow {
  /** Bir xil hujjat ikki marta ochilmasligi uchun barqaror kalit */
  key: string
  kind: WinKind
  title: string
  subtitle?: string
  /** Komponentga uzatiladigan parametrlar */
  params: Record<string, unknown>
  dirty: boolean
}

interface WindowsCtx {
  wins: DocWindow[]
  active: string | null
  open: (w: { kind: WinKind; key: string; title: string; subtitle?: string;
              params?: Record<string, unknown> }) => void
  close: (key: string) => void
  closeAll: () => void
  activate: (key: string | null) => void
  setMeta: (key: string, meta: { title?: string; subtitle?: string }) => void
  setDirty: (key: string, dirty: boolean) => void
  /** Ro'yxatlarga "o'zgardi, qayta yukla" signali */
  signal: (topic: string) => void
  signals: Record<string, number>
}

const Ctx = createContext<WindowsCtx | null>(null)

export function WindowsProvider({ children }: { children: ReactNode }) {
  const [wins, setWins] = useState<DocWindow[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [signals, setSignals] = useState<Record<string, number>>({})

  const open = useCallback<WindowsCtx['open']>((w) => {
    setWins((prev) => {
      if (prev.some((x) => x.key === w.key)) return prev
      return [...prev, {
        key: w.key, kind: w.kind, title: w.title,
        subtitle: w.subtitle, params: w.params ?? {}, dirty: false,
      }]
    })
    setActive(w.key)
  }, [])

  // So'nggi holatga havola: close/closeAll shu orqali barqaror qoladi.
  // Barqaror bo'lmasa useWindowSelf har renderda yangilanib, sarlavha
  // yangilash effekti cheksiz siklga tushib qolardi.
  const winsRef = useRef<DocWindow[]>([])
  winsRef.current = wins

  const close = useCallback((key: string) => {
    const cur = winsRef.current
    const w = cur.find((x) => x.key === key)
    // confirm() ni setState yangilagichi ichida chaqirib bo'lmaydi —
    // React uni ikki marta ishga tushirishi mumkin
    if (w?.dirty && !confirm(
      `"${w.title}" da saqlanmagan o'zgarishlar bor. Yopilsinmi?`)) return

    const i = cur.findIndex((x) => x.key === key)
    const next = cur.filter((x) => x.key !== key)
    setWins(next)
    // Yopilgandan keyin qo'shnisiga o'tamiz — 1C dagidek
    setActive((a) => (a === key ? (next[i]?.key ?? next[i - 1]?.key ?? null) : a))
  }, [])

  const closeAll = useCallback(() => {
    if (winsRef.current.some((w) => w.dirty)
      && !confirm("Ba'zi oynalarda saqlanmagan o'zgarishlar bor. Hammasi yopilsinmi?")) return
    setWins([])
    setActive(null)
  }, [])

  const activate = useCallback((key: string | null) => setActive(key), [])

  const setMeta = useCallback((key: string, meta: { title?: string; subtitle?: string }) => {
    setWins((prev) => {
      const w = prev.find((x) => x.key === key)
      if (!w) return prev
      const title = meta.title ?? w.title
      const subtitle = meta.subtitle ?? w.subtitle
      // O'zgarish bo'lmasa eski massivni qaytaramiz — aks holda sikl
      if (title === w.title && subtitle === w.subtitle) return prev
      return prev.map((x) => (x.key === key ? { ...x, title, subtitle } : x))
    })
  }, [])

  const setDirty = useCallback((key: string, dirty: boolean) => {
    setWins((prev) => {
      const w = prev.find((x) => x.key === key)
      if (!w || w.dirty === dirty) return prev
      return prev.map((x) => (x.key === key ? { ...x, dirty } : x))
    })
  }, [])

  const signal = useCallback((topic: string) => {
    setSignals((prev) => ({ ...prev, [topic]: (prev[topic] ?? 0) + 1 }))
  }, [])

  const value = useMemo<WindowsCtx>(
    () => ({ wins, active, open, close, closeAll, activate, setMeta, setDirty, signal, signals }),
    [wins, active, open, close, closeAll, activate, setMeta, setDirty, signal, signals],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useWindows(): WindowsCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useWindows faqat WindowsProvider ichida ishlaydi')
  return c
}

/**
 * Ro'yxat sahifalari uchun: `signals.orders` o'zgarsa qayta yuklaydi.
 * Oyna yashiringan bo'lsa ham ishlaydi, shuning uchun qaytganingizda
 * ro'yxat allaqachon yangilangan bo'ladi.
 */
export function useSignal(topic: string): number {
  return useWindows().signals[topic] ?? 0
}

/** Oynaning o'z kaliti — hujjat komponentlari sarlavhani yangilashi uchun */
export function useWindowSelf(key: string | undefined) {
  const { setMeta, setDirty, close } = useWindows()
  const ref = useRef(key)
  ref.current = key

  return useMemo(() => ({
    setMeta: (m: { title?: string; subtitle?: string }) => {
      if (ref.current) setMeta(ref.current, m)
    },
    setDirty: (d: boolean) => { if (ref.current) setDirty(ref.current, d) },
    closeSelf: () => { if (ref.current) close(ref.current) },
  }), [setMeta, setDirty, close])
}
