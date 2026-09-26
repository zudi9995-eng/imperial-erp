import type { CSSProperties, ReactNode } from 'react'

/**
 * 1C uslubidagi hujjat ro'yxati uchun komponentlar.
 * Asosiy g'oya: chap chetdagi ikki rangli doira bilan hujjat holati
 * bir qarashda o'qiladi — yuk chiqdimi va pul keldimi.
 */

export type Mark = 'full' | 'half' | 'empty' | 'none'

const MARK_COLOR = {
  full:  'var(--ok)',
  half:  'var(--warn)',
  empty: 'var(--danger)',
  none:  'var(--border-2)',
} as const

/** To'ldirilgan / yarim / bo'sh doira */
export function StatusDot({
  mark, title, size = 11,
}: { mark: Mark; title?: string; size?: number }) {
  const color = MARK_COLOR[mark]

  if (mark === 'half') {
    // Yarim to'ldirilgan: chap yarmi rangli, o'ng yarmi bo'sh
    return (
      <span
        title={title}
        className="inline-block shrink-0 rounded-full"
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
      className="inline-block shrink-0 rounded-full"
      style={{
        width: size, height: size,
        border: `1.5px solid ${color}`,
        background: mark === 'full' ? color : 'transparent',
        opacity: mark === 'none' ? 0.5 : 1,
      }}
    />
  )
}

/* ---------------------------------------------------------------- */

/** Tailwind dinamik klass nomlarini skanerlamaydi — shuning uchun aniq yozamiz */
const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' } as const

/** Zich jadval — 1C dagidek qatorlar past bo'yli */
export function DocTable({
  children, minWidth,
}: { children: ReactNode; minWidth?: number }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table
        className="w-full border-collapse text-[13px]"
        style={{ minWidth }}
      >
        {children}
      </table>
    </div>
  )
}

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
      style={{ width: w, borderColor: 'var(--border)', color: 'var(--text-2)' }}
      className={`border-b border-r px-2 py-[5px] ${ALIGN[align]} text-[12px]
        font-semibold whitespace-nowrap last:border-r-0`}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sorted && (
          <span style={{ color: 'var(--text-3)' }}>{sorted === 'asc' ? '↑' : '↓'}</span>
        )}
      </span>
    </th>
  )
}

export function DocTd({
  children, w, align = 'left', mono, tone, stopClick, className = '', title,
}: {
  children?: ReactNode
  w?: number | string
  align?: 'left' | 'right' | 'center'
  mono?: boolean
  /** 1C dagidek: ishlanmagan hujjat matni to'q sariq bo'ladi */
  tone?: 'normal' | 'attention' | 'link' | 'muted'
  stopClick?: boolean
  className?: string
  title?: string
}) {
  const color =
    tone === 'attention' ? 'var(--warn)'
      : tone === 'link' ? 'var(--brand)'
      : tone === 'muted' ? 'var(--text-3)'
      : undefined

  return (
    <td
      title={title}
      onClick={stopClick ? (e) => e.stopPropagation() : undefined}
      style={{ width: w, borderColor: 'var(--border)', color }}
      className={`border-b border-r px-2 py-[5px] ${ALIGN[align]}
        ${mono ? 'tnum' : ''} last:border-r-0 ${className}`}
    >
      {children}
    </td>
  )
}

export function DocTr({
  children, onClick, onDoubleClick, selected, attention,
}: {
  children: ReactNode
  onClick?: () => void
  /** 1C dagidek: ikki marta bosilganda hujjat ochiladi */
  onDoubleClick?: () => void
  selected?: boolean
  /** Butun qator diqqat talab qiladi (1C da to'q sariq matn) */
  attention?: boolean
}) {
  const style: CSSProperties = {}
  if (selected) style.background = 'var(--brand-soft)'
  else if (attention) style.color = 'var(--warn)'

  return (
    <tr
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      style={style}
      className={`${onClick ? 'cursor-pointer' : ''} transition-colors
        ${selected ? '' : 'hover:bg-[var(--surface-2)]'}`}
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

/** Ikki doira ustuni sarlavhasi uchun kichik belgi */
export function MarkLegend({ items }: { items: { mark: Mark; label: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px]"
         style={{ color: 'var(--text-3)' }}>
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <StatusDot mark={i.mark} size={9} />
          {i.label}
        </span>
      ))}
    </div>
  )
}
