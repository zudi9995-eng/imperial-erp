import { useCallback, useEffect, useMemo, useState } from 'react'
import { Banknote, Wand2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useRefs, translateDbError } from '../lib/useRefs'
import {
  Button, ErrorBox, Field, InfoBox, Input, Modal, Select, Textarea,
} from './ui'
import { DocTable, DocTd, DocTh, DocTr } from './docList'
import { dateShort, isoDate, money } from '../lib/format'

/**
 * Mijozdan pul qabul qilish.
 *
 * Mijoz qarzi sotuvdagi paid_base dan hisoblanadi, shuning uchun pul
 * aynan sotuvga biriktirilishi kerak. Bu yerda har bir hujjatga qancha
 * tushishini o'zingiz belgilaysiz; «Avtomatik taqsimlash» eng eski
 * hujjatdan boshlab to'ldirib beradi, keyin istagancha tuzatasiz.
 *
 * Taqsimlanmagan qoldiq mijoz avansi bo'lib yoziladi.
 */

interface OpenSale {
  id: number
  doc_no: string | null
  doc_date: string
  due_date: string | null
  contract_id: number | null
  total_base: number
  returned_base: number
  paid_base: number
}

export default function ReceivePayment({
  customerId, customerName, onClose, onDone,
}: {
  customerId: number
  customerName: string
  onClose: () => void
  onDone: () => void
}) {
  const refs = useRefs()
  const [sales, setSales] = useState<OpenSale[]>([])
  const [contracts, setContracts] = useState<{ id: number; number: string }[]>([])
  const [contract, setContract] = useState('')
  const [alloc, setAlloc] = useState<Record<number, string>>({})
  const [amount, setAmount] = useState('')
  const [account, setAccount] = useState<number | null>(null)
  const [date, setDate] = useState(isoDate())
  const [method, setMethod] = useState('bank')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState<{ total: number; sales: number; advance: number } | null>(null)

  const load = useCallback(async () => {
    const [s, c] = await Promise.all([
      supabase.from('ip_sales')
        .select('id, doc_no, doc_date, due_date, contract_id, total_base, returned_base, paid_base')
        .eq('customer_id', customerId).eq('status', 'posted')
        .order('due_date', { ascending: true, nullsFirst: true })
        .order('doc_date', { ascending: true }),
      supabase.from('ip_contracts').select('id, number')
        .eq('customer_id', customerId).eq('is_active', true),
    ])
    const rows = ((s.data as OpenSale[]) ?? [])
      .filter((r) => Number(r.total_base) - Number(r.returned_base) - Number(r.paid_base) > 0.01)
    setSales(rows)
    setContracts((c.data as { id: number; number: string }[]) ?? [])
    setLoading(false)
  }, [customerId])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (account == null && refs.accounts.length) setAccount(refs.accounts[0].id)
  }, [refs.accounts, account])

  const due = (r: OpenSale) =>
    Number(r.total_base) - Number(r.returned_base) - Number(r.paid_base)

  const shown = useMemo(
    () => (contract ? sales.filter((r) => String(r.contract_id) === contract) : sales),
    [sales, contract],
  )

  const allocated = useMemo(
    () => Object.values(alloc).reduce((a, v) => a + (Number(v) || 0), 0),
    [alloc],
  )
  const amt = Number(amount) || 0
  const advance = Math.max(0, amt - allocated)
  const over = allocated > amt + 0.01

  /** Eng eski hujjatdan boshlab to'ldiradi */
  function autoFill() {
    let left = amt
    const next: Record<number, string> = {}
    for (const r of shown) {
      if (left <= 0) break
      const take = Math.min(left, due(r))
      if (take > 0) { next[r.id] = String(Math.round(take)); left -= take }
    }
    setAlloc(next)
  }

  async function save() {
    if (!account) { setErr('Kassa hisobi tanlanmagan'); return }
    if (amt <= 0) { setErr('Summa kiritilmagan'); return }
    if (over) { setErr("Taqsimlangan summa kiritilgan puldan ko'p"); return }

    setBusy(true); setErr('')
    const list = Object.entries(alloc)
      .map(([id, v]) => ({ sale_id: Number(id), amount: Number(v) || 0 }))
      .filter((x) => x.amount > 0)

    const { data, error } = await supabase.rpc('ip_receive_payment', {
      p_customer: customerId,
      p_date: date,
      p_account: account,
      p_method: method,
      p_note: note.trim() || null,
      p_alloc: list,
      p_advance: Math.round(advance),
    })
    setBusy(false)
    if (error) { setErr(translateDbError(error.message)); return }
    setDone(data as { total: number; sales: number; advance: number })
  }

  if (done) {
    return (
      <Modal
        open onClose={onDone} width={460} title="To'lov kiritildi"
        footer={<Button variant="primary" onClick={onDone}>Yopish</Button>}
      >
        <div className="space-y-3">
          <InfoBox tone="ok">
            <b>{money(done.total)}</b> qabul qilindi
            {done.sales > 0 && ` · ${done.sales} ta hujjatga biriktirildi`}.
          </InfoBox>
          {done.advance > 0 && (
            <InfoBox tone="info">
              Taqsimlanmagan <b>{money(done.advance)}</b> mijozning avansi sifatida yozildi.
            </InfoBox>
          )}
        </div>
      </Modal>
    )
  }

  const totalDue = sales.reduce((a, r) => a + due(r), 0)

  return (
    <Modal
      open onClose={() => { if (!busy) onClose() }} width={820}
      title={<span>Pul qabul qilish — <span style={{ color: 'var(--text-2)' }}>{customerName}</span></span>}
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={onClose}>Bekor</Button>
          <Button variant="primary" loading={busy} onClick={() => void save()} disabled={amt <= 0 || over}>
            <Banknote size={14} />Kiritish
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Summa" required>
            <Input type="number" className="text-right tnum" value={amount} onChange={setAmount} autoFocus />
          </Field>
          <Field label="Sana"><Input type="date" value={date} onChange={setDate} /></Field>
          <Field label="Qayerga tushdi" required>
            <Select
              value={account ?? ''} onChange={(v) => setAccount(v ? Number(v) : null)}
              options={refs.accounts.map((a) => ({ value: a.id, label: a.name }))}
            />
          </Field>
          <Field label="To'lov turi">
            <Select
              value={method} onChange={setMethod}
              options={[
                { value: 'bank', label: "Bank o'tkazmasi" },
                { value: 'cash', label: 'Naqd' },
                { value: 'card', label: 'Karta' },
                { value: 'other', label: 'Boshqa' },
              ]}
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {contracts.length > 0 && (
            <span className="flex items-center gap-2 text-[13px]">
              <span style={{ color: 'var(--text-3)' }}>Shartnoma</span>
              <Select
                value={contract} onChange={setContract} placeholder="Hammasi"
                options={contracts.map((c) => ({ value: String(c.id), label: c.number }))}
              />
            </span>
          )}
          <Button size="sm" onClick={autoFill} disabled={amt <= 0}>
            <Wand2 size={13} />Avtomatik taqsimlash
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setAlloc({})}>Tozalash</Button>
          <span className="ml-auto text-[13px]" style={{ color: 'var(--text-3)' }}>
            Jami qarz <b style={{ color: 'var(--text)' }}>{money(totalDue, false)}</b>
          </span>
        </div>

        {loading ? (
          <InfoBox>Hujjatlar yuklanmoqda…</InfoBox>
        ) : shown.length === 0 ? (
          <InfoBox tone="warn">
            Bu mijozda to'lanmagan hujjat yo'q — kiritilgan pul to'liq avans bo'lib yoziladi.
          </InfoBox>
        ) : (
          <div className="max-h-[300px] overflow-auto rounded-lg border"
               style={{ borderColor: 'var(--border)' }}>
            <DocTable minWidth={640}>
              <thead>
                <tr>
                  <DocTh w={130}>Hujjat</DocTh>
                  <DocTh w={100}>Sana</DocTh>
                  <DocTh w={100}>Muddat</DocTh>
                  <DocTh w={140} align="right">Qarz</DocTh>
                  <DocTh w={150} align="right">Shu to'lovdan</DocTh>
                </tr>
              </thead>
              <tbody>
                {shown.map((r, i) => {
                  const d = due(r)
                  const late = r.due_date != null && r.due_date < isoDate()
                  return (
                    <DocTr key={r.id} alt={i % 2 === 1} tone={late ? 'attention' : 'normal'}>
                      <DocTd mono>{r.doc_no ?? `#${r.id}`}</DocTd>
                      <DocTd tone="muted">{dateShort(r.doc_date)}</DocTd>
                      <DocTd tone="muted">{r.due_date ? dateShort(r.due_date) : '—'}</DocTd>
                      <DocTd align="right" mono>{money(d, false)}</DocTd>
                      <DocTd align="right" stopClick>
                        <Input
                          type="number" className="text-right tnum"
                          value={alloc[r.id] ?? ''}
                          onChange={(v) => setAlloc({ ...alloc, [r.id]: v })}
                        />
                      </DocTd>
                    </DocTr>
                  )
                })}
              </tbody>
            </DocTable>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px]">
          <span>
            <span style={{ color: 'var(--text-3)' }}>Taqsimlandi: </span>
            <b className="tnum">{money(allocated, false)}</b>
          </span>
          <span>
            <span style={{ color: 'var(--text-3)' }}>Avansga qoladi: </span>
            <b className="tnum" style={{ color: advance > 0 ? 'var(--info)' : undefined }}>
              {money(advance, false)}
            </b>
          </span>
        </div>

        {over && (
          <ErrorBox>
            Taqsimlangan summa ({money(allocated, false)}) kiritilgan puldan
            ({money(amt, false)}) ko'p.
          </ErrorBox>
        )}

        <Field label="Izoh"><Textarea value={note} onChange={setNote} rows={2} /></Field>

        {err && <ErrorBox>{err}</ErrorBox>}
      </div>
    </Modal>
  )
}
