import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Check, X, Pencil } from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  Badge, Button, Empty, ErrorBox, Input, Loading, Select, Table, Td, Th, Toggle, Tr,
} from './ui'
import { money, num, pct } from '../lib/format'

export type ColType =
  | 'text' | 'number' | 'percent' | 'money' | 'bool' | 'select' | 'color' | 'date'

export interface Col {
  key: string
  label: string
  type: ColType
  options?: { value: string | number; label: string }[]
  width?: number | string
  required?: boolean
  hint?: string
  /** Qatorni tahrirlashda ko'rsatilmaydi, faqat o'qish */
  readOnly?: boolean
  align?: 'left' | 'right' | 'center'
}

type Row = Record<string, unknown> & { id?: number | string }

/**
 * Spravochniklar uchun universal tahrirlagich.
 * Qator ichida tahrirlash, qo'shish, o'chirish — hammasi shu yerda.
 */
export default function RefTable({
  table, cols, orderBy = 'sort_order', defaults = {}, canWrite = true,
  emptyTitle = 'Hali yozuv yo\'q', emptyHint, onChanged, minWidth,
}: {
  table: string
  cols: Col[]
  orderBy?: string
  defaults?: Row
  canWrite?: boolean
  emptyTitle?: string
  emptyHint?: string
  onChanged?: () => void
  minWidth?: number
}) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [editId, setEditId] = useState<number | string | null>(null)
  const [draft, setDraft] = useState<Row>({})
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from(table).select('*').order(orderBy, { nullsFirst: false })
    if (error) setErr(error.message)
    else { setErr(''); setRows((data as Row[]) ?? []) }
    setLoading(false)
  }, [table, orderBy])

  useEffect(() => { void load() }, [load])

  const nextSort = useMemo(() => {
    const vals = rows.map((r) => Number(r.sort_order ?? 0)).filter(Number.isFinite)
    return (vals.length ? Math.max(...vals) : 0) + 10
  }, [rows])

  function startAdd() {
    setErr('')
    setDraft({ ...defaults, sort_order: nextSort })
    setAdding(true)
    setEditId(null)
  }

  function startEdit(r: Row) {
    setErr('')
    setAdding(false)
    setEditId(r.id ?? null)
    setDraft({ ...r })
  }

  function cancel() { setAdding(false); setEditId(null); setDraft({}); setErr('') }

  function clean(d: Row): Row {
    const out: Row = {}
    for (const c of cols) {
      if (c.readOnly) continue
      let v = d[c.key]
      if (v === '' || v === undefined) v = null
      if (v !== null && (c.type === 'number' || c.type === 'percent' || c.type === 'money')) {
        const n = Number(v)
        v = Number.isFinite(n) ? n : null
      }
      out[c.key] = v
    }
    if ('sort_order' in d && !cols.some((c) => c.key === 'sort_order')) {
      out.sort_order = Number(d.sort_order ?? 0)
    }
    return out
  }

  async function save() {
    const missing = cols.filter((c) => c.required && !c.readOnly)
      .filter((c) => {
        const v = draft[c.key]
        return v === null || v === undefined || v === ''
      })
    if (missing.length) {
      setErr(`To'ldirilishi shart: ${missing.map((m) => m.label).join(', ')}`)
      return
    }

    setBusy(true); setErr('')
    const payload = clean(draft)
    const res = adding
      ? await supabase.from(table).insert(payload as never)
      : await supabase.from(table).update(payload as never).eq('id', editId as never)
    setBusy(false)

    if (res.error) { setErr(translate(res.error.message)); return }
    cancel()
    await load()
    onChanged?.()
  }

  async function remove(r: Row) {
    const label = String(r.name ?? r.code ?? r.id)
    if (!confirm(`"${label}" o'chirilsinmi?\n\nAgar unga bog'langan hujjat bo'lsa, o'chirilmaydi — "faol emas" qilib qo'ying.`)) return
    setBusy(true)
    const { error } = await supabase.from(table).delete().eq('id', r.id as never)
    setBusy(false)
    if (error) { setErr(translate(error.message)); return }
    await load()
    onChanged?.()
  }

  if (loading) return <Loading />

  const editing = adding || editId !== null

  return (
    <div>
      {err && <div className="mb-3"><ErrorBox>{err}</ErrorBox></div>}

      {rows.length === 0 && !adding ? (
        <Empty
          title={emptyTitle}
          hint={emptyHint}
          action={canWrite ? <Button variant="primary" size="sm" onClick={startAdd}><Plus size={14} />Qo'shish</Button> : undefined}
        />
      ) : (
        <Table minWidth={minWidth}>
          <thead>
            <tr>
              {cols.map((c) => (
                <Th key={c.key} w={c.width} align={c.align ?? alignFor(c.type)}>{c.label}</Th>
              ))}
              {canWrite && <Th w={92} align="right">Amal</Th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isEdit = editId === r.id
              return (
                <Tr key={String(r.id)}>
                  {cols.map((c) => (
                    <Td key={c.key} align={c.align ?? alignFor(c.type)} mono={isNum(c.type)}>
                      {isEdit && !c.readOnly
                        ? <CellEditor col={c} value={draft[c.key]} onChange={(v) => setDraft((d) => ({ ...d, [c.key]: v }))} />
                        : <CellView col={c} value={r[c.key]} />}
                    </Td>
                  ))}
                  {canWrite && (
                    <Td align="right">
                      {isEdit ? (
                        <span className="flex justify-end gap-1">
                          <Button size="sm" variant="primary" loading={busy} onClick={save} title="Saqlash"><Check size={14} /></Button>
                          <Button size="sm" variant="ghost" onClick={cancel} title="Bekor"><X size={14} /></Button>
                        </span>
                      ) : (
                        <span className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" disabled={editing} onClick={() => startEdit(r)} title="Tahrirlash"><Pencil size={14} /></Button>
                          <Button size="sm" variant="ghost" disabled={editing} onClick={() => void remove(r)} title="O'chirish"><Trash2 size={14} /></Button>
                        </span>
                      )}
                    </Td>
                  )}
                </Tr>
              )
            })}

            {adding && (
              <Tr className="bg-[var(--surface-2)]">
                {cols.map((c) => (
                  <Td key={c.key} align={c.align ?? alignFor(c.type)}>
                    {c.readOnly
                      ? <span style={{ color: 'var(--text-3)' }}>—</span>
                      : <CellEditor col={c} value={draft[c.key]} onChange={(v) => setDraft((d) => ({ ...d, [c.key]: v }))} />}
                  </Td>
                ))}
                <Td align="right">
                  <span className="flex justify-end gap-1">
                    <Button size="sm" variant="primary" loading={busy} onClick={save}><Check size={14} /></Button>
                    <Button size="sm" variant="ghost" onClick={cancel}><X size={14} /></Button>
                  </span>
                </Td>
              </Tr>
            )}
          </tbody>
        </Table>
      )}

      {canWrite && rows.length > 0 && !editing && (
        <div className="mt-3">
          <Button size="sm" onClick={startAdd}><Plus size={14} />Qator qo'shish</Button>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */

function alignFor(t: ColType): 'left' | 'right' | 'center' {
  if (t === 'number' || t === 'percent' || t === 'money') return 'right'
  if (t === 'bool') return 'center'
  return 'left'
}
function isNum(t: ColType) { return t === 'number' || t === 'percent' || t === 'money' }

function CellView({ col, value }: { col: Col; value: unknown }) {
  if (value === null || value === undefined || value === '') {
    return <span style={{ color: 'var(--text-3)' }}>—</span>
  }
  switch (col.type) {
    case 'bool':
      return value
        ? <Badge tone="ok">ha</Badge>
        : <span style={{ color: 'var(--text-3)' }}>—</span>
    case 'money':   return <>{money(Number(value), false)}</>
    case 'percent': return <>{pct(Number(value))}</>
    case 'number':  return <>{num(Number(value), 2)}</>
    case 'color':
      return (
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3.5 w-3.5 rounded" style={{ background: String(value) }} />
          <span className="text-[12px]" style={{ color: 'var(--text-3)' }}>{String(value)}</span>
        </span>
      )
    case 'select': {
      const o = col.options?.find((x) => String(x.value) === String(value))
      return <>{o?.label ?? String(value)}</>
    }
    default:
      return <>{String(value)}</>
  }
}

function CellEditor({
  col, value, onChange,
}: { col: Col; value: unknown; onChange: (v: unknown) => void }) {
  switch (col.type) {
    case 'bool':
      return <Toggle checked={Boolean(value)} onChange={onChange} />
    case 'select':
      return (
        <Select
          value={(value as string) ?? ''}
          onChange={onChange}
          options={col.options ?? []}
          placeholder="—"
        />
      )
    case 'color':
      return (
        <input
          type="color"
          value={(value as string) || '#888888'}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-14 cursor-pointer rounded border"
          style={{ borderColor: 'var(--border-2)', background: 'var(--surface)' }}
        />
      )
    case 'number': case 'percent': case 'money':
      return (
        <Input
          type="number"
          value={(value as number) ?? ''}
          onChange={onChange}
          step={col.type === 'percent' ? '0.1' : '1'}
          className="text-right"
        />
      )
    case 'date':
      return <Input type="date" value={(value as string) ?? ''} onChange={onChange} />
    default:
      return <Input value={(value as string) ?? ''} onChange={onChange} placeholder={col.hint} />
  }
}

function translate(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('duplicate key')) return 'Bu qiymat allaqachon mavjud (takrorlanmasligi kerak)'
  if (m.includes('violates foreign key') && m.includes('still referenced')) {
    return "O'chirib bo'lmaydi: bu yozuvga bog'langan hujjatlar bor. \"Faol\" ni o'chirib qo'ying."
  }
  if (m.includes('violates foreign key')) return "Bog'langan yozuv topilmadi"
  if (m.includes('violates not-null')) return "To'ldirilishi shart bo'lgan maydon bo'sh"
  if (m.includes('row-level security') || m.includes('permission denied')) {
    return "Ruxsat yo'q — bu bo'limni faqat ta'sischi o'zgartiradi"
  }
  if (m.includes('violates check constraint')) return 'Qiymat shartga mos emas'
  return msg
}
