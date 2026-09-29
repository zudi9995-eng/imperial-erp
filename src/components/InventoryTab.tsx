import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Check, ClipboardList, Plus, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useProducts, useRefs, translateDbError } from '../lib/useRefs'
import {
  Button, Card, Empty, ErrorBox, Field, InfoBox, Loading, Modal, Select, Stat, Textarea,
} from './ui'
import { CellInput } from './docForm'
import { DocTable, DocTd, DocTh, DocTr } from './docList'
import { dateShort, isoDate, money, num } from '../lib/format'

/**
 * Inventarizatsiya — haqiqiy qoldiqni sanab, tizimdagisi bilan
 * solishtirish. Farq omborga yoziladi: ortiqcha yangi partiya bo'lib
 * kiradi, kamomad FIFO bo'yicha yechiladi.
 */

interface CountRow {
  id: number
  doc_date: string
  status: 'draft' | 'posted' | 'cancelled'
  note: string | null
  warehouse_id: number
  warehouse_name: string | null
  created_by_name: string | null
  line_count: number
  counted_count: number
  diff_count: number
}

interface ItemRow {
  id: number
  product_id: number
  qty_system: number
  qty_actual: number | null
  note: string | null
}

export default function InventoryTab() {
  const { can } = useAuth()
  const refs = useRefs()
  const [rows, setRows] = useState<CountRow[]>([])
  const [openId, setOpenId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('ip_inventory_board')
      .select('*').order('doc_date', { ascending: false }).order('id', { ascending: false })
      .limit(200)
    if (error) setErr(translateDbError(error.message))
    else setErr('')
    setRows((data as CountRow[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  if (openId) {
    return (
      <CountSheet
        id={openId}
        onBack={() => { setOpenId(null); void load() }}
      />
    )
  }

  if (loading || refs.loading) return <Loading />

  return (
    <div className="space-y-4">
      {err && <ErrorBox>{err}</ErrorBox>}

      <InfoBox>
        Inventarizatsiya ochilganda tizimdagi qoldiq <b>suratga olinadi</b>.
        Sanoqchi faqat haqiqiy miqdorni yozadi; farq o'tkazilganda omborga
        tushadi va tan narx haqiqatga keladi.
      </InfoBox>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px]" style={{ color: 'var(--text-3)' }}>
          {rows.length} ta hujjat
        </span>
        {can('stock.count') && (
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={14} />Inventarizatsiya ochish
          </Button>
        )}
      </div>

      <Card pad={false}>
        <div className="p-4">
          {rows.length === 0 ? (
            <Empty
              title="Inventarizatsiya o'tkazilmagan"
              hint="Haqiqiy qoldiqni sanab, tizimdagisi bilan solishtirish uchun hujjat oching."
              action={can('stock.count')
                ? <Button variant="primary" onClick={() => setCreating(true)}>
                    <Plus size={14} />Ochish
                  </Button>
                : undefined}
            />
          ) : (
            <DocTable minWidth={860}>
              <thead>
                <tr>
                  <DocTh w={95}>Sana</DocTh>
                  <DocTh w={70}>Raqam</DocTh>
                  <DocTh>Ombor</DocTh>
                  <DocTh w={110} align="right">Qatorlar</DocTh>
                  <DocTh w={110} align="right">Sanalgan</DocTh>
                  <DocTh w={100} align="right">Farq</DocTh>
                  <DocTh w={130}>Kim ochdi</DocTh>
                  <DocTh w={110}>Holat</DocTh>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <DocTr
                    key={r.id} alt={i % 2 === 1}
                    tone={r.status === 'draft' ? 'attention'
                      : r.status === 'cancelled' ? 'muted' : 'normal'}
                    onClick={() => setOpenId(r.id)}
                  >
                    <DocTd mono>{dateShort(r.doc_date)}</DocTd>
                    <DocTd mono tone="link">#{r.id}</DocTd>
                    <DocTd>{r.warehouse_name ?? '—'}</DocTd>
                    <DocTd align="right" mono>{r.line_count}</DocTd>
                    <DocTd align="right" mono>
                      {r.counted_count} / {r.line_count}
                    </DocTd>
                    <DocTd align="right" mono
                           tone={r.diff_count > 0 ? 'danger' : 'muted'}>
                      {r.diff_count > 0 ? r.diff_count : '—'}
                    </DocTd>
                    <DocTd tone="link">{r.created_by_name ?? '—'}</DocTd>
                    <DocTd>
                      {r.status === 'draft' ? 'Sanalmoqda'
                        : r.status === 'posted' ? "O'tkazilgan" : 'Bekor qilingan'}
                    </DocTd>
                  </DocTr>
                ))}
              </tbody>
            </DocTable>
          )}
        </div>
      </Card>

      {creating && (
        <CreateModal
          warehouses={refs.warehouses}
          onClose={() => setCreating(false)}
          onDone={(id) => { setCreating(false); void load(); setOpenId(id) }}
        />
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- */

function CreateModal({
  warehouses, onClose, onDone,
}: {
  warehouses: { id: number; name: string }[]
  onClose: () => void
  onDone: (id: number) => void
}) {
  const [wh, setWh] = useState<number | null>(warehouses[0]?.id ?? null)
  const [date, setDate] = useState(isoDate())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function create() {
    if (!wh) { setErr('Ombor tanlanmagan'); return }
    setBusy(true); setErr('')
    const { data, error } = await supabase.rpc('ip_create_inventory', {
      p_warehouse: wh, p_date: date,
    })
    setBusy(false)
    if (error) { setErr(translateDbError(error.message)); return }
    onDone((data as { id: number }).id)
  }

  return (
    <Modal
      open onClose={onClose} width={460} title="Inventarizatsiya ochish"
      footer={<>
        <Button onClick={onClose}>Bekor</Button>
        <Button variant="primary" loading={busy} onClick={create}>Ochish</Button>
      </>}
    >
      <div className="space-y-3">
        <InfoBox>
          Shu ombordagi hamma tovarning joriy qoldig'i suratga olinadi.
          Keyin har biri bo'yicha haqiqiy miqdorni yozasiz.
        </InfoBox>
        <Field label="Ombor" required>
          <Select
            value={wh ?? ''} onChange={(v) => setWh(v ? Number(v) : null)}
            options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
          />
        </Field>
        <Field label="Sana">
          <input
            type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border px-2.5 py-2 text-sm outline-none focus:border-[var(--brand)]"
            style={{ background: 'var(--surface)', borderColor: 'var(--border-2)' }}
          />
        </Field>
        {err && <ErrorBox>{err}</ErrorBox>}
      </div>
    </Modal>
  )
}

/* ---------------------------------------------------------------- */

/** Sanoq varaqasi — 1C dagi «Инвентаризация товаров» tabli qismi */
function CountSheet({ id, onBack }: { id: number; onBack: () => void }) {
  const { can } = useAuth()
  const refs = useRefs()
  const { products } = useProducts()
  const [head, setHead] = useState<CountRow | null>(null)
  const [items, setItems] = useState<ItemRow[]>([])
  const [actual, setActual] = useState<Record<number, string>>({})
  const [note, setNote] = useState('')
  const [q, setQ] = useState('')
  const [onlyDiff, setOnlyDiff] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [confirmPost, setConfirmPost] = useState(false)

  const load = useCallback(async () => {
    const [h, it] = await Promise.all([
      supabase.from('ip_inventory_board').select('*').eq('id', id).maybeSingle(),
      supabase.from('ip_inventory_items').select('*').eq('count_id', id).order('id'),
    ])
    const hh = h.data as CountRow | null
    setHead(hh)
    setNote(hh?.note ?? '')
    const rows = (it.data as ItemRow[]) ?? []
    setItems(rows)
    const m: Record<number, string> = {}
    for (const r of rows) if (r.qty_actual != null) m[r.id] = String(r.qty_actual)
    setActual(m)
    setLoading(false)
  }, [id])

  useEffect(() => { void load() }, [load])

  const posted = head?.status === 'posted'
  const nameOf = useCallback((pid: number) => {
    const p = products.find((x) => x.id === pid)
    return p ? (p.code ? `${p.code} — ${p.name}` : p.name) : `#${pid}`
  }, [products])
  const unitOf = useCallback((pid: number) => {
    const p = products.find((x) => x.id === pid)
    return refs.units.find((u) => u.id === p?.unit_id)?.code ?? ''
  }, [products, refs.units])

  const view = useMemo(() => {
    const s = q.trim().toLowerCase()
    return items.filter((i) => {
      if (s && !nameOf(i.product_id).toLowerCase().includes(s)) return false
      if (onlyDiff) {
        const v = actual[i.id]
        if (v == null || v === '') return false
        if (Number(v) === Number(i.qty_system)) return false
      }
      return true
    })
  }, [items, q, onlyDiff, actual, nameOf])

  const counted = items.filter((i) => actual[i.id] != null && actual[i.id] !== '').length
  const diffs = items.filter((i) => {
    const v = actual[i.id]
    return v != null && v !== '' && Number(v) !== Number(i.qty_system)
  })

  async function saveCounts() {
    setBusy(true); setErr('')
    try {
      const changed = items.filter((i) => {
        const v = actual[i.id]
        const cur = i.qty_actual == null ? '' : String(i.qty_actual)
        return (v ?? '') !== cur
      })
      for (const i of changed) {
        const v = actual[i.id]
        const { error } = await supabase.from('ip_inventory_items')
          .update({ qty_actual: v === '' || v == null ? null : Number(v) } as never)
          .eq('id', i.id)
        if (error) throw new Error(error.message)
      }
      if ((head?.note ?? '') !== note) {
        await supabase.from('ip_inventory_counts')
          .update({ note: note.trim() || null } as never).eq('id', id)
      }
      setOk('Saqlandi')
      await load()
    } catch (e) {
      setErr(translateDbError(e instanceof Error ? e.message : 'Xato'))
    } finally { setBusy(false) }
  }

  async function post() {
    setBusy(true); setErr('')
    try {
      await saveCounts()
      const { data, error } = await supabase.rpc('ip_post_inventory', { p_count_id: id })
      if (error) throw new Error(error.message)
      const r = data as { rows: number; surplus_base: number; shortage_base: number }
      setConfirmPost(false)
      setOk(`O'tkazildi: ${r.rows} ta qatorda farq. `
        + `Ortiqcha ${money(r.surplus_base, false)}, kamomad ${money(r.shortage_base, false)}.`)
      await load()
    } catch (e) {
      setErr(translateDbError(e instanceof Error ? e.message : 'Xato'))
      setConfirmPost(false)
    } finally { setBusy(false) }
  }

  if (loading) return <Loading />
  if (!head) return <Empty title="Hujjat topilmadi" action={<Button onClick={onBack}>Orqaga</Button>} />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button variant="ghost" onClick={onBack}><ArrowLeft size={16} /></Button>
          <div>
            <h2 className="text-[18px] font-semibold leading-tight">
              Inventarizatsiya #{head.id}
            </h2>
            <div className="mt-1 flex flex-wrap gap-2 text-[12.5px]"
                 style={{ color: 'var(--text-3)' }}>
              <span>{head.warehouse_name}</span>
              <span>{dateShort(head.doc_date)}</span>
              <span style={{ color: posted ? 'var(--ok)' : 'var(--warn)' }}>
                {posted ? "o'tkazilgan" : 'sanalmoqda'}
              </span>
            </div>
          </div>
        </div>
        {!posted && can('stock.count') && (
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" loading={busy} onClick={() => void saveCounts()}>
              Saqlash
            </Button>
            <Button
              size="sm" variant="primary" disabled={counted === 0}
              onClick={() => setConfirmPost(true)}
            >
              <Check size={14} />O'tkazish
            </Button>
          </div>
        )}
      </div>

      {err && <ErrorBox>{err}</ErrorBox>}
      {ok && !err && <InfoBox tone="ok">{ok}</InfoBox>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Jami tovar" value={String(items.length)} icon={<ClipboardList size={16} />} />
        <Stat label="Sanalgan" value={`${counted} / ${items.length}`}
              tone={counted === items.length ? 'ok' : 'warn'} />
        <Stat label="Farq topilgan" value={String(diffs.length)}
              tone={diffs.length > 0 ? 'danger' : 'ok'} />
        <Stat
          label="Sanalmagan" value={String(items.length - counted)}
          tone={items.length - counted > 0 ? 'warn' : 'ok'}
          sub={items.length - counted > 0 ? "O'tkazishda tegilmaydi" : undefined}
        />
      </div>

      {!posted && (
        <InfoBox tone="warn">
          Bo'sh qoldirilgan qator <b>tegilmaydi</b> — faqat yozilgan miqdorlar
          hisobga olinadi. Tovar yo'q bo'lsa <b>0</b> yozing.
        </InfoBox>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-3)' }} />
          <input
            value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tovar nomi yoki kodi…"
            className="w-full rounded-lg border py-2 pl-8 pr-2.5 text-sm outline-none
              focus:border-[var(--brand)]"
            style={{ background: 'var(--surface)', borderColor: 'var(--border-2)' }}
          />
        </div>
        <label className="inline-flex items-center gap-1.5 text-[13px]"
               style={{ color: 'var(--text-2)' }}>
          <input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} />
          Faqat farqlar
        </label>
      </div>

      <Card pad={false}>
        <div className="p-4">
          {view.length === 0 ? (
            <Empty title="Qator yo'q" hint={onlyDiff ? 'Farq topilmadi.' : 'Qidiruvni tozalang.'} />
          ) : (
            <DocTable minWidth={820}>
              <thead>
                <tr>
                  <DocTh w={34} align="center">N</DocTh>
                  <DocTh>Nomenklatura</DocTh>
                  <DocTh w={60} align="center">Birlik</DocTh>
                  <DocTh w={120} align="right">Tizim bo'yicha</DocTh>
                  <DocTh w={130} align="right">Haqiqiy</DocTh>
                  <DocTh w={120} align="right">Farq</DocTh>
                </tr>
              </thead>
              <tbody>
                {view.map((i, n) => {
                  const v = actual[i.id]
                  const has = v != null && v !== ''
                  const diff = has ? Number(v) - Number(i.qty_system) : 0
                  return (
                    <DocTr key={i.id} alt={n % 2 === 1}
                           tone={has && diff !== 0 ? 'attention' : 'normal'}>
                      <DocTd align="center" tone="muted">{n + 1}</DocTd>
                      <DocTd>{nameOf(i.product_id)}</DocTd>
                      <DocTd align="center" tone="muted">{unitOf(i.product_id)}</DocTd>
                      <DocTd align="right" mono>{num(i.qty_system, 2)}</DocTd>
                      <DocTd stopClick>
                        {posted ? (
                          <div className="tnum px-1 text-right">
                            {i.qty_actual != null ? num(i.qty_actual, 2) : '—'}
                          </div>
                        ) : (
                          <CellInput
                            type="number" align="right" value={v ?? ''}
                            onChange={(val) => setActual((p) => ({ ...p, [i.id]: val }))}
                          />
                        )}
                      </DocTd>
                      <DocTd align="right" mono
                             tone={!has ? 'muted' : diff === 0 ? 'muted' : 'danger'}>
                        {!has ? '—' : diff === 0 ? '0' : `${diff > 0 ? '+' : ''}${num(diff, 2)}`}
                      </DocTd>
                    </DocTr>
                  )
                })}
              </tbody>
            </DocTable>
          )}
        </div>
      </Card>

      {!posted && (
        <Card>
          <Field label="Izoh">
            <Textarea value={note} onChange={setNote} rows={2}
                      placeholder="Masalan: oylik inventarizatsiya, komissiya a'zolari…" />
          </Field>
        </Card>
      )}

      {confirmPost && (
        <Modal
          open onClose={() => setConfirmPost(false)} width={480}
          title="Inventarizatsiyani o'tkazish"
          footer={<>
            <Button onClick={() => setConfirmPost(false)}>Bekor</Button>
            <Button variant="primary" loading={busy} onClick={() => void post()}>
              <Check size={14} />O'tkazish
            </Button>
          </>}
        >
          <div className="space-y-3">
            <InfoBox tone="warn">
              <b>{diffs.length}</b> ta qatorda farq bor. O'tkazilganda ortiqcha tovar
              omborga kiritiladi, kamomad esa yechiladi. Buni orqaga qaytarib bo'lmaydi.
            </InfoBox>
            {items.length - counted > 0 && (
              <InfoBox>
                {items.length - counted} ta qator sanalmagan — ular tegilmaydi.
              </InfoBox>
            )}
            {diffs.length > 0 && (
              <div className="max-h-[200px] overflow-auto rounded-lg border p-2"
                   style={{ borderColor: 'var(--border-2)' }}>
                {diffs.slice(0, 20).map((i) => {
                  const d = Number(actual[i.id]) - Number(i.qty_system)
                  return (
                    <div key={i.id} className="flex justify-between gap-3 py-0.5 text-[12.5px]">
                      <span className="truncate">{nameOf(i.product_id)}</span>
                      <span className="tnum shrink-0"
                            style={{ color: d > 0 ? 'var(--ok)' : 'var(--danger)' }}>
                        {d > 0 ? '+' : ''}{num(d, 2)}
                      </span>
                    </div>
                  )
                })}
                {diffs.length > 20 && (
                  <div className="pt-1 text-[12px]" style={{ color: 'var(--text-3)' }}>
                    …va yana {diffs.length - 20} ta
                  </div>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
