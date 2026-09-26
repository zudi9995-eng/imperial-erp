import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Plus, Trash2, Search, AlertTriangle, CheckCircle2, Clock, Ban, Send,
  Download, Truck, Filter, X as XIcon,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useSettings } from '../lib/settings'
import { useCustomers, useProducts, useRefs, translateDbError } from '../lib/useRefs'
import type { Customer, Product, Sale, SaleBoardRow } from '../lib/types'
import {
  Badge, Button, Card, Empty, ErrorBox, Field, InfoBox, Input, Loading, Modal,
  PageHeader, Select, Stat, Table, Td, Th, Toggle, Tr, Textarea,
} from '../components/ui'
import { dateShort, isoDate, money, moneyShort, monthStart, num, pct } from '../lib/format'
import { PayBadge, ShipBadge, SalesTotals, exportSalesCsv } from '../components/SaleIndicators'
import SaleDetail from '../components/SaleDetail'

type Line = {
  key: string
  product_id: number | null
  qty: string
  price: string
  list_price: number
  margin: number | null
  minMargin: number | null
  noCost: boolean
}

export default function Sales() {
  const { profile, can } = useAuth()
  const refs = useRefs()
  const [openId, setOpenId] = useState<number | null>(null)
  const [rows, setRows] = useState<SaleBoardRow[]>([])
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(isoDate())
  const [status, setStatus] = useState('')
  const [mgr, setMgr] = useState('')
  const [quick, setQuick] = useState<'' | 'unpaid' | 'overdue' | 'unshipped' | 'pending'>('')
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [creating, setCreating] = useState(false)
  const [params, setParams] = useSearchParams()
  const presetCustomer = params.get('customer')

  const load = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('ip_sales_board')
      .select('*')
      .gte('doc_date', from).lte('doc_date', to)
      .order('doc_date', { ascending: false })
      .order('id', { ascending: false })
      .limit(500)
    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) setErr(translateDbError(error.message))
    else setErr('')
    setRows((data as SaleBoardRow[]) ?? [])
    setLoading(false)
  }, [from, to, status])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (presetCustomer) setCreating(true)
  }, [presetCustomer])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (mgr && r.manager_id !== mgr) return false
      if (quick === 'unpaid'    && !(r.status === 'posted' && r.due_base > 0)) return false
      if (quick === 'overdue'   && !r.is_overdue) return false
      if (quick === 'unshipped' && !(r.status === 'posted' && r.source !== 'opening'
                                     && r.shipment_status !== 'shipped')) return false
      if (quick === 'pending'   && r.approval_status !== 'pending') return false
      if (!s) return true
      return r.customer_name.toLowerCase().includes(s)
        || (r.doc_no ?? '').toLowerCase().includes(s)
    })
  }, [rows, q, mgr, quick])

  const counts = useMemo(() => ({
    unpaid: rows.filter((r) => r.status === 'posted' && r.due_base > 0).length,
    overdue: rows.filter((r) => r.is_overdue).length,
    unshipped: rows.filter((r) => r.status === 'posted' && r.source !== 'opening'
      && r.shipment_status !== 'shipped').length,
    pending: rows.filter((r) => r.approval_status === 'pending').length,
  }), [rows])

  if (openId) return <SaleDetail id={openId} onBack={() => { setOpenId(null); void load() }} />
  if (loading || refs.loading) return <Loading />

  const QUICK: { key: typeof quick; label: string; n: number; tone: string }[] = [
    { key: 'unpaid',    label: "To'lanmagan",  n: counts.unpaid,    tone: 'var(--warn)' },
    { key: 'overdue',   label: "Muddati o'tgan", n: counts.overdue, tone: 'var(--danger)' },
    { key: 'unshipped', label: 'Yuk chiqmagan', n: counts.unshipped, tone: 'var(--danger)' },
    { key: 'pending',   label: 'Tasdiq kutmoqda', n: counts.pending, tone: 'var(--warn)' },
  ]

  return (
    <div>
      <PageHeader
        title="Sotuv"
        sub={`${dateShort(from)} — ${dateShort(to)} · ${filtered.length} hujjat`}
        actions={
          <>
            <Button size="sm" onClick={() => exportSalesCsv(filtered)} title="Excel uchun CSV">
              <Download size={14} />Yuklash
            </Button>
            {can('sales.create') && (
              <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
                <Plus size={14} />Yangi sotuv
              </Button>
            )}
          </>
        }
      />

      {err && <div className="mb-4"><ErrorBox>{err}</ErrorBox></div>}

      {/* Tez filtrlar */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {QUICK.map((f) => {
          const on = quick === f.key
          return (
            <button
              key={f.key}
              onClick={() => setQuick(on ? '' : f.key)}
              disabled={f.n === 0 && !on}
              className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12.5px] font-medium transition-colors disabled:opacity-40"
              style={{
                background: on ? 'var(--brand-soft)' : 'var(--surface)',
                color: on ? 'var(--brand)' : 'var(--text-2)',
                borderColor: on ? 'var(--brand)' : 'var(--border-2)',
              }}
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: f.tone }} />
              {f.label}
              <span className="tnum" style={{ color: 'var(--text-3)' }}>{f.n}</span>
            </button>
          )
        })}
        {quick && (
          <Button size="sm" variant="ghost" onClick={() => setQuick('')}>
            <XIcon size={13} />Tozalash
          </Button>
        )}
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Mijoz yoki hujjat raqami…"
            className="w-full rounded-lg border py-2 pl-8 pr-2.5 text-sm outline-none focus:border-[var(--brand)]"
            style={{ background: 'var(--surface)', borderColor: 'var(--border-2)' }}
          />
        </div>
        <div className="w-[150px]"><Input type="date" value={from} onChange={setFrom} /></div>
        <div className="w-[150px]"><Input type="date" value={to} onChange={setTo} /></div>
        {can('view.hr') && (
          <div className="w-[180px]">
            <Select
              value={mgr} onChange={setMgr} placeholder="Hamma menejer"
              options={refs.profiles.filter((p) => p.role !== 'accountant')
                .map((p) => ({ value: p.id, label: p.full_name }))}
            />
          </div>
        )}
        <div className="w-[150px]">
          <Select
            value={status} onChange={setStatus} placeholder="Hamma holat"
            options={[
              { value: 'draft', label: 'Qoralama' },
              { value: 'posted', label: 'Postlangan' },
              { value: 'cancelled', label: 'Bekor qilingan' },
            ]}
          />
        </div>
      </div>

      <Card pad={false}>
        <div className="p-4">
          {filtered.length === 0 ? (
            <Empty
              title="Hujjat topilmadi"
              hint="Sana oralig'ini yoki filtrni o'zgartiring."
              action={can('sales.create')
                ? <Button variant="primary" onClick={() => setCreating(true)}><Plus size={14} />Yangi sotuv</Button>
                : undefined}
            />
          ) : (
            <>
              <Table minWidth={1180}>
                <thead>
                  <tr>
                    <Th w={125}>Hujjat</Th>
                    <Th w={95}>Sana</Th>
                    <Th>Mijoz</Th>
                    {can('view.hr') && <Th w={130}>Menejer</Th>}
                    <Th w={130} align="right">Summa</Th>
                    {can('cost.view') && <Th w={80} align="right">Marja</Th>}
                    <Th w={130}>To'lov</Th>
                    <Th w={110}>Yuk</Th>
                    <Th w={95}>Muddat</Th>
                    <Th w={115} align="center">Holat</Th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <Tr key={r.id} onClick={() => setOpenId(r.id)}>
                      <Td mono><span className="text-[12.5px]">{r.doc_no ?? `#${r.id}`}</span></Td>
                      <Td mono>{dateShort(r.doc_date)}</Td>
                      <Td>
                        <div className="font-medium">{r.customer_name}</div>
                        {r.delivery_address && (
                          <div className="line-clamp-1 text-[11.5px]" style={{ color: 'var(--text-3)' }}>
                            {r.delivery_address}
                          </div>
                        )}
                      </Td>
                      {can('view.hr') && (
                        <Td><span className="text-[12.5px]">{r.manager_name ?? '—'}</span></Td>
                      )}
                      <Td align="right" mono>
                        {money(r.net_base, false)}
                        {Number(r.returned_base) > 0 && (
                          <div className="text-[11px]" style={{ color: 'var(--warn)' }}>
                            qaytgan {moneyShort(r.returned_base)}
                          </div>
                        )}
                      </Td>
                      {can('cost.view') && (
                        <Td align="right" mono>
                          {r.margin_pct != null ? (
                            <span style={{
                              color: Number(r.margin_pct) < 10 ? 'var(--danger)'
                                : Number(r.margin_pct) < 15 ? 'var(--warn)' : 'var(--ok)',
                            }}>{pct(r.margin_pct)}</span>
                          ) : '—'}
                        </Td>
                      )}
                      <Td>
                        <PayBadge r={r} />
                        {Number(r.due_base) > 0 && r.status === 'posted' && (
                          <div className="tnum text-[11px]" style={{ color: 'var(--text-3)' }}>
                            qarz {moneyShort(r.due_base)}
                          </div>
                        )}
                      </Td>
                      <Td><ShipBadge r={r} /></Td>
                      <Td mono>
                        <span style={{ color: r.is_overdue ? 'var(--danger)' : undefined }}>
                          {r.due_date ? dateShort(r.due_date) : '—'}
                        </span>
                      </Td>
                      <Td align="center"><BoardStatus r={r} /></Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
              <div className="mt-3"><SalesTotals rows={filtered} /></div>
            </>
          )}
        </div>
      </Card>

      {creating && (
        <NewSale
          profileId={profile!.id}
          presetCustomerId={presetCustomer ? Number(presetCustomer) : null}
          onClose={() => { setCreating(false); if (presetCustomer) setParams({}, { replace: true }) }}
          onDone={() => { setCreating(false); if (presetCustomer) setParams({}, { replace: true }); void load() }}
        />
      )}
    </div>
  )
}

function BoardStatus({ r }: { r: SaleBoardRow }) {
  if (r.status === 'cancelled') return <Badge tone="neutral"><Ban size={11} />bekor</Badge>
  if (r.approval_status === 'pending') return <Badge tone="warn"><Clock size={11} />tasdiq</Badge>
  if (r.approval_status === 'rejected') return <Badge tone="danger"><Ban size={11} />rad etildi</Badge>
  if (r.status === 'posted') return <Badge tone="ok"><CheckCircle2 size={11} />postlangan</Badge>
  return <Badge tone="info">qoralama</Badge>
}

/* ================================================================ */
/*  YANGI SOTUV                                                      */
/* ================================================================ */

function NewSale({
  profileId, presetCustomerId, onClose, onDone,
}: {
  profileId: string
  presetCustomerId?: number | null
  onClose: () => void
  onDone: () => void
}) {
  const refs = useRefs()
  const { customers, loading: custLoading } = useCustomers()
  const { products, loading: prodLoading } = useProducts()
  const { n } = useSettings()

  const [customerId, setCustomerId] = useState<number | null>(presetCustomerId ?? null)
  const [warehouseId, setWarehouseId] = useState<number | null>(null)
  const [termId, setTermId] = useState<number | null>(null)
  const [docDate, setDocDate] = useState(isoDate())
  const [note, setNote] = useState('')
  const [shipNow, setShipNow] = useState(true)
  const [lines, setLines] = useState<Line[]>([newLine()])
  const [priceMap, setPriceMap] = useState<Map<number, number>>(new Map())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [result, setResult] = useState<{ status: string; reasons?: string[]; margin_pct?: number } | null>(null)

  const customer = customers.find((c) => c.id === customerId) ?? null
  const tierId = customer?.tier_id ?? refs.tiers.find((t) => t.is_default)?.id ?? null

  // Ombor va muddat standartlari
  useEffect(() => {
    if (warehouseId == null && refs.warehouses.length) {
      setWarehouseId((refs.warehouses.find((w) => w.is_default) ?? refs.warehouses[0]).id)
    }
  }, [refs.warehouses, warehouseId])

  useEffect(() => {
    if (customer?.payment_term_id) setTermId(customer.payment_term_id)
    else if (termId == null) setTermId(refs.terms.find((t) => t.is_default)?.id ?? null)
  }, [customer, refs.terms, termId])

  // Mijoz toifasi bo'yicha narxlar
  useEffect(() => {
    if (!tierId) { setPriceMap(new Map()); return }
    let alive = true
    void supabase.from('ip_current_prices').select('product_id, price').eq('tier_id', tierId)
      .then(({ data }) => {
        if (!alive) return
        const m = new Map<number, number>()
        for (const r of (data ?? []) as { product_id: number; price: number }[]) {
          m.set(r.product_id, Number(r.price))
        }
        setPriceMap(m)
      })
    return () => { alive = false }
  }, [tierId])

  function setLine(key: string, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  async function pickProduct(key: string, productId: number) {
    const p = priceMap.get(productId) ?? 0
    setLine(key, { product_id: productId, price: p ? String(p) : '', list_price: p })
    if (p && warehouseId) await checkMargin(key, productId, p)
  }

  async function checkMargin(key: string, productId: number, price: number) {
    if (!warehouseId || !price) return
    const { data } = await supabase.rpc('ip_margin_preview', {
      p_product: productId, p_warehouse: warehouseId, p_price: price, p_tier: tierId,
    })
    const r = data as { margin_pct: number | null; min_margin_pct: number | null; no_cost: boolean } | null
    if (r) setLine(key, { margin: r.margin_pct, minMargin: r.min_margin_pct, noCost: r.no_cost })
  }

  const valid = lines.filter((l) => l.product_id && Number(l.qty) > 0 && Number(l.price) > 0)
  const total = valid.reduce((a, l) => a + Number(l.qty) * Number(l.price), 0)
  const belowMin = valid.filter((l) => l.margin != null && l.minMargin != null && l.margin < l.minMargin)
  const bigSale = total >= n('large_sale_approval_amount', 0) && n('large_sale_approval_amount', 0) > 0

  async function submit() {
    if (!customerId || !warehouseId) { setErr('Mijoz va ombor tanlanmagan'); return }
    if (valid.length === 0) { setErr('Birorta tovar kiritilmagan'); return }

    setBusy(true); setErr('')
    try {
      const { data: sale, error: e1 } = await supabase.rpc('ip_create_sale', {
        p_customer: customerId, p_warehouse: warehouseId,
        p_doc_date: docDate, p_term_id: termId,
      })
      if (e1) throw new Error(e1.message)
      const saleId = (sale as Sale).id

      await supabase.from('ip_sales').update({
        shipment_mode: shipNow ? 'immediate' : 'deferred',
        note: note.trim() || null,
      } as never).eq('id', saleId)

      const { error: e2 } = await supabase.from('ip_sale_items').insert(
        valid.map((l) => ({
          sale_id: saleId,
          product_id: l.product_id,
          qty: Number(l.qty),
          price: Number(l.price),
          list_price: l.list_price || Number(l.price),
          discount_pct: l.list_price > 0
            ? Number((((l.list_price - Number(l.price)) / l.list_price) * 100).toFixed(3))
            : 0,
        })) as never,
      )
      if (e2) throw new Error(e2.message)

      const { data: res, error: e3 } = await supabase.rpc('ip_submit_sale', { p_sale_id: saleId })
      if (e3) throw new Error(e3.message)

      setResult(res as { status: string; reasons?: string[]; margin_pct?: number })
    } catch (e) {
      setErr(translateDbError(e instanceof Error ? e.message : 'Xato'))
    } finally { setBusy(false) }
  }

  if (refs.loading || custLoading || prodLoading) {
    return <Modal open onClose={onClose} title="Yangi sotuv"><Loading /></Modal>
  }

  /* Natija ekrani */
  if (result) {
    const pending = result.status === 'pending'
    return (
      <Modal
        open onClose={onDone} width={520}
        title={pending ? 'Tasdiqqa yuborildi' : 'Sotuv postlandi'}
        footer={<Button variant="primary" onClick={onDone}>Yopish</Button>}
      >
        <div className="space-y-3">
          {pending ? (
            <>
              <InfoBox tone="warn">
                Sotuv ta'sischi tasdig'ini kutmoqda. <b>Tasdiqlanmaguncha tovar
                ombordan yechilmaydi.</b>
              </InfoBox>
              <div>
                <div className="mb-1 text-[13px] font-medium">Sabab:</div>
                <ul className="ml-4 list-disc space-y-1 text-[13px]" style={{ color: 'var(--text-2)' }}>
                  {(result.reasons ?? []).map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            </>
          ) : (
            <InfoBox tone="ok">
              Sotuv postlandi, tovar ombordan yechildi.
              {result.margin_pct != null && <> Marja: <b>{pct(result.margin_pct)}</b>.</>}
            </InfoBox>
          )}
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      open onClose={onClose} width={900} title="Yangi sotuv"
      footer={
        <>
          <Button onClick={onClose}>Bekor</Button>
          <Button variant="primary" loading={busy} onClick={submit} disabled={valid.length === 0}>
            <Send size={14} />Topshirish
          </Button>
        </>
      }
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
              value={warehouseId ?? ''} onChange={(v) => setWarehouseId(v ? Number(v) : null)}
              options={refs.warehouses.map((w) => ({ value: w.id, label: w.name }))}
            />
          </Field>
          <Field label="Sana"><Input type="date" value={docDate} onChange={setDocDate} /></Field>
          <Field label="To'lov muddati">
            <Select
              value={termId ?? ''} onChange={(v) => setTermId(v ? Number(v) : null)}
              placeholder="—" options={refs.terms.map((t) => ({ value: t.id, label: t.name }))}
            />
          </Field>
        </div>

        {customer && (
          <div className="flex flex-wrap items-center gap-2 text-[12.5px]" style={{ color: 'var(--text-2)' }}>
            <Badge tone="brand">
              {refs.tiers.find((t) => t.id === tierId)?.name ?? 'toifa yo\'q'}
            </Badge>
            {customer.credit_limit != null && customer.credit_limit > 0 && (
              <span>Kredit limiti: {money(customer.credit_limit)}</span>
            )}
            {priceMap.size === 0 && (
              <span style={{ color: 'var(--warn)' }}>
                Bu toifa uchun narx ro'yxati bo'sh — narxni qo'lda kiriting
              </span>
            )}
          </div>
        )}

        {/* Qatorlar */}
        <div>
          <div className="mb-2 text-[13px] font-medium">Tovarlar</div>
          <Table minWidth={760}>
            <thead>
              <tr>
                <Th>Tovar</Th>
                <Th w={110} align="right">Miqdor</Th>
                <Th w={150} align="right">Narx</Th>
                <Th w={140} align="right">Summa</Th>
                <Th w={110} align="center">Marja</Th>
                <Th w={44} />
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const sum = Number(l.qty) * Number(l.price)
                const low = l.margin != null && l.minMargin != null && l.margin < l.minMargin
                const discounted = l.list_price > 0 && Number(l.price) < l.list_price
                return (
                  <Tr key={l.key}>
                    <Td>
                      <Select
                        value={l.product_id ?? ''}
                        onChange={(v) => v && void pickProduct(l.key, Number(v))}
                        placeholder="Tovarni tanlang…"
                        options={products.map((p) => ({
                          value: p.id,
                          label: p.code ? `${p.code} — ${p.name}` : p.name,
                        }))}
                      />
                    </Td>
                    <Td>
                      <Input
                        type="number" className="text-right" value={l.qty}
                        onChange={(v) => setLine(l.key, { qty: v })}
                      />
                    </Td>
                    <Td>
                      <Input
                        type="number" className="text-right" value={l.price}
                        onChange={(v) => {
                          setLine(l.key, { price: v })
                          if (l.product_id && Number(v) > 0) void checkMargin(l.key, l.product_id, Number(v))
                        }}
                      />
                      {discounted && (
                        <div className="mt-0.5 text-right text-[11.5px]" style={{ color: 'var(--warn)' }}>
                          ro'yxatda {money(l.list_price, false)}
                        </div>
                      )}
                    </Td>
                    <Td align="right" mono>{sum > 0 ? money(sum, false) : '—'}</Td>
                    <Td align="center">
                      {l.noCost ? <Badge tone="neutral">tan narx yo'q</Badge>
                        : l.margin == null ? <span style={{ color: 'var(--text-3)' }}>—</span>
                        : <Badge tone={low ? 'danger' : l.margin < (l.minMargin ?? 0) + 3 ? 'warn' : 'ok'}>
                            {pct(l.margin)}
                          </Badge>}
                    </Td>
                    <Td align="center">
                      <Button
                        size="sm" variant="ghost"
                        onClick={() => setLines((ls) => ls.length > 1 ? ls.filter((x) => x.key !== l.key) : ls)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </Td>
                  </Tr>
                )
              })}
            </tbody>
          </Table>

          <div className="mt-2 flex items-center justify-between gap-3">
            <Button size="sm" onClick={() => setLines((ls) => [...ls, newLine()])}>
              <Plus size={14} />Qator
            </Button>
            <div className="text-right">
              <div className="text-[12px]" style={{ color: 'var(--text-3)' }}>Jami</div>
              <div className="tnum text-[18px] font-semibold">{money(total)}</div>
            </div>
          </div>
        </div>

        {/* Ogohlantirishlar */}
        {belowMin.length > 0 && (
          <InfoBox tone="warn">
            <span className="flex items-start gap-2">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <span>
                {belowMin.length} ta qatorda marja minimal darajadan past.
                Topshirsangiz sotuv <b>ta'sischi tasdig'iga</b> ketadi.
              </span>
            </span>
          </InfoBox>
        )}
        {bigSale && (
          <InfoBox tone="info">
            Summa katta sotuv chegarasidan ({money(n('large_sale_approval_amount'))}) yuqori —
            tasdiqlash so'raladi.
          </InfoBox>
        )}

        <div
          className="rounded-lg border p-3"
          style={{ borderColor: shipNow ? 'var(--border-2)' : 'var(--warn)' }}
        >
          <Toggle
            checked={shipNow} onChange={setShipNow}
            label={shipNow ? 'Yuk hozir chiqadi' : 'Yuk keyin chiqadi'}
          />
          <p className="mt-1.5 text-[12px]" style={{ color: 'var(--text-3)' }}>
            {shipNow
              ? 'Tovar darhol ombordan yechiladi, tan narx va marja aniq hisoblanadi.'
              : "Tovar band qilinadi — boshqa sotuvda mavjud emas deb hisoblanadi. Keyin 'Yukni chiqarish' tugmasi bilan chiqariladi."}
          </p>
        </div>

        <Field label="Izoh">
          <Textarea value={note} onChange={setNote} rows={2} placeholder="Ixtiyoriy" />
        </Field>

        {err && <ErrorBox>{err}</ErrorBox>}
      </div>
    </Modal>
  )
}

function newLine(): Line {
  return {
    key: Math.random().toString(36).slice(2),
    product_id: null, qty: '', price: '', list_price: 0,
    margin: null, minMargin: null, noCost: false,
  }
}
