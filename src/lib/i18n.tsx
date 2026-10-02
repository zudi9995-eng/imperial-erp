import {
  createContext, useCallback, useContext, useMemo, useState, type ReactNode,
} from 'react'
import { RU } from './ru'

/**
 * Platforma tili: o'zbek yoki rus.
 *
 * Tarjima JSX darajasida qilinadi (src/lib/i18n-runtime/jsx-runtime.ts ga
 * qarang): JSX ichidagi har bir matn shu yerdagi `translate` dan o'tadi.
 * Shuning uchun komponentlarda hech narsa o'ralmaydi — lug'atga so'z
 * qo'shilsa, u butun platformada o'zi ishlab ketadi.
 *
 * Lug'at kaliti — o'zbekcha matnning o'zi. Lug'atda yo'q matn o'zgarmay
 * o'tadi, ya'ni tarjima qilinmagan joy ham buzilmaydi.
 */

export type Lang = 'uz' | 'ru'

const KEY = 'ip-lang'

/** Joriy til — jsx-runtime shu o'zgaruvchini o'qiydi */
let current: Lang = readStored()

function readStored(): Lang {
  try {
    return localStorage.getItem(KEY) === 'ru' ? 'ru' : 'uz'
  } catch {
    return 'uz'   // private rejimda localStorage yopiq bo'lishi mumkin
  }
}

/**
 * Loyihada apostrof ikki xil yozilgan: oddiy ' va tipografik ‘ / ’.
 * Lug'at kaliti mos kelishi uchun ikkalasini ham bir ko'rinishga
 * keltiramiz, bo'sh joylarni ham siqamiz (JSX matnni qatorga bo'lib
 * yozganda ortiqcha probel paydo bo'ladi).
 */
const APOS = /[‘’ʻʼ´`]/g
const norm = (s: string) => s.replace(APOS, "'").replace(/\s+/g, ' ').trim()

const MAP = new Map<string, string>()
for (const [k, v] of Object.entries(RU)) MAP.set(norm(k), v)

/** JSX dagi matnni joriy tilga o'giradi */
export function translate(s: string): string {
  if (current !== 'ru') return s
  const key = norm(s)
  if (!key) return s
  const hit = MAP.get(key)
  if (hit === undefined) return s
  // Atrofidagi bo'sh joy saqlanadi — aks holda so'zlar yopishib qoladi
  const lead = /^\s*/.exec(s)![0]
  const tail = /\s*$/.exec(s)![0]
  return lead + hit + tail
}

export function getLang(): Lang { return current }

// JSX ishlab chiqaruvchi shu nuqtadan o'qiydi. Import orqali emas,
// chunki Vite uni alohida to'plasa modul ikki nusxa bo'lib qoladi.
;(globalThis as { __ipTranslate?: (s: string) => string }).__ipTranslate = translate

interface LangState {
  lang: Lang
  setLang: (l: Lang) => void
  /** Til almashganda butun daraxt qayta chiziladi */
  renderKey: number
}

const Ctx = createContext<LangState | null>(null)

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(current)
  const [renderKey, setRenderKey] = useState(0)

  const setLang = useCallback((l: Lang) => {
    current = l
    try { localStorage.setItem(KEY, l) } catch { /* yopiq bo'lsa ham mayli */ }
    document.documentElement.lang = l
    setLangState(l)
    // jsx-runtime modul darajasidagi `current` ni o'qiydi, shuning uchun
    // React ni qayta chizishga majburlaymiz
    setRenderKey((k) => k + 1)
  }, [])

  const value = useMemo(() => ({ lang, setLang, renderKey }), [lang, setLang, renderKey])

  return (
    <Ctx.Provider value={value}>
      <div key={renderKey} className="contents">{children}</div>
    </Ctx.Provider>
  )
}

export function useLang(): LangState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useLang faqat LangProvider ichida ishlaydi')
  return v
}
