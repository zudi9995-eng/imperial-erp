import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft, Truck, Undo2, Printer, MapPin, Banknote, Package, CheckCircle2, FileDown,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useRefs, translateDbError } from '../lib/useRefs'
import type { SaleBoardRow, SaleItemRow } from '../lib/types'
import {
  Badge, Button, Card, CardTitle, Empty, ErrorBox, Field, InfoBox, Input, Loading,
  Modal, Stat, Table, Td, Textarea, Th, Tr,
} from './ui'
import { dateShort, isoDate, money, num, pct } from '../lib/format'
import { PayBadge, ShipBadge } from './SaleIndicators'
import { printSaleDoc, printOffer } from './printDoc'
import { useSettings } from '../lib/settings'
import DeleteDocButton from './DeleteDoc'

export default function SaleDetail({ id, onBack }: { id: number; onBack: () => void }) {
  const { can } = useAuth()
  const { n, s: sset } = useSettings()
  const refs = useRefs()
  const [s, setS] = useState<SaleBoardRow | null>(null)
  const [items, setItems] = useState<SaleItemRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [modal, setModal] = useState<'ship' | 'return' | 'delivery' | 'pay' | null>(null)

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([
      supabase.from('ip_sales_board').select('*').eq('id', id).maybeSingle(),
      supabase.from('ip_sale_items')
        .select('*, product:ip_products(name, code, unit_id)')
        .eq('sale_id', id).order('id'),
    ])
    setS(a.data as SaleBoardRow | null)
    setItems((b.data as never) ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => { void load() }, [load])
  if (loading || refs.loading) return <Loading />
  if (!s) return <Empty title="Hujjat topilmadi" action={<Button onClick={onBack}>Orqaga</Button>} />

  const unit = (uid: number | null) => refs.units.find((u) => u.id === uid)?.code ?? ''
  const wh = refs.warehouses.find((w) => w.id === s.warehouse_id)?.name ?? ''
  // Hujjatlarda yetkazib beruvchi sifatida o'z kompaniyasi yoziladi
  const printRefs = { ...refs, company: sset('company_name', '') }

  const canShip = s.status === 'posted' && s.shipment_status !== 'shipped'
    && (can('sales.create') || can('sales.edit'))

  // TypeScript ichki funksiyada null tekshiruvini saqlamaydi
  const doc = s

  /** Mijozga yuboriladigan tijorat taklifi — brauzerda PDF ga saqlanadi */
  function makeOffer() {
    printOffer(
      {
        doc_no: doc.doc_no,
        doc_date: doc.doc_date,
        valid_days: n('offer_valid_days', 7),
        customer_name: doc.customer_name,
        phone: doc.phone,
        manager_name: doc.manager_name,
        manager_phone: null,
        company: sset('company_name', ''),
        note: doc.note,
        delivery_note: doc.delivery_address
          ? `Yetkazib berish manzili: ${doc.delivery_address}`
          : null,
      },
      items.map((i) => ({
        name: i.product?.name ?? '',
        code: i.product?.code ?? null,
        unit_id: i.product?.unit_id ?? null,
        qty: Number(i.qty),
        price: Number(i.price),
        line_total: Number(i.line_total),
        vat_amount: Number((i as { vat_amount?: number }).vat_amount ?? 0),
      })),
      printRefs,
    )
  }

  const canReturn = s.status === 'posted' && s.qty_shipped > 0 && can('sales.cancel')

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button variant="ghost" onClick={onBack}><ArrowLeft size={16} /></Button>
          <div>
            <h1 className="text-[20px] font-semibold leading-tight">
              {s.doc_no ?? `#${s.id}`}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px]" style={{ color: 'var(--text-3)' }}>
              <span className="font-medium" style={{ color: 'var(--text-2)' }}>{s.customer_name}</span>
              <span>{dateShort(s.doc_date)}</span>
              <span>{wh}</span>
              {s.manager_name && <span>· {s.manager_name}</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" onClick={() => printSaleDoc(s, items, printRefs, 'waybill')}>
            <Printer size={14} />Yuk xati
          </Button>
          <Button size="sm" onClick={() => printSaleDoc(s, items, printRefs, 'invoice')}>
            <Printer size={14} />Hisob-faktura
          </Button>
          <Button
            size="sm" onClick={makeOffer}
            title="Mijozga yuborish uchun — PDF sifatida saqlanadi"
          >
            <FileDown size={14} />Tijorat taklifi
          </Button>
          {s.status === 'posted' && Number(s.due_base) > 0 && can('pay.customer') && (
            <Button size="sm" variant="primary" onClick={() => setModal('pay')}>
              <Banknote size={14} />To'lov
            </Button>
          )}
          {canShip && (
            <Button size="sm" variant="primary" onClick={() => setModal('ship')}>
              <Truck size={14} />Yukni chiqarish
            </Button>
          )}
          {canReturn && (
            <Button size="sm" onClick={() => setModal('return')}>
              <Undo2 size={14} />Qaytarish
            </Button>
          )}
          <Button size="sm" onClick={() => setModal('delivery')}>
            <MapPin size={14} />Yetkazish
          </Button>
          <DeleteDocButton
            entity="sale" id={s.id} label="O'chirish"
            title={`Sotuv ${s.doc_no ?? s.id}`}
            onDone={onBack}
          />
        </div>
      </div>

      {err && <div className="mb-4"><ErrorBox>{err}</ErrorBox></div>}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Sof summa" value={money(s.net_base, false)} tone="brand"
          sub={Number(s.returned_base) > 0 ? `Qaytarilgan ${money(s.returned_base, false)}` : undefined} />
        <Stat
          label="To'lov" value={money(s.paid_base, false)}
          tone={s.pay_status === 'paid' ? 'ok' : s.is_overdue ? 'danger' : 'warn'}
          sub={Number(s.due_base) > 0 ? `Qarz ${money(s.due_base, false)}` : "To'liq to'langan"}
        />
        <Stat
          label="Yuk" value={s.shipment_status === 'shipped' ? 'Chiqarilgan'
            : s.shipment_status === 'partial' ? 'Qisman' : 'Chiqmagan'}
          tone={s.shipment_status === 'shipped' ? 'ok'
            : s.shipment_status === 'partial' ? 'warn' : 'danger'}
          sub={`${num(s.qty_shipped, 2)} / ${num(s.qty_total, 2)}`}
        />
        {can('cost.view') && (
          <Stat
            label="Marja" value={s.margin_pct != null ? pct(s.margin_pct) : '—'}
            tone={s.margin_pct == null ? 'neutral' : Number(s.margin_pct) >= 15 ? 'ok' : 'warn'}
            sub={`Foyda ${money(s.gross_profit_base, false)}`}
          />
        )}
      </div>

      {s.shipment_status === 'not_shipped' && (
        <div className="mb-4">
          <InfoBox tone="warn">
            <span className="flex items-start gap-2">
              <Package size={15} className="mt-0.5 shrink-0" />
              <span>
                Tovar <b>band qilingan</b> — ombordan hali chiqmagan. Boshqa sotuvda
                bu miqdor mavjud emas deb hisoblanadi. Tan narx taxminiy, yuk
                chiqarilganda aniq qiymatga almashadi.
              </span>
            </span>
          </InfoBox>
        </div>
      )}

      {(s.delivery_address || s.delivery_driver || s.delivered_at) && (
        <Card className="mb-4">
          <CardTitle>Yetkazib berish</CardTitle>
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-[13px]">
            {s.delivery_address && (
              <span><span style={{ color: 'var(--text-3)' }}>Manzil: </span>{s.delivery_address}</span>
            )}
            {s.delivery_driver && (
              <span><span style={{ color: 'var(--text-3)' }}>Haydovchi: </span>{s.delivery_driver}</span>
            )}
            {s.delivered_at && (
              <span><span style={{ color: 'var(--text-3)' }}>Yetkazilgan: </span>{dateShort(s.delivered_at)}</span>
            )}
          </div>
        </Card>
      )}

      <Card pad={false}>
        <div className="p-4">
          <CardTitle
            sub={
              <span className="flex flex-wrap items-center gap-3">
                <PayBadge r={s} />
                <ShipBadge r={s} />
              </span>
            }
          >
            Tovarlar
          </CardTitle>
          <Table minWidth={can('cost.view') ? 820 : 640}>
            <thead>
              <tr>
                <Th>Tovar</Th>
                <Th w={110} align="right">Miqdor</Th>
                <Th w={110} align="right">Chiqarilgan</Th>
                <Th w={110} align="right">Qaytarilgan</Th>
                <Th w={130} align="right">Narx</Th>
                <Th w={140} align="right">Summa</Th>
                {can('cost.view') && <Th w={90} align="right">Marja</Th>}
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <Tr key={i.id}>
                  <Td>
                    <div className="font-medium">{i.product?.name ?? `#${i.product_id}`}</div>
                    {i.product?.code && (
                      <div className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>{i.product.code}</div>
                    )}
                  </Td>
                  <Td align="right" mono>{num(i.qty, 2)} {unit(i.product?.unit_id ?? null)}</Td>
                  <Td align="right" mono>
                    <span style={{
                      color: Number(i.qty_shipped) >= Number(i.qty) ? 'var(--ok)'
                        : Number(i.qty_shipped) > 0 ? 'var(--warn)' : 'var(--danger)',
                    }}>
                      {num(i.qty_shipped, 2)}
                    </span>
                  </Td>
                  <Td align="right" mono>
                    {Number(i.qty_returned) > 0
                      ? <span style={{ color: 'var(--warn)' }}>{num(i.qty_returned, 2)}</span>
                      : '—'}
                  </Td>
                  <Td align="right" mono>{money(i.price, false)}</Td>
                  <Td align="right" mono>{money(i.line_total, false)}</Td>
                  {can('cost.view') && (
                    <Td align="right" mono>{i.margin_pct != null ? pct(i.margin_pct) : '—'}</Td>
                  )}
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>

      {modal === 'ship' && (
        <ShipModal sale={s} items={items} refs={refs}
          onClose={() => setModal(null)} onDone={() => { setModal(null); void load() }} />
      )}
      {modal === 'return' && (
        <ReturnModal sale={s} items={items} refs={refs}
          onClose={() => setModal(null)} onDone={() => { setModal(null); void load() }} />
      )}
      {modal === 'pay' && (
        <PayModal sale={s}
          onClose={() => setModal(null)} onDone={() => { setModal(null); void load() }} />
      )}
      {modal === 'delivery' && (
        <DeliveryModal sale={s}
          onClose={() => setModal(null)} onDone={() => { setModal(null); void load() }} />
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- */

function ShipModal({
  sale, items, refs, onClose, onDone,
}: {
  sale: SaleBoardRow; items: SaleItemRow[]
  refs: ReturnType<typeof useRefs>; onClose: () => void; onDone: () => void
}) {
  const pending = items.filter((i) => Number(i.qty) > Number(i.qty_shipped))
  const [qty, setQty] = useState<Record<number, string>>(() =>
    Object.fromEntries(pending.map((i) => [i.id, String(Number(i.qty) - Number(i.qty_shipped))])))
  const [date, setDate] = useState(isoDate())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const unit = (uid: number | null) => refs.units.find((u) => u.id === uid)?.code ?? ''

  const full = pending.every((i) =>
    Number(qty[i.id] ?? 0) >= Number(i.qty) - Number(i.qty_shipped))

  async function save() {
    setBusy(true); setErr('')
    const list = pending
      .map((i) => ({ item_id: i.id, qty: Number(qty[i.id] ?? 0) }))
      .filter((x) => x.qty > 0)
    if (list.length === 0) { setBusy(false); setErr('Miqdor kiritilmagan'); return }

    const { error } = await supabase.rpc('ip_ship_sale', {
      p_sale_id: sale.id, p_items: full ? null : list, p_date: date,
    })
    setBusy(false)
    if (error) { setErr(translateDbError(error.message)); return }
    onDone()
  }

  return (
    <Modal
      open onClose={onClose} width={640} title="Yukni chiqarish"
      footer={<><Button onClick={onClose}>Bekor</Button>
        <Button variant="primary" loading={busy} onClick={save}>
          <Truck size={14} />Chiqarish
        </Button></>}
    >
      <div className="space-y-3">
        <InfoBox>
          Tovar FIFO bo'yicha ombordan yechiladi va <b>haqiqiy tan narx</b>{' '}
          hisoblanadi — taxminiy qiymat aniqlashtiriladi.
        </InfoBox>

        <Field label="Chiqarish sanasi">
          <Input type="date" value={date} onChange={setDate} />
        </Field>

        <Table minWidth={460}>
          <thead>
            <tr>
              <Th>Tovar</Th>
              <Th w={120} align="right">Qolgan</Th>
              <Th w={130} align="right">Chiqariladi</Th>
            </tr>
          </thead>
          <tbody>
            {pending.map((i) => {
              const left = Number(i.qty) - Number(i.qty_shipped)
              return (
                <Tr key={i.id}>
                  <Td>{i.product?.name ?? `#${i.product_id}`}</Td>
                  <Td align="right" mono>{num(left, 2)} {unit(i.product?.unit_id ?? null)}</Td>
                  <Td>
                    <Input
                      type="number" className="text-right"
                      value={qty[i.id] ?? ''}
                      onChange={(v) => setQty((q) => ({ ...q, [i.id]: v }))}
                      max={left}
                    />
                  </Td>
                </Tr>
              )
            })}
          </tbody>
        </Table>

        {!full && (
          <InfoBox tone="warn">
            Qisman chiqarish — qolgan tovar band bo'lib turaveradi.
          </InfoBox>
        )}
        {err && <ErrorBox>{err}</ErrorBox>}
      </div>
    </Modal>
  )
}

function ReturnModal({
  sale, items, refs, onClose, onDone,
}: {
  sale: SaleBoardRow; items: SaleItemRow[]
  refs: ReturnType<typeof useRefs>; onClose: () => void; onDone: () => void
}) {
  const avail = items.filter((i) => Number(i.qty_shipped) - Number(i.qty_returned) > 0)
  const [qty, setQty] = useState<Record<number, string>>({})
  const [date, setDate] = useState(isoDate())
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const unit = (uid: number | null) => refs.units.find((u) => u.id === uid)?.code ?? ''

  const REASONS = ['Sifatsiz tovar', 'Noto\'g\'ri tovar', 'Ortiqcha yuborilgan',
    'Mijoz rad etdi', 'Shikastlangan', 'Boshqa']

  const total = avail.reduce((a, i) => a + Number(qty[i.id] ?? 0) * Number(i.price), 0)

  async function save() {
    const list = avail
      .map((i) => ({ item: i, q: Number(qty[i.id] ?? 0) }))
      .filter((x) => x.q > 0)
    if (list.length === 0) { setErr('Qaytariladigan miqdor kiritilmagan'); return }
    if (!reason) { setErr('Sabab tanlanmagan'); return }

    setBusy(true); setErr('')
    try {
      const { data: no } = await supabase.rpc('ip_next_doc_no', { p_prefix: 'QAY', p_date: date })
      const { data: ret, error: e1 } = await supabase.from('ip_returns').insert({
        doc_no: no, sale_id: sale.id, customer_id: sale.customer_id,
        warehouse_id: sale.warehouse_id, doc_date: date, reason,
      } as never).select().single()
      if (e1) throw new Error(e1.message)

      const rid = (ret as { id: number }).id
      const { error: e2 } = await supabase.from('ip_return_items').insert(
        list.map((x) => ({
          return_id: rid, sale_item_id: x.item.id, product_id: x.item.product_id,
          qty: x.q, price: x.item.price,
        })) as never)
      if (e2) throw new Error(e2.message)

      const { error: e3 } = await supabase.rpc('ip_post_return', { p_return_id: rid })
      if (e3) throw new Error(e3.message)
      onDone()
    } catch (e) {
      setErr(translateDbError(e instanceof Error ? e.message : 'Xato'))
    } finally { setBusy(false) }
  }

  return (
    <Modal
      open onClose={onClose} width={640} title="Tovar qaytarishi"
      footer={<><Button onClick={onClose}>Bekor</Button>
        <Button variant="primary" loading={busy} onClick={save} disabled={total <= 0}>
          <Undo2 size={14} />Qaytarish
        </Button></>}
    >
      <div className="space-y-3">
        <InfoBox>
          Tovar omborga qaytadi, mijozning qarzi kamayadi va marja qayta
          hisoblanadi.
        </InfoBox>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Sana"><Input type="date" value={date} onChange={setDate} /></Field>
          <Field label="Sabab" required>
            <select
              value={reason} onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border px-2.5 py-2 text-sm outline-none focus:border-[var(--brand)]"
              style={{ background: 'var(--surface)', borderColor: 'var(--border-2)' }}
            >
              <option value="">Tanlang…</option>
              {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
        </div>

        {avail.length === 0 ? (
          <Empty title="Qaytariladigan tovar yo'q" hint="Faqat chiqarilgan tovarni qaytarish mumkin." />
        ) : (
          <Table minWidth={520}>
            <thead>
              <tr>
                <Th>Tovar</Th>
                <Th w={120} align="right">Mumkin</Th>
                <Th w={130} align="right">Qaytariladi</Th>
                <Th w={130} align="right">Summa</Th>
              </tr>
            </thead>
            <tbody>
              {avail.map((i) => {
                const max = Number(i.qty_shipped) - Number(i.qty_returned)
                const q = Number(qty[i.id] ?? 0)
                return (
                  <Tr key={i.id}>
                    <Td>{i.product?.name ?? `#${i.product_id}`}</Td>
                    <Td align="right" mono>{num(max, 2)} {unit(i.product?.unit_id ?? null)}</Td>
                    <Td>
                      <Input
                        type="number" className="text-right"
                        value={qty[i.id] ?? ''} max={max}
                        onChange={(v) => setQty((s) => ({ ...s, [i.id]: v }))}
                      />
                    </Td>
                    <Td align="right" mono>{q > 0 ? money(q * Number(i.price), false) : '—'}</Td>
                  </Tr>
                )
              })}
            </tbody>
          </Table>
        )}

        {total > 0 && (
          <div className="flex justify-between border-t pt-2 text-[14px] font-semibold">
            <span>Qaytarish summasi</span>
            <span className="tnum">{money(total)}</span>
          </div>
        )}
        {err && <ErrorBox>{err}</ErrorBox>}
      </div>
    </Modal>
  )
}

function DeliveryModal({
  sale, onClose, onDone,
}: { sale: SaleBoardRow; onClose: () => void; onDone: () => void }) {
  const [address, setAddress] = useState(sale.delivery_address ?? '')
  const [driver, setDriver] = useState(sale.delivery_driver ?? '')
  const [vehicle, setVehicle] = useState('')
  const [delivered, setDelivered] = useState(sale.delivered_at ?? '')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function save() {
    setBusy(true); setErr('')
    const { error } = await supabase.from('ip_sales').update({
      delivery_address: address.trim() || null,
      delivery_driver: driver.trim() || null,
      delivery_vehicle: vehicle.trim() || null,
      delivered_at: delivered || null,
      delivery_note: note.trim() || null,
    } as never).eq('id', sale.id)
    setBusy(false)
    if (error) { setErr(translateDbError(error.message)); return }
    onDone()
  }

  return (
    <Modal
      open onClose={onClose} width={520} title="Yetkazib berish"
      footer={<><Button onClick={onClose}>Bekor</Button>
        <Button variant="primary" loading={busy} onClick={save}>Saqlash</Button></>}
    >
      <div className="space-y-3">
        <Field label="Yetkazish manzili">
          <Textarea value={address} onChange={setAddress} rows={2} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Haydovchi"><Input value={driver} onChange={setDriver} /></Field>
          <Field label="Mashina raqami"><Input value={vehicle} onChange={setVehicle} placeholder="01 A 123 BC" /></Field>
        </div>
        <Field label="Yetkazilgan sana">
          <Input type="date" value={delivered} onChange={setDelivered} />
        </Field>
        <Field label="Izoh"><Textarea value={note} onChange={setNote} rows={2} /></Field>
        {err && <ErrorBox>{err}</ErrorBox>}
      </div>
    </Modal>
  )
}


function PayModal({
  sale, onClose, onDone,
}: { sale: SaleBoardRow; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState(String(Number(sale.due_base) || ''))
  const [account, setAccount] = useState<number | null>(null)
  const [date, setDate] = useState(isoDate())
  const [method, setMethod] = useState('cash')
  const [note, setNote] = useState('')
  const [accounts, setAccounts] = useState<{ cash_account_id: number; name: string; balance_base: number }[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [res, setRes] = useState<{ applied: number; advance: number } | null>(null)

  useEffect(() => {
    let alive = true
    void supabase.from('ip_cash_balances').select('*').then(({ data }) => {
      if (!alive) return
      const rows = (data as never as { cash_account_id: number; name: string; balance_base: number }[]) ?? []
      setAccounts(rows)
      setAccount((c) => c ?? rows[0]?.cash_account_id ?? null)
    })
    return () => { alive = false }
  }, [])

  async function save() {
    if (!account) { setErr('Kassa tanlanmagan'); return }
    setBusy(true); setErr('')
    const { data, error } = await supabase.rpc('ip_pay_sale', {
      p_sale_id: sale.id, p_amount: Number(amount), p_account: account,
      p_date: date, p_method: method, p_note: note.trim() || null,
    })
    setBusy(false)
    if (error) { setErr(translateDbError(error.message)); return }
    setRes(data as { applied: number; advance: number })
  }

  if (res) {
    return (
      <Modal open onClose={onDone} width={440} title="To'lov kiritildi"
        footer={<Button variant="primary" onClick={onDone}>Yopish</Button>}>
        <div className="space-y-3">
          <InfoBox tone="ok">
            <b>{money(res.applied)}</b> shu hujjat qarziga yopildi.
          </InfoBox>
          {res.advance > 0 && (
            <InfoBox tone="info">
              Ortgan <b>{money(res.advance)}</b> mijozning avansi sifatida yozildi.
            </InfoBox>
          )}
        </div>
      </Modal>
    )
  }

  const extra = Math.max(0, Number(amount) - Number(sale.due_base))

  return (
    <Modal open onClose={onClose} width={480}
      title={`To'lov — ${sale.doc_no ?? sale.id}`}
      footer={<><Button onClick={onClose}>Bekor</Button>
        <Button variant="primary" loading={busy} onClick={save} disabled={!(Number(amount) > 0)}>
          <Banknote size={14} />Kiritish
        </Button></>}>
      <div className="space-y-3">
        <InfoBox>
          Bu hujjat bo'yicha qarz: <b>{money(sale.due_base)}</b>
          {' · '}mijoz: {sale.customer_name}
        </InfoBox>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Summa" required>
            <Input type="number" className="text-right tnum" value={amount} onChange={setAmount} autoFocus />
          </Field>
          <Field label="Sana"><Input type="date" value={date} onChange={setDate} /></Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Qayerga tushdi" required>
            <select
              value={account ?? ''} onChange={(e) => setAccount(Number(e.target.value))}
              className="w-full rounded-lg border px-2.5 py-2 text-sm outline-none focus:border-[var(--brand)]"
              style={{ background: 'var(--surface)', borderColor: 'var(--border-2)' }}
            >
              {accounts.map((a) => (
                <option key={a.cash_account_id} value={a.cash_account_id}>
                  {a.name} — {money(a.balance_base, false)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="To'lov turi">
            <select
              value={method} onChange={(e) => setMethod(e.target.value)}
              className="w-full rounded-lg border px-2.5 py-2 text-sm outline-none focus:border-[var(--brand)]"
              style={{ background: 'var(--surface)', borderColor: 'var(--border-2)' }}
            >
              <option value="cash">Naqd</option>
              <option value="bank">Bank o'tkazmasi</option>
              <option value="card">Karta</option>
              <option value="other">Boshqa</option>
            </select>
          </Field>
        </div>
        {extra > 0 && (
          <InfoBox tone="warn">
            Summa qarzdan <b>{money(extra)}</b> ko'p — ortgani avans bo'lib qoladi.
          </InfoBox>
        )}
        <Field label="Izoh"><Textarea value={note} onChange={setNote} rows={2} /></Field>
        {err && <ErrorBox>{err}</ErrorBox>}
      </div>
    </Modal>
  )
}
