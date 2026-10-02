import { jsxDEV as reactJsxDEV, Fragment } from 'react/jsx-dev-runtime'
import { fixProps } from './jsx-runtime'

/** jsx-runtime.ts bilan bir xil, faqat dev rejim uchun */

type Props = Record<string, unknown> | null | undefined

export function jsxDEV(
  type: unknown, props: Props, key?: unknown,
  isStatic?: boolean, source?: unknown, self?: unknown,
) {
  return (reactJsxDEV as never as (
    t: unknown, p: Props, k?: unknown, s?: boolean, src?: unknown, slf?: unknown,
  ) => unknown)(type, fixProps(props), key, isStatic, source, self)
}

// JSX nomlar fazosi React niki bo'lib qoladi — aks holda
// TypeScript JSX.IntrinsicElements ni topa olmaydi.
export type { JSX } from 'react/jsx-runtime'

export { Fragment }
