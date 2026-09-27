import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown, ArrowUp, Ban, Check, ListPlus, Plus, Printer, Save, Trash2,
  X as XIcon,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useSettings } from '../lib/settings'
import { useCustomers, useProducts, useRefs, translateDbError } from '../lib/useRefs'
import type { Product, Sale } from '../lib/types'
import { ErrorBox, InfoBox, Loading } from './ui'
import {
  BarSep, CellInput, DocBarButton, DocCommandBar, DocField, DocFooter, DocInput,
  DocMainButton, DocNav, DocSelect, DocTabs, DocTitleBar, DocWindow, TotalsBox,
} from './docForm'
import { ProductCombo, ProductPickerModal, type PickCtx, type PickedLine } from './ProductPick'
import { isoDate, money, num, pct } from '../lib/format'
import { printSaleDoc } from './printDoc'
import { useWindowSelf } from '../lib/windows'
import DocHistory from './DocHistory'
import CustomerSnapshot from './CustomerSnapshot'

/**
 * Mijozga sotuv — 1C «Реализация» / «Заказ покупателя» formasi uslubida.
 * Buyurtma formasi bilan bir xil joylashuv, farqi: chegirma va marja
 * ustunlari bor, saqlash o'rniga "o'tkazish" tovarni ombordan yechadi.
 */

type Line = {
  key: string
  product_id: number | null
  qty: string
  price: string
  /** Narx ro'yxatidagi narx — chegirma shundan hisoblanadi */
  list_price: number
  margin: number | null
  minMargin: number | null
  noCost: boolean
  /** QQS stavkasi — sozlamadan keladi, qatorda o'zgartirsa bo'ladi */
  vat_pct: number
}

const newLine = (): Line => ({
  key: Math.random().toString(36).slice(2),
  product_id: null, qty: '', price: '',
  list_price: 0, margin: null, minMargin: null, noCost: false, vat_pct: 0,
})

type Tab = 'items' | 'delivery' | 'extra'
type Section = 'main' | 'history' | 'reports'

interface Balance {
  debt_base: number
  overdue_base: number
  max_overdue_days: number
}

export default function SaleForm({
  winKey, saleId, presetCustomerId, onClose, onSaved, onPosted,
}: {
  winKey?: string
  /** Tahrirlanayotgan qoralama; yangi hujjat uchun null */
  saleId: number | null
  presetCustomerId?: number | null
  onClose: () => void
  onSaved: () => void
  /** Hujjat o'tkazilgandan keyin — kartochkasini ochish uchun */
  onPosted: (saleId: number) => void
}) {
  const self = useWindowSelf(winKey)
  const { can, profile } = useAuth()
  const refs = useRefs()
  const { customers, loading: custLoading } = useCustomers()
  const { products, loading: prodLoading } = useProducts()
  const { n, b } = useSettings()
  const vatOn = b('vat_enabled', true)
  const vatRate = vatOn ? n('vat_rate', 0) : 0

  const [id, setId] = useState<number | null>(saleId)
  const [docNo, setDocNo] = useState<string | null>(null)
  const [status, setStatus] = useState<'draft' | 'posted' | 'cancelled'>('draft')

  const [customerId, setCustomerId] = useState<number | null>(presetCustomerId ?? null)
  const [contractId, setContractId] = useState<number | null>(null)
  const [warehouseId, setWarehouseId] = useState<number | null>(null)
  const [termId, setTermId] = useState<number | null>(null)
  const [docDate, setDocDate] = useState(isoDate())
  const [note, setNote] = useState('')
  const [shipNow, setShipNow] = useState(true)
  const [address, setAddress] = useState('')
  const [driver, setDriver] = useState('')
  const [vehicle, setVehicle] = useState('')
  const [lines, setLines] = useState<Line[]>([newLine()])

  const [priceMap, setPriceMap] = useState<Map<number, number>>(new Map())
  const [stock, setStock] = useState<Map<number, number>>(new Map())
  const [balance, setBalance] = useState<Balance | null>(null)
  const [contracts, setContracts] = useState<{ id: number; number: string }[]>([])

  const [tab, setTab] = useState<Tab>('items')
  const [section, setSection] = useState<Section>('main')
  const [loading, setLoading] = useState(Boolean(saleId))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [dirty, setDirty] = useState(false)
  const [picking, setPicking] = useState(false)
  const [selRow, setSelRow] = useState<string | null>(null)

  const customer = customers.find((c) => c.id === customerId) ?? null
  const tierId = customer?.tier_id ?? refs.tiers.find((t) => t.is_default)?.id ?? null
  const readOnly = status !== 'draft'
  const showMargin = can('cost.view')

  function touch() { setDirty(true); setOk('') }

  /* ---------------------------------------------- standart qiymatlar */

  useEffect(() => {
    if (warehouseId == null && refs.warehouses.length) {
      setWarehouseId((refs.warehouses.find((w) => w.is_default) ?? refs.warehouses[0]).id)
    }
  }, [refs.warehouses, warehouseId])

  useEffect(() => {
    if (customer?.payment_term_id) setTermId(customer.payment_term_id)
    else if (termId == null) setTermId(refs.terms.find((t) => t.is_default)?.id ?? null)
  }, [customer, refs.terms, termId])

  useEffect(() => {
    if (!customerId || address) return
    if (customer?.address) setAddress(customer.address)
  }, [customer, customerId, address])

  /* ---------------------------------------------- mavjud qoralama */

  useEffect(() => {
    if (!saleId) { setLoading(false); return }
    let alive = true
    void Promise.all([
      supabase.from('ip_sales').select('*').eq('id', saleId).single(),
      supabase.from('ip_sale_items').select('*').eq('sale_id', saleId).order('id'),
    ]).then(([a, b]) => {
      if (!alive || !a.data) { setLoading(false); return }
      const s = a.data as Sale & {
        shipment_mode?: string; doc_no: string | null; contract_id: number | null
        delivery_address: string | null; delivery_driver: string | null
        delivery_vehicle: string | null
      }
      setId(s.id)
      setDocNo(s.doc_no)
      setStatus(s.status as typeof status)
      setCustomerId(s.customer_id)
      setContractId(s.contract_id)
      setWarehouseId(s.warehouse_id)
      setTermId(s.payment_term_id)
      setDocDate(s.doc_date)
      setNote(s.note ?? '')
      setShipNow((s.shipment_mode ?? 'immediate') !== 'deferred')
      setAddress(s.delivery_address ?? '')
      setDriver(s.delivery_driver ?? '')
      setVehicle(s.delivery_vehicle ?? '')
      const rows = (b.data as {
        product_id: number; qty: number; price: number; list_price: number; vat_pct: number
      }[]) ?? []
      setLines(rows.length
        ? rows.map((r) => ({
            key: Math.random().toString(36).slice(2),
            product_id: r.product_id, qty: String(r.qty), price: String(r.price),
            list_price: Number(r.list_price), margin: null, minMargin: null, noCost: false,
            vat_pct: Number(r.vat_pct ?? 0),
          }))
        : [newLine()])
      setLoading(false)
    })
    return () => { alive = false }
  }, [saleId])

  /* ---------------------------------------------- yordamchi ma'lumot */

  useEffect(() => {
    if (!customerId) { setContracts([]); setBalance(null); return }
    let alive = true
    void Promise.all([
      supabase.from('ip_contracts').select('id, number')
        .eq('customer_id', customerId).eq('is_active', true)
        .order('signed_at', { ascending: false }),
      supabase.from('ip_customer_balance')
        .select('debt_base, overdue_base, max_overdue_days')
        .eq('customer_id', customerId).maybeSingle(),
    ]).then(([c, b]) => {
      if (!alive) return
      setContracts((c.data as never) ?? [])
      setBalance((b.data as Balance | null) ?? null)
    })
    return () => { alive = false }
  }, [customerId])

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

  useEffect(() => {
    if (!warehouseId) { setStock(new Map()); return }
    let alive = true
    void supabase.rpc('ip_stock_available_rows', { p_warehouse: warehouseId })
      .then(({ data }) => {
        if (!alive) return
        const m = new Map<number, number>()
        for (const r of (data ?? []) as { product_id: number; qty_available: number }[]) {
          m.set(r.product_id, Number(r.qty_available))
        }
        setStock(m)
      })
    return () => { alive = false }
  }, [warehouseId])

  /* ---------------------------------------------- hisob-kitob */

  const unitOf = useCallback(
    (uid: number | null | undefined) => refs.units.find((u) => u.id === uid)?.code ?? '',
    [refs.units],
  )
  const categoryOf = useCallback(
    (cid: number | null | undefined) => refs.categories.find((c) => c.id === cid)?.name ?? '',
    [refs.categories],
  )
  const productOf = useCallback(
    (pid: number | null) => (pid ? products.find((p) => p.id === pid) ?? null : null),
    [products],
  )

  const pickCtx: PickCtx = useMemo(
    () => ({ products, stock, prices: priceMap, unitOf, categoryOf }),
    [products, stock, priceMap, unitOf, categoryOf],
  )

  const valid = lines.filter((l) => l.product_id && Number(l.qty) > 0 && Number(l.price) > 0)
  const total = valid.reduce((a, l) => a + Number(l.qty) * Number(l.price), 0)
  const qtyTotal = valid.reduce((a, l) => a + Number(l.qty), 0)
  const listTotal = valid.reduce((a, l) => a + Number(l.qty) * (l.list_price || Number(l.price)), 0)
  // QQS narx ichida: summadan ajratib olinadi
  const vatTotal = valid.reduce((a, l) => {
    const line = Number(l.qty) * Number(l.price)
    return a + line * l.vat_pct / (100 + l.vat_pct)
  }, 0)
  const exVatTotal = total - vatTotal
  const discountTotal = Math.max(0, listTotal - total)
  const belowMin = valid.filter(
    (l) => l.margin != null && l.minMargin != null && l.margin < l.minMargin)
  const approvalAmount = n('large_sale_approval_amount', 0)
  const bigSale = approvalAmount > 0 && total >= approvalAmount

  /* ---------------------------------------------- qator amallari */

  function patch(key: string, p: Partial<Line>) {
    setLines((ls) => ls.map((x) => (x.key === key ? { ...x, ...p } : x)))
    touch()
  }

  const checkMargin = useCallback(async (key: string, productId: number, price: number) => {
    if (!warehouseId || !price) return
    const { data } = await supabase.rpc('ip_margin_preview', {
      p_product: productId, p_warehouse: warehouseId, p_price: price, p_tier: tierId,
    })
    const r = data as {
      margin_pct: number | null; min_margin_pct: number | null; no_cost: boolean
    } | null
    if (!r) return
    setLines((ls) => ls.map((x) => (x.key === key
      ? { ...x, margin: r.margin_pct, minMargin: r.min_margin_pct, noCost: r.no_cost }
      : x)))
  }, [warehouseId, tierId])

  function pickProduct(key: string, productId: number) {
    const p = priceMap.get(productId) ?? 0
    setLines((ls) => ls.map((x) => (x.key === key
      ? { ...x, product_id: productId, list_price: p,
          price: p ? String(p) : x.price, qty: x.qty || '1',
          vat_pct: x.vat_pct || vatRate }
      : x)))
    touch()
    if (p) void checkMargin(key, productId, p)
  }

  function setPrice(key: string, v: string) {
    patch(key, { price: v })
    const l = lines.find((x) => x.key === key)
    if (l?.product_id && Number(v) > 0) void checkMargin(key, l.product_id, Number(v))
  }

  /** Chegirma foizini yozganda narx ro'yxat narxidan hisoblanadi — 1C dagidek */
  function setDiscount(key: string, v: string) {
    const l = lines.find((x) => x.key === key)
    if (!l || !l.list_price) return
    const d = Math.min(100, Math.max(0, Number(v) || 0))
    const price = Math.round(l.list_price * (1 - d / 100))
    patch(key, { price: String(price) })
    if (l.product_id && price > 0) void checkMargin(key, l.product_id, price)
  }

  function addLine() {
    const l = { ...newLine(), vat_pct: vatRate }
    setLines((ls) => [...ls, l])
    setSelRow(l.key)
    touch()
  }

  function removeLine(key: string) {
    setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== key) : [newLine()]))
    setSelRow(null)
    touch()
  }

  function moveLine(key: string, dir: -1 | 1) {
    setLines((ls) => {
      const i = ls.findIndex((x) => x.key === key)
      const j = i + dir
      if (i < 0 || j < 0 || j >= ls.length) return ls
      const nx = [...ls]
      ;[nx[i], nx[j]] = [nx[j], nx[i]]
      return nx
    })
    touch()
  }

  function applyPicked(picked: PickedLine[]) {
    setLines((ls) => {
      const kept = ls.filter((l) => l.product_id)
      const byId = new Map(kept.map((l) => [l.product_id!, l]))
      for (const p of picked) {
        const ex = byId.get(p.product_id)
        if (ex) ex.qty = String(Number(ex.qty || 0) + p.qty)
        else {
          const lp = p.price || priceMap.get(p.product_id) || 0
          const l: Line = {
            key: Math.random().toString(36).slice(2),
            product_id: p.product_id, qty: String(p.qty), price: String(lp),
            list_price: lp, margin: null, minMargin: null, noCost: false,
            vat_pct: vatRate,
          }
          kept.push(l)
          byId.set(p.product_id, l)
        }
      }
      return kept.length ? [...kept] : [newLine()]
    })
    setPicking(false)
    touch()
    for (const p of picked) {
      const price = p.price || priceMap.get(p.product_id) || 0
      const row = lines.find((x) => x.product_id === p.product_id)
      if (row && price) void checkMargin(row.key, p.product_id, price)
    }
  }

  /* ---------------------------------------------- saqlash */

  /** Qoralamani yozadi va id qaytaradi (o'tkazmaydi) */
  const write = useCallback(async (): Promise<number | null> => {
    if (!customerId) { setErr('Xaridor tanlanmagan'); return null }
    if (!warehouseId) { setErr('Ombor tanlanmagan'); return null }
    if (valid.length === 0) { setErr('Tovar kiritilmagan'); return null }
    setErr('')

    let sid = id
    const head = {
      customer_id: customerId, warehouse_id: warehouseId, contract_id: contractId,
      doc_date: docDate, payment_term_id: termId,
      shipment_mode: shipNow ? 'immediate' : 'deferred',
      note: note.trim() || null,
      delivery_address: address.trim() || null,
      delivery_driver: driver.trim() || null,
      delivery_vehicle: vehicle.trim() || null,
    }

    if (!sid) {
      const { data, error } = await supabase.rpc('ip_create_sale', {
        p_customer: customerId, p_warehouse: warehouseId,
        p_doc_date: docDate, p_term_id: termId,
      })
      if (error) throw new Error(error.message)
      const created = data as Sale & { doc_no: string | null }
      sid = created.id
      setId(created.id)
      setDocNo(created.doc_no)
    } else {
      await supabase.from('ip_sale_items').delete().eq('sale_id', sid)
    }

    const { error: e1 } = await supabase.from('ip_sales')
      .update(head as never).eq('id', sid)
    if (e1) throw new Error(e1.message)

    const { error: e2 } = await supabase.from('ip_sale_items').insert(
      valid.map((l) => ({
        sale_id: sid,
        product_id: l.product_id,
        qty: Number(l.qty),
        price: Number(l.price),
        list_price: l.list_price || Number(l.price),
        vat_pct: l.vat_pct,
        discount_pct: l.list_price > 0
          ? Number((((l.list_price - Number(l.price)) / l.list_price) * 100).toFixed(3))
          : 0,
      })) as never,
    )
    if (e2) throw new Error(e2.message)

    setDirty(false)
    return sid
  }, [customerId, warehouseId, contractId, docDate, termId, shipNow, note,
      address, driver, vehicle, valid, id])

  async function doWrite(close: boolean) {
    setBusy(true)
    try {
      const sid = await write()
      if (sid) { setOk('Qoralama yozildi'); onSaved(); if (close) onClose() }
    } catch (e) {
      setErr(translateDbError(e instanceof Error ? e.message : 'Xato'))
    } finally { setBusy(false) }
  }

  async function doPost(close: boolean) {
    setBusy(true)
    try {
      const sid = await write()
      if (!sid) return
      const { data, error } = await supabase.rpc('ip_submit_sale', { p_sale_id: sid })
      if (error) throw new Error(error.message)
      const res = data as { status: string; reasons?: string[]; margin_pct?: number }
      onSaved()

      if (res.status === 'pending') {
        setStatus('draft')
        setOk(`Tasdiqqa yuborildi. Sabab: ${(res.reasons ?? []).join('; ')}. `
          + "Tasdiqlanmaguncha tovar ombordan yechilmaydi.")
        return
      }
      setStatus('posted')
      setOk("Hujjat o'tkazildi, tovar ombordan yechildi."
        + (res.margin_pct != null ? ` Marja: ${pct(res.margin_pct)}.` : ''))
      if (close) { onPosted(sid); onClose() }
    } catch (e) {
      setErr(translateDbError(e instanceof Error ? e.message : 'Xato'))
    } finally { setBusy(false) }
  }

  function requestClose() {
    if (dirty && !confirm("Saqlanmagan o'zgarishlar bor. Yopilsinmi?")) return
    onClose()
  }

  function doPrint() {
    if (!id) { setErr('Avval hujjatni yozing'); return }
    printSaleDoc(
      {
        id, doc_no: docNo, doc_date: docDate, due_date: null,
        customer_name: customer?.name ?? '', phone: customer?.phone ?? null,
        manager_name: refs.profiles.find((p) => p.id === profile?.id)?.full_name ?? null,
        warehouse_id: warehouseId ?? 0,
        total_base: total, returned_base: 0, paid_base: 0, net_base: total, due_base: total,
        delivery_address: address || null, delivery_driver: driver || null,
        delivery_vehicle: vehicle || null,
      } as never,
      valid.map((l) => {
        const p = productOf(l.product_id)
        return {
          qty: Number(l.qty), qty_shipped: 0, price: Number(l.price),
          line_total: Number(l.qty) * Number(l.price),
          product: { name: p?.name ?? '', code: p?.code ?? null, unit_id: p?.unit_id ?? null },
        }
      }) as never,
      refs,
      'waybill',
    )
  }

  /* ---------------------------------------------- oyna yorlig'i */

  useEffect(() => {
    self.setMeta({
      title: customer?.name ? `Sotuv · ${customer.name.slice(0, 22)}` : 'Sotuv (yaratish)',
      subtitle: docNo ?? undefined,
    })
  }, [self, customer?.name, docNo])

  useEffect(() => { self.setDirty(dirty) }, [self, dirty])

  /* ---------------------------------------------- klaviatura */

  const kb = useRef({ doWrite, doPost, addLine, readOnly, tab })
  kb.current = { doWrite, doPost, addLine, readOnly, tab }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = kb.current
      if (s.readOnly) return
      if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); void s.doPost(true) }
      else if (e.ctrlKey && (e.key === 's' || e.key === 'S')) { e.preventDefault(); void s.doWrite(false) }
      else if (e.key === 'Insert' && s.tab === 'items') { e.preventDefault(); s.addLine() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /* ---------------------------------------------- ko'rinish */

  if (loading || refs.loading || custLoading || prodLoading) {
    return <DocWindow><div className="p-8"><Loading /></div></DocWindow>
  }

  const stateLabel = status === 'draft' ? 'Ishlanmagan'
    : status === 'posted' ? "O'tkazilgan" : 'Bekor qilingan'

  return (
    <DocWindow>
      <DocTitleBar
        title="Mijozga sotuv"
        subtitle={id ? `№ ${docNo ?? id}` : '(yaratish)'}
        onClose={requestClose}
        right={dirty
          ? <span className="text-[12px]" style={{ color: 'var(--warn)' }}>saqlanmagan</span>
          : undefined}
      />

      <DocNav<Section>
        value={section} onChange={setSection}
        items={[
          { key: 'main', label: 'Asosiy' },
          { key: 'history', label: 'Tarix' },
          { key: 'reports', label: 'Hisobotlar' },
        ]}
      />

      <DocCommandBar>
        <DocMainButton
          onClick={() => void doPost(true)} disabled={readOnly || busy} title="Ctrl+Enter"
        >
          <Check size={14} />O'tkazish va yopish
        </DocMainButton>
        <DocBarButton onClick={() => void doWrite(false)} disabled={readOnly || busy} title="Ctrl+S">
          <Save size={14} />Yozish
        </DocBarButton>
        <DocBarButton onClick={() => void doPost(false)} disabled={readOnly || busy}>
          O'tkazish
        </DocBarButton>
        <BarSep />
        <DocBarButton onClick={doPrint} disabled={valid.length === 0} title="Yuk xati">
          <Printer size={14} />
        </DocBarButton>
        <DocBarButton
          onClick={() => { if (id) onPosted(id) }}
          disabled={!id || status !== 'posted'}
          title="Hujjat kartochkasi — to'lov, yuk, qaytarish"
        >
          Kartochka
        </DocBarButton>
        <DocBarButton onClick={requestClose} disabled={busy} title="Yopish">
          <Ban size={14} />
        </DocBarButton>
      </DocCommandBar>

      {section === 'history' && (
        <div className="flex-1 px-3 py-3">
          <DocHistory entity="ip_sales" entityId={id} />
        </div>
      )}

      {section === 'reports' && (
        <div className="flex-1 px-3 py-3">
          <CustomerSnapshot
            customerId={customerId}
            customerName={customer?.name ?? ''}
            onOpenSale={onPosted}
          />
        </div>
      )}

      {section === 'main' && <>

      <div className="grid gap-x-6 px-3 py-2 lg:grid-cols-2">
        <div>
          <DocField label="Holat">
            <div
              className="flex h-[30px] items-center rounded border px-2 text-[13px]"
              style={{
                background: 'var(--surface-2)', borderColor: 'var(--border-2)',
                color: status === 'draft' ? 'var(--warn)' : 'var(--text)',
              }}
            >
              {stateLabel}
            </div>
          </DocField>

          <DocField
            label="Xaridor" required
            hint={balance && (
              <span style={{ color: Number(balance.debt_base) > 0 ? 'var(--danger)' : 'var(--ok)' }}>
                {Number(balance.debt_base) > 0
                  ? `Bizga qarzdor ${money(balance.debt_base)}`
                  : Number(balance.debt_base) < 0
                    ? `Biz qarzdormiz ${money(-balance.debt_base)}`
                    : 'Hisob-kitob teng'}
                {Number(balance.overdue_base) > 0 && (
                  <> · muddati o'tgan {money(balance.overdue_base)} ({balance.max_overdue_days} kun)</>
                )}
              </span>
            )}
          >
            <DocSelect
              value={customerId ?? ''} disabled={readOnly}
              onChange={(v) => { setCustomerId(v ? Number(v) : null); setContractId(null); touch() }}
              placeholder="Tanlang…"
              options={customers.map((c) => ({ value: c.id, label: c.name }))}
            />
          </DocField>

          <DocField label="Shartnoma">
            <DocSelect
              value={contractId ?? ''} disabled={readOnly || !customerId}
              onChange={(v) => { setContractId(v ? Number(v) : null); touch() }}
              placeholder="Asosiy shartnoma"
              options={contracts.map((c) => ({ value: c.id, label: c.number }))}
            />
          </DocField>
        </div>

        <div>
          <DocField label="Raqam" width={110}>
            <div
              className="tnum flex h-[30px] items-center rounded border px-2 text-[13px]"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--border-2)',
                       color: 'var(--text-3)' }}
            >
              {docNo ?? '<Avto>'}
            </div>
          </DocField>
          <DocField label="Sana" width={110}>
            <DocInput type="date" value={docDate} disabled={readOnly}
                      onChange={(v) => { setDocDate(v); touch() }} />
          </DocField>
          <DocField label="Ombor" width={110} required>
            <DocSelect
              value={warehouseId ?? ''} disabled={readOnly}
              onChange={(v) => { setWarehouseId(v ? Number(v) : null); touch() }}
              options={refs.warehouses.map((w) => ({ value: w.id, label: w.name }))}
            />
          </DocField>
          <DocField label="To'lov muddati" width={110}>
            <DocSelect
              value={termId ?? ''} disabled={readOnly}
              onChange={(v) => { setTermId(v ? Number(v) : null); touch() }}
              placeholder="Tanlang…"
              options={refs.terms.map((t) => ({ value: t.id, label: t.name }))}
            />
          </DocField>
        </div>
      </div>

      {err && <div className="px-3 pb-2"><ErrorBox>{err}</ErrorBox></div>}
      {ok && !err && <div className="px-3 pb-2"><InfoBox tone="ok">{ok}</InfoBox></div>}
      {!err && belowMin.length > 0 && (
        <div className="px-3 pb-2">
          <InfoBox tone="warn">
            {belowMin.length} ta qatorda marja eng past chegaradan past —
            o'tkazishda ta'sischi tasdig'i so'raladi.
          </InfoBox>
        </div>
      )}
      {!err && belowMin.length === 0 && bigSale && (
        <div className="px-3 pb-2">
          <InfoBox tone="warn">
            Summa {money(approvalAmount)} dan oshdi — o'tkazishda tasdiq so'raladi.
          </InfoBox>
        </div>
      )}

      <DocTabs<Tab>
        value={tab} onChange={setTab}
        tabs={[
          { key: 'items', label: 'Tovarlar', badge: valid.length },
          { key: 'delivery', label: 'Yetkazib berish' },
          { key: 'extra', label: "Qo'shimcha" },
        ]}
      />

      <div className="flex-1 px-3 py-2">
        {tab === 'items' && (
          <ItemsGrid
            lines={lines} readOnly={readOnly} selRow={selRow} setSelRow={setSelRow}
            pickCtx={pickCtx} productOf={productOf} unitOf={unitOf} showMargin={showMargin}
            showVat={vatRate > 0 || lines.some((l) => l.vat_pct > 0)}
            onVat={(k, v) => patch(k, { vat_pct: Math.max(0, Number(v) || 0) })}
            onPick={pickProduct} onQty={(k, v) => patch(k, { qty: v })}
            onPrice={setPrice} onDiscount={setDiscount}
            onAdd={addLine} onRemove={removeLine} onMove={moveLine}
            onOpenPicker={() => setPicking(true)}
          />
        )}

        {tab === 'delivery' && (
          <div className="max-w-[620px] pt-2">
            <DocField label="Yuk rejimi" width={150}>
              <label className="flex h-[30px] cursor-pointer items-center gap-2 text-[13px]">
                <input
                  type="checkbox" checked={shipNow} disabled={readOnly}
                  onChange={(e) => { setShipNow(e.target.checked); touch() }}
                />
                {shipNow ? 'Yuk hozir chiqadi' : 'Yuk keyin chiqadi'}
              </label>
            </DocField>
            <p className="mb-2 pl-[158px] text-[12px]" style={{ color: 'var(--text-3)' }}>
              {shipNow
                ? "O'tkazilganda tovar darhol ombordan yechiladi, tan narx va marja aniq hisoblanadi."
                : "Tovar band bo'lib turadi; chiqarilganda tan narx aniqlashtiriladi."}
            </p>
            <DocField label="Manzil" width={150}>
              <DocInput value={address} disabled={readOnly}
                        onChange={(v) => { setAddress(v); touch() }} />
            </DocField>
            <DocField label="Haydovchi" width={150}>
              <DocInput value={driver} disabled={readOnly}
                        onChange={(v) => { setDriver(v); touch() }} />
            </DocField>
            <DocField label="Mashina" width={150}>
              <DocInput value={vehicle} disabled={readOnly}
                        onChange={(v) => { setVehicle(v); touch() }} />
            </DocField>
          </div>
        )}

        {tab === 'extra' && (
          <div className="max-w-[560px] pt-2">
            <DocField label="Menejer" width={150}>
              <div className="flex h-[30px] items-center text-[13px]"
                   style={{ color: 'var(--text-2)' }}>
                {profile?.full_name ?? '—'}
              </div>
            </DocField>
            <DocField label="Narx turi" width={150}>
              <div className="flex h-[30px] items-center text-[13px]"
                   style={{ color: 'var(--text-2)' }}>
                {refs.tiers.find((t) => t.id === tierId)?.name ?? 'Standart'}
              </div>
            </DocField>
            <p className="mt-2 pl-[158px] text-[12px]" style={{ color: 'var(--text-3)' }}>
              Narx turi mijoz kartochkasida belgilanadi va qatorlardagi narxni
              shu belgilaydi.
            </p>
          </div>
        )}
      </div>

      <DocFooter>
        <div className="min-w-[240px] flex-1">
          <label className="mb-1 block text-[12px]" style={{ color: 'var(--text-2)' }}>
            Izoh
          </label>
          <textarea
            value={note} disabled={readOnly} rows={2}
            onChange={(e) => { setNote(e.target.value); touch() }}
            className="w-full rounded border px-2 py-1.5 text-[13px] outline-none
              focus:border-[var(--brand)]"
            style={{ background: 'var(--surface)', borderColor: 'var(--border-2)' }}
          />
        </div>
        <TotalsBox
          rows={[
            { label: 'Qatorlar', value: `${valid.length} ta` },
            { label: 'Miqdor', value: num(qtyTotal, 2) },
            ...(discountTotal > 0
              ? [{ label: 'Chegirma', value: money(discountTotal, false) }] : []),
            ...(vatTotal > 0
              ? [{ label: 'QQS siz', value: money(exVatTotal, false) },
                 { label: `QQS (${vatRate}%)`, value: money(vatTotal, false) }] : []),
            { label: 'Jami', value: money(total), strong: true },
          ]}
        />
      </DocFooter>

      </>}

      {picking && (
        <ProductPickerModal
          ctx={pickCtx} onClose={() => setPicking(false)} onSubmit={applyPicked}
        />
      )}
    </DocWindow>
  )
}

/* ---------------------------------------------------------------- */

function ItemsGrid({
  lines, readOnly, selRow, setSelRow, pickCtx, productOf, unitOf, showMargin,
  showVat, onVat,
  onPick, onQty, onPrice, onDiscount, onAdd, onRemove, onMove, onOpenPicker,
}: {
  lines: Line[]
  readOnly: boolean
  selRow: string | null
  setSelRow: (k: string | null) => void
  pickCtx: PickCtx
  productOf: (id: number | null) => Product | null
  unitOf: (id: number | null | undefined) => string
  showMargin: boolean
  showVat: boolean
  onVat: (key: string, v: string) => void
  onPick: (key: string, pid: number) => void
  onQty: (key: string, v: string) => void
  onPrice: (key: string, v: string) => void
  onDiscount: (key: string, v: string) => void
  onAdd: () => void
  onRemove: (key: string) => void
  onMove: (key: string, dir: -1 | 1) => void
  onOpenPicker: () => void
}) {
  const head = (t: string, w?: number, right?: boolean) => (
    <th
      key={t} style={{ width: w, borderColor: 'var(--border)', color: 'var(--text-2)' }}
      className={`border-b border-r px-2 py-[5px] text-[12px] font-semibold whitespace-nowrap
        last:border-r-0 ${right ? 'text-right' : 'text-left'}`}
    >
      {t}
    </th>
  )

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <DocBarButton onClick={onAdd} disabled={readOnly} title="Insert">
          <Plus size={14} />Qo'shish
        </DocBarButton>
        <DocBarButton onClick={onOpenPicker} disabled={readOnly}
                      title="Ro'yxatdan bir nechta tovarni tanlash">
          <ListPlus size={14} />Tanlash
        </DocBarButton>
        <BarSep />
        <DocBarButton onClick={() => selRow && onMove(selRow, -1)}
                      disabled={readOnly || !selRow} title="Yuqoriga">
          <ArrowUp size={14} />
        </DocBarButton>
        <DocBarButton onClick={() => selRow && onMove(selRow, 1)}
                      disabled={readOnly || !selRow} title="Pastga">
          <ArrowDown size={14} />
        </DocBarButton>
        <DocBarButton onClick={() => selRow && onRemove(selRow)}
                      disabled={readOnly || !selRow} title="O'chirish">
          <Trash2 size={14} />
        </DocBarButton>
      </div>

      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full border-collapse text-[13px]" style={{ minWidth: showVat ? 1150 : 960 }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)' }}>
              {head('N', 34)}
              {head('Nomenklatura')}
              {head('Miqdor', 92, true)}
              {head('Birlik', 60)}
              {head('Narx', 120, true)}
              {head('Chegirma %', 92, true)}
              {head('Summa', 132, true)}
              {showVat ? head('QQS %', 72, true) : null}
              {showVat ? head('QQS summa', 118, true) : null}
              {showMargin ? head('Marja', 84, true) : null}
              {head('Erkin qoldiq', 104, true)}
              {head('', 34)}
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const p = productOf(l.product_id)
              const free = l.product_id ? pickCtx.stock.get(l.product_id) ?? 0 : 0
              const qty = Number(l.qty) || 0
              const price = Number(l.price) || 0
              const sum = qty * price
              const over = Boolean(l.product_id) && qty > free
              const disc = l.list_price > 0 && price > 0
                ? ((l.list_price - price) / l.list_price) * 100 : 0
              const low = l.margin != null && l.minMargin != null && l.margin < l.minMargin
              const lineVat = l.vat_pct > 0 ? sum * l.vat_pct / (100 + l.vat_pct) : 0
              const on = selRow === l.key
              return (
                <tr
                  key={l.key}
                  onClick={() => setSelRow(l.key)}
                  style={{ background: on ? 'var(--brand-soft)' : undefined }}
                  className={on ? '' : 'hover:bg-[var(--surface-2)]'}
                >
                  <td className="tnum border-b border-r px-2 py-[3px] text-center"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-3)' }}>
                    {i + 1}
                  </td>
                  <td className="border-b border-r px-1 py-[3px]"
                      style={{ borderColor: 'var(--border)' }}>
                    <ProductCombo
                      value={l.product_id} ctx={pickCtx} disabled={readOnly}
                      onChange={(pid) => onPick(l.key, pid)}
                    />
                  </td>
                  <td className="border-b border-r px-1 py-[3px]"
                      style={{ borderColor: 'var(--border)' }}>
                    <CellInput
                      type="number" align="right" value={l.qty} disabled={readOnly}
                      onChange={(v) => onQty(l.key, v)}
                      onKeyDown={(e) => { if (e.key === 'Enter') onAdd() }}
                    />
                  </td>
                  <td className="border-b border-r px-2 py-[3px] text-center"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-3)' }}>
                    {unitOf(p?.unit_id)}
                  </td>
                  <td className="border-b border-r px-1 py-[3px]"
                      style={{ borderColor: 'var(--border)' }}>
                    <CellInput
                      type="number" align="right" value={l.price} disabled={readOnly}
                      onChange={(v) => onPrice(l.key, v)}
                    />
                    {l.list_price > 0 && price > 0 && price !== l.list_price && (
                      <div className="tnum text-right text-[11px]"
                           style={{ color: 'var(--text-3)' }}>
                        ro'yxat {money(l.list_price, false)}
                      </div>
                    )}
                  </td>
                  <td className="border-b border-r px-1 py-[3px]"
                      style={{ borderColor: 'var(--border)' }}>
                    <CellInput
                      type="number" align="right"
                      value={disc ? disc.toFixed(1) : ''}
                      disabled={readOnly || !l.list_price}
                      onChange={(v) => onDiscount(l.key, v)}
                    />
                  </td>
                  <td className="tnum border-b border-r px-2 py-[3px] text-right"
                      style={{ borderColor: 'var(--border)' }}>
                    {sum > 0 ? money(sum, false) : '—'}
                  </td>
                  {showVat && (
                    <td className="border-b border-r px-1 py-[3px]"
                        style={{ borderColor: 'var(--border)' }}>
                      <CellInput
                        type="number" align="right" value={l.vat_pct ? String(l.vat_pct) : ''}
                        disabled={readOnly}
                        onChange={(v) => onVat(l.key, v)}
                      />
                    </td>
                  )}
                  {showVat && (
                    <td className="tnum border-b border-r px-2 py-[3px] text-right"
                        style={{ borderColor: 'var(--border)', color: 'var(--text-3)' }}
                        title="Summa ichidagi QQS">
                      {lineVat > 0 ? money(lineVat, false) : '—'}
                    </td>
                  )}
                  {showMargin && (
                    <td className="tnum border-b border-r px-2 py-[3px] text-right"
                        style={{
                          borderColor: 'var(--border)',
                          color: l.noCost ? 'var(--text-3)'
                            : low ? 'var(--danger)'
                            : l.margin != null ? 'var(--ok)' : undefined,
                        }}
                        title={l.noCost ? 'Tan narx yo\'q — marja hisoblanmaydi'
                          : low ? `Eng past chegara ${pct(l.minMargin)}` : undefined}>
                      {l.noCost ? 'tan narx yo\'q'
                        : l.margin != null ? pct(l.margin) : '—'}
                    </td>
                  )}
                  <td className="tnum border-b border-r px-2 py-[3px] text-right"
                      style={{
                        borderColor: 'var(--border)',
                        color: over ? 'var(--danger)' : free > 0 ? 'var(--ok)' : 'var(--text-3)',
                      }}
                      title={over ? 'Sotuv qoldiqdan ko\'p' : undefined}>
                    {l.product_id ? num(free, 2) : '—'}
                  </td>
                  <td className="border-b px-1 py-[3px] text-center"
                      style={{ borderColor: 'var(--border)' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); onRemove(l.key) }}
                      disabled={readOnly}
                      style={{ color: 'var(--text-3)' }}
                      className="rounded p-0.5 hover:bg-[var(--surface-2)] disabled:opacity-40"
                    >
                      <XIcon size={13} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-[12px]" style={{ color: 'var(--text-3)' }}>
        <b>Insert</b> — yangi qator · <b>Ctrl+S</b> — yozish · <b>Ctrl+Enter</b> — o'tkazish va yopish
      </p>
    </div>
  )
}
