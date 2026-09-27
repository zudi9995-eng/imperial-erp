import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Plus, Copy, Check, Ban, FolderOpen, Search, Filter,
  RefreshCw, X as XIcon, FileText, Truck, Wallet,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useRefs, translateDbError } from '../lib/useRefs'
import { Button, Card, Empty, ErrorBox, Field, Loading, Select } from './ui'
import {
  DocTable, DocTd, DocTh, DocToolbar, DocTr, MarkLegend, StatusDot, ToneLegend,
  type Mark, type RowTone,
} from './docList'
import { useWindows, useSignal } from '../lib/windows'
import { dateShort, money, num } from '../lib/format'

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

/** 1C dagi "Состояние" ustuni — qator rangini ham shu belgilaydi */
const STATE: Record<string, { label: string; tone: RowTone }> = {
  new:         { label: 'Ishlanmagan',    tone: 'attention' },
  confirmed:   { label: 'Band qilindi',   tone: 'active' },
  in_progress: { label: 'Ishlanmoqda',    tone: 'active' },
  done:        { label: 'Yakunlangan',    tone: 'normal' },
  cancelled:   { label: 'Bekor qilingan', tone: 'muted' },
}

export default function OrdersTab({ onOpenSale }: { onOpenSale: (id: number) => void }) {
  const { can } = useAuth()
  const [rows, setRows] = useState<OrderRow[]>([])
  const [q, setQ] = useState('')
  const [st, setSt] = useState('')
  const [sel, setSel] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [showFilter, setShowFilter] = useState(false)
  const { open } = useWindows()
  const ordersSignal = useSignal('orders')

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('ip_orders_board').select('*')
      .order('doc_date', { ascending: false }).order('id', { ascending: false }).limit(500)
    if (error) setErr(translateDbError(error.message))
    else setErr('')
    setRows((data as OrderRow[]) ?? [])
    setLoading(false)
  }, [])

  // Oyna yashiringan bo'lsa ham qayta yuklanadi — qaytganingizda ro'yxat yangi
  useEffect(() => { void load() }, [load, ordersSignal])

  /** Hujjatni alohida oynada ochadi (1C dagidek) */
  const openOrder = useCallback((o: {
    orderId: number | null; copyFromId?: number | null; name?: string; no?: string | null
  }) => {
    const key = o.orderId ? `order:${o.orderId}`
      : o.copyFromId ? `order:copy:${o.copyFromId}`
      : 'order:new'
    open({
      kind: 'order', key,
      title: o.name ? `Buyurtma · ${o.name.slice(0, 22)}` : 'Buyurtma (yaratish)',
      subtitle: o.no ?? undefined,
      params: { orderId: o.orderId, copyFromId: o.copyFromId ?? null },
    })
  }, [open])

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
              <Button size="sm" variant="primary" onClick={() => openOrder({ orderId: null })}>
                <Plus size={14} />Yaratish
              </Button>
            )}
            <Button
              size="sm" disabled={!current} title="Ochish (yoki qatorni ikki marta bosing)"
              onClick={() => current && openOrder({ orderId: current.id, name: current.customer_name, no: current.doc_no })}
            >
              <FolderOpen size={14} />Ochish
            </Button>
            <Button
              size="sm" disabled={!current} title="Nusxasini yaratish"
              onClick={() => current && openOrder({ orderId: null, copyFromId: current.id, name: current.customer_name })}
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
                ? <Button variant="primary" onClick={() => openOrder({ orderId: null })}><Plus size={14} />Yaratish</Button>
                : undefined}
            />
          ) : (
            <>
              <DocTable minWidth={1120}>
                <thead>
                  <tr>
                    <DocTh w={28} align="center"><Truck size={13} /></DocTh>
                    <DocTh w={28} align="center"><Wallet size={13} /></DocTh>
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
                  {filtered.map((r, i) => {
                    const state = STATE[r.state] ?? STATE.new
                    return (
                      <DocTr
                        key={r.id}
                        alt={i % 2 === 1}
                        selected={sel === r.id}
                        tone={state.tone}
                        onClick={() => setSel(sel === r.id ? null : r.id)}
                        onDoubleClick={() => { setSel(r.id); openOrder({ orderId: r.id, name: r.customer_name, no: r.doc_no }) }}
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
                        <DocTd mono>{r.doc_no ?? `#${r.id}`}</DocTd>
                        <DocTd>
                          {state.label}
                          {(r.is_expired || r.is_overdue) && (
                            <span className="ml-1.5 text-[11px]" style={{ color: 'var(--danger)' }}>
                              {r.is_expired ? "muddati o'tgan" : 'qarz kechikkan'}
                            </span>
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
          <OrderPreview row={current} onOpenSale={onOpenSale} onEdit={() => openOrder({ orderId: current.id, name: current.customer_name, no: current.doc_no })} />
        </div>
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
