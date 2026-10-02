import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  PhoneCall, Wallet, AlertTriangle, ArrowDownLeft, Search, RefreshCw,
  Banknote, MessageSquarePlus, CheckCircle2, Clock,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useRefs, translateDbError } from '../lib/useRefs'
import ReceivePayment from '../components/ReceivePayment'
import type { ArAging, ArCustomer } from '../lib/types'
import {
  Badge, Button, Card, CardTitle, Empty, ErrorBox, Field, InfoBox, Input, Loading,
  Modal, PageHeader, Progress, Select, Stat, Table, Td, Textarea, Th, Tr, type Tone,
} from '../components/ui'
import { dateShort, dateUz, isoDate, money, moneyShort, relativeDays } from '../lib/format'

type Tab = 'calls' | 'customers' | 'docs'

const BUCKET_TONE: Record<string, Tone> = {
  'muddatida': 'ok', "muddat yo'q": 'neutral',
  '1-15 kun': 'warn', '16-30 kun': 'warn',
  '31-60 kun': 'danger', '61-90 kun': 'danger', '90+ kun': 'danger',
}

export default function Receivables() {
  const { isOwner, isAccountant } = useAuth()
  const canPay = isOwner || isAccountant
  const [tab, setTab] = useState<Tab>('calls')
  const [rows, setRows] = useState<ArCustomer[]>([])
  const [docs, setDocs] = useState<ArAging[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [payFor, setPayFor] = useState<ArCustomer | null>(null)
  const [callFor, setCallFor] = useState<ArCustomer | null>(null)

  const load = useCallback(async () => {
    const [c, d] = await Promise.all([
      supabase.from('ip_ar_customer').select('*').order('priority').order('net_base', { ascending: false }),
      supabase.from('ip_ar_aging').select('*').order('overdue_days', { ascending: false }).limit(300),
    ])
    if (c.error) setErr(translateDbError(c.error.message))
    else setErr('')
    setRows((c.data as ArCustomer[]) ?? [])
    setDocs((d.data as ArAging[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const sum = useMemo(() => {
    const owing = rows.filter((r) => r.net_base > 0)
    const credit = rows.filter((r) => r.net_base < 0)
    return {
      net: owing.reduce((a, r) => a + r.net_base, 0),
      overdue: rows.reduce((a, r) => a + r.overdue_base, 0),
      advance: credit.reduce((a, r) => a - r.net_base, 0),
      calls: rows.filter((r) => r.priority === 1).length,
      callAmount: rows.filter((r) => r.priority === 1).reduce((a, r) => a + r.net_base, 0),
      gross: rows.reduce((a, r) => a + r.outstanding_base, 0),
    }
  }, [rows])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return rows.filter((r) => !s || r.name.toLowerCase().includes(s))
  }, [rows, q])

  const callQueue = useMemo(
    () => filtered.filter((r) => r.priority <= 2 && r.net_base > 0),
    [filtered],
  )

  if (loading) return <Loading />

  const TABS = ([
    { key: 'calls',     label: `Qo'ng'iroq navbati (${callQueue.length})` },
    { key: 'customers', label: 'Mijozlar bo\'yicha' },
    { key: 'docs',      label: 'Hujjatlar' },
  ] as { key: Tab; label: string }[])

  return (
    <div>
      <PageHeader
        title="Debitor"
        sub={`${dateUz(new Date())} · avans hisobga olingan holda`}
        actions={<Button size="sm" onClick={() => void load()}><RefreshCw size={14} />Yangilash</Button>}
      />

      {err && <div className="mb-4"><ErrorBox>{err}</ErrorBox></div>}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Sof qarz" value={moneyShort(sum.net)} tone="brand" icon={<Wallet size={16} />}
          sub={`Brutto ${moneyShort(sum.gross)} · avans chegirilgan`}
        />
        <Stat
          label="Muddati o'tgan" value={moneyShort(sum.overdue)}
          tone={sum.overdue > 0 ? 'danger' : 'ok'} icon={<AlertTriangle size={16} />}
        />
        <Stat
          label="Bugun qo'ng'iroq" value={sum.calls}
          tone={sum.calls > 0 ? 'warn' : 'ok'} icon={<PhoneCall size={16} />}
          sub={moneyShort(sum.callAmount)}
        />
        <Stat
          label="Biz qarzdormiz" value={moneyShort(sum.advance)}
          tone={sum.advance > 0 ? 'info' : 'neutral'} icon={<ArrowDownLeft size={16} />}
          sub="Mijozlardan olingan avans"
        />
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key} onClick={() => setTab(t.key)}
            className="rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors"
            style={{
              background: tab === t.key ? 'var(--brand-soft)' : 'var(--surface)',
              color: tab === t.key ? 'var(--brand)' : 'var(--text-2)',
              borderColor: tab === t.key ? 'var(--brand)' : 'var(--border-2)',
            }}
          >
            {t.label}
          </button>
        ))}
        <div className="relative ml-auto min-w-[220px] flex-1 sm:flex-none">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Mijoz nomi…"
            className="w-full rounded-lg border py-1.5 pl-8 pr-2.5 text-sm outline-none focus:border-[var(--brand)]"
            style={{ background: 'var(--surface)', borderColor: 'var(--border-2)' }}
          />
        </div>
      </div>

      {tab === 'calls' && (
        <CallQueue
          rows={callQueue} canPay={canPay}
          onPay={setPayFor} onCall={setCallFor}
        />
      )}
      {tab === 'customers' && (
        <CustomerList rows={filtered} canPay={canPay} onPay={setPayFor} onCall={setCallFor} />
      )}
      {tab === 'docs' && <DocList rows={docs} q={q} />}

      {payFor && (
        <ReceivePayment
          customerId={payFor.customer_id} customerName={payFor.name}
          onClose={() => setPayFor(null)}
          onDone={() => { setPayFor(null); void load() }}
        />
      )}
      {callFor && (
        <CallModal
          customer={callFor} onClose={() => setCallFor(null)}
          onDone={() => { setCallFor(null); void load() }}
        />
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- */

function CallQueue({
  rows, canPay, onPay, onCall,
}: {
  rows: ArCustomer[]; canPay: boolean
  onPay: (c: ArCustomer) => void; onCall: (c: ArCustomer) => void
}) {
  if (rows.length === 0) {
    return (
      <Card>
        <Empty
          title="Qo'ng'iroq navbati bo'sh"
          hint="Muddati o'tgan yoki 3 kun ichida to'lanishi kerak bo'lgan qarz yo'q."
          icon={<CheckCircle2 size={22} />}
        />
      </Card>
    )
  }
  return (
    <Card pad={false}>
      <div className="p-4">
        <InfoBox>
          Tartib: eng ko'p kechikkan va eng katta summa yuqorida. Avansi qarzidan
          ko'p bo'lgan mijozlar ro'yxatga kirmaydi — ularga <b>biz</b> qarzdormiz.
        </InfoBox>
        <div className="mt-3">
          <Table minWidth={860}>
            <thead>
              <tr>
                <Th w={40}>#</Th>
                <Th>Mijoz</Th>
                <Th w={130} align="right">Sof qarz</Th>
                <Th w={120} align="right">Kechikish</Th>
                <Th w={130}>Oxirgi aloqa</Th>
                <Th w={170} align="right">Amal</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <Tr key={r.customer_id}>
                  <Td mono><span style={{ color: 'var(--text-3)' }}>{i + 1}</span></Td>
                  <Td>
                    <div className="font-medium">{r.name}</div>
                    <div className="text-[12px]" style={{ color: 'var(--text-3)' }}>
                      {r.phone ?? "telefon yo'q"} · {r.doc_count} hujjat
                      {r.advance_base > 0 && ` · avans ${moneyShort(r.advance_base)}`}
                    </div>
                  </Td>
                  <Td align="right" mono>
                    <span className="font-semibold">{money(r.net_base, false)}</span>
                    {r.overdue_base > 0 && r.overdue_base !== r.net_base && (
                      <div className="text-[11.5px]" style={{ color: 'var(--danger)' }}>
                        muddati o'tgan {moneyShort(r.overdue_base)}
                      </div>
                    )}
                  </Td>
                  <Td align="right">
                    <Badge tone={r.overdue_days > 60 ? 'danger' : r.overdue_days > 0 ? 'warn' : 'info'}>
                      {r.overdue_days > 0 ? `${r.overdue_days} kun` : 'muddat yaqin'}
                    </Badge>
                  </Td>
                  <Td>
                    <span className="text-[12.5px]" style={{ color: 'var(--text-3)' }}>
                      {r.last_contact_at ? dateShort(r.last_contact_at) : '—'}
                    </span>
                    {r.next_action_at && (
                      <div className="text-[11.5px]" style={{ color: 'var(--brand)' }}>
                        {relativeDays(r.next_action_at)}
                      </div>
                    )}
                  </Td>
                  <Td align="right">
                    <span className="flex justify-end gap-1.5">
                      <Button size="sm" onClick={() => onCall(r)}>
                        <MessageSquarePlus size={14} />Qo'ng'iroq
                      </Button>
                      {canPay && (
                        <Button size="sm" variant="primary" onClick={() => onPay(r)}>
                          <Banknote size={14} />To'lov
                        </Button>
                      )}
                    </span>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      </div>
    </Card>
  )
}

function CustomerList({
  rows, canPay, onPay, onCall,
}: {
  rows: ArCustomer[]; canPay: boolean
  onPay: (c: ArCustomer) => void; onCall: (c: ArCustomer) => void
}) {
  const active = rows.filter((r) => r.outstanding_base > 0 || r.advance_base > 0)
  if (active.length === 0) return <Card><Empty title="Qarz ham, avans ham yo'q" /></Card>

  return (
    <Card pad={false}>
      <div className="p-4">
        <Table minWidth={900}>
          <thead>
            <tr>
              <Th>Mijoz</Th>
              <Th w={130} align="right">Qarz</Th>
              <Th w={130} align="right">Avans</Th>
              <Th w={140} align="right">Sof</Th>
              <Th w={110} align="right">Kechikish</Th>
              <Th w={170} align="right">Amal</Th>
            </tr>
          </thead>
          <tbody>
            {active.map((r) => (
              <Tr key={r.customer_id}>
                <Td>
                  <div className="font-medium">{r.name}</div>
                  <div className="text-[12px]" style={{ color: 'var(--text-3)' }}>
                    {r.phone ?? "telefon yo'q"}
                  </div>
                </Td>
                <Td align="right" mono>{r.outstanding_base > 0 ? money(r.outstanding_base, false) : '—'}</Td>
                <Td align="right" mono>
                  {r.advance_base > 0
                    ? <span style={{ color: 'var(--info)' }}>{money(r.advance_base, false)}</span>
                    : '—'}
                </Td>
                <Td align="right" mono>
                  <span
                    className="font-semibold"
                    style={{ color: r.net_base > 0 ? 'var(--text)' : 'var(--info)' }}
                  >
                    {money(r.net_base, false)}
                  </span>
                  {r.net_base < 0 && (
                    <div className="text-[11.5px]" style={{ color: 'var(--info)' }}>biz qarzdormiz</div>
                  )}
                </Td>
                <Td align="right">
                  {r.overdue_days > 0
                    ? <Badge tone={r.overdue_days > 60 ? 'danger' : 'warn'}>{r.overdue_days} kun</Badge>
                    : <span style={{ color: 'var(--text-3)' }}>—</span>}
                </Td>
                <Td align="right">
                  <span className="flex justify-end gap-1.5">
                    <Button size="sm" variant="ghost" onClick={() => onCall(r)}>
                      <MessageSquarePlus size={14} />
                    </Button>
                    {canPay && r.outstanding_base > 0 && (
                      <Button size="sm" onClick={() => onPay(r)}><Banknote size={14} /></Button>
                    )}
                  </span>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </div>
    </Card>
  )
}

function DocList({ rows, q }: { rows: ArAging[]; q: string }) {
  const s = q.trim().toLowerCase()
  const list = rows.filter((r) => !s || r.customer_name.toLowerCase().includes(s))
  if (list.length === 0) return <Card><Empty title="Hujjat yo'q" /></Card>

  return (
    <Card pad={false}>
      <div className="p-4">
        <Table minWidth={860}>
          <thead>
            <tr>
              <Th w={140}>Hujjat</Th>
              <Th>Mijoz</Th>
              <Th w={110}>Sana</Th>
              <Th w={110}>Muddat</Th>
              <Th w={130} align="right">Summa</Th>
              <Th w={130} align="right">Qoldiq</Th>
              <Th w={120} align="center">Guruh</Th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <Tr key={r.sale_id}>
                <Td mono><span className="text-[12.5px]">{r.doc_no ?? `#${r.sale_id}`}</span></Td>
                <Td>{r.customer_name}</Td>
                <Td mono>{dateShort(r.doc_date)}</Td>
                <Td mono>
                  <span style={{ color: r.overdue_days > 0 ? 'var(--danger)' : undefined }}>
                    {r.due_date ? dateShort(r.due_date) : '—'}
                  </span>
                </Td>
                <Td align="right" mono>{money(r.total_base, false)}</Td>
                <Td align="right" mono>{money(r.outstanding_base, false)}</Td>
                <Td align="center">
                  <Badge tone={BUCKET_TONE[r.bucket] ?? 'neutral'}>{r.bucket}</Badge>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </div>
    </Card>
  )
}

function CallModal({
  customer, onClose, onDone,
}: { customer: ArCustomer; onClose: () => void; onDone: () => void }) {
  const [outcome, setOutcome] = useState('promise')
  const [body, setBody] = useState('')
  const [promise, setPromise] = useState('')
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const OUTCOMES = [
    { value: 'promise',    label: "To'lashga va'da berdi" },
    { value: 'partial',    label: "Qisman to'lay olaman dedi" },
    { value: 'no_answer',  label: 'Javob bermadi' },
    { value: 'dispute',    label: 'Summa bilan rozi emas' },
    { value: 'no_money',   label: "Hozir puli yo'q" },
    { value: 'needs_doc',  label: 'Hujjat/faktura kerak' },
    { value: 'other',      label: 'Boshqa' },
  ]

  async function save() {
    setBusy(true); setErr('')
    const { error } = await supabase.rpc('ip_log_call', {
      p_customer: customer.customer_id,
      p_outcome: OUTCOMES.find((o) => o.value === outcome)?.label ?? outcome,
      p_body: body.trim() || null,
      p_next_action: next || null,
      p_promise: promise ? Number(promise) : null,
    })
    setBusy(false)
    if (error) { setErr(translateDbError(error.message)); return }
    onDone()
  }

  return (
    <Modal
      open onClose={onClose} width={520}
      title={<span>Qo'ng'iroq — <span style={{ color: 'var(--text-2)' }}>{customer.name}</span></span>}
      footer={
        <>
          <Button onClick={onClose}>Bekor</Button>
          <Button variant="primary" loading={busy} onClick={save}>Saqlash</Button>
        </>
      }
    >
      <div className="space-y-3">
        <InfoBox>
          Qarz <b>{money(customer.net_base)}</b>
          {customer.overdue_days > 0 && <> · {customer.overdue_days} kun kechikish</>}
          {customer.phone && <> · <span className="tnum">{customer.phone}</span></>}
        </InfoBox>

        <Field label="Natija" required>
          <Select value={outcome} onChange={setOutcome} options={OUTCOMES} />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Va'da qilingan summa" hint="Ixtiyoriy">
            <Input type="number" className="text-right tnum" value={promise} onChange={setPromise} />
          </Field>
          <Field label="Keyingi aloqa sanasi" hint="Kiritilsa vazifa yaratiladi">
            <Input type="date" value={next} onChange={setNext} />
          </Field>
        </div>

        <Field label="Izoh"><Textarea value={body} onChange={setBody} rows={3} /></Field>

        {next && (
          <InfoBox tone="info">
            <span className="flex items-center gap-1.5">
              <Clock size={14} />
              {relativeDays(next)} uchun vazifa yaratiladi
            </span>
          </InfoBox>
        )}

        {err && <ErrorBox>{err}</ErrorBox>}
      </div>
    </Modal>
  )
}
