import type { CSSProperties, ReactNode } from 'react'

/**
 * 1C uslubidagi hujjat ro'yxati.
 *
 * Asosiy uchta odat 1C dan olingan:
 *  1. Chap chetdagi ikki rangli doira — yuk chiqdimi va pul keldimi
 *  2. Qator matni holat rangida: ishlanmagan — to'q sariq, ishlanmoqda —
 *     ko'k, yakunlangan — oddiy, bekor qilingan — kulrang
 *  3. Katak chiziqlari yo'q, qatorlar navbatma-navbat fonli; tanlangan
 *     qator sariq
 */

export type Mark = 'full' | 'half' | 'empty' | 'none'

/** Qator holati — matn rangini belgilaydi (1C dagi «Состояние» kabi) */
export type RowTone = 'normal' | 'attention' | 'active' | 'muted'

const MARK_COLOR = {
  full:  'var(--ok)',
  half:  'var(--ok)',
  empty: 'var(--danger)',
  none:  'var(--border-2)',
} as const

const TONE_COLOR: Record<RowTone, string | undefined> = {
  normal:    undefined,
  attention: 'var(--warn)',
  active:    'var(--brand)',
  muted:     'var(--text-3)',
}

/** To'ldirilgan / yarim / bo'sh doira */
export function StatusDot({
  mark, title, size = 12,
}: { mark: Mark; title?: string; size?: number }) {
  const color = MARK_COLOR[mark]

  if (mark === 'half') {
    // Yarim to'ldirilgan: chap yarmi rangli, o'ng yarmi bo'sh
    return (
      <span
        title={title}
        className="inline-block shrink-0 rounded-full align-middle"
        style={{
          width: size, height: size,
          border: `1.5px solid ${color}`,
          background: `linear-gradient(90deg, ${color} 50%, transparent 50%)`,
        }}
      />
    )
  }

  return (
    <span
      title={title}
      className="inline-block shrink-0 rounded-full align-middle"
      style={{
        width: size, height: size,
        border: `1.5px solid ${color}`,
        background: mark === 'full' ? color : 'transparent',
        opacity: mark === 'none' ? 0.45 : 1,
      }}
    />
  )
}

/* ---------------------------------------------------------------- */

const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' } as const

export function DocTable({
  children, minWidth,
}: { children: ReactNode; minWidth?: number }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full border-collapse text-[13px]" style={{ minWidth }}>
        {children}
      </table>
    </div>
  )
}

/** Sarlavha — kulrang fon, ustunlar orasida ingichka ajratgich */
export function DocTh({
  children, w, align = 'left', sorted,
}: {
  children?: ReactNode
  w?: number | string
  align?: 'left' | 'right' | 'center'
  sorted?: 'asc' | 'desc'
}) {
  return (
    <th
      style={{
        width: w,
        background: 'var(--head-bg)',
        borderColor: 'var(--border-2)',
        color: 'var(--text-2)',
      }}
      className={`sticky top-0 z-10 border-b border-r px-2 py-[6px] ${ALIGN[align]}
        text-[12px] font-semibold whitespace-nowrap last:border-r-0`}
    >
      <span className={`inline-flex items-center gap-1
        ${align === 'right' ? 'flex-row-reverse' : ''}`}>
        {children}
        {sorted && (
          <span style={{ color: 'var(--text-3)' }}>{sorted === 'asc' ? '↑' : '↓'}</span>
        )}
      </span>
    </th>
  )
}

/**
 * Katak — chiziqsiz. `link` ohangi qator rangiga bo'ysunadi:
 * 1C da ishlanmagan qatorda havolalar ham to'q sariq bo'ladi.
 */
export function DocTd({
  children, w, align = 'left', mono, tone, stopClick, className = '', title, colSpan,
}: {
  children?: ReactNode
  w?: number | string
  align?: 'left' | 'right' | 'center'
  mono?: boolean
  tone?: 'normal' | 'link' | 'muted' | 'danger'
  stopClick?: boolean
  className?: string
  title?: string
  colSpan?: number
}) {
  const color =
    tone === 'link' ? 'var(--doc-row-color, var(--brand))'
      : tone === 'muted' ? 'var(--doc-row-color, var(--text-3))'
      : tone === 'danger' ? 'var(--doc-row-color, var(--danger))'
      : undefined

  return (
    <td
      title={title}
      colSpan={colSpan}
      onClick={stopClick ? (e) => e.stopPropagation() : undefined}
      style={{ width: w, color }}
      className={`px-2 py-[5px] align-middle ${ALIGN[align]}
        ${mono ? 'tnum' : ''} ${className}`}
    >
      {children}
    </td>
  )
}

/**
 * Qator. `tone` butun qator matnini bo'yaydi va `--doc-row-color` orqali
 * havola kataklariga ham o'tadi — 1C dagidek.
 */
export function DocTr({
  children, onClick, onDoubleClick, selected, tone = 'normal', alt,
}: {
  children: ReactNode
  onClick?: () => void
  /** 1C dagidek: ikki marta bosilganda hujjat ochiladi */
  onDoubleClick?: () => void
  selected?: boolean
  tone?: RowTone
  /** Navbatma-navbat fon uchun toq/juft */
  alt?: boolean
}) {
  const c = TONE_COLOR[tone]
  const style: CSSProperties & Record<string, string | undefined> = {}

  if (c) {
    style.color = c
    style['--doc-row-color'] = c
  }
  if (selected) {
    style.background = 'var(--row-sel)'
    style.boxShadow = 'inset 0 0 0 1px var(--row-sel-bd)'
  } else if (alt) {
    style.background = 'var(--row-alt)'
  }

  return (
    <tr
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      style={style}
      className={`${onClick ? 'cursor-pointer' : ''}
        ${selected ? '' : 'hover:bg-[var(--brand-soft)]'}`}
    >
      {children}
    </tr>
  )
}

/* ---------------------------------------------------------------- */

/** 1C dagi buyruqlar paneli */
export function DocToolbar({
  left, right,
}: { left: ReactNode; right?: ReactNode }) {
  return (
    <div
      className="mb-2 flex flex-wrap items-center gap-1.5 rounded-lg border px-2 py-1.5"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="flex flex-wrap items-center gap-1.5">{left}</div>
      {right && <div className="ml-auto flex flex-wrap items-center gap-1.5">{right}</div>}
    </div>
  )
}

/** Doiralar nimani anglatishini tushuntiruvchi qator */
export function MarkLegend({ items }: { items: { mark: Mark; label: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px]"
         style={{ color: 'var(--text-3)' }}>
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <StatusDot mark={i.mark} size={10} />
          {i.label}
        </span>
      ))}
    </div>
  )
}

/** Holat ranglari izohi — jadval ostida */
export function ToneLegend() {
  const items: { tone: RowTone; label: string }[] = [
    { tone: 'attention', label: 'ishlanmagan' },
    { tone: 'active', label: 'ishlanmoqda' },
    { tone: 'normal', label: 'yakunlangan' },
    { tone: 'muted', label: 'bekor qilingan' },
  ]
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px]"
         style={{ color: 'var(--text-3)' }}>
      {items.map((i) => (
        <span key={i.label} style={{ color: TONE_COLOR[i.tone] }}>{i.label}</span>
      ))}
    </div>
  )
}
