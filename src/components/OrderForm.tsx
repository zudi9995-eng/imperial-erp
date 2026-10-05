import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown, ArrowUp, Ban, Check, Copy, FileText, ListPlus, Plus, Printer,
  Save, Trash2, X as XIcon,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useCustomers, useProducts, useRefs, translateDbError } from '../lib/useRefs'
import type { Order, Product } from '../lib/types'
import { ErrorBox, InfoBox, Loading, Modal, Button } from './ui'
import {
  BarSep, CellInput, DocBarButton, DocCommandBar, DocField, DocFooter, DocInput,
  DocLink, DocMainButton, DocNav, DocSelect, DocTabs, DocTitleBar, DocWindow, TotalsBox,
} from './docForm'
import { ProductCombo, ProductPickerModal, type PickCtx, type PickedLine } from './ProductPick'
import { isoDate, money, num } from '../lib/format'
import { printOrderDoc } from './printDoc'
import { useWindowSelf } from '../lib/windows'
import { useSettings } from '../lib/settings'
import DocHistory from './DocHistory'
import CustomerCombo from './CustomerPick'
import { DocDeleteBarButton } from './DeleteDoc'
import CustomerSnapshot from './CustomerSnapshot'

/**
 * 1C «Заказ покупателя» formasining ERP dagi ko'rinishi.
 * Joylashuv ataylab 1C dagidek: menejerlar bir necha yil o'sha oynada
 * ishlagan, shuning uchun tugmalar ham, tugmachalar ham o'sha joyda.
 */

type Line = {
  key: string
  product_id: number | null
  qty: string
  price: string
}

const newLine = (): Line => ({
  key: Math.random().toString(36).slice(2),
  product_id: null, qty: '', price: '',
})

type Tab = 'items' | 'delivery' | 'extra'
/** 1C dagi forma navigatsiya paneli: Основное / События / Отчеты */
type Section = 'main' | 'history' | 'reports'

interface Balance {
  debt_base: number
  overdue_base: number
  max_overdue_days: number
}

export default function OrderForm({
  winKey, orderId, copyFromId, onClose, onSaved, onOpenSale,
}: {
  /** Sidebardagi oyna kaliti — sarlavha va "saqlanmagan" belgisi uchun */
  winKey?: string
  /** Mavjud buyurtmani ochish */
  orderId: number | null
  /** Nusxa olish uchun manba */
  copyFromId?: number | null
  onClose: () => void
  onSaved: () => void
  onOpenSale: (saleId: number) => void
}) {
  const self = useWindowSelf(winKey)
  const { can, profile } = useAuth()
  const { s: sset } = useSettings()
  const companyName = sset('company_name', '')
  const refs = useRefs()
  const { customers } = useCustomers()
  const { products } = useProducts()

  /* ----- hujjat sarlavhasi ----- */
  const [docNo, setDocNo] = useState<string | null>(null)
  const [status, setStatus] = useState<'draft' | 'confirmed' | 'converted' | 'cancelled'>('draft')
  const [saleId, setSaleId] = useState<number | null>(null)
  const [saleDocNo, setSaleDocNo] = useState<string | null>(null)
  const [id, setId] = useState<number | null>(orderId)

  const [customerId, setCustomerId] = useState<number | null>(null)
  const [contractId, setContractId] = useState<number | null>(null)
  const [warehouse, setWarehouse] = useState<number | null>(null)
  const [managerId, setManagerId] = useState<string | null>(null)
  const [date, setDate] = useState(isoDate())
  const [valid, setValid] = useState('')
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<Line[]>([newLine()])

  /* ----- yordamchi ma'lumotlar ----- */
  const [prices, setPrices] = useState<Map<number, number>>(new Map())
  const [stock, setStock] = useState<Map<number, number>>(new Map())
  const [balance, setBalance] = useState<Balance | null>(null)
  const [contracts, setContracts] = useState<{ id: number; number: string }[]>([])

  /* ----- holat ----- */
  const [tab, setTab] = useState<Tab>('items')
  const [section, setSection] = useState<Section>('main')
  const [loading, setLoading] = useState(Boolean(orderId || copyFromId))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [dirty, setDirty] = useState(false)
  const [picking, setPicking] = useState(false)
  const [selRow, setSelRow] = useState<string | null>(null)
  const [showConvert, setShowConvert] = useState(false)

  const readOnly = status === 'converted' || status === 'cancelled'
  const customer = customers.find((c) => c.id === customerId) ?? null
  const tierId = customer?.tier_id ?? refs.tiers.find((t) => t.is_default)?.id ?? null

  /* ---------------------------------------------- boshlang'ich yuklash */

  useEffect(() => {
    if (warehouse == null && refs.warehouses.length) {
      setWarehouse((refs.warehouses.find((w) => w.is_default) ?? refs.warehouses[0]).id)
    }
  }, [refs.warehouses, warehouse])

  useEffect(() => {
    if (managerId == null && profile?.id && !orderId && !copyFromId) setManagerId(profile.id)
  }, [profile, managerId, orderId, copyFromId])

  const src = orderId ?? copyFromId ?? null
  useEffect(() => {
    if (!src) { setLoading(false); return }
    let alive = true
    void Promise.all([
      supabase.from('ip_orders').select('*').eq('id', src).single(),
      supabase.from('ip_order_items').select('*').eq('order_id', src).order('id'),
    ]).then(([o, it]) => {
      if (!alive || !o.data) { setLoading(false); return }
      const ord = o.data as Order & { contract_id: number | null; doc_no: string | null }
      setCustomerId(ord.customer_id)
      setContractId(ord.contract_id)
      setWarehouse(ord.warehouse_id)
      setManagerId(ord.manager_id)
      if (orderId) {
        setId(ord.id)
        setDocNo(ord.doc_no)
        setStatus(ord.status as typeof status)
        setSaleId(ord.sale_id)
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
      setLoading(false)
    })
    return () => { alive = false }
  }, [src, orderId])

  // Bog'langan sotuv raqami
  useEffect(() => {
    if (!saleId) { setSaleDocNo(null); return }
    let alive = true
    void supabase.from('ip_sales').select('doc_no').eq('id', saleId).single()
      .then(({ data }) => { if (alive) setSaleDocNo((data as { doc_no: string } | null)?.doc_no ?? null) })
    return () => { alive = false }
  }, [saleId])

  // Mijozning shartnomalari va balansi
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

  // Narxlar (mijoz narx turi bo'yicha)
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

  // Erkin qoldiq
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
    () => ({ products, stock, prices, unitOf, categoryOf }),
    [products, stock, prices, unitOf, categoryOf],
  )

  const validLines = lines.filter(
    (l) => l.product_id && Number(l.qty) > 0 && Number(l.price) > 0,
  )
  const total = validLines.reduce((a, l) => a + Number(l.qty) * Number(l.price), 0)
  const qtyTotal = validLines.reduce((a, l) => a + Number(l.qty), 0)

  const creditLeft = customer?.credit_limit != null && balance
    ? Number(customer.credit_limit) - Number(balance.debt_base) - total
    : null

  /* ---------------------------------------------- qatorlar */

  function touch() { setDirty(true); setOk('') }

  function patch(key: string, p: Partial<Line>) {
    setLines((ls) => ls.map((x) => (x.key === key ? { ...x, ...p } : x)))
    touch()
  }

  function pickProduct(key: string, pid: number) {
    const price = prices.get(pid) ?? 0
    setLines((ls) => ls.map((x) => (x.key === key
      ? { ...x, product_id: pid, price: price ? String(price) : x.price, qty: x.qty || '1' }
      : x)))
    touch()
  }

  function addLine() {
    const l = newLine()
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
      const n = [...ls]
      ;[n[i], n[j]] = [n[j], n[i]]
      return n
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
          const l: Line = {
            key: Math.random().toString(36).slice(2),
            product_id: p.product_id, qty: String(p.qty),
            price: String(p.price || prices.get(p.product_id) || 0),
          }
          kept.push(l)
          byId.set(p.product_id, l)
        }
      }
      return kept.length ? [...kept] : [newLine()]
    })
    setPicking(false)
    touch()
  }

  /* ---------------------------------------------- saqlash */

  const save = useCallback(async (): Promise<number | null> => {
    if (!customerId) { setErr('Xaridor tanlanmagan'); return null }
    if (!warehouse) { setErr('Ombor tanlanmagan'); return null }
    if (validLines.length === 0) { setErr('Tovar kiritilmagan'); return null }
    setErr('')

    let oid = id
    if (!oid) {
      const { data, error } = await supabase.rpc('ip_create_order', {
        p_customer: customerId, p_warehouse: warehouse,
        p_date: date, p_valid_until: valid || null, p_contract: contractId,
      })
      if (error) throw new Error(error.message)
      const created = data as Order & { doc_no: string | null }
      oid = created.id
      setId(created.id)
      setDocNo(created.doc_no)
    } else {
      const { error } = await supabase.from('ip_orders').update({
        customer_id: customerId, warehouse_id: warehouse, contract_id: contractId,
        doc_date: date, valid_until: valid || null,
      } as never).eq('id', oid)
      if (error) throw new Error(error.message)
      await supabase.from('ip_order_items').delete().eq('order_id', oid)
    }

    const { error: e1 } = await supabase.from('ip_orders')
      .update({ note: note.trim() || null, manager_id: managerId } as never)
      .eq('id', oid)
    if (e1) throw new Error(e1.message)

    const { error: e2 } = await supabase.from('ip_order_items').insert(
      validLines.map((l) => ({
        order_id: oid, product_id: l.product_id,
        qty: Number(l.qty), price: Number(l.price),
      })) as never)
    if (e2) throw new Error(e2.message)

    await supabase.rpc('ip_recalc_order', { p_order_id: oid })
    setDirty(false)
    return oid
  }, [customerId, warehouse, validLines, id, date, valid, contractId, note, managerId])

  async function doWrite(close: boolean) {
    setBusy(true)
    try {
      const oid = await save()
      if (oid) { setOk('Yozildi'); onSaved(); if (close) onClose() }
    } catch (e) {
      setErr(translateDbError(e instanceof Error ? e.message : 'Xato'))
    } finally { setBusy(false) }
  }

  async function doPost(close: boolean) {
    setBusy(true)
    try {
      const oid = await save()
      if (!oid) return
      if (status === 'draft') {
        const { error } = await supabase.rpc('ip_confirm_order', { p_order_id: oid })
        if (error) throw new Error(error.message)
        setStatus('confirmed')
      }
      setOk("O'tkazildi — tovar band qilindi")
      onSaved()
      if (close) onClose()
    } catch (e) {
      setErr(translateDbError(e instanceof Error ? e.message : 'Xato'))
    } finally { setBusy(false) }
  }

  async function doCancel() {
    if (!id || !confirm('Buyurtma bekor qilinsinmi? Band qilingan tovar bo\'shatiladi.')) return
    setBusy(true)
    const { error } = await supabase.rpc('ip_cancel_order', { p_order_id: id, p_reason: null })
    setBusy(false)
    if (error) { setErr(translateDbError(error.message)); return }
    setStatus('cancelled')
    onSaved()
  }

  // Sidebardagi oyna yorlig'i hujjat bilan birga o'zgarib turadi
  useEffect(() => {
    self.setMeta({
      title: customer?.name
        ? `Buyurtma · ${customer.name.slice(0, 22)}`
        : 'Buyurtma (yaratish)',
      subtitle: docNo ?? undefined,
    })
  }, [self, customer?.name, docNo])

  useEffect(() => { self.setDirty(dirty) }, [self, dirty])

  function doPrint() {
    printOrderDoc(
      {
        id: id ?? 0, doc_no: docNo, doc_date: date, valid_until: valid || null,
        customer_name: customer?.name ?? '',
        manager_name: refs.profiles.find((p) => p.id === managerId)?.full_name ?? null,
        warehouse_name: refs.warehouses.find((w) => w.id === warehouse)?.name ?? null,
        contract_no: contracts.find((c) => c.id === contractId)?.number ?? null,
        note: note.trim() || null,
      },
      validLines.map((l) => {
        const p = productOf(l.product_id)
        return {
          name: p?.name ?? '', code: p?.code ?? null, unit_id: p?.unit_id ?? null,
          qty: Number(l.qty), price: Number(l.price),
          line_total: Number(l.qty) * Number(l.price),
        }
      }),
      { ...refs, company: companyName },
    )
  }

  function requestClose() {
    if (dirty && !confirm("Saqlanmagan o'zgarishlar bor. Yopilsinmi?")) return
    onClose()
  }

  /* ---------------------------------------------- klaviatura (1C odatlari) */

  const saveRef = useRef({ doWrite, doPost, addLine, readOnly, tab })
  saveRef.current = { doWrite, doPost, addLine, readOnly, tab }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = saveRef.current
      if (s.readOnly) return
      if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); void s.doPost(true) }
      else if (e.ctrlKey && (e.key === 's' || e.key === 'S')) { e.preventDefault(); void s.doWrite(false) }
      else if (e.key === 'Insert' && s.tab === 'items') { e.preventDefault(); s.addLine() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /* ---------------------------------------------- ko'rinish */

  if (loading || refs.loading) {
    return <DocWindow><div className="p-8"><Loading /></div></DocWindow>
  }

  const stateLabel = status === 'draft' ? 'Ishlanmagan'
    : status === 'confirmed' ? 'Band qilindi'
    : status === 'converted' ? 'Sotuvga o\'tkazilgan'
    : 'Bekor qilingan'

  return (
    <DocWindow>
      <DocTitleBar
        title="Xaridor buyurtmasi"
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
          onClick={() => void doPost(true)} disabled={readOnly || busy}
          title="Ctrl+Enter"
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
        <DocBarButton
          onClick={() => setShowConvert(true)}
          disabled={status !== 'confirmed' || busy || dirty}
          title={dirty ? 'Avval hujjatni yozing' : 'Buyurtma asosida sotuv yaratish'}
        >
          <FileText size={14} />Asosida yaratish
        </DocBarButton>
        <DocBarButton
          onClick={doPrint} disabled={validLines.length === 0} title="Chop etish"
        >
          <Printer size={14} />
        </DocBarButton>
        <DocBarButton
          onClick={() => void doCancel()}
          disabled={!id || readOnly || busy} title="Bekor qilish"
        >
          <Ban size={14} />
        </DocBarButton>
        <DocDeleteBarButton
          entity="order" id={id} disabled={busy}
          title={`Buyurtma ${docNo ?? id}`}
          onDone={() => { onSaved(); onClose() }}
        />
        {saleId && (
          <>
            <BarSep />
            <DocBarButton onClick={() => onOpenSale(saleId)}>
              Sotuv: {saleDocNo ?? saleId}
            </DocBarButton>
          </>
        )}
      </DocCommandBar>

      {section === 'history' && (
        <div className="flex-1 px-3 py-3">
          <DocHistory entity="ip_orders" entityId={id} />
        </div>
      )}

      {section === 'reports' && (
        <div className="flex-1 px-3 py-3">
          <CustomerSnapshot
            customerId={customerId}
            customerName={customer?.name ?? ''}
            onOpenSale={onOpenSale}
          />
        </div>
      )}

      {section === 'main' && <>

      {/* ---------------- sarlavha maydonlari ---------------- */}
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
                  <span style={{ color: 'var(--danger)' }}>
                    {' '}· muddati o'tgan {money(balance.overdue_base)} ({balance.max_overdue_days} kun)
                  </span>
                )}
              </span>
            )}
          >
            <CustomerCombo
              value={customerId} customers={customers} disabled={readOnly}
              onChange={(id) => { setCustomerId(id); setContractId(null); touch() }}
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
          <DocField label="Raqam" width={90}>
            <div
              className="tnum flex h-[30px] items-center rounded border px-2 text-[13px]"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--border-2)',
                       color: 'var(--text-3)' }}
            >
              {docNo ?? '<Avto>'}
            </div>
          </DocField>
          <DocField label="Sana" width={90}>
            <DocInput type="date" value={date} disabled={readOnly}
                      onChange={(v) => { setDate(v); touch() }} />
          </DocField>
          <DocField label="Ombor" width={90} required>
            <DocSelect
              value={warehouse ?? ''} disabled={readOnly}
              onChange={(v) => { setWarehouse(v ? Number(v) : null); touch() }}
              options={refs.warehouses.map((w) => ({ value: w.id, label: w.name }))}
            />
          </DocField>
        </div>
      </div>

      {/* ---------------- havolalar ---------------- */}
      <div className="flex flex-wrap items-center gap-4 px-3 pb-2">
        <DocLink onClick={() => setTab('delivery')} active={tab === 'delivery'}>
          Yuk va to'lov sanalari
        </DocLink>
        <DocLink onClick={() => setTab('extra')} active={tab === 'extra'}>
          Qo'shimcha
        </DocLink>
        {creditLeft != null && (
          <span className="text-[12px]"
                style={{ color: creditLeft < 0 ? 'var(--danger)' : 'var(--text-3)' }}>
            Kredit limiti: {creditLeft < 0
              ? `${money(-creditLeft)} oshib ketdi`
              : `${money(creditLeft)} qoldi`}
          </span>
        )}
      </div>

      {err && <div className="px-3 pb-2"><ErrorBox>{err}</ErrorBox></div>}
      {ok && !err && (
        <div className="px-3 pb-2">
          <InfoBox tone="ok">{ok}</InfoBox>
        </div>
      )}

      {/* ---------------- zakladkalar ---------------- */}
      <DocTabs<Tab>
        value={tab} onChange={setTab}
        tabs={[
          { key: 'items', label: 'Tovarlar', badge: validLines.length },
          { key: 'delivery', label: 'Yetkazib berish' },
          { key: 'extra', label: "Qo'shimcha" },
        ]}
      />

      <div className="flex-1 px-3 py-2">
        {tab === 'items' && (
          <ItemsGrid
            lines={lines} readOnly={readOnly} selRow={selRow} setSelRow={setSelRow}
            pickCtx={pickCtx} productOf={productOf} unitOf={unitOf}
            onPick={pickProduct} onPatch={patch} onAdd={addLine}
            onRemove={removeLine} onMove={moveLine} onOpenPicker={() => setPicking(true)}
          />
        )}

        {tab === 'delivery' && (
          <div className="max-w-[520px] pt-2">
            <DocField label="Amal qilish muddati" width={150}>
              <DocInput type="date" value={valid} disabled={readOnly}
                        onChange={(v) => { setValid(v); touch() }} />
            </DocField>
            <p className="mt-2 pl-[158px] text-[12px]" style={{ color: 'var(--text-3)' }}>
              Shu sanadan keyin buyurtma ro'yxatda qizil ko'rinadi. Bo'sh qoldirsangiz
              muddat tekshirilmaydi.
            </p>
          </div>
        )}

        {tab === 'extra' && (
          <div className="max-w-[520px] pt-2">
            <DocField label="Menejer" width={150}>
              <DocSelect
                value={managerId ?? ''} disabled={readOnly || !can('customers.assign')}
                onChange={(v) => { setManagerId(v || null); touch() }}
                placeholder="Tayinlanmagan"
                options={refs.profiles.map((p) => ({ value: p.id, label: p.full_name }))}
              />
            </DocField>
            {!can('customers.assign') && (
              <p className="mt-2 pl-[158px] text-[12px]" style={{ color: 'var(--text-3)' }}>
                Menejerni faqat rahbar o'zgartira oladi.
              </p>
            )}
          </div>
        )}
      </div>

      {/* ---------------- pastki qism ---------------- */}
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
            { label: 'Qatorlar', value: `${validLines.length} ta` },
            { label: 'Miqdor', value: num(qtyTotal, 2) },
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
      {showConvert && id && (
        <ConvertModal
          orderId={id}
          onClose={() => setShowConvert(false)}
          onDone={(sid) => {
            setShowConvert(false); setSaleId(sid); setStatus('converted')
            onSaved(); onOpenSale(sid)
          }}
        />
      )}
    </DocWindow>
  )
}

/* ---------------------------------------------------------------- */

function ItemsGrid({
  lines, readOnly, selRow, setSelRow, pickCtx, productOf, unitOf,
  onPick, onPatch, onAdd, onRemove, onMove, onOpenPicker,
}: {
  lines: Line[]
  readOnly: boolean
  selRow: string | null
  setSelRow: (k: string | null) => void
  pickCtx: PickCtx
  productOf: (id: number | null) => Product | null
  unitOf: (id: number | null | undefined) => string
  onPick: (key: string, pid: number) => void
  onPatch: (key: string, p: Partial<Line>) => void
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
        <DocBarButton
          onClick={() => {
            if (!selRow) return
            const l = lines.find((x) => x.key === selRow)
            if (l?.product_id) onPick(selRow, l.product_id)
          }}
          disabled={readOnly || !selRow} title="Narxni yangilash"
        >
          <Copy size={14} />
        </DocBarButton>
        <DocBarButton onClick={() => selRow && onRemove(selRow)}
                      disabled={readOnly || !selRow} title="O'chirish">
          <Trash2 size={14} />
        </DocBarButton>
      </div>

      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full border-collapse text-[13px]" style={{ minWidth: 860 }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)' }}>
              {head('N', 36)}
              {head('Nomenklatura')}
              {head('Miqdor', 100, true)}
              {head('Birlik', 64)}
              {head('Narx', 130, true)}
              {head('Summa', 140, true)}
              {head('Erkin qoldiq', 110, true)}
              {head('', 34)}
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const p = productOf(l.product_id)
              const free = l.product_id ? pickCtx.stock.get(l.product_id) ?? 0 : 0
              const qty = Number(l.qty) || 0
              const sum = qty * (Number(l.price) || 0)
              const over = Boolean(l.product_id) && qty > free
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
                      onChange={(v) => onPatch(l.key, { qty: v })}
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
                      onChange={(v) => onPatch(l.key, { price: v })}
                    />
                  </td>
                  <td className="tnum border-b border-r px-2 py-[3px] text-right"
                      style={{ borderColor: 'var(--border)' }}>
                    {sum > 0 ? money(sum, false) : '—'}
                  </td>
                  <td className="tnum border-b border-r px-2 py-[3px] text-right"
                      style={{
                        borderColor: 'var(--border)',
                        color: over ? 'var(--danger)' : free > 0 ? 'var(--ok)' : 'var(--text-3)',
                      }}
                      title={over ? 'Buyurtma qoldiqdan ko\'p' : undefined}>
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

/* ---------------------------------------------------------------- */

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
      open onClose={onClose} width={460} title="Asosida yaratish — Sotuv"
      footer={<><Button onClick={onClose}>Bekor</Button>
        <Button variant="primary" loading={busy} onClick={convert}>
          <Check size={14} />Yaratish
        </Button></>}
    >
      <div className="space-y-3">
        <InfoBox>
          Buyurtma asosida <b>sotuv qoralamasi</b> yaratiladi. Uni tekshirib
          topshirganingizdan keyingina qarz va ombor harakati yoziladi.
        </InfoBox>
        <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border-2)' }}>
          <label className="flex cursor-pointer items-center gap-2 text-[13px]">
            <input type="checkbox" checked={shipNow} onChange={(e) => setShipNow(e.target.checked)} />
            {shipNow ? 'Yuk hozir chiqadi' : 'Yuk keyin chiqadi'}
          </label>
          <p className="mt-1.5 text-[12px]" style={{ color: 'var(--text-3)' }}>
            {shipNow
              ? 'Sotuv topshirilganda tovar darhol ombordan yechiladi.'
              : "Tovar band bo'lib turadi, keyin alohida chiqariladi."}
          </p>
        </div>
        {err && <ErrorBox>{err}</ErrorBox>}
      </div>
    </Modal>
  )
}
