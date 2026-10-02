import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown, ArrowUp, Ban, Check, ListPlus, Plus, Save, Trash2, X as XIcon,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useSettings } from '../lib/settings'
import { useProducts, useRefs, useSuppliers, translateDbError } from '../lib/useRefs'
import type { Product, Purchase } from '../lib/types'
import { ErrorBox, InfoBox, Loading } from './ui'
import {
  BarSep, CellInput, DocBarButton, DocCommandBar, DocField, DocFooter, DocInput,
  DocMainButton, DocNav, DocSelect, DocTabs, DocTitleBar, DocWindow, TotalsBox,
} from './docForm'
import { ProductCombo, ProductPickerModal, type PickCtx, type PickedLine } from './ProductPick'
import { isoDate, money, num } from '../lib/format'
import { useWindowSelf } from '../lib/windows'
import DocHistory from './DocHistory'
import { DocDeleteBarButton } from './DeleteDoc'

/**
 * Postavshikdan xarid — 1C «Поступление товаров» formasi uslubida.
 * Tan narx QQS siz olinadi: shunda marja QQS siz daromadga mos keladi.
 */

type Line = {
  key: string
  product_id: number | null
  qty: string
  cost: string
  vat_pct: number
}

const newLine = (): Line => ({
  key: Math.random().toString(36).slice(2),
  product_id: null, qty: '', cost: '', vat_pct: 0,
})

type Tab = 'items' | 'extra'
type Section = 'main' | 'history'

export default function PurchaseForm({
  winKey, purchaseId, onClose, onSaved,
}: {
  winKey?: string
  purchaseId: number | null
  onClose: () => void
  onSaved: () => void
}) {
  const self = useWindowSelf(winKey)
  const { can } = useAuth()
  const refs = useRefs()
  const { suppliers } = useSuppliers()
  const { products } = useProducts()
  const { n, b } = useSettings()
  const vatRate = b('vat_enabled', true) ? n('vat_rate', 0) : 0

  const [id, setId] = useState<number | null>(purchaseId)
  const [docNo, setDocNo] = useState<string | null>(null)
  const [status, setStatus] = useState<'draft' | 'posted' | 'cancelled'>('draft')

  const [supplier, setSupplier] = useState<number | null>(null)
  const [warehouse, setWarehouse] = useState<number | null>(null)
  const [date, setDate] = useState(isoDate())
  const [currency, setCurrency] = useState('UZS')
  const [rate, setRate] = useState('1')
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<Line[]>([newLine()])

  const [stock, setStock] = useState<Map<number, number>>(new Map())
  const [lastCost, setLastCost] = useState<Map<number, number>>(new Map())
  const [debt, setDebt] = useState<number | null>(null)

  const [tab, setTab] = useState<Tab>('items')
  const [section, setSection] = useState<Section>('main')
  const [loading, setLoading] = useState(Boolean(purchaseId))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [dirty, setDirty] = useState(false)
  const [picking, setPicking] = useState(false)
  const [selRow, setSelRow] = useState<string | null>(null)

  const readOnly = status !== 'draft'
  const sup = suppliers.find((s) => s.id === supplier) ?? null

  function touch() { setDirty(true); setOk('') }

  /* ---------------------------------------------- standart qiymatlar */

  useEffect(() => {
    if (warehouse == null && refs.warehouses.length) {
      setWarehouse((refs.warehouses.find((w) => w.is_default) ?? refs.warehouses[0]).id)
    }
  }, [refs.warehouses, warehouse])

  useEffect(() => {
    if (currency === 'UZS') { setRate('1'); return }
    let alive = true
    void supabase.from('ip_exchange_rates').select('rate')
      .eq('currency', currency).lte('rate_date', date)
      .order('rate_date', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => {
        if (alive && data) setRate(String((data as { rate: number }).rate))
      })
    return () => { alive = false }
  }, [currency, date])

  /* ---------------------------------------------- mavjud qoralama */

  useEffect(() => {
    if (!purchaseId) { setLoading(false); return }
    let alive = true
    void Promise.all([
      supabase.from('ip_purchases').select('*').eq('id', purchaseId).single(),
      supabase.from('ip_purchase_items').select('*').eq('purchase_id', purchaseId).order('id'),
    ]).then(([p, it]) => {
      if (!alive || !p.data) { setLoading(false); return }
      const pu = p.data as Purchase & { doc_no: string | null }
      setId(pu.id)
      setDocNo(pu.doc_no)
      setStatus(pu.status as typeof status)
      setSupplier(pu.supplier_id)
      setWarehouse(pu.warehouse_id)
      setDate(pu.doc_date)
      setCurrency(pu.currency)
      setRate(String(pu.fx_rate))
      setNote(pu.note ?? '')
      const items = (it.data as {
        product_id: number; qty: number; unit_cost: number; vat_pct: number
      }[]) ?? []
      setLines(items.length
        ? items.map((i) => ({
            key: Math.random().toString(36).slice(2),
            product_id: i.product_id, qty: String(i.qty), cost: String(i.unit_cost),
            vat_pct: Number(i.vat_pct ?? 0),
          }))
        : [newLine()])
      setLoading(false)
    })
    return () => { alive = false }
  }, [purchaseId])

  /* ---------------------------------------------- yordamchi ma'lumot */

  useEffect(() => {
    if (!supplier) { setDebt(null); return }
    let alive = true
    void supabase.from('ip_supplier_balance').select('debt_base')
      .eq('supplier_id', supplier).maybeSingle()
      .then(({ data }) => {
        if (alive) setDebt((data as { debt_base: number } | null)?.debt_base ?? 0)
      })
    return () => { alive = false }
  }, [supplier])

  useEffect(() => {
    if (!warehouse) return
    let alive = true
    void supabase.rpc('ip_stock_available_rows', { p_warehouse: warehouse })
      .then(({ data }) => {
        if (!alive) return
        const m = new Map<number, number>()
        for (const r of (data ?? []) as { product_id: number; qty: number }[]) {
          m.set(r.product_id, Number(r.qty))
        }
        setStock(m)
      })
    return () => { alive = false }
  }, [warehouse])

  // Oxirgi kelgan tan narx — yangi narx bilan solishtirish uchun
  useEffect(() => {
    let alive = true
    void supabase.from('ip_batches')
      .select('product_id, unit_cost_base, received_at')
      .order('received_at', { ascending: false }).limit(500)
      .then(({ data }) => {
        if (!alive) return
        const m = new Map<number, number>()
        for (const r of (data ?? []) as { product_id: number; unit_cost_base: number }[]) {
          if (!m.has(r.product_id)) m.set(r.product_id, Number(r.unit_cost_base))
        }
        setLastCost(m)
      })
    return () => { alive = false }
  }, [])

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
    () => ({ products, stock, prices: lastCost, unitOf, categoryOf }),
    [products, stock, lastCost, unitOf, categoryOf],
  )

  const valid = lines.filter((l) => l.product_id && Number(l.qty) > 0 && Number(l.cost) > 0)
  const fx = Number(rate) || 1
  const totalDoc = valid.reduce((a, l) => a + Number(l.qty) * Number(l.cost), 0)
  const vatTotal = valid.reduce((a, l) => {
    const line = Number(l.qty) * Number(l.cost)
    return a + line * l.vat_pct / (100 + l.vat_pct)
  }, 0)
  const exVatTotal = totalDoc - vatTotal
  const qtyTotal = valid.reduce((a, l) => a + Number(l.qty), 0)

  /* ---------------------------------------------- qatorlar */

  function patch(key: string, p: Partial<Line>) {
    setLines((ls) => ls.map((x) => (x.key === key ? { ...x, ...p } : x)))
    touch()
  }

  function pickProduct(key: string, pid: number) {
    const c = lastCost.get(pid) ?? 0
    setLines((ls) => ls.map((x) => (x.key === key
      ? { ...x, product_id: pid, qty: x.qty || '1',
          cost: x.cost || (c ? String(Math.round(c)) : ''),
          vat_pct: x.vat_pct || vatRate }
      : x)))
    touch()
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
          const c = lastCost.get(p.product_id) ?? 0
          const l: Line = {
            key: Math.random().toString(36).slice(2),
            product_id: p.product_id, qty: String(p.qty),
            cost: c ? String(Math.round(c)) : '', vat_pct: vatRate,
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

  const write = useCallback(async (): Promise<number | null> => {
    if (!supplier) { setErr('Postavshik tanlanmagan'); return null }
    if (!warehouse) { setErr('Ombor tanlanmagan'); return null }
    if (valid.length === 0) { setErr('Tovar kiritilmagan'); return null }
    setErr('')

    let pid = id
    if (!pid) {
      const { data, error } = await supabase.rpc('ip_create_purchase', {
        p_supplier: supplier, p_warehouse: warehouse,
        p_doc_date: date, p_currency: currency, p_fx_rate: fx,
      })
      if (error) throw new Error(error.message)
      const created = data as Purchase & { doc_no: string | null }
      pid = created.id
      setId(created.id)
      setDocNo(created.doc_no)
    } else {
      await supabase.from('ip_purchase_items').delete().eq('purchase_id', pid)
    }

    const { error: e1 } = await supabase.from('ip_purchases').update({
      supplier_id: supplier, warehouse_id: warehouse, doc_date: date,
      currency, fx_rate: fx, note: note.trim() || null,
    } as never).eq('id', pid)
    if (e1) throw new Error(e1.message)

    const { error: e2 } = await supabase.from('ip_purchase_items').insert(
      valid.map((l) => ({
        purchase_id: pid,
        product_id: l.product_id,
        qty: Number(l.qty),
        unit_cost: Number(l.cost),
        vat_pct: l.vat_pct,
      })) as never,
    )
    if (e2) throw new Error(e2.message)

    // Tan narxni QQS siz qayta hisoblaydi
    await supabase.rpc('ip_recalc_purchase', { p_purchase_id: pid })
    setDirty(false)
    return pid
  }, [supplier, warehouse, date, currency, fx, note, valid, id])

  async function doWrite(close: boolean) {
    setBusy(true)
    try {
      const pid = await write()
      if (pid) { setOk('Qoralama yozildi'); onSaved(); if (close) onClose() }
    } catch (e) {
      setErr(translateDbError(e instanceof Error ? e.message : 'Xato'))
    } finally { setBusy(false) }
  }

  async function doPost(close: boolean) {
    setBusy(true)
    try {
      const pid = await write()
      if (!pid) return
      const { error } = await supabase.rpc('ip_post_purchase', { p_purchase_id: pid })
      if (error) throw new Error(error.message)
      setStatus('posted')
      setOk(`O'tkazildi: ${valid.length} ta tovar omborga kirdi.`)
      onSaved()
      if (close) onClose()
    } catch (e) {
      setErr(translateDbError(e instanceof Error ? e.message : 'Xato'))
    } finally { setBusy(false) }
  }

  function requestClose() {
    if (dirty && !confirm("Saqlanmagan o'zgarishlar bor. Yopilsinmi?")) return
    onClose()
  }

  /* ---------------------------------------------- oyna yorlig'i */

  useEffect(() => {
    self.setMeta({
      title: sup?.name ? `Xarid · ${sup.name.slice(0, 22)}` : 'Xarid (yaratish)',
      subtitle: docNo ?? undefined,
    })
  }, [self, sup?.name, docNo])

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

  if (loading || refs.loading) {
    return <DocWindow><div className="p-8"><Loading /></div></DocWindow>
  }

  const canPost = can('purchases.post') || can('purchases.create')
  const stateLabel = status === 'draft' ? 'Ishlanmagan'
    : status === 'posted' ? "O'tkazilgan" : 'Bekor qilingan'
  const showVat = vatRate > 0 || lines.some((l) => l.vat_pct > 0)

  return (
    <DocWindow>
      <DocTitleBar
        title="Tovar kelishi"
        subtitle={id ? `№ ${docNo ?? id}` : '(yaratish)'}
        onClose={requestClose}
        right={dirty
          ? <span className="text-[12px]" style={{ color: 'var(--warn)' }}>saqlanmagan</span>
          : undefined}
      />

      <DocNav<Section>
        value={section} onChange={setSection}
        items={[{ key: 'main', label: 'Asosiy' }, { key: 'history', label: 'Tarix' }]}
      />

      <DocCommandBar>
        <DocMainButton
          onClick={() => void doPost(true)} disabled={readOnly || busy || !canPost}
          title="Ctrl+Enter"
        >
          <Check size={14} />O'tkazish va yopish
        </DocMainButton>
        <DocBarButton onClick={() => void doWrite(false)} disabled={readOnly || busy} title="Ctrl+S">
          <Save size={14} />Yozish
        </DocBarButton>
        <DocBarButton onClick={() => void doPost(false)} disabled={readOnly || busy || !canPost}>
          O'tkazish
        </DocBarButton>
        <DocDeleteBarButton
          entity="purchase" id={id} disabled={busy}
          title={`Xarid ${docNo ?? id}`}
          onDone={() => { onSaved(); onClose() }}
        />
        <BarSep />
        <DocBarButton onClick={requestClose} disabled={busy} title="Yopish">
          <Ban size={14} />
        </DocBarButton>
      </DocCommandBar>

      {section === 'history' && (
        <div className="flex-1 px-3 py-3">
          <DocHistory entity="ip_purchases" entityId={id} />
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
            label="Postavshik" required
            hint={debt != null && debt > 0 && (
              <span style={{ color: 'var(--danger)' }}>
                Biz qarzdormiz {money(debt)}
              </span>
            )}
          >
            <DocSelect
              value={supplier ?? ''} disabled={readOnly}
              onChange={(v) => { setSupplier(v ? Number(v) : null); touch() }}
              placeholder="Tanlang…"
              options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
            />
          </DocField>
          <DocField label="Ombor" required>
            <DocSelect
              value={warehouse ?? ''} disabled={readOnly}
              onChange={(v) => { setWarehouse(v ? Number(v) : null); touch() }}
              options={refs.warehouses.map((w) => ({ value: w.id, label: w.name }))}
            />
          </DocField>
        </div>

        <div>
          <DocField label="Raqam" width={100}>
            <div
              className="tnum flex h-[30px] items-center rounded border px-2 text-[13px]"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--border-2)',
                       color: 'var(--text-3)' }}
            >
              {docNo ?? '<Avto>'}
            </div>
          </DocField>
          <DocField label="Sana" width={100}>
            <DocInput type="date" value={date} disabled={readOnly}
                      onChange={(v) => { setDate(v); touch() }} />
          </DocField>
          <DocField label="Valyuta" width={100}>
            <DocSelect
              value={currency} disabled={readOnly}
              onChange={(v) => { setCurrency(v); touch() }}
              options={[{ value: 'UZS', label: "so'm" }, { value: 'USD', label: 'USD' }]}
            />
          </DocField>
          {currency !== 'UZS' && (
            <DocField label="Kurs" width={100}>
              <DocInput type="number" value={rate} disabled={readOnly} align="right"
                        onChange={(v) => { setRate(v); touch() }} />
            </DocField>
          )}
        </div>
      </div>

      {err && <div className="px-3 pb-2"><ErrorBox>{err}</ErrorBox></div>}
      {ok && !err && <div className="px-3 pb-2"><InfoBox tone="ok">{ok}</InfoBox></div>}
      {!err && showVat && (
        <div className="px-3 pb-2">
          <InfoBox>
            Tan narx omborga <b>QQS siz</b> kiritiladi — shunda sotuvdagi marja
            haqiqiy foydani ko'rsatadi.
          </InfoBox>
        </div>
      )}

      <DocTabs<Tab>
        value={tab} onChange={setTab}
        tabs={[
          { key: 'items', label: 'Tovarlar', badge: valid.length },
          { key: 'extra', label: "Qo'shimcha" },
        ]}
      />

      <div className="flex-1 px-3 py-2">
        {tab === 'items' && (
          <ItemsGrid
            lines={lines} readOnly={readOnly} selRow={selRow} setSelRow={setSelRow}
            pickCtx={pickCtx} productOf={productOf} unitOf={unitOf}
            showVat={showVat} fx={fx} lastCost={lastCost}
            onPick={pickProduct} onPatch={patch} onAdd={addLine}
            onRemove={removeLine} onMove={moveLine} onOpenPicker={() => setPicking(true)}
          />
        )}

        {tab === 'extra' && (
          <div className="max-w-[560px] pt-2">
            <DocField label="Postavshik qarzi" width={150}>
              <div className="flex h-[30px] items-center text-[13px]"
                   style={{ color: debt && debt > 0 ? 'var(--danger)' : 'var(--text-2)' }}>
                {debt == null ? '—' : debt > 0 ? money(debt) : 'Qarz yo\'q'}
              </div>
            </DocField>
            <p className="mt-2 pl-[158px] text-[12px]" style={{ color: 'var(--text-3)' }}>
              Xarid o'tkazilgandan keyin bu summa oshadi. To'lov Xaridlar
              sahifasidagi "To'lov" tugmasi orqali kiritiladi.
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
            ...(vatTotal > 0
              ? [{ label: 'QQS siz', value: money(exVatTotal, false) },
                 { label: `QQS (${vatRate}%)`, value: money(vatTotal, false) }] : []),
            { label: 'Jami', value: money(totalDoc), strong: true },
            ...(fx !== 1
              ? [{ label: "So'mda", value: money(totalDoc * fx) }] : []),
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
  lines, readOnly, selRow, setSelRow, pickCtx, productOf, unitOf, showVat, fx, lastCost,
  onPick, onPatch, onAdd, onRemove, onMove, onOpenPicker,
}: {
  lines: Line[]
  readOnly: boolean
  selRow: string | null
  setSelRow: (k: string | null) => void
  pickCtx: PickCtx
  productOf: (id: number | null) => Product | null
  unitOf: (id: number | null | undefined) => string
  showVat: boolean
  fx: number
  lastCost: Map<number, number>
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
        <DocBarButton onClick={onOpenPicker} disabled={readOnly} title="Ro'yxatdan tanlash">
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
        <table className="w-full border-collapse text-[13px]"
               style={{ minWidth: showVat ? 1080 : 900 }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)' }}>
              {head('N', 34)}
              {head('Nomenklatura')}
              {head('Miqdor', 92, true)}
              {head('Birlik', 60)}
              {head('Tan narx', 120, true)}
              {showVat ? head('QQS %', 72, true) : null}
              {head('Summa', 132, true)}
              {head('Oldingi narx', 118, true)}
              {head('Ombordagi', 100, true)}
              {head('', 34)}
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const p = productOf(l.product_id)
              const onHand = l.product_id ? pickCtx.stock.get(l.product_id) ?? 0 : 0
              const qty = Number(l.qty) || 0
              const cost = Number(l.cost) || 0
              const sum = qty * cost
              const prev = l.product_id ? lastCost.get(l.product_id) ?? 0 : 0
              // Narx oshgan bo'lsa menejer buni darrov ko'rsin
              const up = prev > 0 && cost * fx > prev * 1.02
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
                      type="number" align="right" value={l.cost} disabled={readOnly}
                      onChange={(v) => onPatch(l.key, { cost: v })}
                    />
                  </td>
                  {showVat && (
                    <td className="border-b border-r px-1 py-[3px]"
                        style={{ borderColor: 'var(--border)' }}>
                      <CellInput
                        type="number" align="right"
                        value={l.vat_pct ? String(l.vat_pct) : ''} disabled={readOnly}
                        onChange={(v) => onPatch(l.key, {
                          vat_pct: Math.max(0, Number(v) || 0) })}
                      />
                    </td>
                  )}
                  <td className="tnum border-b border-r px-2 py-[3px] text-right"
                      style={{ borderColor: 'var(--border)' }}>
                    {sum > 0 ? money(sum, false) : '—'}
                  </td>
                  <td className="tnum border-b border-r px-2 py-[3px] text-right"
                      style={{ borderColor: 'var(--border)',
                               color: up ? 'var(--warn)' : 'var(--text-3)' }}
                      title={up ? 'Narx oldingi partiyadan qimmat' : undefined}>
                    {prev > 0 ? money(prev, false) : '—'}
                  </td>
                  <td className="tnum border-b border-r px-2 py-[3px] text-right"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-3)' }}>
                    {l.product_id ? num(onHand, 2) : '—'}
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
