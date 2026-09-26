import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Plus, RefreshCw, Search,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useRefs, translateDbError } from '../lib/useRefs'
import type { CashBalance, CashCategory, CashLedgerRow } from '../lib/types'
import {
  Badge, Button, Card, CardTitle, Empty, ErrorBox, Field, InfoBox, Input, Loading,
  Modal, Select, Stat, Table, Td, Textarea, Th, Tr, type Tone,
} from './ui'
import { dateShort, isoDate, money, moneyShort, monthStart } from '../lib/format'

const SRC_LABEL: Record<string, string> = {
  payment: 'To\'lov', expense: 'Harajat', loan: 'Qarz', op: 'Qo\'lda',
}
const FLOW_TONE: Record<string, Tone> = {
  operating: 'neutral', financing: 'info', investing: 'warn',
}

/** Barcha pul harakati bitta oqimda — kirim, chiqim, harajat, qarz, ko'chirish */
export default function CashJournal() {
  const refs = useRefs()
  const [rows, setRows] = useState<CashLedgerRow[]>([])
  const [balances, setBalances] = useState<CashBalance[]>([])
  const [cats, setCats] = useState<CashCategory[]>([])
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(isoDate())
  const [acct, setAcct] = useState('')
  const [dir, setDir] = useState('')
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [modal, setModal] = useState<'in' | 'out' | 'transfer' | null>(null)

  const load = useCallback(async () => {
    const [l, b, c] = await Promise.all([
      supabase.from('ip_cash_ledger').select('*')
        .gte('op_date', from).lte('op_date', to)
        .order('op_date', { ascending: false }).order('created_at', { ascending: false })
        .limit(500),
      supabase.from('ip_cash_balances').select('*').order('cash_account_id'),
      supabase.from('ip_cash_categories').select('*').eq('is_active', true).order('sort_order'),
    ])
    if (l.error) setErr(translateDbError(l.error.message))
    else setErr('')
    setRows((l.data as CashLedgerRow[]) ?? [])
    setBalances((b.data as CashBalance[]) ?? [])
    setCats((c.data as CashCategory[]) ?? [])
    setLoading(false)
  }, [from, to])

  useEffect(() => { void load() }, [load])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (acct && String(r.cash_account_id) !== acct && String(r.to_account_id ?? '') !== acct) return false
      if (dir === 'in' && r.direction !== 1) return false
      if (dir === 'out' && r.direction !== -1) return false
      if (dir === 'transfer' && r.to_account_id == null) return false
      if (!s) return true
      return (r.counterparty ?? '').toLowerCase().includes(s)
        || (r.category_name ?? '').toLowerCase().includes(s)
        || (r.doc_no ?? '').toLowerCase().includes(s)
        || (r.description ?? '').toLowerCase().includes(s)
    })
  }, [rows, acct, dir, q])

  const sum = useMemo(() => {
    const real = filtered.filter((r) => r.to_account_id == null)
    return {
      inflow: real.filter((r) => r.direction === 1).reduce((a, r) => a + Number(r.amount_base), 0),
      outflow: real.filter((r) => r.direction === -1).reduce((a, r) => a + Number(r.amount_base), 0),
      transfers: filtered.filter((r) => r.to_account_id != null).length,
    }
  }, [filtered])

  const acctName = (id: number | null) =>
    id == null ? '—' : balances.find((b) => b.cash_account_id === id)?.name ?? `#${id}`

  if (loading || refs.loading) return <Loading />

  const totalCash = balances.reduce((a, b) => a + Number(b.balance_base), 0)

  return (
    <div className="space-y-4">
      {err && <ErrorBox>{err}</ErrorBox>}

      {/* Kassalar */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {balances.map((b) => (
          <Stat
            key={b.cash_account_id} label={b.name}
            value={moneyShort(b.balance_base)}
            tone={Number(b.balance_base) < 0 ? 'danger' : 'neutral'}
            sub={`Boshlang'ich ${moneyShort(b.opening_base)}`}
          />
        ))}
        <Stat label="Jami kassa" value={moneyShort(totalCash)} tone="brand" />
      </div>

      {/* Amallar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={() => setModal('in')}>
          <ArrowDownLeft size={14} />Kirim
        </Button>
        <Button onClick={() => setModal('out')}>
          <ArrowUpRight size={14} />Chiqim
        </Button>
        <Button onClick={() => setModal('transfer')}>
          <ArrowLeftRight size={14} />Ko'chirish
        </Button>
        <Button variant="ghost" onClick={() => void load()}><RefreshCw size={14} /></Button>
      </div>

      <InfoBox>
        Bu yerda <b>hamma pul harakati</b> ko'rinadi: mijoz to'lovlari, postavshikka
        to'lov, harajatlar, qarz to'lovlari, ustav fond, xizmat daromadi va kassalar
        orasidagi ko'chirish. Ko'chirish jami kassaga ta'sir qilmaydi — faqat joyini
        o'zgartiradi.
      </InfoBox>

      {/* Filtrlar */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-[150px]"><Field label="Dan"><Input type="date" value={from} onChange={setFrom} /></Field></div>
        <div className="w-[150px]"><Field label="Gacha"><Input type="date" value={to} onChange={setTo} /></Field></div>
        <div className="w-[170px]">
          <Field label="Kassa">
            <Select
              value={acct} onChange={setAcct} placeholder="Hammasi"
              options={balances.map((b) => ({ value: String(b.cash_account_id), label: b.name }))}
            />
          </Field>
        </div>
        <div className="w-[150px]">
          <Field label="Yo'nalish">
            <Select
              value={dir} onChange={setDir} placeholder="Hammasi"
              options={[
                { value: 'in', label: 'Kirim' },
                { value: 'out', label: 'Chiqim' },
                { value: 'transfer', label: "Ko'chirish" },
              ]}
            />
          </Field>
        </div>
        <div className="relative min-w-[200px] flex-1">
          <Search size={15} className="absolute left-2.5 top-[30px] -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
          <Field label="Qidiruv">
            <input
              value={q} onChange={(e) => setQ(e.target.value)} placeholder="Kontragent, toifa, hujjat…"
              className="w-full rounded-lg border py-2 pl-8 pr-2.5 text-sm outline-none focus:border-[var(--brand)]"
              style={{ background: 'var(--surface)', borderColor: 'var(--border-2)' }}
            />
          </Field>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Kirim" value={moneyShort(sum.inflow)} tone="ok" icon={<ArrowDownLeft size={16} />} />
        <Stat label="Chiqim" value={moneyShort(sum.outflow)} tone="danger" icon={<ArrowUpRight size={16} />} />
        <Stat
          label="Sof oqim" value={moneyShort(sum.inflow - sum.outflow)}
          tone={sum.inflow - sum.outflow >= 0 ? 'ok' : 'danger'}
          sub={sum.transfers > 0 ? `${sum.transfers} ta ko'chirish (hisobga kirmaydi)` : undefined}
        />
      </div>

      <Card pad={false}>
        <div className="p-4">
          <CardTitle sub={`${filtered.length} ta harakat`}>Kassa jurnali</CardTitle>
          {filtered.length === 0 ? (
            <Empty title="Harakat yo'q" hint="Sana oralig'ini o'zgartiring yoki yangi kirim/chiqim kiriting." />
          ) : (
            <Table minWidth={900}>
              <thead>
                <tr>
                  <Th w={100}>Sana</Th>
                  <Th w={90} align="center">Turi</Th>
                  <Th w={170}>Toifa</Th>
                  <Th>Kontragent / izoh</Th>
                  <Th w={150}>Kassa</Th>
                  <Th w={150} align="right">Summa</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const isTransfer = r.to_account_id != null
                  return (
                    <Tr key={`${r.source}-${r.source_id}`}>
                      <Td mono>{dateShort(r.op_date)}</Td>
                      <Td align="center">
                        <Badge tone={isTransfer ? 'neutral' : r.direction === 1 ? 'ok' : 'warn'}>
                          {isTransfer ? "ko'chirish" : r.direction === 1 ? 'kirim' : 'chiqim'}
                        </Badge>
                      </Td>
                      <Td>
                        <span className="text-[13px]">{r.category_name}</span>
                        {r.flow_kind !== 'operating' && (
                          <Badge tone={FLOW_TONE[r.flow_kind] ?? 'neutral'} className="ml-1.5">
                            {r.flow_kind === 'financing' ? 'moliyaviy' : 'investitsiya'}
                          </Badge>
                        )}
                      </Td>
                      <Td>
                        <div className="font-medium">{r.counterparty ?? '—'}</div>
                        {(r.doc_no || r.description) && (
                          <div className="line-clamp-1 text-[11.5px]" style={{ color: 'var(--text-3)' }}>
                            {r.doc_no ? `${r.doc_no} · ` : ''}{r.description ?? ''}
                          </div>
                        )}
                      </Td>
                      <Td>
                        <span className="text-[12.5px]">
                          {acctName(r.cash_account_id)}
                          {isTransfer && <> → {acctName(r.to_account_id)}</>}
                        </span>
                      </Td>
                      <Td align="right" mono>
                        <span
                          className="font-semibold"
                          style={{
                            color: isTransfer ? 'var(--text-3)'
                              : r.direction === 1 ? 'var(--ok)' : 'var(--danger)',
                          }}
                        >
                          {isTransfer ? '' : r.direction === 1 ? '+' : '−'}
                          {money(r.amount_base, false)}
                        </span>
                      </Td>
                    </Tr>
                  )
                })}
              </tbody>
            </Table>
          )}
        </div>
      </Card>

      {modal && modal !== 'transfer' && (
        <CashOpModal
          direction={modal === 'in' ? 1 : -1}
          cats={cats.filter((c) => c.direction === (modal === 'in' ? 1 : -1) && !c.is_system)}
          accounts={balances}
          onClose={() => setModal(null)}
          onDone={() => { setModal(null); void load() }}
        />
      )}
      {modal === 'transfer' && (
        <TransferModal
          accounts={balances}
          onClose={() => setModal(null)}
          onDone={() => { setModal(null); void load() }}
        />
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- */

function CashOpModal({
  direction, cats, accounts, onClose, onDone,
}: {
  direction: 1 | -1
  cats: CashCategory[]
  accounts: CashBalance[]
  onClose: () => void
  onDone: () => void
}) {
  const [cat, setCat] = useState<number | null>(cats[0]?.id ?? null)
  const [amount, setAmount] = useState('')
  const [account, setAccount] = useState<number | null>(accounts[0]?.cash_account_id ?? null)
  const [date, setDate] = useState(isoDate())
  const [counterparty, setCounterparty] = useState('')
  const [desc, setDesc] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const isIn = direction === 1

  async function save() {
    if (!cat) { setErr('Toifa tanlanmagan'); return }
    if (!account) { setErr('Kassa tanlanmagan'); return }
    if (!(Number(amount) > 0)) { setErr('Summa kiritilmagan'); return }
    setBusy(true); setErr('')
    const { error } = await supabase.rpc('ip_add_cash_op', {
      p_category: cat, p_amount: Number(amount), p_account: account,
      p_date: date, p_description: desc.trim() || null,
      p_counterparty: counterparty.trim() || null,
    })
    setBusy(false)
    if (error) { setErr(translateDbError(error.message)); return }
    onDone()
  }

  return (
    <Modal
      open onClose={onClose} width={500}
      title={isIn ? 'Pul kirimi' : 'Pul chiqimi'}
      footer={
        <>
          <Button onClick={onClose}>Bekor</Button>
          <Button variant="primary" loading={busy} onClick={save}>Saqlash</Button>
        </>
      }
    >
      <div className="space-y-3">
        <InfoBox>
          {isIn
            ? "Mijoz to'lovini bu yerdan emas, Debitor bo'limidan kiriting — u qarzga bog'lanadi. Bu yerda ustav fond, xizmat daromadi va boshqa kirimlar."
            : "Operatsion harajatni Moliya → Harajatlar dan kiriting. Bu yerda ta'sischi olib chiqqan pul va boshqa chiqimlar."}
        </InfoBox>

        <Field label="Toifa" required>
          <Select
            value={cat ?? ''} onChange={(v) => setCat(v ? Number(v) : null)}
            options={cats.map((c) => ({ value: c.id, label: c.name }))}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Summa" required>
            <Input type="number" className="text-right tnum" value={amount} onChange={setAmount} autoFocus />
          </Field>
          <Field label="Sana"><Input type="date" value={date} onChange={setDate} /></Field>
        </div>

        <Field label={isIn ? 'Qaysi kassaga' : 'Qaysi kassadan'} required>
          <Select
            value={account ?? ''} onChange={(v) => setAccount(v ? Number(v) : null)}
            options={accounts.map((a) => ({
              value: a.cash_account_id,
              label: `${a.name} — ${money(a.balance_base, false)}`,
            }))}
          />
        </Field>

        <Field label="Kimdan / kimga" hint="Ixtiyoriy">
          <Input value={counterparty} onChange={setCounterparty} placeholder="Ism yoki tashkilot" />
        </Field>
        <Field label="Izoh"><Textarea value={desc} onChange={setDesc} rows={2} /></Field>

        {err && <ErrorBox>{err}</ErrorBox>}
      </div>
    </Modal>
  )
}

function TransferModal({
  accounts, onClose, onDone,
}: { accounts: CashBalance[]; onClose: () => void; onDone: () => void }) {
  const [from, setFrom] = useState<number | null>(accounts[0]?.cash_account_id ?? null)
  const [to, setTo] = useState<number | null>(accounts[1]?.cash_account_id ?? null)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(isoDate())
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const fromBal = accounts.find((a) => a.cash_account_id === from)

  async function save() {
    if (!from || !to) { setErr('Kassalar tanlanmagan'); return }
    setBusy(true); setErr('')
    const { error } = await supabase.rpc('ip_transfer_cash', {
      p_from: from, p_to: to, p_amount: Number(amount),
      p_date: date, p_note: note.trim() || null,
    })
    setBusy(false)
    if (error) { setErr(translateDbError(error.message)); return }
    onDone()
  }

  return (
    <Modal
      open onClose={onClose} width={480} title="Kassalar orasida ko'chirish"
      footer={
        <>
          <Button onClick={onClose}>Bekor</Button>
          <Button variant="primary" loading={busy} onClick={save} disabled={!(Number(amount) > 0)}>
            Ko'chirish
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <InfoBox>
          Jami kassa o'zgarmaydi — pul faqat joyini almashtiradi. Naqd oqim
          hisobotiga kirmaydi.
        </InfoBox>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Qayerdan" required>
            <Select
              value={from ?? ''} onChange={(v) => setFrom(v ? Number(v) : null)}
              options={accounts.map((a) => ({
                value: a.cash_account_id, label: `${a.name} — ${money(a.balance_base, false)}`,
              }))}
            />
          </Field>
          <Field label="Qayerga" required>
            <Select
              value={to ?? ''} onChange={(v) => setTo(v ? Number(v) : null)}
              options={accounts.filter((a) => a.cash_account_id !== from)
                .map((a) => ({ value: a.cash_account_id, label: a.name }))}
            />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Summa" required
            hint={fromBal ? `Mavjud: ${money(fromBal.balance_base)}` : undefined}
          >
            <Input type="number" className="text-right tnum" value={amount} onChange={setAmount} autoFocus />
          </Field>
          <Field label="Sana"><Input type="date" value={date} onChange={setDate} /></Field>
        </div>
        <Field label="Izoh"><Textarea value={note} onChange={setNote} rows={2} /></Field>
        {err && <ErrorBox>{err}</ErrorBox>}
      </div>
    </Modal>
  )
}
