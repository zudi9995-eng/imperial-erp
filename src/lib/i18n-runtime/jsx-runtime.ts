import { jsx as reactJsx, jsxs as reactJsxs, Fragment } from 'react/jsx-runtime'

/**
 * Tarjima qiluvchi JSX ishlab chiqaruvchi.
 *
 * vite.config.ts da `jsxImportSource` shu papkaga qaratilgan, shuning
 * uchun loyihadagi har bir JSX elementi shu yerdan o'tadi. Vazifasi
 * bitta: element ichidagi matnni va matn tashiydigan proplarni
 * tarjimadan o'tkazish.
 *
 * Nega shunday: platformada mingdan ortiq matn bor. Har birini qo'lda
 * t('...') ga o'rash o'rniga, bitta joyda ushlaymiz. Lug'atda yo'q matn
 * o'zgarmay o'tadi, ya'ni bu qatlam hech narsani sindirmaydi.
 *
 * DIQQAT: bu fayl `i18n.tsx` ni import QILMAYDI. Vite jsxImportSource ni
 * tashqi paket deb o'ylab alohida to'playdi, import qilinsa i18n moduli
 * ikki nusxa bo'lib qoladi va til almashtirish ishlamaydi. Shuning uchun
 * aloqa globalThis orqali: i18n.tsx yuklanganda o'z funksiyasini shu
 * yerga qo'yadi.
 */

type Global = { __ipTranslate?: (s: string) => string }

function translate(s: string): string {
  const fn = (globalThis as Global).__ipTranslate
  return fn ? fn(s) : s
}

/** Matn tashiydigan proplar — tugma sarlavhasi, maydon nomi va h.k. */
const TEXT_PROPS = [
  'title', 'placeholder', 'label', 'sub', 'hint', 'alt', 'aria-label',
]

type Props = Record<string, unknown> | null | undefined

function tr(v: unknown): unknown {
  if (typeof v === 'string') return translate(v)
  if (Array.isArray(v)) {
    let changed = false
    const out = v.map((x) => {
      if (typeof x !== 'string') return x
      const t = translate(x)
      if (t !== x) changed = true
      return t
    })
    return changed ? out : v
  }
  return v
}

export function fixProps(props: Props): Props {
  if (!props) return props
  let out: Record<string, unknown> | null = null

  const kids = (props as Record<string, unknown>).children
  const nextKids = tr(kids)
  if (nextKids !== kids) out = { ...props, children: nextKids }

  for (const k of TEXT_PROPS) {
    const v = (props as Record<string, unknown>)[k]
    if (typeof v !== 'string') continue
    const t = translate(v)
    if (t === v) continue
    out = { ...(out ?? props), [k]: t }
  }

  return out ?? props
}

export function jsx(type: unknown, props: Props, key?: unknown) {
  return (reactJsx as never as (t: unknown, p: Props, k?: unknown) => unknown)(
    type, fixProps(props), key)
}

export function jsxs(type: unknown, props: Props, key?: unknown) {
  return (reactJsxs as never as (t: unknown, p: Props, k?: unknown) => unknown)(
    type, fixProps(props), key)
}

// JSX nomlar fazosi React niki bo'lib qoladi — aks holda
// TypeScript JSX.IntrinsicElements ni topa olmaydi.
export type { JSX } from 'react/jsx-runtime'

export { Fragment }
