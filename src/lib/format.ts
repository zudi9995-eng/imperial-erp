const nf0 = new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 0 })
const nf2 = new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 2 })

/** 1 234 567 so'm */
export function money(v: number | null | undefined, withUnit = true): string {
  if (v == null) return '—'
  return nf0.format(Math.round(v)) + (withUnit ? " so'm" : '')
}

/** Katta summani qisqartiradi: 921 060 405 -> 921.1 mln */
export function moneyShort(v: number | null | undefined): string {
  if (v == null) return '—'
  const a = Math.abs(v)
  const sign = v < 0 ? '−' : ''
  if (a >= 1e9) return `${sign}${nf2.format(a / 1e9)} mlrd`
  if (a >= 1e6) return `${sign}${nf2.format(a / 1e6)} mln`
  if (a >= 1e3) return `${sign}${nf0.format(a / 1e3)} ming`
  return `${sign}${nf0.format(a)}`
}

export function num(v: number | null | undefined, decimals = 2): string {
  if (v == null) return '—'
  return new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: decimals }).format(v)
}

export function pct(v: number | null | undefined, decimals = 1): string {
  if (v == null) return '—'
  return `${nf2.format(Number(v.toFixed(decimals)))}%`
}

const MONTHS_UZ = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr',
]
const MONTHS_SHORT = [
  'Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek',
]

export function dateUz(v: string | Date | null | undefined): string {
  if (!v) return '—'
  const d = typeof v === 'string' ? new Date(v) : v
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.getDate()} ${MONTHS_UZ[d.getMonth()]} ${d.getFullYear()}`
}

export function dateShort(v: string | Date | null | undefined): string {
  if (!v) return '—'
  const d = typeof v === 'string' ? new Date(v) : v
  if (Number.isNaN(d.getTime())) return '—'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}.${mm}.${d.getFullYear()}`
}

export function monthLabel(v: string | Date | null | undefined): string {
  if (!v) return '—'
  const d = typeof v === 'string' ? new Date(v) : v
  if (Number.isNaN(d.getTime())) return '—'
  return `${MONTHS_SHORT[d.getMonth()]}'${String(d.getFullYear()).slice(2)}`
}

export function timeUz(v: string | Date | null | undefined): string {
  if (!v) return '—'
  const d = typeof v === 'string' ? new Date(v) : v
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })
}

export function dateTimeUz(v: string | Date | null | undefined): string {
  if (!v) return '—'
  return `${dateShort(v)} ${timeUz(v)}`
}

/** "3 kun oldin", "bugun", "2 kundan keyin" */
export function relativeDays(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const today = new Date()
  d.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000)
  if (diff === 0) return 'bugun'
  if (diff === 1) return 'ertaga'
  if (diff === -1) return 'kecha'
  if (diff < 0) return `${-diff} kun oldin`
  return `${diff} kundan keyin`
}

/** ISO sana (YYYY-MM-DD) — input[type=date] uchun */
export function isoDate(d: Date = new Date()): string {
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10)
}

export function monthStart(d: Date = new Date()): string {
  return isoDate(new Date(d.getFullYear(), d.getMonth(), 1))
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}
