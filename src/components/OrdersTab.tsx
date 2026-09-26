import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Plus, Copy, Check, Ban, ArrowRightLeft, Search, Filter,
  RefreshCw, X as XIcon, FileText,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useCustomers, useProducts, useRefs, translateDbError } from '../lib/useRefs'
import type { Order } from '../lib/types'
import {
  Button, Card, Empty, ErrorBox, Field, InfoBox, Input, Loading, Modal,
  Select, Textarea, Toggle,
} from './ui'
import {
  DocTable, DocTd, DocTh, DocToolbar, DocTr, MarkLegend, StatusDot, type Mark,
} from './docList'
import { dateShort, isoDate, money, num } from '../lib/format'

interface OrderRow {
  id: number
  doc_no: string | null
  doc_date: string
  valid_until: string | null
  status: 'draft' | 'confirmed' | 'converted' | 'cancelled'
  customer_id: number
  customer_name: string
  manager_id: string | null
  manager_name: string | null
  warehouse_id: number
  warehouse_name: string | null
  contract_id: number | null
  contract_no: string | null
  total: number
  sale_id: number | null
  sale_doc_no: string | null
  note: string | null
  line_count: number
  qty_total: number
  is_expired: boolean
  sale_net: number
  sale_due: number
  ship_mark: Mark
  pay_mark: Mark
  state: 'new' | 'confirmed' | 'in_progress' | 'done' | 'cancelled'
  is_overdue: boolean
}

/** 1C dagi "Состояние" ustuniga o'xshash */
const STATE: Record<string, { label: string; attention: boolean }> = {
  new:         { label: 'Ishlanmagan',    attention: true },
  confirmed:   { label: 'Band qilindi',   attention: false },
  in_progress: { label: 'Ishlanmoqda',    attention: false },
  done:        { label: 'Yakunlangan',    attention: false },
  cancelled:   { label: 'Bekor qilingan', attention: false },
}

export default function OrdersTab({ onOpenSale }: { onOpenSale: (id: number) => void }) {
  const { can } = useAuth()
  const [rows, setRows] = useState<OrderRow[]>([])
  const [q, setQ] = useState('')
  const [st, setSt] = useState('')
  const [sel, setSel] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [creating, setCreating] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [copyFrom, setCopyFrom] = useState<number | null>(null)
  const [convertId, setConvertId] = useState<number | null>(null)
  const [showFilter, setShowFilter] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('ip_orders_board').select('*')
      .order('doc_date', { ascending: false }).order('id', { ascending: false }).limit(500)
    if (error) setErr(translateDbError(error.message))
    else setErr('')
    setRows((data as OrderRow[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (st && r.state !== st) return false
      if (!s) return true
      return r.customer_name.toLowerCase().includes(s)
        || (r.doc_no ?? '').toLowerCase().includes(s)
        || (r.contract_no ?? '').toLowerCase().includes(s)
    })
  }, [rows, q, st])

  const current = rows.find((r) => r.id === sel) ?? null

  async function act(id: number, action: 'confirm' | 'cancel') {
    setErr('')
    const { error } = action === 'confirm'
      ? await supabase.rpc('ip_confirm_order', { p_order_id: id })
      : await supabase.rpc('ip_cancel_order', { p_order_id: id, p_reason: null })
    if (error) { setErr(translateDbError(error.message)); return }
    await load()
  }

  if (loading) return <Loading />

  const total = filtered.reduce((a, r) => a + Number(r.total), 0)

  return (
    <div>
      {err && <div className="mb-2"><ErrorBox>{err}</ErrorBox></div>}

      <DocToolbar
        left={
          <>
            {can('sales.create') && (
              <Button size="sm" variant="primary" onClick={() => setCreating(true)}>
                <Plus size={14} />Yaratish
              </Button>
            )}
            <Button
              size="sm" disabled={!current} title="Nusxasini yaratish"
              onClick={() => current && setCopyFrom(current.id)}
            >
              <Copy size={14} />
            </Button>
            <span className="mx-1 h-5 w-px" style={{ background: 'var(--border)' }} />
            <Button
              size="sm" disabled={!current || current.status !== 'draft'}
              title="Tasdiqlash — tovar band qilinadi"
              onClick={() => current && void act(current.id, 'confirm')}
            >
              <Check size={14} />Tasdiqlash
            </Button>
            <Button
              size="sm" disabled={!current || current.status !== 'confirmed'}
              title="Sotuvga aylantirish"
              onClick={() => current && setConvertId(current.id)}
            >
              <ArrowRightLeft size={14} />Sotuv yaratish
            </Button>
            <Button
              size="sm" disabled={!current || !['draft', 'confirmed'].includes(current.status)}
              title="Bekor qilish"
              onClick={() => {
                if (current && confirm('Buyurtma bekor qilinsinmi?')) void act(current.id, 'cancel')
              }}
            >
              <Ban size={14} />
            </Button>
            <span className="mx-1 h-5 w-px" style={{ background: 'var(--border)' }} />
            <Button
              size="sm" onClick={() => setShowFilter((v) => !v)}
              title="Saralash"
            >
              <Filter size={14} />
            </Button>
            <Button size="sm" onClick={() => void load()} title="Yangilash">
              <RefreshCw size={14} />
            </Button>
          </>
        }
        right={
          <div className="relative w-[240px]">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--text-3)' }} />
            <input
              value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Qidiruv…"
              className="w-full rounded border py-[5px] pl-7 pr-7 text-[13px] outline-none focus:border-[var(--brand)]"
              style={{ background: 'var(--surface)', borderColor: 'var(--border-2)' }}
            />
            {q && (
              <button onClick={() => setQ('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      style={{ color: 'var(--text-3)' }}>
                <XIcon size={13} />
              </button>
            )}
          </div>
        }
      />

      {showFilter && (
        <div
          className="mb-2 flex flex-wrap items-end gap-2 rounded-lg border px-3 py-2"
          style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
        >
          <div className="w-[190px]">
            <Field label="Holat">
              <Select
                value={st} onChange={setSt} placeholder="Hammasi"
                options={[
                  { value: 'new', label: 'Ishlanmagan' },
                  { value: 'confirmed', label: 'Band qilindi' },
                  { value: 'in_progress', label: 'Ishlanmoqda' },
                  { value: 'done', label: 'Yakunlangan' },
                  { value: 'cancelled', label: 'Bekor qilingan' },
                ]}
              />
            </Field>
          </div>
          <Button size="sm" variant="ghost" onClick={() => { setSt(''); setShowFilter(false) }}>
            Tozalash
          </Button>
        </div>
      )}

      <Card pad={false}>
        <div className="p-4">
          {filtered.length === 0 ? (
            <Empty
              title="Buyurtma yo'q"
              hint="Mijoz so'ragan, lekin hali rasmiylashtirilmagan tovarni shu yerga yozasiz."
              action={can('sales.create')
                ? <Button variant="primary" onClick={() => setCreating(true)}><Plus size={14} />Yaratish</Button>
                : undefined}
            />
          ) : (
            <>
              <DocTable minWidth={1120}>
                <thead>
                  <tr>
                    <DocTh w={30} align="center"><span title="Yuk chiqishi">🚚</span></DocTh>
                    <DocTh w={30} align="center"><span title="To'lov">₿</span></DocTh>
                    <DocTh w={95}>Sana</DocTh>
                    <DocTh w={130} sorted="desc">Raqam</DocTh>
                    <DocTh w={120}>Holat</DocTh>
                    <DocTh>Mijoz</DocTh>
                    <DocTh w={150}>Shartnoma</DocTh>
                    <DocTh w={140} align="right">Summa</DocTh>
                    <DocTh w={130}>Menejer</DocTh>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const state = STATE[r.state] ?? STATE.new
                    const att = state.attention || r.is_expired || r.is_overdue
                    return (
                      <DocTr
                        key={r.id}
                        selected={sel === r.id}
                        attention={att}
                        onClick={() => setSel(sel === r.id ? null : r.id)}
                        onDoubleClick={() => {
                          if (r.sale_id) onOpenSale(r.sale_id)
                          else if (r.status === 'draft') { setSel(r.id); setEditId(r.id) }
                        }}
                      >
                        <DocTd align="center">
                          <StatusDot
                            mark={r.ship_mark}
                            title={
                              r.ship_mark === 'full' ? 'Yuk chiqarilgan'
                                : r.ship_mark === 'half' ? 'Qisman chiqarilgan'
                                : r.ship_mark === 'none' ? '—' : 'Yuk chiqmagan'
                            }
                          />
                        </DocTd>
                        <DocTd align="center">
                          <StatusDot
                            mark={r.pay_mark}
                            title={
                              r.pay_mark === 'full' ? "To'liq to'langan"
                                : r.pay_mark === 'half' ? `Qisman: qarz ${money(r.sale_due)}`
                                : r.pay_mark === 'none' ? '—' : "To'lov yo'q"
                            }
                          />
                        </DocTd>
                        <DocTd mono>{dateShort(r.doc_date)}</DocTd>
                        <DocTd mono tone={att ? 'attention' : 'normal'}>
                          {r.doc_no ?? `#${r.id}`}
                        </DocTd>
                        <DocTd tone={state.attention ? 'attention' : 'normal'}>
                          {state.label}
                          {r.is_expired && (
                            <div className="text-[11px]" style={{ color: 'var(--danger)' }}>
                              muddati o'tgan
                            </div>
                          )}
                        </DocTd>
                        <DocTd tone="link">{r.customer_name}</DocTd>
                        <DocTd tone={r.contract_no ? 'link' : 'muted'}>
                          {r.contract_no ?? 'Asosiy shartnoma'}
                        </DocTd>
                        <DocTd align="right" mono>{money(r.total, false)}</DocTd>
                        <DocTd tone="link">{r.manager_name ?? '—'}</DocTd>
                      </DocTr>
                    )
                  })}
                </tbody>
              </DocTable>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3"
                   style={{ borderColor: 'var(--border)' }}>
                <MarkLegend items={[
                  { mark: 'full',  label: 'bajarilgan' },
                  { mark: 'half',  label: 'qisman' },
                  { mark: 'empty', label: 'bajarilmagan' },
                ]} />
                <span className="text-[13px]">
                  <span style={{ color: 'var(--text-3)' }}>{filtered.length} ta · Jami: </span>
                  <b className="tnum">{money(total)}</b>
                </span>
              </div>
            </>
          )}
        </div>
      </Card>

      {current && (
        <div className="mt-3">
          <OrderPreview row={current} onOpenSale={onOpenSale} onEdit={() => setEditId(current.id)} />
        </div>
      )}

      {(creating || editId || copyFrom) && (
        <OrderModal
          orderId={editId}
          copyFromId={copyFrom}
          onClose={() => { setCreating(false); setEditId(null); setCopyFrom(null) }}
          onDone={() => { setCreating(false); setEditId(null); setCopyFrom(null); void load() }}
        />
      )}
      {convertId && (
        <ConvertModal
          orderId={convertId}
          onClose={() => setConvertId(null)}
          onDone={(saleId) => { setConvertId(null); void load(); onOpenSale(saleId) }}
        />
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- */

/** Tanlangan buyurtmaning tarkibi — 1C dagi "Товары, услуги" paneli kabi */
function OrderPreview({
  row, onOpenSale, onEdit,
}: { row: OrderRow; onOpenSale: (id: number) => void; onEdit: () => void }) {
  const refs = useRefs()
  const [items, setItems] = useState<{
    id: number; product_id: number; qty: number; price: number; line_total: number
    product?: { name: string; code: string | null; unit_id: number | null } | null
  }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    void supabase.from('ip_order_items')
      .select('*, product:ip_products(name, code, unit_id)')
      .eq('order_id', row.id).order('id')
      .then(({ data }) => {
        if (!alive) return
        setItems((data as never) ?? [])
        setLoading(false)
      })
    return () => { alive = false }
  }, [row.id])

  const unit = (uid: number | null | undefined) =>
    refs.units.find((u) => u.id === uid)?.code ?? ''

  return (
    <Card pad={false}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2"
           style={{ borderColor: 'var(--border)' }}>
        <span className="inline-flex items-center gap-1.5 text-[13px] font-medium">
          <FileText size={14} />Tovarlar · {row.doc_no}
        </span>
        <span className="flex gap-1.5">
          {row.status === 'draft' && (
            <Button size="sm" onClick={onEdit}>Tahrirlash</Button>
          )}
          {row.sale_id && (
            <Button size="sm" variant="primary" onClick={() => onOpenSale(row.sale_id!)}>
              Sotuv: {row.sale_doc_no}
            </Button>
          )}
        </span>
      </div>
      <div className="p-4">
        {loading ? <Loading /> : items.length === 0 ? (
          <Empty title="Tovar kiritilmagan" />
        ) : (
          <DocTable minWidth={560}>
            <thead>
              <tr>
                <DocTh w={34} align="center">№</DocTh>
                <DocTh>Nomenklatura</DocTh>
                <DocTh w={90} align="right">Miqdor</DocTh>
                <DocTh w={60} align="center">Birlik</DocTh>
                <DocTh w={120} align="right">Narx</DocTh>
                <DocTh w={130} align="right">Summa</DocTh>
              </tr>
            </thead>
            <tbody>
              {items.map((i, n) => (
                <DocTr key={i.id}>
                  <DocTd align="center" tone="muted">{n + 1}</DocTd>
                  <DocTd>
                    {i.product?.name ?? `#${i.product_id}`}
                    {i.product?.code && (
                      <span className="ml-1.5 text-[11px]" style={{ color: 'var(--text-3)' }}>
                        {i.product.code}
                      </span>
                    )}
                  </DocTd>
                  <DocTd align="right" mono>{num(i.qty, 2)}</DocTd>
                  <DocTd align="center" tone="muted">{unit(i.product?.unit_id)}</DocTd>
                  <DocTd align="right" mono>{money(i.price, false)}</DocTd>
                  <DocTd align="right" mono>{money(i.line_total, false)}</DocTd>
                </DocTr>
              ))}
            </tbody>
          </DocTable>
        )}
      </div>
    </Card>
  )
}

/* ---------------------------------------------------------------- */

type Line = { key: string; product_id: number | null; qty: string; price: string }
const newLine = (): Line => ({
  key: Math.random().toString(36).slice(2), product_id: null, qty: '', price: '',
})

function OrderModal({
  orderId, copyFromId, onClose, onDone,
}: {
  orderId: number | null
  copyFromId: number | null
  onClose: () => void
  onDone: () => void
}) {
  const refs = useRefs()
  const { customers } = useCustomers()
  const { products } = useProducts()

  const [customerId, setCustomerId] = useState<number | null>(null)
  const [warehouse, setWarehouse] = useState<number | null>(null)
  const [contractId, setContractId] = useState<number | null>(null)
  const [contracts, setContracts] = useState<{ id: number; number: string }[]>([])
  const [date, setDate] = useState(isoDate())
  const [valid, setValid] = useState('')
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<Line[]>([newLine()])
  const [prices, setPrices] = useState<Map<number, number>>(new Map())
  const [stock, setStock] = useState<Map<number, number>>(new Map())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const customer = customers.find((c) => c.id === customerId) ?? null
  const tierId = customer?.tier_id ?? refs.tiers.find((t) => t.is_default)?.id ?? null
  const sourceId = orderId ?? copyFromId

  useEffect(() => {
    if (warehouse == null && refs.warehouses.length) {
      setWarehouse((refs.warehouses.find((w) => w.is_default) ?? refs.warehouses[0]).id)
    }
  }, [refs.warehouses, warehouse])

  // Mijozning shartnomalari
  useEffect(() => {
    if (!customerId) { setContracts([]); return }
    let alive = true
    void supabase.from('ip_contracts').select('id, number')
      .eq('customer_id', customerId).eq('is_active', true).order('signed_at', { ascending: false })
      .then(({ data }) => { if (alive) setContracts((data as never) ?? []) })
    return () => { alive = false }
  }, [customerId])

  useEffect(() => {
    if (!tierId) return
    let alive = true
    void supabase.from('ip_current_prices').select('product_id, price').eq('tier_id', tierId)
      .then(({ data }) => {
        if (!alive) return
        const m = new Map<number, number>()
        for (const r of (data ?? []) as { product_id: number; price: number }[]) {
          m.set(r.product_id, Number(r.price))
        }
        setPrices(m)
      })
    return () => { alive = false }
  }, [tierId])

  useEffect(() => {
    if (!warehouse) return
    let alive = true
    void supabase.rpc('ip_stock_available_rows', { p_warehouse: warehouse })
      .then(({ data }) => {
        if (!alive) return
        const m = new Map<number, number>()
        for (const r of (data ?? []) as { product_id: number; qty_available: number }[]) {
          m.set(r.product_id, Number(r.qty_available))
        }
        setStock(m)
      })
    return () => { alive = false }
  }, [warehouse])

  useEffect(() => {
    if (!sourceId) return
    let alive = true
    void Promise.all([
      supabase.from('ip_orders').select('*').eq('id', sourceId).single(),
      supabase.from('ip_order_items').select('*').eq('order_id', sourceId).order('id'),
    ]).then(([o, it]) => {
      if (!alive || !o.data) return
      const ord = o.data as Order & { contract_id: number | null }
      setCustomerId(ord.customer_id)
      setWarehouse(ord.warehouse_id)
      setContractId(ord.contract_id)
      if (orderId) {
        setDate(ord.doc_date)
        setValid(ord.valid_until ?? '')
        setNote(ord.note ?? '')
      }
      const items = (it.data as { product_id: number; qty: number; price: number }[]) ?? []
      setLines(items.length
        ? items.map((i) => ({
            key: Math.random().toString(36).slice(2),
            product_id: i.product_id, qty: String(i.qty), price: String(i.price),
          }))
        : [newLine()])
    })
    return () => { alive = false }
  }, [sourceId, orderId])

  const validLines = lines.filter((l) => l.product_id && Number(l.qty) > 0 && Number(l.price) > 0)
  const total = validLines.reduce((a, l) => a + Number(l.qty) * Number(l.price), 0)

  function pick(key: string, pid: number) {
    const p = prices.get(pid) ?? 0
    setLines((ls) => ls.map((x) =>
      x.key === key ? { ...x, product_id: pid, price: p ? String(p) : x.price } : x))
  }

  async function save() {
    if (!customerId || !warehouse) { setErr('Mijoz va ombor tanlanmagan'); return }
    if (validLines.length === 0) { setErr('Tovar kiritilmagan'); return }
    setBusy(true); setErr('')
    try {
      let id = orderId
      if (!id) {
        const { data, error } = await supabase.rpc('ip_create_order', {
          p_customer: customerId, p_warehouse: warehouse,
          p_date: date, p_valid_until: valid || null, p_contract: contractId,
        })
        if (error) throw new Error(error.message)
        id = (data as Order).id
      } else {
        const { error } = await supabase.from('ip_orders').update({
          customer_id: customerId, warehouse_id: warehouse, contract_id: contractId,
          doc_date: date, valid_until: valid || null,
        } as never).eq('id', id)
        if (error) throw new Error(error.message)
        await supabase.from('ip_order_items').delete().eq('order_id', id)
      }

      if (note.trim()) {
        await supabase.from('ip_orders').update({ note: note.trim() } as never).eq('id', id)
      }

      const { error: e2 } = await supabase.from('ip_order_items').insert(
        validLines.map((l) => ({
          order_id: id, product_id: l.product_id,
          qty: Number(l.qty), price: Number(l.price),
        })) as never)
      if (e2) throw new Error(e2.message)

      await supabase.rpc('ip_recalc_order', { p_order_id: id })
      onDone()
    } catch (e) {
      setErr(translateDbError(e instanceof Error ? e.message : 'Xato'))
    } finally { setBusy(false) }
  }

  if (refs.loading) return <Modal open onClose={onClose} title="Buyurtma"><Loading /></Modal>

  return (
    <Modal
      open onClose={onClose} width={860}
      title={orderId ? 'Buyurtmani tahrirlash' : copyFromId ? 'Buyurtma nusxasi' : 'Yangi buyurtma'}
      footer={<><Button onClick={onClose}>Bekor</Button>
        <Button variant="primary" loading={busy} onClick={save} disabled={validLines.length === 0}>
          Saqlash
        </Button></>}
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Mijoz" required>
            <Select
              value={customerId ?? ''} onChange={(v) => setCustomerId(v ? Number(v) : null)}
              placeholder="Tanlang…"
              options={customers.map((c) => ({ value: c.id, label: c.name }))}
            />
          </Field>
          <Field label="Shartnoma">
            <Select
              value={contractId ?? ''} onChange={(v) => setContractId(v ? Number(v) : null)}
              placeholder="Asosiy shartnoma"
              options={contracts.map((c) => ({ value: c.id, label: c.number }))}
            />
          </Field>
          <Field label="Ombor" required>
            <Select
              value={warehouse ?? ''} onChange={(v) => setWarehouse(v ? Number(v) : null)}
              options={refs.warehouses.map((w) => ({ value: w.id, label: w.name }))}
            />
          </Field>
          <Field label="Sana"><Input type="date" value={date} onChange={setDate} /></Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Amal qilish muddati" hint="Ixtiyoriy">
            <Input type="date" value={valid} onChange={setValid} />
          </Field>
        </div>

        <DocTable minWidth={660}>
          <thead>
            <tr>
              <DocTh>Nomenklatura</DocTh>
              <DocTh w={110} align="right">Miqdor</DocTh>
              <DocTh w={130} align="right">Narx</DocTh>
              <DocTh w={130} align="right">Summa</DocTh>
              <DocTh w={40} />
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const free = l.product_id ? stock.get(l.product_id) ?? 0 : 0
              const over = l.product_id != null && Number(l.qty) > free
              return (
                <DocTr key={l.key}>
                  <DocTd>
                    <Select
                      value={l.product_id ?? ''} onChange={(v) => v && pick(l.key, Number(v))}
                      placeholder="Tovarni tanlang…"
                      options={products.map((p) => {
                        const f = stock.get(p.id)
                        const base = p.code ? `${p.code} — ${p.name}` : p.name
                        return {
                          value: p.id,
                          label: f != null ? `${base}  ·  ${num(f, 2)} erkin` : `${base}  ·  yo'q`,
                        }
                      })}
                    />
                  </DocTd>
                  <DocTd>
                    <Input type="number" className="text-right" value={l.qty}
                      onChange={(v) => setLines((ls) => ls.map((x) => x.key === l.key ? { ...x, qty: v } : x))} />
                    {over && (
                      <div className="mt-0.5 text-right text-[11px]" style={{ color: 'var(--warn)' }}>
                        erkin {num(free, 2)}
                      </div>
                    )}
                  </DocTd>
                  <DocTd>
                    <Input type="number" className="text-right" value={l.price}
                      onChange={(v) => setLines((ls) => ls.map((x) => x.key === l.key ? { ...x, price: v } : x))} />
                  </DocTd>
                  <DocTd align="right" mono>
                    {Number(l.qty) * Number(l.price) > 0
                      ? money(Number(l.qty) * Number(l.price), false) : '—'}
                  </DocTd>
                  <DocTd align="center">
                    <Button size="sm" variant="ghost"
                      onClick={() => setLines((ls) => ls.length > 1 ? ls.filter((x) => x.key !== l.key) : ls)}>
                      <XIcon size={13} />
                    </Button>
                  </DocTd>
                </DocTr>
              )
            })}
          </tbody>
        </DocTable>

        <div className="flex items-center justify-between gap-3">
          <Button size="sm" onClick={() => setLines((ls) => [...ls, newLine()])}>
            <Plus size={14} />Qator
          </Button>
          <div className="text-right">
            <div className="text-[12px]" style={{ color: 'var(--text-3)' }}>Jami</div>
            <div className="tnum text-[18px] font-semibold">{money(total)}</div>
          </div>
        </div>

        <Field label="Izoh"><Textarea value={note} onChange={setNote} rows={2} /></Field>
        {err && <ErrorBox>{err}</ErrorBox>}
      </div>
    </Modal>
  )
}

function ConvertModal({
  orderId, onClose, onDone,
}: { orderId: number; onClose: () => void; onDone: (saleId: number) => void }) {
  const [shipNow, setShipNow] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function convert() {
    setBusy(true); setErr('')
    const { data, error } = await supabase.rpc('ip_convert_order', {
      p_order_id: orderId, p_mode: shipNow ? 'immediate' : 'deferred',
    })
    setBusy(false)
    if (error) { setErr(translateDbError(error.message)); return }
    onDone(data as number)
  }

  return (
    <Modal
      open onClose={onClose} width={460} title="Sotuvga aylantirish"
      footer={<><Button onClick={onClose}>Bekor</Button>
        <Button variant="primary" loading={busy} onClick={convert}>
          <ArrowRightLeft size={14} />Aylantirish
        </Button></>}
    >
      <div className="space-y-3">
        <InfoBox>
          Buyurtma asosida <b>sotuv qoralamasi</b> yaratiladi. Keyin uni tekshirib
          topshirasiz — shundagina qarz va ombor harakati yoziladi.
        </InfoBox>
        <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border-2)' }}>
          <Toggle
            checked={shipNow} onChange={setShipNow}
            label={shipNow ? 'Yuk hozir chiqadi' : 'Yuk keyin chiqadi'}
          />
          <p className="mt-1.5 text-[12px]" style={{ color: 'var(--text-3)' }}>
            {shipNow
              ? 'Sotuv topshirilganda tovar darhol ombordan yechiladi.'
              : "Tovar band bo'lib turadi, keyin chiqariladi."}
          </p>
        </div>
        {err && <ErrorBox>{err}</ErrorBox>}
      </div>
    </Modal>
  )
}
