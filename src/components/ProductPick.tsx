import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Package, Search, Trash2, X } from 'lucide-react'
import type { Product } from '../lib/types'
import { money, num } from '../lib/format'
import { Button, Modal } from './ui'

/**
 * Tovar tanlash: katak ichidagi tez qidiruv (1C dagi tanlash maydoni) va
 * "Tanlash" oynasi (1C dagi «Подобрать») — bir vaqtda bir nechta tovarni
 * qoldiq va narxni ko'rib turib savatga yig'ish uchun.
 */

export interface PickCtx {
  products: Product[]
  /** product_id → erkin qoldiq */
  stock: Map<number, number>
  /** product_id → mijoz narx turi bo'yicha narx */
  prices: Map<number, number>
  /** unit_id → qisqartma */
  unitOf: (id: number | null | undefined) => string
  categoryOf: (id: number | null | undefined) => string
}

function label(p: Product) {
  return p.code ? `${p.code} — ${p.name}` : p.name
}

function matches(p: Product, q: string) {
  if (!q) return true
  const s = q.toLowerCase()
  return p.name.toLowerCase().includes(s)
    || (p.code ?? '').toLowerCase().includes(s)
    || (p.barcode ?? '').toLowerCase().includes(s)
}

/* ------------------------------------------------ Katakdagi tez qidiruv */

export function ProductCombo({
  value, onChange, ctx, autoFocus, disabled,
}: {
  value: number | null
  onChange: (id: number) => void
  ctx: PickCtx
  autoFocus?: boolean
  disabled?: boolean
}) {
  const selected = value ? ctx.products.find((p) => p.id === value) ?? null : null
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [hi, setHi] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)

  const list = useMemo(
    () => ctx.products.filter((p) => matches(p, q)).slice(0, 50),
    [ctx.products, q],
  )

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function choose(p: Product) {
    onChange(p.id)
    setOpen(false)
    setQ('')
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        value={open ? q : selected ? label(selected) : ''}
        placeholder={disabled ? '' : 'Tovarni yozing yoki tanlang…'}
        autoFocus={autoFocus}
        disabled={disabled}
        onFocus={(e) => { setOpen(true); setQ(''); setHi(0); e.target.select() }}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setHi(0) }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setHi((i) => Math.min(i + 1, list.length - 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((i) => Math.max(i - 1, 0)) }
          else if (e.key === 'Enter' && open && list[hi]) { e.preventDefault(); choose(list[hi]) }
          else if (e.key === 'Escape') { setOpen(false) }
        }}
        className="h-[26px] w-full rounded-sm border border-transparent bg-transparent px-1
          text-[13px] outline-none focus:border-[var(--brand)] focus:bg-[var(--surface)]"
      />

      {open && (
        <div
          className="absolute left-0 top-[28px] z-30 max-h-[300px] w-[440px] overflow-auto
            rounded-lg border shadow-lg"
          style={{ background: 'var(--surface)', borderColor: 'var(--border-2)' }}
        >
          {list.length === 0 ? (
            <div className="px-3 py-3 text-[13px]" style={{ color: 'var(--text-3)' }}>
              Topilmadi
            </div>
          ) : list.map((p, i) => {
            const free = ctx.stock.get(p.id) ?? 0
            const price = ctx.prices.get(p.id) ?? 0
            return (
              <button
                key={p.id} type="button"
                onMouseEnter={() => setHi(i)}
                onMouseDown={(e) => { e.preventDefault(); choose(p) }}
                style={{ background: i === hi ? 'var(--brand-soft)' : undefined }}
                className="flex w-full items-center gap-2 px-2.5 py-[5px] text-left text-[13px]"
              >
                <span className="min-w-0 flex-1 truncate">
                  {p.code && (
                    <span className="mr-1.5 tnum" style={{ color: 'var(--text-3)' }}>{p.code}</span>
                  )}
                  {p.name}
                </span>
                <span
                  className="tnum shrink-0 text-right text-[12px]"
                  style={{ width: 78, color: free > 0 ? 'var(--ok)' : 'var(--danger)' }}
                >
                  {num(free, 2)} {ctx.unitOf(p.unit_id)}
                </span>
                <span className="tnum shrink-0 text-right text-[12px]" style={{ width: 92 }}>
                  {price ? money(price, false) : '—'}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------ «Podobrat» oynasi */

export interface PickedLine { product_id: number; qty: number; price: number }

export function ProductPickerModal({
  ctx, onClose, onSubmit,
}: {
  ctx: PickCtx
  onClose: () => void
  onSubmit: (lines: PickedLine[]) => void
}) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<number | 'all'>('all')
  const [onlyStock, setOnlyStock] = useState(false)
  const [basket, setBasket] = useState<Map<number, number>>(new Map())

  const cats = useMemo(() => {
    const seen = new Map<number, string>()
    for (const p of ctx.products) {
      if (p.category_id != null && !seen.has(p.category_id)) {
        seen.set(p.category_id, ctx.categoryOf(p.category_id))
      }
    }
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [ctx])

  const list = useMemo(
    () => ctx.products.filter((p) => {
      if (!matches(p, q)) return false
      if (cat !== 'all' && p.category_id !== cat) return false
      if (onlyStock && (ctx.stock.get(p.id) ?? 0) <= 0) return false
      return true
    }),
    [ctx, q, cat, onlyStock],
  )

  function setQty(id: number, qty: number) {
    setBasket((b) => {
      const n = new Map(b)
      if (qty > 0) n.set(id, qty)
      else n.delete(id)
      return n
    })
  }

  const basketRows = [...basket.entries()].map(([id, qty]) => {
    const p = ctx.products.find((x) => x.id === id)
    const price = ctx.prices.get(id) ?? 0
    return { id, p, qty, price, sum: qty * price }
  })
  const basketTotal = basketRows.reduce((a, r) => a + r.sum, 0)

  return (
    <Modal
      open onClose={onClose} width={960} title="Tovar tanlash"
      footer={
        <>
          <span className="mr-auto text-[13px]" style={{ color: 'var(--text-2)' }}>
            Tanlandi: <b>{basketRows.length}</b> ta · Summa:{' '}
            <b className="tnum">{money(basketTotal)}</b>
          </span>
          <Button onClick={onClose}>Bekor</Button>
          <Button
            variant="primary" disabled={basketRows.length === 0}
            onClick={() => onSubmit(basketRows.map((r) => ({
              product_id: r.id, qty: r.qty, price: r.price,
            })))}
          >
            <Check size={14} />Hujjatga o'tkazish
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--text-3)' }} />
            <input
              value={q} onChange={(e) => setQ(e.target.value)} autoFocus
              placeholder="Nomi, kodi yoki shtrix-kodi…"
              className="h-[32px] w-full rounded-lg border pl-8 pr-2 text-[13px] outline-none
                focus:border-[var(--brand)]"
              style={{ background: 'var(--surface)', borderColor: 'var(--border-2)' }}
            />
          </div>
          <select
            value={cat} onChange={(e) => setCat(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="h-[32px] rounded-lg border px-2 text-[13px] outline-none"
            style={{ background: 'var(--surface)', borderColor: 'var(--border-2)' }}
          >
            <option value="all">Barcha turkumlar</option>
            {cats.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          <label className="inline-flex items-center gap-1.5 text-[13px]"
                 style={{ color: 'var(--text-2)' }}>
            <input type="checkbox" checked={onlyStock}
                   onChange={(e) => setOnlyStock(e.target.checked)} />
            Faqat qoldig'i borlar
          </label>
        </div>

        <div className="max-h-[340px] overflow-auto rounded-lg border"
             style={{ borderColor: 'var(--border)' }}>
          <table className="w-full border-collapse text-[13px]">
            <thead className="sticky top-0 z-10">
              <tr style={{ background: 'var(--surface-2)' }}>
                {['Kod', 'Nomenklatura', 'Erkin qoldiq', 'Narx', 'Miqdor'].map((h, i) => (
                  <th key={h}
                      className={`border-b border-r px-2 py-[6px] text-[12px] font-semibold
                        whitespace-nowrap last:border-r-0 ${i >= 2 ? 'text-right' : 'text-left'}`}
                      style={{ borderColor: 'var(--border)', color: 'var(--text-2)',
                               width: i === 0 ? 90 : i >= 2 ? 110 : undefined }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center"
                        style={{ color: 'var(--text-3)' }}>Topilmadi</td></tr>
              ) : list.map((p) => {
                const free = ctx.stock.get(p.id) ?? 0
                const price = ctx.prices.get(p.id) ?? 0
                const inBasket = basket.get(p.id) ?? 0
                return (
                  <tr key={p.id}
                      style={{ background: inBasket ? 'var(--brand-soft)' : undefined }}
                      className={inBasket ? '' : 'hover:bg-[var(--surface-2)]'}>
                    <td className="tnum border-b border-r px-2 py-[4px]"
                        style={{ borderColor: 'var(--border)', color: 'var(--text-3)' }}>
                      {p.code ?? '—'}
                    </td>
                    <td className="border-b border-r px-2 py-[4px]"
                        style={{ borderColor: 'var(--border)' }}>
                      {p.name}
                    </td>
                    <td className="tnum border-b border-r px-2 py-[4px] text-right"
                        style={{ borderColor: 'var(--border)',
                                 color: free > 0 ? 'var(--ok)' : 'var(--danger)' }}>
                      {num(free, 2)} {ctx.unitOf(p.unit_id)}
                    </td>
                    <td className="tnum border-b border-r px-2 py-[4px] text-right"
                        style={{ borderColor: 'var(--border)' }}>
                      {price ? money(price, false) : '—'}
                    </td>
                    <td className="border-b px-1 py-[3px]" style={{ borderColor: 'var(--border)' }}>
                      <input
                        type="number" value={inBasket || ''}
                        onChange={(e) => setQty(p.id, Number(e.target.value) || 0)}
                        placeholder="0"
                        className="tnum h-[26px] w-full rounded border px-1.5 text-right text-[13px]
                          outline-none focus:border-[var(--brand)]"
                        style={{ background: 'var(--surface)', borderColor: 'var(--border-2)' }}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {basketRows.length > 0 && (
          <div className="rounded-lg border p-2" style={{ borderColor: 'var(--border-2)' }}>
            <div className="mb-1.5 inline-flex items-center gap-1.5 text-[12px] font-semibold"
                 style={{ color: 'var(--text-2)' }}>
              <Package size={13} />Tanlangan tovarlar
            </div>
            <div className="flex flex-wrap gap-1.5">
              {basketRows.map((r) => (
                <span key={r.id}
                      className="inline-flex items-center gap-1.5 rounded border px-2 py-[3px] text-[12px]"
                      style={{ background: 'var(--surface-2)', borderColor: 'var(--border-2)' }}>
                  {r.p?.name ?? r.id}
                  <b className="tnum">{num(r.qty, 2)}</b>
                  <button onClick={() => setQty(r.id, 0)} style={{ color: 'var(--text-3)' }}>
                    <X size={12} />
                  </button>
                </span>
              ))}
              <button
                onClick={() => setBasket(new Map())}
                className="inline-flex items-center gap-1 text-[12px]"
                style={{ color: 'var(--danger)' }}
              >
                <Trash2 size={12} />Tozalash
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
