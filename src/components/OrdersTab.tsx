import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Plus, Trash2, Check, Ban, ArrowRightLeft, Search, Clock, AlertTriangle,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useCustomers, useProducts, useRefs, translateDbError } from '../lib/useRefs'
import type { Order } from '../lib/types'
import {
  Badge, Button, Card, Empty, ErrorBox, Field, InfoBox, Input, Loading, Modal,
  Select, Stat, Table, Td, Textarea, Th, Toggle, Tr, type Tone,
} from './ui'
import { dateShort, isoDate, money, moneyShort, num } from '../lib/format'

interface OrderRow {
  id: number
  doc_no: string | null
  doc_date: string
  valid_until: string | null
  status: 'draft' | 'confirmed' | 'converted' | 'cancelled'
  customer_id: number
  customer_name: string
  phone: string | null
  manager_id: string | null
  manager_name: string | null
  warehouse_id: number
  warehouse_name: string | null
  total: number
  sale_id: number | null
  sale_doc_no: string | null
  note: string | null
  line_count: number
  qty_total: number
  is_expired: boolean
}

const ST_LABEL: Record<string, string> = {
  draft: 'Qoralama', confirmed: 'Tasdiqlangan',
  converted: 'Sotuvga aylandi', cancelled: 'Bekor qilingan',
}
const ST_TONE: Record<string, Tone> = {
  draft: 'info', confirmed: 'warn', converted: 'ok', cancelled: 'neutral',
}

export default function OrdersTab({ onOpenSale }: { onOpenSale: (id: number) => void }) {
  const { can } = useAuth()
  const [rows, setRows] = useState<OrderRow[]>([])
  const [q, setQ] = useState('')
  const [st, setSt] = useState('')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [creating, setCreating] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [convertId, setConvertId] = useState<number | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('ip_orders_board').select('*')
      .order('doc_date', { ascending: false }).order('id', { ascending: false }).limit(300)
    if (error) setErr(translateDbError(error.message))
    else setErr('')
    setRows((data as OrderRow[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (st && r.status !== st) return false
      if (!s) return true
      return r.customer_name.toLowerCase().includes(s) || (r.doc_no ?? '').toLowerCase().includes(s)
    })
  }, [rows, q, st])

  async function act(id: number, action: 'confirm' | 'cancel') {
    setErr('')
    const { error } = action === 'confirm'
      ? await supabase.rpc('ip_confirm_order', { p_order_id: id })
      : await supabase.rpc('ip_cancel_order', { p_order_id: id, p_reason: null })
    if (error) { setErr(translateDbError(error.message)); return }
    await load()
  }

  if (loading) return <Loading />

  const open = rows.filter((r) => r.status === 'draft' || r.status === 'confirmed')
  const reserved = rows.filter((r) => r.status === 'confirmed')
    .reduce((a, r) => a + Number(r.total), 0)

  return (
    <div className="space-y-4">
      {err && <ErrorBox>{err}</ErrorBox>}

      <InfoBox>
        Buyurtma — sotuvdan oldingi bosqich. <b>Tasdiqlansa</b> tovar band
        qilinadi va boshqa sotuvda mavjud emas deb hisoblanadi. Keyin bir
        bosishda sotuvga aylantiriladi.
      </InfoBox>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Ochiq buyurtma" value={open.length} tone={open.length > 0 ? 'warn' : 'neutral'} />
        <Stat label="Tasdiqlangan summa" value={moneyShort(reserved)} tone="brand" sub="Tovar band" />
        <Stat label="Sotuvga aylangan" value={rows.filter((r) => r.status === 'converted').length} tone="ok" />
        <Stat
          label="Muddati o'tgan" value={rows.filter((r) => r.is_expired).length}
          tone={rows.some((r) => r.is_expired) ? 'danger' : 'ok'}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
          <input
            value={q} onChange={(e) => setQ(e.target.value)} placeholder="Mijoz yoki raqam…"
            className="w-full rounded-lg border py-2 pl-8 pr-2.5 text-sm outline-none focus:border-[var(--brand)]"
            style={{ background: 'var(--surface)', borderColor: 'var(--border-2)' }}
          />
        </div>
        <div className="w-[180px]">
          <Select
            value={st} onChange={setSt} placeholder="Hamma holat"
            options={Object.entries(ST_LABEL).map(([k, l]) => ({ value: k, label: l }))}
          />
        </div>
        {can('sales.create') && (
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={14} />Yangi buyurtma
          </Button>
        )}
      </div>

      <Card pad={false}>
        <div className="p-4">
          {filtered.length === 0 ? (
            <Empty
              title="Buyurtma yo'q"
              hint="Mijoz so'ragan, lekin hali rasmiylashtirilmagan tovarni shu yerga yozasiz."
              action={can('sales.create')
                ? <Button variant="primary" onClick={() => setCreating(true)}><Plus size={14} />Yangi buyurtma</Button>
                : undefined}
            />
          ) : (
            <Table minWidth={980}>
              <thead>
                <tr>
                  <Th w={130}>Hujjat</Th>
                  <Th w={100}>Sana</Th>
                  <Th>Mijoz</Th>
                  <Th w={130}>Menejer</Th>
                  <Th w={90} align="right">Qator</Th>
                  <Th w={140} align="right">Summa</Th>
                  <Th w={110}>Amal qiladi</Th>
                  <Th w={140} align="center">Holat</Th>
                  <Th w={160} align="right">Amallar</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <Tr key={r.id} onClick={() => r.status === 'draft' && setEditId(r.id)}>
                    <Td mono>
                      <span className="text-[12.5px]">{r.doc_no ?? `#${r.id}`}</span>
                      {r.sale_doc_no && (
                        <div className="text-[11px]" style={{ color: 'var(--ok)' }}>
                          → {r.sale_doc_no}
                        </div>
                      )}
                    </Td>
                    <Td mono>{dateShort(r.doc_date)}</Td>
                    <Td><span className="font-medium">{r.customer_name}</span></Td>
                    <Td><span className="text-[12.5px]">{r.manager_name ?? '—'}</span></Td>
                    <Td align="right" mono>{r.line_count}</Td>
                    <Td align="right" mono>{money(r.total, false)}</Td>
                    <Td mono>
                      {r.valid_until ? (
                        <span style={{ color: r.is_expired ? 'var(--danger)' : undefined }}>
                          {dateShort(r.valid_until)}
                        </span>
                      ) : '—'}
                    </Td>
                    <Td align="center">
                      <Badge tone={ST_TONE[r.status]}>{ST_LABEL[r.status]}</Badge>
                      {r.is_expired && (
                        <div className="mt-0.5 text-[11px]" style={{ color: 'var(--danger)' }}>
                          muddati o'tgan
                        </div>
                      )}
                    </Td>
                    <Td align="right" stopClick>
                      <span className="flex justify-end gap-1">
                        {r.status === 'draft' && can('sales.create') && (
                          <Button size="sm" variant="primary" title="Tasdiqlash"
                            onClick={() => void act(r.id, 'confirm')}>
                            <Check size={14} />
                          </Button>
                        )}
                        {r.status === 'confirmed' && can('sales.create') && (
                          <Button size="sm" variant="primary" title="Sotuvga aylantirish"
                            onClick={() => setConvertId(r.id)}>
                            <ArrowRightLeft size={14} />
                          </Button>
                        )}
                        {r.status === 'converted' && r.sale_id && (
                          <Button size="sm" title="Sotuvni ochish"
                            onClick={() => onOpenSale(r.sale_id!)}>
                            Sotuv
                          </Button>
                        )}
                        {(r.status === 'draft' || r.status === 'confirmed') && can('sales.create') && (
                          <Button size="sm" variant="ghost" title="Bekor qilish"
                            onClick={() => { if (confirm('Buyurtma bekor qilinsinmi?')) void act(r.id, 'cancel') }}>
                            <Ban size={14} />
                          </Button>
                        )}
                      </span>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </Card>

      {(creating || editId) && (
        <OrderModal
          orderId={editId}
          onClose={() => { setCreating(false); setEditId(null) }}
          onDone={() => { setCreating(false); setEditId(null); void load() }}
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

type Line = { key: string; product_id: number | null; qty: string; price: string }
const newLine = (): Line => ({
  key: Math.random().toString(36).slice(2), product_id: null, qty: '', price: '',
})

function OrderModal({
  orderId, onClose, onDone,
}: { orderId: number | null; onClose: () => void; onDone: () => void }) {
  const refs = useRefs()
  const { customers } = useCustomers()
  const { products } = useProducts()

  const [customerId, setCustomerId] = useState<number | null>(null)
  const [warehouse, setWarehouse] = useState<number | null>(null)
  const [date, setDate] = useState(isoDate())
  const [valid, setValid] = useState('')
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<Line[]>([newLine()])
  const [prices, setPrices] = useState<Map<number, number>>(new Map())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const customer = customers.find((c) => c.id === customerId) ?? null
  const tierId = customer?.tier_id ?? refs.tiers.find((t) => t.is_default)?.id ?? null

  useEffect(() => {
    if (warehouse == null && refs.warehouses.length) {
      setWarehouse((refs.warehouses.find((w) => w.is_default) ?? refs.warehouses[0]).id)
    }
  }, [refs.warehouses, warehouse])

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
    if (!orderId) return
    let alive = true
    void Promise.all([
      supabase.from('ip_orders').select('*').eq('id', orderId).single(),
      supabase.from('ip_order_items').select('*').eq('order_id', orderId).order('id'),
    ]).then(([o, it]) => {
      if (!alive || !o.data) return
      const ord = o.data as Order
      setCustomerId(ord.customer_id)
      setWarehouse(ord.warehouse_id)
      setDate(ord.doc_date)
      setValid(ord.valid_until ?? '')
      setNote(ord.note ?? '')
      const items = (it.data as { product_id: number; qty: number; price: number }[]) ?? []
      setLines(items.length
        ? items.map((i) => ({
            key: Math.random().toString(36).slice(2),
            product_id: i.product_id, qty: String(i.qty), price: String(i.price),
          }))
        : [newLine()])
    })
    return () => { alive = false }
  }, [orderId])

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
          p_date: date, p_valid_until: valid || null,
        })
        if (error) throw new Error(error.message)
        id = (data as Order).id
      } else {
        const { error } = await supabase.from('ip_orders').update({
          customer_id: customerId, warehouse_id: warehouse,
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
      open onClose={onClose} width={800}
      title={orderId ? 'Buyurtmani tahrirlash' : 'Yangi buyurtma'}
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
          <Field label="Ombor" required>
            <Select
              value={warehouse ?? ''} onChange={(v) => setWarehouse(v ? Number(v) : null)}
              options={refs.warehouses.map((w) => ({ value: w.id, label: w.name }))}
            />
          </Field>
          <Field label="Sana"><Input type="date" value={date} onChange={setDate} /></Field>
          <Field label="Amal qilish muddati" hint="Ixtiyoriy">
            <Input type="date" value={valid} onChange={setValid} />
          </Field>
        </div>

        <Table minWidth={620}>
          <thead>
            <tr>
              <Th>Tovar</Th>
              <Th w={110} align="right">Miqdor</Th>
              <Th w={140} align="right">Narx</Th>
              <Th w={140} align="right">Summa</Th>
              <Th w={44} />
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <Tr key={l.key}>
                <Td>
                  <Select
                    value={l.product_id ?? ''} onChange={(v) => v && pick(l.key, Number(v))}
                    placeholder="Tovarni tanlang…"
                    options={products.map((p) => ({
                      value: p.id, label: p.code ? `${p.code} — ${p.name}` : p.name,
                    }))}
                  />
                </Td>
                <Td>
                  <Input type="number" className="text-right" value={l.qty}
                    onChange={(v) => setLines((ls) => ls.map((x) => x.key === l.key ? { ...x, qty: v } : x))} />
                </Td>
                <Td>
                  <Input type="number" className="text-right" value={l.price}
                    onChange={(v) => setLines((ls) => ls.map((x) => x.key === l.key ? { ...x, price: v } : x))} />
                </Td>
                <Td align="right" mono>
                  {Number(l.qty) * Number(l.price) > 0
                    ? money(Number(l.qty) * Number(l.price), false) : '—'}
                </Td>
                <Td align="center">
                  <Button size="sm" variant="ghost"
                    onClick={() => setLines((ls) => ls.length > 1 ? ls.filter((x) => x.key !== l.key) : ls)}>
                    <Trash2 size={14} />
                  </Button>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>

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
              : 'Tovar band bo\'lib turadi, keyin chiqariladi.'}
          </p>
        </div>
        {err && <ErrorBox>{err}</ErrorBox>}
      </div>
    </Modal>
  )
}
