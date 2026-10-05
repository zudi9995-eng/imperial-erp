/**
 * Excel va CSV o'qish.
 *
 * Uchala import ham (tovar, qoldiq, bank vipiskasi) shu yerdan
 * foydalanadi. Fayl xom holda — matn qatorlari ko'rinishida qaytadi,
 * ustunlarni moslashni yuqoridagi qatlam qiladi.
 *
 * Excel kutubxonasi faqat kerak bo'lganda yuklanadi: u ~200 KB,
 * platformaning birinchi ochilishini sekinlashtirmasligi kerak.
 */

export type Row = string[]

/** Faylni o'qib, qatorlar jadvalini qaytaradi */
export async function readSheet(file: File): Promise<Row[]> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.xlsx') || name.endsWith('.xlsm')) return readXlsx(file)
  if (name.endsWith('.xls')) {
    throw new Error(
      "Eski .xls formati o'qilmaydi. Excelda ochib, .xlsx yoki CSV qilib saqlang.",
    )
  }
  return readText(file)
}

async function readXlsx(file: File): Promise<Row[]> {
  const { default: readXlsxFile } = await import('read-excel-file/browser')
  const raw = await readXlsxFile(file)
  return (pickSheet(raw as unknown) ?? []).map((r) => r.map(cellToText))
}

/**
 * Kutubxona ba'zi fayllarda oddiy qatorlar emas, varaqlar ro'yxatini
 * qaytaradi: [{ sheet, data }]. Haqiqiy 1C eksportlarida shunday
 * bo'ldi, shuning uchun ikkala ko'rinishni ham qabul qilamiz.
 * Bir nechta varaq bo'lsa, eng ko'p qatorlisi olinadi.
 */
export function pickSheet(raw: unknown): unknown[][] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null

  // Oddiy ko'rinish: qatorlar massivi
  if (Array.isArray(raw[0])) return raw as unknown[][]

  // Varaqlar ro'yxati
  const sheets = raw as { sheet?: string; data?: unknown[][] }[]
  let best: unknown[][] | null = null
  for (const s of sheets) {
    const d = Array.isArray(s?.data) ? s.data : null
    if (!d) continue
    if (!best || d.length > best.length) best = d
  }
  return best
}

/** Excel sanasining boshlanish nuqtasi */
const EXCEL_EPOCH = Date.UTC(1899, 11, 30)

/**
 * Excel katakchasi har xil turda keladi — hammasini matnga keltiramiz.
 *
 * Nozik joy: 1C dan chiqqan hisobotlarda raqam ustuni ba'zan sana
 * formatida saqlanadi. Kutubxona uni Date qilib beradi va qiymat
 * 1900-yillarga tushadi (49.59 -> 1900-02-17). Haqiqiy hujjat sanasi
 * hech qachon 1990 dan oldin bo'lmaydi, shuning uchun eski sanani
 * asl soniga qaytaramiz — aks holda miqdor butunlay yo'qoladi.
 */
export function cellToText(v: unknown): string {
  if (v == null) return ''
  if (v instanceof Date) {
    if (v.getUTCFullYear() < 1990) {
      const serial = (v.getTime() - EXCEL_EPOCH) / 86400000
      // Kasr qoldig'idagi suzuvchi nuqta xatosini kesamiz
      return String(Math.round(serial * 1e6) / 1e6)
    }
    const p = (n: number) => String(n).padStart(2, '0')
    return `${p(v.getDate())}.${p(v.getMonth() + 1)}.${v.getFullYear()}`
  }
  return String(v).trim()
}

async function readText(file: File): Promise<Row[]> {
  let text = await readAsText(file)
  // Excel CSV ni ko'pincha BOM bilan saqlaydi
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  return parseCsv(text)
}

/**
 * Fayl kodlashi noma'lum. Avval UTF-8 sinab ko'ramiz; kirill matn
 * buzilgan bo'lsa (ko'p � belgisi) windows-1251 ga o'tamiz — bizdagi
 * banklar ko'pincha shu kodlashda beradi.
 */
async function readAsText(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const utf8 = new TextDecoder('utf-8').decode(buf)
  const bad = (utf8.match(/�/g) ?? []).length
  if (bad > 3) {
    try {
      return new TextDecoder('windows-1251').decode(buf)
    } catch { /* brauzer qo'llab-quvvatlamasa utf-8 qoladi */ }
  }
  return utf8
}

/** Ajratgichni o'zi topadi: vergul, nuqta-vergul yoki tabulyatsiya */
export function parseCsv(text: string): Row[] {
  const sample = text.slice(0, 5000)
  const counts: [string, number][] = [
    [';', (sample.match(/;/g) ?? []).length],
    [',', (sample.match(/,/g) ?? []).length],
    ['\t', (sample.match(/\t/g) ?? []).length],
  ]
  counts.sort((a, b) => b[1] - a[1])
  const sep = counts[0][1] > 0 ? counts[0][0] : ';'

  const rows: Row[] = []
  let row: Row = []
  let cell = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]

    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++ }   // ikkilangan qo'shtirnoq
        else quoted = false
      } else cell += ch
      continue
    }

    if (ch === '"') { quoted = true; continue }
    if (ch === sep) { row.push(cell.trim()); cell = ''; continue }
    if (ch === '\r') continue
    if (ch === '\n') {
      row.push(cell.trim()); cell = ''
      if (row.some((c) => c !== '')) rows.push(row)
      row = []
      continue
    }
    cell += ch
  }
  row.push(cell.trim())
  if (row.some((c) => c !== '')) rows.push(row)

  return rows
}

/* ------------------------------------------------------------------ */
/*  Qiymatlarni o'qish                                                  */
/* ------------------------------------------------------------------ */

/**
 * Raqamni o'qiydi. Jadvalda u har xil keladi:
 * "1 234 567,89" · "1,234,567.89" · "1234567.89" · "(500)" — manfiy.
 */
export function toNumber(v: string): number | null {
  if (!v) return null
  let s = v.replace(/\s| /g, '').replace(/[^\d.,()\-+]/g, '')
  if (!s) return null

  let neg = false
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1) }
  if (s.startsWith('-')) { neg = true; s = s.slice(1) }
  if (s.startsWith('+')) s = s.slice(1)

  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')

  if (lastComma >= 0 && lastDot >= 0) {
    // Qaysi biri oxirida tursa — o'sha kasr ajratgichi
    if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.')
    else s = s.replace(/,/g, '')
  } else if (lastComma >= 0) {
    // Oxirgi verguldan keyin 1-2 raqam bo'lsa — kasr, aks holda minglik
    const tail = s.length - lastComma - 1
    s = tail > 0 && tail <= 2 ? s.replace(',', '.') : s.replace(/,/g, '')
  } else if (lastDot >= 0) {
    const tail = s.length - lastDot - 1
    if (!(tail > 0 && tail <= 2)) s = s.replace(/\./g, '')
  }

  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return neg ? -n : n
}

/** Sanani o'qiydi va ISO ko'rinishida (YYYY-MM-DD) qaytaradi */
export function toDate(v: string): string | null {
  if (!v) return null
  const s = v.trim()

  // 02.10.2026 · 02/10/2026 · 02-10-2026
  let m = /^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/.exec(s)
  if (m) {
    const d = +m[1], mo = +m[2]
    let y = +m[3]
    if (y < 100) y += y < 70 ? 2000 : 1900
    return iso(y, mo, d)
  }

  // 2026-10-02
  m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s)
  if (m) return iso(+m[1], +m[2], +m[3])

  // Excel seriya raqami (1900 dan boshlab kunlar)
  const n = Number(s)
  if (Number.isFinite(n) && n > 20000 && n < 60000) {
    const d = new Date(Date.UTC(1899, 11, 30) + n * 86400000)
    return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
  }

  return null
}

function iso(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  const p = (n: number) => String(n).padStart(2, '0')
  return `${y}-${p(m)}-${p(d)}`
}

/**
 * Moslangan qatorlarni bazaga yuborishdan oldin tozalaydi.
 *
 * Jadvaldan raqam "38 500,00" ko'rinishida keladi, sana esa
 * "02.10.2026" — bazadagi ::numeric va ::date ularni qabul qilmaydi.
 * Shuning uchun raqam ustunlari oddiy songa, sana ustunlari ISO ga
 * o'giriladi. O'qib bo'lmagan katakcha bo'sh satr bo'lib qoladi —
 * baza tomonida "bo'sh" deb hisoblanadi.
 */
export function normalizeRows(
  rows: Record<string, string>[],
  opts: { numeric?: string[]; date?: string[] },
): Record<string, string>[] {
  const nums = opts.numeric ?? []
  const dates = opts.date ?? []
  return rows.map((r) => {
    const o: Record<string, string> = { ...r }
    for (const k of nums) {
      const n = toNumber(o[k] ?? '')
      o[k] = n == null ? '' : String(n)
    }
    for (const k of dates) {
      o[k] = toDate(o[k] ?? '') ?? ''
    }
    return o
  })
}

/* ------------------------------------------------------------------ */
/*  Ustunlarni taniish                                                  */
/* ------------------------------------------------------------------ */

export interface SheetField {
  key: string
  label: string
  required?: boolean
  /** Sarlavhada uchrashi mumkin bo'lgan nomlar (uz / ru / en) */
  aliases: string[]
  hint?: string
}

const normHeader = (s: string) =>
  s.toLowerCase()
    .replace(/[‘’'`]/g, '')
    .replace(/[^a-zа-яё0-9]+/gi, ' ')
    .trim()

/**
 * Sarlavha qatoriga qarab ustunlarni o'zi topadi.
 * Natija: maydon kaliti -> ustun raqami (topilmasa -1).
 */
export function guessMapping(headers: Row, fields: SheetField[]): Record<string, number> {
  const norm = headers.map(normHeader)
  const used = new Set<number>()
  const out: Record<string, number> = {}

  for (const f of fields) {
    const want = [f.label, ...f.aliases].map(normHeader).filter(Boolean)
    let found = -1

    // Avval to'liq mos kelgani
    for (let i = 0; i < norm.length && found < 0; i++) {
      if (used.has(i) || !norm[i]) continue
      if (want.includes(norm[i])) found = i
    }
    // Keyin ichida uchragani
    for (let i = 0; i < norm.length && found < 0; i++) {
      if (used.has(i) || !norm[i]) continue
      if (want.some((w) => w.length >= 3 && (norm[i].includes(w) || w.includes(norm[i])))) {
        found = i
      }
    }

    if (found >= 0) used.add(found)
    out[f.key] = found
  }
  return out
}

/**
 * Sarlavha qatori qayerdaligini topadi. Bank vipiskalarida yuqorida
 * bir necha qator sarlavha-matn bo'ladi, jadval pastroqdan boshlanadi.
 */
export function findHeaderRow(rows: Row[], fields: SheetField[]): number {
  let best = 0, bestScore = -1
  const limit = Math.min(rows.length, 25)

  for (let i = 0; i < limit; i++) {
    const m = guessMapping(rows[i], fields)
    const score = Object.values(m).filter((x) => x >= 0).length
    // Teng bo'lsa yuqoridagisi afzal
    if (score > bestScore) { bestScore = score; best = i }
  }
  return bestScore > 0 ? best : 0
}
