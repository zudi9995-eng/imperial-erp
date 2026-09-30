import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Plus, Search, Download, Truck, Wallet, X as XIcon, Printer,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useRefs, translateDbError } from '../lib/useRefs'
import type { SaleBoardRow } from '../lib/types'
import {
  Button, Card, Empty, ErrorBox, Input, Loading, PageHeader, Select,
} from '../components/ui'
import {
  DocTable, DocTd, DocTh, DocTr, MarkLegend, StatusDot, ToneLegend,
  type Mark, type RowTone,
} from '../components/docList'
import { dateShort, isoDate, money, moneyShort, monthStart, num, pct } from '../lib/format'
import { SalesTotals, exportSalesCsv } from '../components/SaleIndicators'
import OrdersTab from '../components/OrdersTab'
import ReturnsTab from '../components/ReturnsTab'
import { printManySaleDocs } from '../components/printDoc'
import { useWindows, useSignal } from '../lib/windows'
import { useSettings } from '../lib/settings'


export default function Sales() {
  const { profile, can } = useAuth()
  const refs = useRefs()
  const [tab, setTab] = useState<'sales' | 'orders' | 'returns'>('sales')
  const [sel, setSel] = useState<Set<number>>(new Set())
  const [printing, setPrinting] = useState(false)
  const [rows, setRows] = useState<SaleBoardRow[]>([])
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(isoDate())
  const [status, setStatus] = useState('')
  const [mgr, setMgr] = useState('')
  const [quick, setQuick] = useState<'' | 'unpaid' | 'overdue' | 'unshipped' | 'pending'>('')
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [params, setParams] = useSearchParams()
  const presetCustomer = params.get('customer')
  const { s: sset } = useSettings()
  const companyName = sset('company_name', '')
  const { open } = useWindows()
  const salesSignal = useSignal('sales')

  /** O'tkazilgan sotuv kartochkasi — to'lov, yuk, qaytarish */
  const openSale = useCallback((id: number, name?: string, no?: string | null) => {
    open({
      kind: 'sale', key: `sale:${id}`,
      title: name ? `Sotuv · ${name.slice(0, 22)}` : 'Sotuv',
      subtitle: no ?? undefined,
      params: { id },
    })
  }, [open])

  /** Sotuv hujjati formasi — yangi yoki qoralama */
  const openSaleForm = useCallback((o: {
    saleId?: number | null; customerId?: number | null; name?: string; no?: string | null
  }) => {
    open({
      kind: 'sale-edit',
      key: o.saleId ? `sale-edit:${o.saleId}` : 'sale-edit:new',
      title: o.name ? `Sotuv · ${o.name.slice(0, 22)}` : 'Sotuv (yaratish)',
      subtitle: o.no ?? undefined,
      params: { saleId: o.saleId ?? null, customerId: o.customerId ?? null },
    })
  }, [open])

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

  useEffect(() => { void load() }, [load, salesSignal])

  // Mijoz kartochkasidan "sotuv yaratish" bilan kelingan
  useEffect(() => {
    if (!presetCustomer) return
    openSaleForm({ customerId: Number(presetCustomer) })
    setParams({}, { replace: true })
  }, [presetCustomer, openSaleForm, setParams])

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

  async function printSelected(kind: 'waybill' | 'invoice') {
    const ids = [...sel]
    if (ids.length === 0) return
    setPrinting(true)
    try {
      const { data } = await supabase.from('ip_sale_items')
        .select('*, product:ip_products(name, code, unit_id)')
        .in('sale_id', ids).order('sale_id').order('id')
      const byId = new Map<number, typeof data>()
      for (const it of (data ?? []) as { sale_id: number }[]) {
        const arr = byId.get(it.sale_id) ?? []
        arr.push(it as never)
        byId.set(it.sale_id, arr as never)
      }
      const docs = rows.filter((r) => sel.has(r.id))
        .map((r) => ({ sale: r, items: (byId.get(r.id) ?? []) as never }))
      printManySaleDocs(docs, { ...refs, company: companyName }, kind)
    } finally { setPrinting(false) }
  }

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
              <Button variant="primary" size="sm" onClick={() => openSaleForm({})}>
                <Plus size={14} />Yangi sotuv
              </Button>
            )}
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {([
          { k: 'sales',   l: 'Sotuv' },
          { k: 'orders',  l: 'Buyurtma' },
          { k: 'returns', l: 'Qaytarish' },
        ] as { k: typeof tab; l: string }[]).map((t) => (
          <button
            key={t.k} onClick={() => setTab(t.k)}
            className="rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors"
            style={{
              background: tab === t.k ? 'var(--brand-soft)' : 'var(--surface)',
              color: tab === t.k ? 'var(--brand)' : 'var(--text-2)',
              borderColor: tab === t.k ? 'var(--brand)' : 'var(--border-2)',
            }}
          >
            {t.l}
          </button>
        ))}
      </div>

      {tab === 'orders'  && <OrdersTab onOpenSale={(id) => openSale(id)} />}
      {tab === 'returns' && <ReturnsTab />}

      {tab === 'sales' && <>

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

      {sel.size > 0 && (
        <div
          className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2"
          style={{ background: 'var(--brand-soft)', borderColor: 'var(--brand)' }}
        >
          <span className="text-[13px] font-medium" style={{ color: 'var(--brand)' }}>
            {sel.size} ta hujjat belgilandi
          </span>
          <Button size="sm" loading={printing} onClick={() => void printSelected('waybill')}>
            <Printer size={14} />Yuk xatlari
          </Button>
          <Button size="sm" loading={printing} onClick={() => void printSelected('invoice')}>
            <Printer size={14} />Hisob-fakturalar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSel(new Set())}>
            <XIcon size={13} />Bekor
          </Button>
        </div>
      )}

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
                ? <Button variant="primary" onClick={() => openSaleForm({})}><Plus size={14} />Yangi sotuv</Button>
                : undefined}
            />
          ) : (
            <>
              <DocTable minWidth={1140}>
                <thead>
                  <tr>
                    <DocTh w={30} align="center">
                      <input
                        type="checkbox"
                        checked={sel.size > 0 && sel.size === filtered.length}
                        onChange={(e) => setSel(e.target.checked
                          ? new Set(filtered.map((r) => r.id)) : new Set())}
                      />
                    </DocTh>
                    <DocTh w={28} align="center"><Truck size={13} /></DocTh>
                    <DocTh w={28} align="center"><Wallet size={13} /></DocTh>
                    <DocTh w={92}>Sana</DocTh>
                    <DocTh w={118} sorted="desc">Hujjat</DocTh>
                    <DocTh w={132}>Holat</DocTh>
                    <DocTh>Mijoz</DocTh>
                    {can('view.hr') && <DocTh w={120}>Menejer</DocTh>}
                    <DocTh w={130} align="right">Summa</DocTh>
                    {can('cost.view') && <DocTh w={70} align="right">Marja</DocTh>}
                    <DocTh w={120} align="right">Qarz</DocTh>
                    <DocTh w={92}>Muddat</DocTh>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => {
                    const s = saleState(r)
                    const checked = sel.has(r.id)
                    return (
                      <DocTr
                        key={r.id}
                        alt={i % 2 === 1}
                        selected={checked}
                        tone={s.tone}
                        onClick={() => r.status === 'draft'
                          ? openSaleForm({ saleId: r.id, name: r.customer_name, no: r.doc_no })
                          : openSale(r.id, r.customer_name, r.doc_no)}
                      >
                        <DocTd align="center" stopClick>
                          <input
                            type="checkbox" checked={checked}
                            onChange={(e) => setSel((prev) => {
                              const n = new Set(prev)
                              if (e.target.checked) n.add(r.id); else n.delete(r.id)
                              return n
                            })}
                          />
                        </DocTd>
                        <DocTd align="center">
                          <StatusDot mark={s.ship} title={s.shipTitle} />
                        </DocTd>
                        <DocTd align="center">
                          <StatusDot mark={s.pay} title={s.payTitle} />
                        </DocTd>
                        <DocTd mono>{dateShort(r.doc_date)}</DocTd>
                        <DocTd mono>{r.doc_no ?? `#${r.id}`}</DocTd>
                        <DocTd>
                          {s.label}
                          {r.source === 'opening' && (
                            <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>
                              1C qoldig'i
                            </div>
                          )}
                        </DocTd>
                        <DocTd tone="link">
                          {r.customer_name}
                          {r.delivery_address && (
                            <div className="line-clamp-1 text-[11.5px]"
                                 style={{ color: 'var(--text-3)' }}>
                              {r.delivery_address}
                            </div>
                          )}
                        </DocTd>
                        {can('view.hr') && <DocTd tone="link">{r.manager_name ?? '—'}</DocTd>}
                        <DocTd align="right" mono>
                          {money(r.net_base, false)}
                          {Number(r.returned_base) > 0 && (
                            <div className="text-[11px]" style={{ color: 'var(--warn)' }}>
                              qaytgan {moneyShort(r.returned_base)}
                            </div>
                          )}
                        </DocTd>
                        {can('cost.view') && (
                          <DocTd align="right" mono>
                            {r.margin_pct != null ? (
                              <span style={{
                                color: Number(r.margin_pct) < 10 ? 'var(--danger)'
                                  : Number(r.margin_pct) < 15 ? 'var(--warn)' : 'var(--ok)',
                              }}>{pct(r.margin_pct)}</span>
                            ) : '—'}
                          </DocTd>
                        )}
                        <DocTd align="right" mono>
                          {Number(r.due_base) > 0 ? money(r.due_base, false) : '—'}
                        </DocTd>
                        <DocTd mono tone={r.is_overdue ? 'danger' : 'normal'}>
                          {r.due_date ? dateShort(r.due_date) : '—'}
                          {r.is_overdue && (
                            <div className="text-[11px]" style={{ color: 'var(--danger)' }}>
                              {r.overdue_days} kun
                            </div>
                          )}
                        </DocTd>
                      </DocTr>
                    )
                  })}
                </tbody>
              </DocTable>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3"
                   style={{ borderColor: 'var(--border)' }}>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                  <MarkLegend items={[
                    { mark: 'full',  label: 'bajarilgan' },
                    { mark: 'half',  label: 'qisman' },
                    { mark: 'empty', label: 'bajarilmagan' },
                  ]} />
                  <ToneLegend />
                </div>
              </div>
              <div className="mt-3"><SalesTotals rows={filtered} /></div>
            </>
          )}
        </div>
      </Card>

      </>}

    </div>
  )
}

/**
 * Sotuv hujjatining 1C uslubidagi holati: qator rangi, ikkita doira va
 * ularning izohi. 1C da ham qator rangi «Состояние» ga bog'langan.
 */
function saleState(r: SaleBoardRow): {
  label: string
  tone: RowTone
  ship: Mark
  pay: Mark
  shipTitle: string
  payTitle: string
} {
  const net = Number(r.net_base)
  const paid = Number(r.paid_base)

  // Yuk
  let ship: Mark = 'empty'
  let shipTitle = 'Yuk chiqmagan'
  if (r.status === 'cancelled' || r.status === 'draft') { ship = 'none'; shipTitle = '—' }
  else if (r.shipment_status === 'shipped') { ship = 'full'; shipTitle = 'Yuk chiqarilgan' }
  else if (r.shipment_status === 'partial') {
    ship = 'half'
    shipTitle = `Qisman chiqarilgan: ${num(r.qty_shipped, 2)} / ${num(r.qty_total, 2)}`
  }

  // To'lov
  let pay: Mark = 'empty'
  let payTitle = "To'lov yo'q"
  if (r.status === 'cancelled' || r.status === 'draft') { pay = 'none'; payTitle = '—' }
  else if (net <= 0 || paid >= net) { pay = 'full'; payTitle = "To'liq to'langan" }
  else if (paid > 0) {
    pay = 'half'
    payTitle = `Qisman to'langan: qarz ${money(r.due_base)}`
  }

  // Holat
  if (r.status === 'cancelled') {
    return { label: 'Bekor qilingan', tone: 'muted', ship, pay, shipTitle, payTitle }
  }
  if (r.approval_status === 'rejected') {
    return { label: 'Rad etildi', tone: 'muted', ship, pay, shipTitle, payTitle }
  }
  if (r.approval_status === 'pending') {
    return { label: 'Tasdiq kutmoqda', tone: 'attention', ship, pay, shipTitle, payTitle }
  }
  if (r.status === 'draft') {
    return { label: 'Qoralama', tone: 'attention', ship, pay, shipTitle, payTitle }
  }
  if (ship === 'full' && pay === 'full') {
    return { label: 'Yakunlangan', tone: 'normal', ship, pay, shipTitle, payTitle }
  }
  return { label: 'Ishlanmoqda', tone: 'active', ship, pay, shipTitle, payTitle }
}
