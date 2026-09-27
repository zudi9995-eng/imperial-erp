import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Ban, Check, Search, Undo2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useRefs, translateDbError } from '../lib/useRefs'
import type { SaleBoardRow, SaleItemRow } from '../lib/types'
import { Empty, ErrorBox, InfoBox, Loading } from './ui'
import {
  BarSep, CellInput, DocBarButton, DocCommandBar, DocField, DocFooter, DocInput,
  DocMainButton, DocNav, DocSelect, DocTitleBar, DocWindow, TotalsBox,
} from './docForm'
import { DocTable, DocTd, DocTh, DocTr } from './docList'
import { dateShort, isoDate, money, num } from '../lib/format'
import { useWindowSelf } from '../lib/windows'
import DocHistory from './DocHistory'

/**
 * Xaridordan tovar qaytarish — 1C «Возврат товаров от покупателя».
 * Hujjat doim sotuvga bog'lanadi: tan narx o'sha sotuvdan olinadi,
 * shunda foyda ham, ombor ham to'g'ri joyiga qaytadi.
 */

const REASONS = [
  'Sifatsiz tovar', "Noto'g'ri tovar", 'Ortiqcha yuborilgan',
  'Mijoz rad etdi', 'Shikastlangan', 'Boshqa',
]

type Section = 'main' | 'history'

export default function ReturnForm({
  winKey, saleId, returnId, onClose, onSaved, onOpenSale,
}: {
  winKey?: string
  /** Qaysi sotuvdan qaytariladi; tanlanmagan bo'lsa formada tanlanadi */
  saleId?: number | null
  /** Mavjud qaytarish hujjatini ko'rish */
  returnId?: number | null
  onClose: () => void
  onSaved: () => void
  onOpenSale: (id: number) => void
}) {
  const self = useWindowSelf(winKey)
  const { can } = useAuth()
  const refs = useRefs()

  const [id, setId] = useState<number | null>(returnId ?? null)
  const [docNo, setDocNo] = useState<string | null>(null)
  const [posted, setPosted] = useState(Boolean(returnId))

  const [sale, setSale] = useState<SaleBoardRow | null>(null)
  const [items, setItems] = useState<SaleItemRow[]>([])
  const [qty, setQty] = useState<Record<number, string>>({})
  const [date, setDate] = useState(isoDate())
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')

  const [picker, setPicker] = useState(!saleId && !returnId)
  const [q, setQ] = useState('')
  const [candidates, setCandidates] = useState<SaleBoardRow[]>([])

  const [section, setSection] = useState<Section>('main')
  const [loading, setLoading] = useState(Boolean(saleId || returnId))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [dirty, setDirty] = useState(false)

  function touch() { setDirty(true); setOk('') }

  /* ---------------------------------------------- sotuvni yuklash */

  const loadSale = useCallback(async (sid: number) => {
    setLoading(true)
    const [a, b] = await Promise.all([
      supabase.from('ip_sales_board').select('*').eq('id', sid).maybeSingle(),
      supabase.from('ip_sale_items')
        .select('*, product:ip_products(name, code, unit_id)')
        .eq('sale_id', sid).order('id'),
    ])
    setSale(a.data as SaleBoardRow | null)
    setItems((b.data as never) ?? [])
    setPicker(false)
    setLoading(false)
  }, [])

  useEffect(() => { if (saleId) void loadSale(saleId) }, [saleId, loadSale])

  // Mavjud qaytarish hujjati — faqat ko'rish uchun
  useEffect(() => {
    if (!returnId) return
    let alive = true
    void Promise.all([
      supabase.from('ip_returns').select('*').eq('id', returnId).single(),
      supabase.from('ip_return_items')
        .select('*, product:ip_products(name, code, unit_id)')
        .eq('return_id', returnId).order('id'),
    ]).then(([r, it]) => {
      if (!alive || !r.data) { setLoading(false); return }
      const rr = r.data as {
        id: number; doc_no: string | null; sale_id: number | null
        doc_date: string; reason: string | null; note: string | null; status: string
      }
      setId(rr.id)
      setDocNo(rr.doc_no)
      setDate(rr.doc_date)
      setReason(rr.reason ?? '')
      setNote(rr.note ?? '')
      setPosted(rr.status === 'posted')
      const rows = (it.data as never as SaleItemRow[]) ?? []
      setItems(rows)
      const m: Record<number, string> = {}
      for (const x of rows) m[x.id] = String(x.qty)
      setQty(m)
      if (rr.sale_id) {
        void supabase.from('ip_sales_board').select('*').eq('id', rr.sale_id).maybeSingle()
          .then(({ data }) => { if (alive) setSale(data as SaleBoardRow | null) })
      }
      setLoading(false)
    })
    return () => { alive = false }
  }, [returnId])

  // Sotuv tanlash ro'yxati
  useEffect(() => {
    if (!picker) return
    let alive = true
    void supabase.from('ip_sales_board').select('*')
      .eq('status', 'posted').gt('qty_shipped', 0)
      .order('doc_date', { ascending: false }).limit(200)
      .then(({ data }) => { if (alive) setCandidates((data as SaleBoardRow[]) ?? []) })
    return () => { alive = false }
  }, [picker])

  /* ---------------------------------------------- hisob-kitob */

  const unitOf = (uid: number | null | undefined) =>
    refs.units.find((u) => u.id === uid)?.code ?? ''

  // Qaytarish mumkin bo'lgan qatorlar: chiqarilgan, lekin hali qaytarilmagan
  const avail = useMemo(
    () => (posted ? items
      : items.filter((i) => Number(i.qty_shipped) - Number(i.qty_returned) > 0)),
    [items, posted],
  )

  const total = avail.reduce(
    (a, i) => a + Number(qty[i.id] ?? 0) * Number(i.price), 0)
  const qtyTotal = avail.reduce((a, i) => a + Number(qty[i.id] ?? 0), 0)
  const vatTotal = avail.reduce((a, i) => {
    const rate = Number((i as { vat_pct?: number }).vat_pct ?? 0)
    return a + Number(qty[i.id] ?? 0) * Number(i.price) * rate / (100 + rate)
  }, 0)

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return candidates
    return candidates.filter((r) => r.customer_name.toLowerCase().includes(s)
      || (r.doc_no ?? '').toLowerCase().includes(s))
  }, [candidates, q])

  /* ---------------------------------------------- saqlash */

  async function doPost(close: boolean) {
    if (!sale) { setErr('Sotuv tanlanmagan'); return }
    const list = avail
      .map((i) => ({ item: i, q: Number(qty[i.id] ?? 0) }))
      .filter((x) => x.q > 0)
    if (list.length === 0) { setErr('Qaytariladigan miqdor kiritilmagan'); return }
    if (!reason) { setErr('Sabab tanlanmagan'); return }

    const over = list.find(
      (x) => x.q > Number(x.item.qty_shipped) - Number(x.item.qty_returned))
    if (over) {
      setErr(`"${over.item.product?.name ?? ''}" bo'yicha qaytarish chiqarilgandan ko'p`)
      return
    }

    setBusy(true); setErr('')
    try {
      const { data: no } = await supabase.rpc('ip_next_doc_no', { p_prefix: 'QAY', p_date: date })
      const { data: ret, error: e1 } = await supabase.from('ip_returns').insert({
        doc_no: no, sale_id: sale.id, customer_id: sale.customer_id,
        warehouse_id: sale.warehouse_id, doc_date: date, reason,
        note: note.trim() || null,
      } as never).select().single()
      if (e1) throw new Error(e1.message)

      const rid = (ret as { id: number; doc_no: string | null }).id
      const { error: e2 } = await supabase.from('ip_return_items').insert(
        list.map((x) => ({
          return_id: rid, sale_item_id: x.item.id, product_id: x.item.product_id,
          qty: x.q, price: x.item.price,
          vat_pct: Number((x.item as { vat_pct?: number }).vat_pct ?? 0),
        })) as never)
      if (e2) throw new Error(e2.message)

      const { error: e3 } = await supabase.rpc('ip_post_return', { p_return_id: rid })
      if (e3) throw new Error(e3.message)

      setId(rid)
      setDocNo((ret as { doc_no: string | null }).doc_no)
      setPosted(true)
      setDirty(false)
      setOk('Qaytarish o\'tkazildi — tovar omborga qaytdi, mijoz qarzi kamaydi.')
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
      title: sale?.customer_name
        ? `Qaytarish · ${sale.customer_name.slice(0, 20)}`
        : 'Qaytarish (yaratish)',
      subtitle: docNo ?? undefined,
    })
  }, [self, sale?.customer_name, docNo])

  useEffect(() => { self.setDirty(dirty) }, [self, dirty])

  const kb = useRef({ doPost, posted })
  kb.current = { doPost, posted }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (kb.current.posted) return
      if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); void kb.current.doPost(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /* ---------------------------------------------- ko'rinish */

  if (loading || refs.loading) {
    return <DocWindow><div className="p-8"><Loading /></div></DocWindow>
  }

  return (
    <DocWindow>
      <DocTitleBar
        title="Xaridordan qaytarish"
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
          onClick={() => void doPost(true)}
          disabled={posted || busy || !sale || !can('sales.cancel')}
          title="Ctrl+Enter"
        >
          <Check size={14} />O'tkazish va yopish
        </DocMainButton>
        <DocBarButton
          onClick={() => void doPost(false)}
          disabled={posted || busy || !sale || !can('sales.cancel')}
        >
          <Undo2 size={14} />O'tkazish
        </DocBarButton>
        <BarSep />
        <DocBarButton
          onClick={() => { setPicker(true); setSale(null); setItems([]); setQty({}) }}
          disabled={posted || busy}
          title="Boshqa sotuvni tanlash"
        >
          Sotuvni almashtirish
        </DocBarButton>
        {sale && (
          <DocBarButton onClick={() => onOpenSale(sale.id)}>
            Sotuv: {sale.doc_no ?? sale.id}
          </DocBarButton>
        )}
        <DocBarButton onClick={requestClose} disabled={busy} title="Yopish">
          <Ban size={14} />
        </DocBarButton>
      </DocCommandBar>

      {section === 'history' && (
        <div className="flex-1 px-3 py-3">
          <DocHistory entity="ip_returns" entityId={id} />
        </div>
      )}

      {section === 'main' && <>

      {/* ---- sotuv tanlash ---- */}
      {picker ? (
        <div className="flex-1 px-3 py-3">
          <div className="mb-2 max-w-[420px]">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2"
                      style={{ color: 'var(--text-3)' }} />
              <input
                value={q} onChange={(e) => setQ(e.target.value)} autoFocus
                placeholder="Mijoz yoki hujjat raqami…"
                className="h-[32px] w-full rounded-lg border pl-8 pr-2 text-[13px] outline-none
                  focus:border-[var(--brand)]"
                style={{ background: 'var(--surface)', borderColor: 'var(--border-2)' }}
              />
            </div>
          </div>
          <p className="mb-2 text-[12px]" style={{ color: 'var(--text-3)' }}>
            Qaytarish qaysi sotuvdan ekanini tanlang — tan narx o'sha hujjatdan olinadi.
          </p>
          {filtered.length === 0 ? (
            <Empty title="Mos sotuv topilmadi"
                   hint="Faqat o'tkazilgan va yuki chiqqan sotuvlardan qaytarish mumkin." />
          ) : (
            <DocTable minWidth={720}>
              <thead>
                <tr>
                  <DocTh w={95}>Sana</DocTh>
                  <DocTh w={130}>Hujjat</DocTh>
                  <DocTh>Mijoz</DocTh>
                  <DocTh w={140} align="right">Summa</DocTh>
                  <DocTh w={110} align="right">Chiqarilgan</DocTh>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <DocTr key={r.id} alt={i % 2 === 1} onClick={() => void loadSale(r.id)}>
                    <DocTd mono>{dateShort(r.doc_date)}</DocTd>
                    <DocTd mono tone="link">{r.doc_no ?? `#${r.id}`}</DocTd>
                    <DocTd tone="link">{r.customer_name}</DocTd>
                    <DocTd align="right" mono>{money(r.net_base, false)}</DocTd>
                    <DocTd align="right" mono>{num(r.qty_shipped, 2)}</DocTd>
                  </DocTr>
                ))}
              </tbody>
            </DocTable>
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-x-6 px-3 py-2 lg:grid-cols-2">
            <div>
              <DocField label="Holat">
                <div
                  className="flex h-[30px] items-center rounded border px-2 text-[13px]"
                  style={{
                    background: 'var(--surface-2)', borderColor: 'var(--border-2)',
                    color: posted ? 'var(--text)' : 'var(--warn)',
                  }}
                >
                  {posted ? "O'tkazilgan" : 'Ishlanmagan'}
                </div>
              </DocField>
              <DocField label="Xaridor">
                <div className="flex h-[30px] items-center text-[13px]"
                     style={{ color: 'var(--brand)' }}>
                  {sale?.customer_name ?? '—'}
                </div>
              </DocField>
              <DocField label="Asos" hint={
                <span style={{ color: 'var(--text-3)' }}>
                  {sale ? `${dateShort(sale.doc_date)} · ${money(sale.net_base)}` : ''}
                </span>
              }>
                <div className="flex h-[30px] items-center text-[13px]"
                     style={{ color: 'var(--brand)' }}>
                  {sale?.doc_no ?? '—'}
                </div>
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
                <DocInput type="date" value={date} disabled={posted}
                          onChange={(v) => { setDate(v); touch() }} />
              </DocField>
              <DocField label="Sabab" width={100} required>
                <DocSelect
                  value={reason} disabled={posted}
                  onChange={(v) => { setReason(v); touch() }}
                  placeholder="Tanlang…"
                  options={REASONS.map((r) => ({ value: r, label: r }))}
                />
              </DocField>
            </div>
          </div>

          {err && <div className="px-3 pb-2"><ErrorBox>{err}</ErrorBox></div>}
          {ok && !err && <div className="px-3 pb-2"><InfoBox tone="ok">{ok}</InfoBox></div>}
          {!err && !posted && (
            <div className="px-3 pb-2">
              <InfoBox tone="warn">
                O'tkazilgandan keyin bekor qilib bo'lmaydi: tovar omborga alohida
                partiya bo'lib qaytadi, mijoz qarzi va foyda darhol kamayadi.
              </InfoBox>
            </div>
          )}

          <div className="flex-1 px-3 py-2">
            {avail.length === 0 ? (
              <Empty
                title="Qaytariladigan tovar yo'q"
                hint="Bu sotuvdagi hamma tovar allaqachon qaytarilgan yoki hali chiqmagan."
              />
            ) : (
              <div className="-mx-1 overflow-x-auto px-1">
                <table className="w-full border-collapse text-[13px]" style={{ minWidth: 820 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-2)' }}>
                      {['N', 'Nomenklatura', 'Sotilgan', 'Chiqarilgan', 'Qaytarilgan',
                        'Qaytariladi', 'Narx', 'Summa'].map((h, i) => (
                        <th
                          key={h}
                          style={{
                            width: i === 0 ? 34 : i >= 2 ? 104 : undefined,
                            borderColor: 'var(--border)', color: 'var(--text-2)',
                          }}
                          className={`border-b border-r px-2 py-[5px] text-[12px] font-semibold
                            whitespace-nowrap last:border-r-0 ${i >= 2 ? 'text-right' : 'text-left'}`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {avail.map((i, idx) => {
                      const shipped = Number(i.qty_shipped)
                      const returned = Number(i.qty_returned)
                      const max = shipped - returned
                      const v = Number(qty[i.id] ?? 0)
                      const over = v > max && !posted
                      return (
                        <tr key={i.id} className="hover:bg-[var(--surface-2)]">
                          <td className="tnum border-b border-r px-2 py-[3px] text-center"
                              style={{ borderColor: 'var(--border)', color: 'var(--text-3)' }}>
                            {idx + 1}
                          </td>
                          <td className="border-b border-r px-2 py-[3px]"
                              style={{ borderColor: 'var(--border)' }}>
                            {i.product?.name ?? `#${i.product_id}`}
                            {i.product?.code && (
                              <span className="ml-1.5 text-[11px]"
                                    style={{ color: 'var(--text-3)' }}>
                                {i.product.code}
                              </span>
                            )}
                          </td>
                          <td className="tnum border-b border-r px-2 py-[3px] text-right"
                              style={{ borderColor: 'var(--border)', color: 'var(--text-3)' }}>
                            {num(i.qty, 2)} {unitOf(i.product?.unit_id)}
                          </td>
                          <td className="tnum border-b border-r px-2 py-[3px] text-right"
                              style={{ borderColor: 'var(--border)' }}>
                            {num(shipped, 2)}
                          </td>
                          <td className="tnum border-b border-r px-2 py-[3px] text-right"
                              style={{ borderColor: 'var(--border)',
                                       color: returned > 0 ? 'var(--warn)' : 'var(--text-3)' }}>
                            {returned > 0 ? num(returned, 2) : '—'}
                          </td>
                          <td className="border-b border-r px-1 py-[3px]"
                              style={{ borderColor: 'var(--border)' }}>
                            {posted ? (
                              <div className="tnum px-1 text-right">{num(i.qty, 2)}</div>
                            ) : (
                              <>
                                <CellInput
                                  type="number" align="right" value={qty[i.id] ?? ''}
                                  onChange={(val) => {
                                    setQty((p) => ({ ...p, [i.id]: val })); touch()
                                  }}
                                />
                                <div className="px-1 text-right text-[11px]"
                                     style={{ color: over ? 'var(--danger)' : 'var(--text-3)' }}>
                                  max {num(max, 2)}
                                </div>
                              </>
                            )}
                          </td>
                          <td className="tnum border-b border-r px-2 py-[3px] text-right"
                              style={{ borderColor: 'var(--border)' }}>
                            {money(i.price, false)}
                          </td>
                          <td className="tnum border-b px-2 py-[3px] text-right"
                              style={{ borderColor: 'var(--border)' }}>
                            {v > 0 ? money(v * Number(i.price), false) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <DocFooter>
            <div className="min-w-[240px] flex-1">
              <label className="mb-1 block text-[12px]" style={{ color: 'var(--text-2)' }}>
                Izoh
              </label>
              <textarea
                value={note} disabled={posted} rows={2}
                onChange={(e) => { setNote(e.target.value); touch() }}
                className="w-full rounded border px-2 py-1.5 text-[13px] outline-none
                  focus:border-[var(--brand)]"
                style={{ background: 'var(--surface)', borderColor: 'var(--border-2)' }}
              />
            </div>
            <TotalsBox
              rows={[
                { label: 'Miqdor', value: num(qtyTotal, 2) },
                ...(vatTotal > 0
                  ? [{ label: 'QQS', value: money(vatTotal, false) }] : []),
                { label: 'Qaytariladi', value: money(total), strong: true, tone: 'danger' },
              ]}
            />
          </DocFooter>
        </>
      )}

      </>}
    </DocWindow>
  )
}
