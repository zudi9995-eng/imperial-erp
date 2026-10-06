import { useCallback, useEffect, useState } from 'react'

/**
 * Spravochniklar uchun umumiy kesh.
 *
 * Muammo shunda ediki, `useRefs()` ni 19 ta komponent chaqiradi va har
 * biri o'z nusxasida 8 ta so'rov yuborardi. Ochiq hujjat oynalari ham
 * mount bo'lib turgani uchun (1C dagidek) bu yana ko'payardi — bitta
 * sahifa ochilishida yuzga yaqin ortiqcha so'rov ketardi.
 *
 * Endi bir xil kalit bo'yicha so'rov bir marta ketadi, natija esa
 * hamma obunachilarga tarqaladi. `reload()` majburan qayta yuklaydi va
 * hammani yangilaydi.
 *
 * Kesh foydalanuvchiga bog'liq (RLS menejerga faqat o'z mijozini
 * ko'rsatadi), shuning uchun chiqishda `clearShared()` chaqiriladi.
 */

/**
 * Kesh qancha vaqt yangi hisoblanadi.
 *
 * Muddatsiz kesh bir marta chatoq bo'lsa, abadiy chatoq qoladi: bir
 * menejer ilovani ruxsat tuzatilishidan oldin ochgan edi va bo'sh
 * mijozlar ro'yxati brauzerida qotib qoldi — sahifani yangilamaguncha
 * shunday turardi. Endi eskirgan kesh keyingi ochilishda o'zi
 * yangilanadi.
 */
const TTL = 5 * 60_000

interface Entry {
  data: unknown
  /** Oxirgi marta qachon yuklangan */
  at: number
  /** Hozir ketayotgan so'rov — ikkinchi chaqiruv shunga ulanadi */
  inflight: Promise<unknown> | null
  subs: Set<() => void>
}

const store = new Map<string, Entry>()

function entry(key: string): Entry {
  let e = store.get(key)
  if (!e) { e = { data: null, at: 0, inflight: null, subs: new Set() }; store.set(key, e) }
  return e
}

function notify(e: Entry) { for (const fn of e.subs) fn() }

/** Ma'lumot bor, lekin eskirgan */
function stale(e: Entry) { return e.data !== null && Date.now() - e.at > TTL }

function load<T>(key: string, loader: () => Promise<T>, force: boolean): Promise<T> {
  const e = entry(key)
  if (!force && e.inflight) return e.inflight as Promise<T>
  if (!force && e.data !== null) return Promise.resolve(e.data as T)

  const p = loader().then((data) => {
    e.data = data
    e.at = Date.now()
    e.inflight = null
    notify(e)
    return data
  }).catch((err) => {
    e.inflight = null
    throw err
  })
  e.inflight = p
  return p
}

/**
 * Bir xil kalitli ma'lumotni hamma komponent bilan bo'lishadi.
 * `empty` — hali yuklanmagan paytdagi qiymat (doim bir xil havola
 * bo'lsin, aks holda qayta chizish tsikliga tushadi).
 */
export function useShared<T>(
  key: string,
  loader: () => Promise<T>,
  empty: T,
): { data: T; loading: boolean; reload: () => Promise<void> } {
  const e = entry(key)
  const [, bump] = useState(0)

  useEffect(() => {
    const cb = () => bump((x) => x + 1)
    const self = entry(key)
    self.subs.add(cb)
    // Eskirgan bo'lsa jimgina yangilanadi: ekranda hozirgi ma'lumot
    // turib turadi, so'rov qaytgach o'zi almashadi.
    if (!self.inflight && (self.data === null || stale(self))) {
      void load(key, loader, self.data !== null).catch(() => {})
    }
    return () => { self.subs.delete(cb) }
    // loader har renderda yangi funksiya bo'ladi — kalit yetarli
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const reload = useCallback(
    () => load(key, loader, true).then(() => undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  )

  return {
    data: (e.data as T | null) ?? empty,
    loading: e.data === null,
    reload,
  }
}

/** Chiqishda yoki foydalanuvchi almashganda — kesh foydalanuvchiga bog'liq */
export function clearShared() {
  for (const e of store.values()) {
    e.data = null
    e.at = 0
    e.inflight = null
    notify(e)
  }
}

/** Bitta kalitni bekor qilish (masalan tovar qo'shilgandan keyin) */
export function invalidateShared(key: string) {
  const e = store.get(key)
  if (!e) return
  e.data = null
  e.at = 0
  e.inflight = null
  notify(e)
}
