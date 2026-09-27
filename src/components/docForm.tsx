import type { CSSProperties, ReactNode } from 'react'
import { ArrowLeft, Star, X } from 'lucide-react'

/**
 * 1C uslubidagi hujjat formasi uchun komponentlar.
 * Menejerlar yillar davomida 1C da ishlagani uchun joylashuv ataylab
 * o'sha tartibda: sarlavha → buyruqlar paneli → sarlavha maydonlari →
 * havolalar → jadvalli qism (zakladkalar) → izoh va yakuniy summa.
 */

/* ------------------------------------------------- Sarlavha va panel */

export function DocWindow({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex min-h-[calc(100vh-130px)] flex-col overflow-hidden rounded-lg border"
      style={{ background: 'var(--surface)', borderColor: 'var(--border-2)' }}
    >
      {children}
    </div>
  )
}

export function DocTitleBar({
  title, subtitle, onClose, right,
}: { title: string; subtitle?: string; onClose: () => void; right?: ReactNode }) {
  return (
    <div
      className="flex items-center gap-2 border-b px-3 py-2"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
    >
      <button
        onClick={onClose} title="Orqaga"
        className="rounded p-1 hover:bg-[var(--surface)]"
        style={{ color: 'var(--text-2)' }}
      >
        <ArrowLeft size={16} />
      </button>
      <Star size={14} style={{ color: 'var(--text-3)' }} />
      <span className="truncate text-[15px] font-semibold">
        {title}
        {subtitle && (
          <span className="ml-1.5 font-normal" style={{ color: 'var(--text-3)' }}>
            {subtitle}
          </span>
        )}
      </span>
      <span className="ml-auto flex items-center gap-2">
        {right}
        <button
          onClick={onClose} title="Yopish"
          className="rounded p-1 hover:bg-[var(--surface)]"
          style={{ color: 'var(--text-2)' }}
        >
          <X size={16} />
        </button>
      </span>
    </div>
  )
}

export function DocCommandBar({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex flex-wrap items-center gap-1.5 border-b px-3 py-2"
      style={{ borderColor: 'var(--border)' }}
    >
      {children}
    </div>
  )
}

/** 1C dagi sariq "Provesti va yopish" tugmasi — menejerlar uni ko'z bilan topadi */
export function DocMainButton({
  children, onClick, disabled, loading, title,
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
  title?: string
}) {
  return (
    <button
      type="button" title={title} onClick={onClick} disabled={disabled || loading}
      style={{ background: '#f2c94c', color: '#1a1a1a', borderColor: '#d9ad2b' }}
      className="inline-flex h-8 items-center gap-1.5 rounded border px-3 text-[13px]
        font-semibold transition-opacity hover:opacity-85
        disabled:cursor-not-allowed disabled:opacity-45"
    >
      {children}
    </button>
  )
}

export function DocBarButton({
  children, onClick, disabled, title, active,
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  title?: string
  active?: boolean
}) {
  return (
    <button
      type="button" title={title} onClick={onClick} disabled={disabled}
      style={{
        background: active ? 'var(--brand-soft)' : 'var(--surface)',
        borderColor: 'var(--border-2)',
        color: 'var(--text)',
      }}
      className="inline-flex h-8 items-center gap-1.5 rounded border px-2.5 text-[13px]
        transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  )
}

export function BarSep() {
  return <span className="mx-1 h-5 w-px shrink-0" style={{ background: 'var(--border-2)' }} />
}

/* ------------------------------------------------- Sarlavha maydonlari */

/** Yorliq chapda, maydon o'ngda — 1C dagidek */
export function DocField({
  label, children, width = 110, hint, required,
}: {
  label: string
  children: ReactNode
  /** Yorliq ustuni kengligi — bir ustundagi maydonlar bir xil bo'lsin */
  width?: number
  hint?: ReactNode
  required?: boolean
}) {
  return (
    <div className="flex items-start gap-2 py-[3px]">
      <label
        className="shrink-0 pt-[6px] text-right text-[13px]"
        style={{ width, color: 'var(--text-2)' }}
      >
        {label}:{required && <span style={{ color: 'var(--danger)' }}> *</span>}
      </label>
      <div className="min-w-0 flex-1">
        {children}
        {hint && <div className="mt-0.5 text-[12px]">{hint}</div>}
      </div>
    </div>
  )
}

const inputStyle: CSSProperties = {
  background: 'var(--surface)',
  borderColor: 'var(--border-2)',
}
const inputCls =
  'h-[30px] w-full rounded border px-2 text-[13px] outline-none ' +
  'transition-colors focus:border-[var(--brand)] disabled:opacity-60'

export function DocInput({
  value, onChange, type = 'text', placeholder, disabled, align, className = '', onKeyDown,
}: {
  value: string
  onChange: (v: string) => void
  type?: 'text' | 'number' | 'date'
  placeholder?: string
  disabled?: boolean
  align?: 'right'
  className?: string
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
}) {
  return (
    <input
      type={type} value={value} placeholder={placeholder} disabled={disabled}
      onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown}
      style={inputStyle}
      className={`${inputCls} ${align === 'right' ? 'text-right tnum' : ''} ${className}`}
    />
  )
}

export function DocSelect<T extends string | number>({
  value, onChange, options, placeholder, disabled,
}: {
  value: T | null | undefined
  onChange: (v: string) => void
  options: { value: T; label: string }[]
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <select
      value={value ?? ''} disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      style={inputStyle} className={inputCls}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={String(o.value)} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

/** 1C dagi ko'k havolalar qatori */
export function DocLink({
  children, onClick, active,
}: { children: ReactNode; onClick?: () => void; active?: boolean }) {
  return (
    <button
      type="button" onClick={onClick}
      style={{ color: 'var(--brand)' }}
      className={`text-[13px] hover:underline ${active ? 'font-semibold underline' : ''}`}
    >
      {children}
    </button>
  )
}

/* ------------------------------------------------- Zakladkalar */

export function DocTabs<T extends string>({
  tabs, value, onChange,
}: {
  tabs: { key: T; label: string; badge?: number }[]
  value: T
  onChange: (k: T) => void
}) {
  return (
    <div
      className="flex items-end gap-0.5 border-b px-3"
      style={{ borderColor: 'var(--border-2)' }}
    >
      {tabs.map((t) => {
        const on = t.key === value
        return (
          <button
            key={t.key} type="button" onClick={() => onChange(t.key)}
            style={{
              background: on ? 'var(--surface)' : 'var(--surface-2)',
              borderColor: 'var(--border-2)',
              borderBottomColor: on ? 'var(--surface)' : 'var(--border-2)',
              color: on ? 'var(--text)' : 'var(--text-2)',
              marginBottom: -1,
            }}
            className={`rounded-t border px-3 py-[6px] text-[13px] ${on ? 'font-semibold' : ''}`}
          >
            {t.label}
            {t.badge != null && t.badge > 0 && (
              <span className="ml-1.5 tnum" style={{ color: 'var(--text-3)' }}>
                ({t.badge})
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------- Jadval kataklari */

/** Katak ichidagi chegarasiz maydon — 1C jadvalidagidek */
export function CellInput({
  value, onChange, type = 'text', align, placeholder, disabled, onKeyDown, autoFocus,
}: {
  value: string
  onChange: (v: string) => void
  type?: 'text' | 'number'
  align?: 'right'
  placeholder?: string
  disabled?: boolean
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  autoFocus?: boolean
}) {
  return (
    <input
      type={type} value={value} placeholder={placeholder} disabled={disabled}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown}
      onFocus={(e) => e.target.select()}
      className={`h-[26px] w-full rounded-sm border border-transparent bg-transparent px-1
        text-[13px] outline-none focus:border-[var(--brand)] focus:bg-[var(--surface)]
        ${align === 'right' ? 'text-right tnum' : ''}`}
    />
  )
}

/* ------------------------------------------------- Pastki qism */

export function DocFooter({ children }: { children: ReactNode }) {
  return (
    <div
      className="mt-auto flex flex-wrap items-start justify-between gap-4 border-t px-3 py-2.5"
      style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
    >
      {children}
    </div>
  )
}

/** O'ngdagi yakuniy summalar bloki */
export function TotalsBox({
  rows,
}: { rows: { label: string; value: string; strong?: boolean; tone?: 'ok' | 'danger' }[] }) {
  return (
    <table className="text-[13px]">
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <td className="py-[2px] pr-5" style={{ color: 'var(--text-2)' }}>{r.label}:</td>
            <td
              className={`tnum py-[2px] text-right ${r.strong ? 'text-[15px] font-semibold' : ''}`}
              style={{
                color: r.tone === 'ok' ? 'var(--ok)'
                  : r.tone === 'danger' ? 'var(--danger)' : undefined,
              }}
            >
              {r.value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
