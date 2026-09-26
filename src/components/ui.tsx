import type { CSSProperties, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

/* ---------------------------------------------------------- Card */
export function Card({
  children, className = '', style, pad = true,
}: { children: ReactNode; className?: string; style?: CSSProperties; pad?: boolean }) {
  return (
    <div
      className={`rounded-[10px] border ${pad ? 'p-4' : ''} ${className}`}
      style={{ background: 'var(--surface)', boxShadow: 'var(--shadow-sm)', ...style }}
    >
      {children}
    </div>
  )
}

export function CardTitle({
  children, right, sub,
}: { children: ReactNode; right?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <h3 className="text-[15px] font-semibold leading-tight">{children}</h3>
        {sub && <p className="mt-0.5 text-xs" style={{ color: 'var(--text-3)' }}>{sub}</p>}
      </div>
      {right}
    </div>
  )
}

/* ---------------------------------------------------------- Button */
type BtnVariant = 'primary' | 'ghost' | 'outline' | 'danger' | 'subtle'
type BtnSize = 'sm' | 'md'

export function Button({
  children, onClick, variant = 'outline', size = 'md', disabled, loading,
  type = 'button', className = '', title, full,
}: {
  children?: ReactNode
  onClick?: () => void
  variant?: BtnVariant
  size?: BtnSize
  disabled?: boolean
  loading?: boolean
  type?: 'button' | 'submit'
  className?: string
  title?: string
  full?: boolean
}) {
  const styles: Record<BtnVariant, CSSProperties> = {
    primary: { background: 'var(--brand)', color: 'var(--brand-fg)', borderColor: 'var(--brand)' },
    outline: { background: 'var(--surface)', color: 'var(--text)', borderColor: 'var(--border-2)' },
    ghost:   { background: 'transparent', color: 'var(--text-2)', borderColor: 'transparent' },
    subtle:  { background: 'var(--surface-2)', color: 'var(--text)', borderColor: 'transparent' },
    danger:  { background: 'var(--danger)', color: '#fff', borderColor: 'var(--danger)' },
  }
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled || loading}
      style={styles[variant]}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium
        transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-45
        ${size === 'sm' ? 'h-8 px-2.5 text-[13px]' : 'h-9 px-3.5 text-sm'}
        ${full ? 'w-full' : ''} ${className}`}
    >
      {loading && <Loader2 size={14} style={{ animation: 'ip-spin .8s linear infinite' }} />}
      {children}
    </button>
  )
}

/* ---------------------------------------------------------- Inputs */
const fieldCls =
  'w-full rounded-lg border px-2.5 py-2 text-sm outline-none transition-colors ' +
  'focus:border-[var(--brand)] disabled:opacity-60'
const fieldStyle: CSSProperties = { background: 'var(--surface)', borderColor: 'var(--border-2)' }

export function Field({
  label, hint, children, required, error,
}: { label?: ReactNode; hint?: ReactNode; children: ReactNode; required?: boolean; error?: string }) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1 block text-[13px] font-medium">
          {label}
          {required && <span style={{ color: 'var(--danger)' }}> *</span>}
        </span>
      )}
      {children}
      {error
        ? <span className="mt-1 block text-xs" style={{ color: 'var(--danger)' }}>{error}</span>
        : hint
          ? <span className="mt-1 block text-xs" style={{ color: 'var(--text-3)' }}>{hint}</span>
          : null}
    </label>
  )
}

export function Input({
  value, onChange, type = 'text', placeholder, disabled, min, max, step, className = '',
  onEnter, autoFocus, dir,
}: {
  value: string | number
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  disabled?: boolean
  min?: number | string
  max?: number | string
  step?: number | string
  className?: string
  onEnter?: () => void
  autoFocus?: boolean
  dir?: 'ltr' | 'rtl'
}) {
  return (
    <input
      type={type}
      dir={dir}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      min={min}
      max={max}
      step={step}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter' && onEnter) { e.preventDefault(); onEnter() } }}
      style={fieldStyle}
      className={`${fieldCls} ${type === 'number' ? 'tnum' : ''} ${className}`}
    />
  )
}

export function Textarea({
  value, onChange, rows = 3, placeholder, disabled,
}: {
  value: string; onChange: (v: string) => void
  rows?: number; placeholder?: string; disabled?: boolean
}) {
  return (
    <textarea
      rows={rows}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      style={fieldStyle}
      className={`${fieldCls} resize-y`}
    />
  )
}

export function Select<T extends string | number>({
  value, onChange, options, placeholder, disabled, className = '',
}: {
  value: T | null | undefined
  onChange: (v: string) => void
  options: { value: T; label: string }[]
  placeholder?: string
  disabled?: boolean
  className?: string
}) {
  return (
    <select
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      style={fieldStyle}
      className={`${fieldCls} ${className}`}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={String(o.value)} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

export function Toggle({
  checked, onChange, label, disabled,
}: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 disabled:opacity-50"
    >
      <span
        className="relative inline-block h-5 w-9 shrink-0 rounded-full transition-colors"
        style={{ background: checked ? 'var(--brand)' : 'var(--border-2)' }}
      >
        <span
          className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all"
          style={{ left: checked ? 18 : 2, boxShadow: '0 1px 2px rgba(0,0,0,.3)' }}
        />
      </span>
      {label && <span className="text-[13px]">{label}</span>}
    </button>
  )
}

/* ---------------------------------------------------------- Badge */
export type Tone = 'neutral' | 'brand' | 'ok' | 'warn' | 'danger' | 'info'

const toneStyle: Record<Tone, CSSProperties> = {
  neutral: { background: 'var(--surface-2)',  color: 'var(--text-2)' },
  brand:   { background: 'var(--brand-soft)', color: 'var(--brand)' },
  ok:      { background: 'var(--ok-soft)',    color: 'var(--ok)' },
  warn:    { background: 'var(--warn-soft)',  color: 'var(--warn)' },
  danger:  { background: 'var(--danger-soft)', color: 'var(--danger)' },
  info:    { background: 'var(--info-soft)',  color: 'var(--info)' },
}

export function Badge({
  children, tone = 'neutral', className = '',
}: { children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <span
      style={toneStyle[tone]}
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px]
        font-semibold whitespace-nowrap ${className}`}
    >
      {children}
    </span>
  )
}

/* ---------------------------------------------------------- Table */
export function Table({ children, minWidth }: { children: ReactNode; minWidth?: number }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full border-collapse text-sm" style={{ minWidth }}>{children}</table>
    </div>
  )
}

export function Th({
  children, align = 'left', w, className = '',
}: { children?: ReactNode; align?: 'left' | 'right' | 'center'; w?: number | string; className?: string }) {
  return (
    <th
      style={{ color: 'var(--text-3)', width: w, borderColor: 'var(--border)' }}
      className={`border-b px-2 py-2 text-${align} text-[12px] font-semibold
        uppercase tracking-wide whitespace-nowrap ${className}`}
    >
      {children}
    </th>
  )
}

export function Td({
  children, align = 'left', className = '', mono, colSpan, title,
}: {
  children?: ReactNode; align?: 'left' | 'right' | 'center'
  className?: string; mono?: boolean; colSpan?: number; title?: string
}) {
  return (
    <td
      colSpan={colSpan}
      title={title}
      style={{ borderColor: 'var(--border)' }}
      className={`border-b px-2 py-2 text-${align} ${mono ? 'tnum' : ''} ${className}`}
    >
      {children}
    </td>
  )
}

export function Tr({
  children, onClick, className = '',
}: { children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <tr
      onClick={onClick}
      className={`${onClick ? 'cursor-pointer' : ''} transition-colors hover:bg-[var(--surface-2)] ${className}`}
    >
      {children}
    </tr>
  )
}

/* ---------------------------------------------------------- Feedback */
export function Spinner({ size = 18 }: { size?: number }) {
  return <Loader2 size={size} style={{ animation: 'ip-spin .8s linear infinite', color: 'var(--text-3)' }} />
}

export function Loading({ label = 'Yuklanmoqda…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12" style={{ color: 'var(--text-3)' }}>
      <Spinner />
      <span className="text-sm">{label}</span>
    </div>
  )
}

export function Empty({
  title, hint, action, icon,
}: { title: string; hint?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
      {icon && <div style={{ color: 'var(--text-3)' }}>{icon}</div>}
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="max-w-md text-[13px]" style={{ color: 'var(--text-3)' }}>{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function ErrorBox({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <div
      className="rounded-lg border px-3 py-2 text-[13px]"
      style={{ background: 'var(--danger-soft)', color: 'var(--danger)', borderColor: 'transparent' }}
    >
      {children}
    </div>
  )
}

export function InfoBox({ children, tone = 'info' }: { children: ReactNode; tone?: Tone }) {
  return (
    <div
      className="rounded-lg px-3 py-2 text-[13px]"
      style={{ ...toneStyle[tone], borderColor: 'transparent' }}
    >
      {children}
    </div>
  )
}

/* ---------------------------------------------------------- Modal */
export function Modal({
  open, onClose, title, children, footer, width = 560,
}: {
  open: boolean; onClose: () => void; title: ReactNode
  children: ReactNode; footer?: ReactNode; width?: number
}) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center"
      style={{ background: 'rgba(8,10,14,.55)' }}
      onClick={onClose}
    >
      <div
        className="ip-fade my-auto w-full rounded-xl border"
        style={{ maxWidth: width, background: 'var(--surface)', boxShadow: 'var(--shadow-lg)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-[15px] font-semibold">{title}</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
        </div>
        <div className="px-4 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t px-4 py-3">{footer}</div>}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------- Stat */
export function Stat({
  label, value, sub, tone = 'neutral', icon, onClick,
}: {
  label: string; value: ReactNode; sub?: ReactNode
  tone?: Tone; icon?: ReactNode; onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={`rounded-[10px] border p-3.5 ${onClick ? 'cursor-pointer hover:opacity-90' : ''}`}
      style={{ background: 'var(--surface)', boxShadow: 'var(--shadow-sm)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[12px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>
          {label}
        </span>
        {icon && <span style={{ color: toneStyle[tone].color }}>{icon}</span>}
      </div>
      <div className="tnum mt-1.5 text-[22px] font-semibold leading-none" style={{ color: tone === 'neutral' ? 'var(--text)' : toneStyle[tone].color }}>
        {value}
      </div>
      {sub && <div className="mt-1.5 text-[12.5px]" style={{ color: 'var(--text-3)' }}>{sub}</div>}
    </div>
  )
}

/* ---------------------------------------------------------- Page header */
export function PageHeader({
  title, sub, actions,
}: { title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[20px] font-semibold leading-tight">{title}</h1>
        {sub && <p className="mt-0.5 text-[13px]" style={{ color: 'var(--text-3)' }}>{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/* ---------------------------------------------------------- Progress */
export function Progress({
  value, max = 100, tone = 'brand', height = 6,
}: { value: number; max?: number; tone?: Tone; height?: number }) {
  const p = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <div className="w-full overflow-hidden rounded-full" style={{ background: 'var(--surface-2)', height }}>
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${p}%`, background: toneStyle[tone].color }}
      />
    </div>
  )
}
