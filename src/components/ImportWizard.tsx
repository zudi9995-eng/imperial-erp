import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check, FileSpreadsheet, Upload } from 'lucide-react'
import {
  findHeaderRow, guessMapping, readSheet, type Row, type SheetField,
} from '../lib/sheet'
import { supabase } from '../lib/supabase'
import { Button, ErrorBox, InfoBox, Modal, Select } from './ui'
import { DocTable, DocTd, DocTh, DocTr } from './docList'

/**
 * Excel/CSV dan yuklash sehrgari — tovar, qoldiq va bank vipiskasi
 * uchun umumiy.
 *
 * Uch qadam: fayl → ustunlarni moslash → ko'rib chiqib yuklash.
 *
 * Ustunlarni moslash eslab qolinadi (ip_import_profiles): bir xil
 * fayldan har oy yuklaydigan odam ikkinchi marta moslamaydi.
 */

export interface ImportResult {
  ok: number
  failed: { row: number; reason: string }[]
}

type Step = 'file' | 'map' | 'done'

export default function ImportWizard({
  open, onClose, title, hint, kind, fields, onImport, sampleNote,
}: {
  open: boolean
  onClose: () => void
  title: string
  hint?: string
  /** Moslashni eslab qolish uchun kalit: 'products' | 'stock' | 'bank' */
  kind: string
  fields: SheetField[]
  /** Moslangan qatorlarni bazaga yozadi */
  onImport: (rows: Record<string, string>[]) => Promise<ImportResult>
  sampleNote?: string
}) {
  const [step, setStep] = useState<Step>('file')
  const [rows, setRows] = useState<Row[]>([])
  const [headerRow, setHeaderRow] = useState(0)
  const [map, setMap] = useState<Record<string, number>>({})
  const [fileName, setFileName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [drag, setDrag] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const reset = useCallback(() => {
    setStep('file'); setRows([]); setMap({}); setHeaderRow(0)
    setFileName(''); setErr(''); setResult(null); setBusy(false)
  }, [])

  useEffect(() => { if (open) reset() }, [open, reset])

  async function take(file: File) {
    setErr(''); setBusy(true)
    try {
      const data = await readSheet(file)
      if (data.length < 2) throw new Error("Faylda ma'lumot topilmadi")

      const h = findHeaderRow(data, fields)
      let m = guessMapping(data[h], fields)

      // Oldin shu turdagi fayl yuklangan bo'lsa, o'sha moslashni olamiz
      const saved = await loadProfile(kind, data[h])
      if (saved) m = { ...m, ...saved }

      setRows(data); setHeaderRow(h); setMap(m)
      setFileName(file.name)
      setStep('map')
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Faylni o'qib bo'lmadi")
    } finally { setBusy(false) }
  }

  const body = useMemo(
    () => rows.slice(headerRow + 1).filter((r) => r.some((c) => c !== '')),
    [rows, headerRow],
  )

  const missing = fields.filter((f) => f.required && (map[f.key] ?? -1) < 0)

  /** Moslangan qatorlar */
  const mapped = useMemo(() => body.map((r) => {
    const o: Record<string, string> = {}
    for (const f of fields) {
      const i = map[f.key] ?? -1
      o[f.key] = i >= 0 ? (r[i] ?? '') : ''
    }
    return o
  }), [body, fields, map])

  async function run() {
    setBusy(true); setErr('')
    try {
      await saveProfile(kind, rows[headerRow], map)
      const res = await onImport(mapped)
      setResult(res)
      setStep('done')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Yuklashda xato')
    } finally { setBusy(false) }
  }

  return (
    <Modal
      open={open}
      onClose={() => { if (!busy) onClose() }}
      title={title}
      width={step === 'map' ? 900 : 620}
      footer={
        step === 'file' ? (
          <Button variant="ghost" onClick={onClose}>Yopish</Button>
        ) : step === 'map' ? (
          <>
            <Button variant="ghost" disabled={busy} onClick={() => setStep('file')}>
              Orqaga
            </Button>
            <Button
              variant="primary" loading={busy}
              disabled={missing.length > 0 || mapped.length === 0}
              onClick={() => void run()}
            >
              <Upload size={14} />{mapped.length} qatorni yuklash
            </Button>
          </>
        ) : (
          <Button variant="primary" onClick={onClose}>Yopish</Button>
        )
      }
    >
      {/* ---------------- 1. Fayl ---------------- */}
      {step === 'file' && (
        <div className="space-y-3">
          {hint && <InfoBox>{hint}</InfoBox>}

          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault(); setDrag(false)
              const f = e.dataTransfer.files[0]
              if (f) void take(f)
            }}
            onClick={() => inputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2
              border-dashed px-4 py-10 text-center transition-colors"
            style={{
              borderColor: drag ? 'var(--brand)' : 'var(--border-2)',
              background: drag ? 'var(--brand-soft)' : 'var(--surface-2)',
            }}
          >
            <FileSpreadsheet size={28} style={{ color: 'var(--text-3)' }} />
            <div className="text-[14px] font-medium">
              Faylni shu yerga tashlang yoki bosing
            </div>
            <div className="text-[12.5px]" style={{ color: 'var(--text-3)' }}>
              Excel (.xlsx) yoki CSV
            </div>
            <input
              ref={inputRef} type="file" className="hidden"
              accept=".xlsx,.xlsm,.csv,.txt"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void take(f)
                e.target.value = ''
              }}
            />
          </div>

          <div>
            <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide"
                 style={{ color: 'var(--text-3)' }}>
              Faylda shu ustunlar bo'lsin
            </div>
            <div className="flex flex-wrap gap-1.5">
              {fields.map((f) => (
                <span
                  key={f.key}
                  className="rounded-lg border px-2 py-1 text-[12.5px]"
                  style={{
                    borderColor: f.required ? 'var(--brand)' : 'var(--border-2)',
                    color: f.required ? 'var(--brand)' : 'var(--text-2)',
                  }}
                  title={f.hint}
                >
                  {f.label}{f.required ? ' *' : ''}
                </span>
              ))}
            </div>
            {sampleNote && (
              <p className="mt-2 text-[12.5px]" style={{ color: 'var(--text-3)' }}>
                {sampleNote}
              </p>
            )}
          </div>

          {busy && <InfoBox>Fayl o'qilmoqda…</InfoBox>}
          {err && <ErrorBox>{err}</ErrorBox>}
        </div>
      )}

      {/* ---------------- 2. Ustunlarni moslash ---------------- */}
      {step === 'map' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <FileSpreadsheet size={14} style={{ color: 'var(--text-3)' }} />
            <span className="font-medium">{fileName}</span>
            <span style={{ color: 'var(--text-3)' }}>· {mapped.length} qator</span>
            <span className="ml-auto flex items-center gap-1.5 text-[12.5px]"
                  style={{ color: 'var(--text-3)' }}>
              Sarlavha qatori
              <Select
                value={String(headerRow)}
                onChange={(v) => {
                  const h = Number(v)
                  setHeaderRow(h)
                  setMap(guessMapping(rows[h], fields))
                }}
                options={rows.slice(0, 25).map((r, i) => ({
                  value: String(i),
                  label: `${i + 1}: ${r.filter(Boolean).slice(0, 3).join(' | ').slice(0, 40)}`,
                }))}
              />
            </span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {fields.map((f) => {
              const i = map[f.key] ?? -1
              const bad = f.required && i < 0
              return (
                <div key={f.key} className="flex items-center gap-2">
                  <span
                    className="w-[140px] shrink-0 text-right text-[13px]"
                    style={{ color: bad ? 'var(--danger)' : 'var(--text-2)' }}
                    title={f.hint}
                  >
                    {f.label}{f.required ? ' *' : ''}
                  </span>
                  <span className="min-w-0 flex-1">
                    <Select
                      value={String(i)}
                      onChange={(v) => setMap({ ...map, [f.key]: Number(v) })}
                      options={[
                        { value: '-1', label: '— yo‘q —' },
                        ...rows[headerRow].map((h, idx) => ({
                          value: String(idx),
                          label: h || `${idx + 1}-ustun`,
                        })),
                      ]}
                    />
                  </span>
                </div>
              )
            })}
          </div>

          {missing.length > 0 && (
            <ErrorBox>
              Quyidagi ustunlar ko'rsatilmagan: {missing.map((f) => f.label).join(', ')}
            </ErrorBox>
          )}

          <div>
            <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide"
                 style={{ color: 'var(--text-3)' }}>
              Dastlabki 5 qator
            </div>
            <DocTable minWidth={520}>
              <thead>
                <tr>{fields.map((f) => <DocTh key={f.key}>{f.label}</DocTh>)}</tr>
              </thead>
              <tbody>
                {mapped.slice(0, 5).map((r, i) => (
                  <DocTr key={i} alt={i % 2 === 1}>
                    {fields.map((f) => (
                      <DocTd key={f.key} tone={r[f.key] ? 'normal' : 'muted'}>
                        {r[f.key] || '—'}
                      </DocTd>
                    ))}
                  </DocTr>
                ))}
              </tbody>
            </DocTable>
          </div>

          {err && <ErrorBox>{err}</ErrorBox>}
        </div>
      )}

      {/* ---------------- 3. Natija ---------------- */}
      {step === 'done' && result && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[15px] font-semibold">
            <Check size={18} style={{ color: 'var(--ok)' }} />
            {result.ok} qator yuklandi
          </div>

          {result.failed.length > 0 && (
            <>
              <div className="flex items-center gap-2 text-[13px]"
                   style={{ color: 'var(--warn)' }}>
                <AlertTriangle size={15} />
                {result.failed.length} qator o'tmadi
              </div>
              <div className="max-h-[260px] overflow-auto rounded-lg border"
                   style={{ borderColor: 'var(--border)' }}>
                <DocTable minWidth={400}>
                  <thead>
                    <tr><DocTh w={80}>Qator</DocTh><DocTh>Sabab</DocTh></tr>
                  </thead>
                  <tbody>
                    {result.failed.slice(0, 100).map((f, i) => (
                      <DocTr key={i} alt={i % 2 === 1} tone="attention">
                        <DocTd>{f.row}</DocTd>
                        <DocTd>{f.reason}</DocTd>
                      </DocTr>
                    ))}
                  </tbody>
                </DocTable>
              </div>
            </>
          )}

          {result.failed.length === 0 && (
            <InfoBox tone="ok">Hamma qator muammosiz yuklandi.</InfoBox>
          )}
        </div>
      )}
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/*  Moslashni eslab qolish                                             */
/* ------------------------------------------------------------------ */

/** Sarlavha qatorini kalitga aylantiramiz — fayl o'zgarsa moslash ham o'zgaradi */
const headerKey = (h: Row) =>
  h.map((x) => x.toLowerCase().trim()).filter(Boolean).join('|').slice(0, 300)

async function loadProfile(kind: string, header: Row): Promise<Record<string, number> | null> {
  const { data } = await supabase
    .from('ip_import_profiles')
    .select('mapping')
    .eq('kind', kind)
    .eq('header_key', headerKey(header))
    .maybeSingle()
  return (data as { mapping: Record<string, number> } | null)?.mapping ?? null
}

async function saveProfile(kind: string, header: Row, mapping: Record<string, number>) {
  const { error } = await supabase.from('ip_import_profiles').upsert({
    kind, header_key: headerKey(header), mapping,
  } as never, { onConflict: 'company_id,kind,header_key' })
  if (error) console.warn('Moslashni saqlab bo\'lmadi:', error.message)
}

/** Yuklash tugmasi — ro'yxat sahifalarida ishlatiladi */
export function ImportButton({
  label = 'Exceldan yuklash', onClick,
}: { label?: string; onClick: () => void }) {
  return (
    <Button size="sm" onClick={onClick}>
      <Upload size={14} />{label}
    </Button>
  )
}

