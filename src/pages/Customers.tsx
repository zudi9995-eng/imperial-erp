import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Search, Plus, Users, UserCheck, Phone, ArrowLeft, Pencil, MessageSquarePlus,
  FileText, ShoppingCart, Wallet, TrendingUp, Clock, AlertTriangle,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useRefs, translateDbError } from '../lib/useRefs'
import type {
  Activity, Contract, Customer, CustomerStats, CustomerStatus, Sale,
} from '../lib/types'
import {
  Badge, Button, Card, CardTitle, Empty, ErrorBox, Field, InfoBox, Input, Loading,
  Modal, PageHeader, Select, Stat, Table, Td, Textarea, Th, Toggle, Tr, type Tone,
} from '../components/ui'
import {
  dateShort, dateTimeUz, isoDate, money, moneyShort, pct, relativeDays,
} from '../lib/format'

const STATUS_LABEL: Record<CustomerStatus, string> = {
  lead: 'Lid', active: 'Faol', sleeping: 'Uxlayotgan', lost: "Yo'qotilgan", blocked: 'Bloklangan',
}
const STATUS_TONE: Record<CustomerStatus, Tone> = {
  lead: 'info', active: 'ok', sleeping: 'warn', lost: 'neutral', blocked: 'danger',
}

export default function Customers() {
  const [openId, setOpenId] = useState<number | null>(null)
  return openId
    ? <CustomerCard id={openId} onBack={() => setOpenId(null)} />
    : <CustomerList onOpen={setOpenId} />
}

/* ================================================================ */
/*  RO'YXAT                                                          */
/* ================================================================ */

function CustomerList({ onOpen }: { onOpen: (id: number) => void }) {
  const { isOwner } = useAuth()
  const refs = useRefs()
  const [rows, setRows] = useState<CustomerStats[]>([])
  const [q, setQ] = useState('')
  const [mgr, setMgr] = useState('')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [sel, setSel] = useState<Set<number>>(new Set())
  const [assigning, setAssigning] = useState(false)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('ip_customer_stats').select('*').order('name')
    if (error) setErr(translateDbError(error.message))
    setRows((data as CustomerStats[]) ?? [])
    setSel(new Set())
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (mgr === '__none' && r.manager_id) return false
      if (mgr && mgr !== '__none' && r.manager_id !== mgr) return false
      return !s || r.name.toLowerCase().includes(s)
    })
  }, [rows, q, mgr])

  const mgrName = (id: string | null) =>
    id ? refs.profiles.find((p) => p.id === id)?.full_name ?? '—' : null

  if (loading || refs.loading) return <Loading />

  const unassigned = rows.filter((r) => !r.manager_id).length
  const totalDebt = rows.reduce((a, r) => a + Math.max(0, Number(r.net_base)), 0)

  return (
    <div>
      <PageHeader
        title="Mijozlar"
        sub={`${rows.length} mijoz · ${unassigned} tasi taqsimlanmagan`}
        actions={isOwner && (
          <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
            <Plus size={14} />Yangi mijoz
          </Button>
        )}
      />

      {err && <div className="mb-4"><ErrorBox>{err}</ErrorBox></div>}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Mijoz" value={rows.length} icon={<Users size={16} />} />
        <Stat
          label="Taqsimlanmagan" value={unassigned}
          tone={unassigned > 0 ? 'warn' : 'ok'} icon={<UserCheck size={16} />}
        />
        <Stat label="Sof qarz" value={moneyShort(totalDebt)} tone="brand" icon={<Wallet size={16} />} />
        <Stat label="Faol" value={rows.filter((r) => r.status === 'active').length} tone="ok" />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
          <input
            value={q} onChange={(e) => setQ(e.target.value)} placeholder="Mijoz nomi…"
            className="w-full rounded-lg border py-2 pl-8 pr-2.5 text-sm outline-none focus:border-[var(--brand)]"
            style={{ background: 'var(--surface)', borderColor: 'var(--border-2)' }}
          />
        </div>
        {isOwner && (
          <div className="w-[210px]">
            <Select
              value={mgr} onChange={setMgr} placeholder="Hamma menejer"
              options={[
                { value: '__none', label: '— taqsimlanmagan —' },
                ...refs.profiles.filter((p) => p.role !== 'accountant')
                  .map((p) => ({ value: p.id, label: p.full_name })),
              ]}
            />
          </div>
        )}
        {isOwner && sel.size > 0 && (
          <Button variant="primary" onClick={() => setAssigning(true)}>
            <UserCheck size={14} />{sel.size} tasini taqsimlash
          </Button>
        )}
      </div>

      <Card pad={false}>
        <div className="p-4">
          {filtered.length === 0 ? (
            <Empty title="Mijoz topilmadi" hint="Qidiruv yoki filtrni o'zgartiring." />
          ) : (
            <Table minWidth={isOwner ? 1000 : 820}>
              <thead>
                <tr>
                  {isOwner && (
                    <Th w={36}>
                      <input
                        type="checkbox"
                        checked={sel.size > 0 && sel.size === filtered.length}
                        onChange={(e) => setSel(e.target.checked
                          ? new Set(filtered.map((r) => r.customer_id)) : new Set())}
                      />
                    </Th>
                  )}
                  <Th>Mijoz</Th>
                  {isOwner && <Th w={160}>Menejer</Th>}
                  <Th w={130} align="right">Sotuv</Th>
                  <Th w={90} align="right">Marja</Th>
                  <Th w={140} align="right">Sof qarz</Th>
                  <Th w={120} align="right">Oxirgi sotuv</Th>
                  <Th w={100} align="center">Holat</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <Tr key={r.customer_id} onClick={() => onOpen(r.customer_id)}>
                    {isOwner && (
                      <Td>
                        <input
                          type="checkbox" checked={sel.has(r.customer_id)}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            const next = new Set(sel)
                            if (e.target.checked) next.add(r.customer_id)
                            else next.delete(r.customer_id)
                            setSel(next)
                          }}
                        />
                      </Td>
                    )}
                    <Td>
                      <div className="font-medium">{r.name}</div>
                      <div className="text-[12px]" style={{ color: 'var(--text-3)' }}>
                        {r.phone ?? "telefon yo'q"}
                      </div>
                    </Td>
                    {isOwner && (
                      <Td>
                        {mgrName(r.manager_id)
                          ?? <Badge tone="warn">taqsimlanmagan</Badge>}
                      </Td>
                    )}
                    <Td align="right" mono>
                      {Number(r.revenue_base) > 0 ? money(r.revenue_base, false) : '—'}
                      {r.sale_count > 0 && (
                        <div className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>
                          {r.sale_count} hujjat
                        </div>
                      )}
                    </Td>
                    <Td align="right" mono>{r.margin_pct != null ? pct(r.margin_pct) : '—'}</Td>
                    <Td align="right" mono>
                      <span
                        className="font-semibold"
                        style={{ color: Number(r.net_base) > 0 ? 'var(--text)' : 'var(--info)' }}
                      >
                        {money(r.net_base, false)}
                      </span>
                      {Number(r.net_base) < 0 && (
                        <div className="text-[11.5px]" style={{ color: 'var(--info)' }}>avans</div>
                      )}
                    </Td>
                    <Td align="right">
                      {r.last_sale_at ? (
                        <span
                          className="text-[12.5px]"
                          style={{ color: (r.days_since_sale ?? 0) > 90 ? 'var(--warn)' : 'var(--text-2)' }}
                        >
                          {dateShort(r.last_sale_at)}
                        </span>
                      ) : <span style={{ color: 'var(--text-3)' }}>—</span>}
                    </Td>
                    <Td align="center">
                      <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </Card>

      {assigning && (
        <AssignModal
          count={sel.size} ids={[...sel]}
          onClose={() => setAssigning(false)}
          onDone={() => { setAssigning(false); void load() }}
        />
      )}
      {creating && (
        <CustomerModal
          value={{ status: 'active', is_active: true }}
          onClose={() => setCreating(false)} onDone={() => { setCreating(false); void load() }}
        />
      )}
    </div>
  )
}

function AssignModal({
  count, ids, onClose, onDone,
}: { count: number; ids: number[]; onClose: () => void; onDone: () => void }) {
  const refs = useRefs()
  const [mgr, setMgr] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function save() {
    setBusy(true); setErr('')
    const { error } = await supabase.rpc('ip_assign_manager', {
      p_customers: ids, p_manager: mgr || null,
    })
    setBusy(false)
    if (error) { setErr(translateDbError(error.message)); return }
    onDone()
  }

  const managers = refs.profiles.filter((p) => p.role === 'manager' || p.role === 'owner')

  return (
    <Modal
      open onClose={onClose} width={440} title={`${count} ta mijozni taqsimlash`}
      footer={
        <>
          <Button onClick={onClose}>Bekor</Button>
          <Button variant="primary" loading={busy} onClick={save}>Taqsimlash</Button>
        </>
      }
    >
      <div className="space-y-3">
        <InfoBox>
          Mijoz bilan birga uning <b>boshlang'ich qarz hujjatlari</b> ham yangi
          menejerga o'tadi — debitor ro'yxatida to'g'ri ko'rinishi uchun.
        </InfoBox>
        <Field label="Menejer" required>
          <Select
            value={mgr} onChange={setMgr} placeholder="— biriktirmaslik —"
            options={managers.map((p) => ({
              value: p.id,
              label: `${p.full_name}${p.role === 'owner' ? " (ta'sischi)" : ''}`,
            }))}
          />
        </Field>
        {managers.filter((p) => p.role === 'manager').length === 0 && (
          <InfoBox tone="warn">
            Hali sotuv menejeri yo'q. Xodimlar bo'limidan hisob oching.
          </InfoBox>
        )}
        {err && <ErrorBox>{err}</ErrorBox>}
      </div>
    </Modal>
  )
}

/* ================================================================ */
/*  KARTOCHKA                                                        */
/* ================================================================ */

function CustomerCard({ id, onBack }: { id: number; onBack: () => void }) {
  const { isOwner } = useAuth()
  const refs = useRefs()
  const [c, setC] = useState<Customer | null>(null)
  const [st, setSt] = useState<CustomerStats | null>(null)
  const [sales, setSales] = useState<Sale[]>([])
  const [acts, setActs] = useState<(Activity & { actor: { full_name: string } | null })[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)

  const load = useCallback(async () => {
    const [a, b, s, ac, ct] = await Promise.all([
      supabase.from('ip_customers').select('*').eq('id', id).maybeSingle(),
      supabase.from('ip_customer_stats').select('*').eq('customer_id', id).maybeSingle(),
      supabase.from('ip_sales').select('*').eq('customer_id', id)
        .order('doc_date', { ascending: false }).limit(50),
      supabase.from('ip_activities').select('*, actor:ip_profiles(full_name)')
        .eq('customer_id', id).order('happened_at', { ascending: false }).limit(30),
      supabase.from('ip_contracts').select('*').eq('customer_id', id).order('signed_at', { ascending: false }),
    ])
    setC(a.data as Customer | null)
    setSt(b.data as CustomerStats | null)
    setSales((s.data as Sale[]) ?? [])
    setActs((ac.data as never) ?? [])
    setContracts((ct.data as Contract[]) ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => { void load() }, [load])
  if (loading) return <Loading />
  if (!c || !st) return <Empty title="Mijoz topilmadi" action={<Button onClick={onBack}>Orqaga</Button>} />

  const tierName = refs.tiers.find((t) => t.id === c.tier_id)?.name
  const termName = refs.terms.find((t) => t.id === c.payment_term_id)?.name
  const mgrName = refs.profiles.find((p) => p.id === c.manager_id)?.full_name

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button variant="ghost" onClick={onBack}><ArrowLeft size={16} /></Button>
          <div>
            <h1 className="text-[20px] font-semibold leading-tight">{c.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px]" style={{ color: 'var(--text-3)' }}>
              <Badge tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge>
              {tierName && <Badge tone="brand">{tierName}</Badge>}
              {c.phone && <span className="tnum">{c.phone}</span>}
              {c.inn && <span>STIR {c.inn}</span>}
              {mgrName && <span>· {mgrName}</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={`/sales?customer=${id}`}>
            <Button size="sm" variant="primary"><ShoppingCart size={14} />Sotuv kiritish</Button>
          </Link>
          <Link to="/receivables">
            <Button size="sm"><Wallet size={14} />Debitor</Button>
          </Link>
          <Button size="sm" onClick={() => setNoteOpen(true)}><MessageSquarePlus size={14} />Aloqa</Button>
          {isOwner && <Button size="sm" onClick={() => setEditing(true)}><Pencil size={14} />Tahrirlash</Button>}
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Sof qarz" value={moneyShort(st.net_base)}
          tone={Number(st.net_base) > 0 ? 'warn' : Number(st.net_base) < 0 ? 'info' : 'ok'}
          sub={Number(st.opening_advance) > 0 ? `Avans ${moneyShort(st.opening_advance)}` : undefined}
          icon={<Wallet size={16} />}
        />
        <Stat label="Jami sotuv" value={moneyShort(st.revenue_base)} tone="brand"
          sub={`${st.sale_count} hujjat`} icon={<ShoppingCart size={16} />} />
        <Stat
          label="O'rtacha marja" value={st.margin_pct != null ? pct(st.margin_pct) : '—'}
          tone={st.margin_pct == null ? 'neutral' : Number(st.margin_pct) >= 15 ? 'ok' : 'warn'}
          icon={<TrendingUp size={16} />}
        />
        <Stat
          label="Oxirgi sotuv"
          value={st.last_sale_at ? dateShort(st.last_sale_at) : '—'}
          tone={(st.days_since_sale ?? 0) > 90 ? 'warn' : 'neutral'}
          sub={st.days_since_sale != null ? `${st.days_since_sale} kun oldin` : undefined}
          icon={<Clock size={16} />}
        />
      </div>

      {(st.days_since_sale ?? 0) > 90 && st.sale_count > 0 && (
        <div className="mb-4">
          <InfoBox tone="warn">
            <span className="flex items-start gap-2">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <span>
                Bu mijoz <b>{st.days_since_sale} kundan beri</b> xarid qilmagan.
                Aloqaga chiqish vaqti keldi.
              </span>
            </span>
          </InfoBox>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <div className="space-y-4">
          <Card pad={false}>
            <div className="p-4">
              <CardTitle sub={`${sales.length} ta hujjat`}>Sotuv tarixi</CardTitle>
              {sales.length === 0 ? (
                <Empty title="Sotuv yo'q" />
              ) : (
                <Table minWidth={620}>
                  <thead>
                    <tr>
                      <Th w={130}>Hujjat</Th>
                      <Th w={100}>Sana</Th>
                      <Th w={130} align="right">Summa</Th>
                      <Th w={120} align="right">Qoldiq</Th>
                      {isOwner && <Th w={90} align="right">Marja</Th>}
                    </tr>
                  </thead>
                  <tbody>
                    {sales.map((s) => {
                      const due = Number(s.total_base) - Number(s.paid_base)
                      const overdue = s.due_date && s.due_date < isoDate() && due > 0
                      return (
                        <Tr key={s.id}>
                          <Td mono>
                            <span className="text-[12.5px]">{s.doc_no ?? `#${s.id}`}</span>
                            {s.source === 'opening' && (
                              <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>1C qoldig'i</div>
                            )}
                          </Td>
                          <Td mono>{dateShort(s.doc_date)}</Td>
                          <Td align="right" mono>{money(s.total_base, false)}</Td>
                          <Td align="right" mono>
                            <span style={{ color: overdue ? 'var(--danger)' : undefined }}>
                              {due > 0 ? money(due, false) : '—'}
                            </span>
                            {overdue && (
                              <div className="text-[11px]" style={{ color: 'var(--danger)' }}>
                                {dateShort(s.due_date)}
                              </div>
                            )}
                          </Td>
                          {isOwner && (
                            <Td align="right" mono>
                              {s.margin_pct != null ? pct(s.margin_pct) : '—'}
                            </Td>
                          )}
                        </Tr>
                      )
                    })}
                  </tbody>
                </Table>
              )}
            </div>
          </Card>

          {contracts.length > 0 && (
            <Card pad={false}>
              <div className="p-4">
                <CardTitle sub="1C dan kelgan shartnomalar">
                  <span className="inline-flex items-center gap-1.5">
                    <FileText size={15} />Shartnomalar
                  </span>
                </CardTitle>
                <Table minWidth={520}>
                  <thead>
                    <tr>
                      <Th w={140}>Raqam</Th>
                      <Th w={120}>Sana</Th>
                      <Th w={110} align="center">Turi</Th>
                      <Th align="right">Summa</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {contracts.map((ct) => (
                      <Tr key={ct.id}>
                        <Td mono>{ct.number}</Td>
                        <Td mono>{ct.signed_at ? dateShort(ct.signed_at) : '—'}</Td>
                        <Td align="center">
                          <Badge tone={ct.kind === 'debt' ? 'warn' : 'info'}>
                            {ct.kind === 'debt' ? 'qarz' : 'avans'}
                          </Badge>
                        </Td>
                        <Td align="right" mono>{ct.amount ? money(ct.amount, false) : '—'}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardTitle>Ma'lumot</CardTitle>
            <div className="space-y-2 text-[13px]">
              <Row label="Menejer" value={mgrName ?? 'taqsimlanmagan'} />
              <Row label="Toifa" value={tierName ?? '—'} />
              <Row label="To'lov muddati" value={termName ?? '—'} />
              <Row label="Kredit limiti" value={c.credit_limit ? money(c.credit_limit) : 'yo\'q'} />
              <Row label="Birinchi sotuv" value={c.first_sale_at ? dateShort(c.first_sale_at) : '—'} />
              <Row label="Manzil" value={c.address ?? '—'} />
              {c.note && (
                <div className="border-t pt-2">
                  <div className="mb-1 text-[12px]" style={{ color: 'var(--text-3)' }}>Izoh</div>
                  <div className="text-[12.5px]" style={{ color: 'var(--text-2)' }}>{c.note}</div>
                </div>
              )}
            </div>
          </Card>

          <Card pad={false}>
            <div className="p-4">
              <CardTitle sub={`${acts.length} ta yozuv`}>Aloqa tarixi</CardTitle>
              {acts.length === 0 ? (
                <Empty title="Aloqa yozilmagan" hint="Qo'ng'iroq va uchrashuvlarni yozib borsangiz, tarix shu yerda to'planadi." />
              ) : (
                <div className="space-y-3">
                  {acts.map((a) => (
                    <div key={a.id} className="border-l-2 pl-3" style={{ borderColor: 'var(--border-2)' }}>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={a.kind === 'call' ? 'brand' : a.kind === 'meeting' ? 'info' : 'neutral'}>
                          {ACT_KIND[a.kind] ?? a.kind}
                        </Badge>
                        <span className="text-[12px]" style={{ color: 'var(--text-3)' }}>
                          {dateTimeUz(a.happened_at)}
                        </span>
                        {a.actor && (
                          <span className="text-[12px]" style={{ color: 'var(--text-3)' }}>
                            · {a.actor.full_name}
                          </span>
                        )}
                      </div>
                      {a.outcome && (
                        <div className="mt-0.5 text-[13px] font-medium">{a.outcome}</div>
                      )}
                      {a.body && (
                        <div className="mt-0.5 whitespace-pre-line text-[12.5px]" style={{ color: 'var(--text-2)' }}>
                          {a.body}
                        </div>
                      )}
                      {a.next_action_at && (
                        <div className="mt-1 text-[12px]" style={{ color: 'var(--brand)' }}>
                          Keyingi aloqa: {relativeDays(a.next_action_at)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {editing && (
        <CustomerModal value={c} onClose={() => setEditing(false)} onDone={() => { setEditing(false); void load() }} />
      )}
      {noteOpen && (
        <ActivityModal
          customerId={id} onClose={() => setNoteOpen(false)}
          onDone={() => { setNoteOpen(false); void load() }}
        />
      )}
    </div>
  )
}

const ACT_KIND: Record<string, string> = {
  call: "qo'ng'iroq", meeting: 'uchrashuv', message: 'xabar',
  note: 'izoh', visit: 'tashrif', email: 'email',
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span style={{ color: 'var(--text-3)' }}>{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}

function ActivityModal({
  customerId, onClose, onDone,
}: { customerId: number; onClose: () => void; onDone: () => void }) {
  const [kind, setKind] = useState('call')
  const [outcome, setOutcome] = useState('')
  const [body, setBody] = useState('')
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function save() {
    setBusy(true); setErr('')
    const { error } = await supabase.from('ip_activities').insert({
      kind, customer_id: customerId,
      actor_id: (await supabase.auth.getUser()).data.user?.id,
      subject: ACT_KIND[kind], outcome: outcome.trim() || null,
      body: body.trim() || null, next_action_at: next || null,
    } as never)
    setBusy(false)
    if (error) { setErr(translateDbError(error.message)); return }
    onDone()
  }

  return (
    <Modal
      open onClose={onClose} width={480} title="Aloqa yozuvi"
      footer={
        <>
          <Button onClick={onClose}>Bekor</Button>
          <Button variant="primary" loading={busy} onClick={save}>Saqlash</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Turi" required>
          <Select
            value={kind} onChange={setKind}
            options={Object.entries(ACT_KIND).map(([v, l]) => ({ value: v, label: l }))}
          />
        </Field>
        <Field label="Natija"><Input value={outcome} onChange={setOutcome} placeholder="Qisqacha" /></Field>
        <Field label="Izoh"><Textarea value={body} onChange={setBody} rows={3} /></Field>
        <Field label="Keyingi aloqa sanasi"><Input type="date" value={next} onChange={setNext} /></Field>
        {err && <ErrorBox>{err}</ErrorBox>}
      </div>
    </Modal>
  )
}

function CustomerModal({
  value, onClose, onDone,
}: { value: Partial<Customer>; onClose: () => void; onDone: () => void }) {
  const refs = useRefs()
  const [d, setD] = useState<Partial<Customer>>(value)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  function set<K extends keyof Customer>(k: K, v: Customer[K]) { setD((p) => ({ ...p, [k]: v })) }

  async function save() {
    if (!d.name?.trim()) { setErr('Nomi kiritilmagan'); return }
    setBusy(true); setErr('')
    const payload = {
      name: d.name.trim(),
      legal_name: d.legal_name?.trim() || null,
      inn: d.inn?.trim() || null,
      tier_id: d.tier_id ?? null,
      payment_term_id: d.payment_term_id ?? null,
      manager_id: d.manager_id ?? null,
      status: d.status ?? 'active',
      phone: d.phone?.trim() || null,
      email: d.email?.trim() || null,
      address: d.address?.trim() || null,
      credit_limit: d.credit_limit ?? null,
      opening_debt: d.opening_debt ?? 0,
      opening_advance: d.opening_advance ?? 0,
      note: d.note?.trim() || null,
      is_active: d.is_active ?? true,
    }
    const res = d.id
      ? await supabase.from('ip_customers').update(payload as never).eq('id', d.id)
      : await supabase.from('ip_customers').insert(payload as never)
    setBusy(false)
    if (res.error) { setErr(translateDbError(res.error.message)); return }
    onDone()
  }

  return (
    <Modal
      open onClose={onClose} width={600} title={d.id ? 'Mijozni tahrirlash' : 'Yangi mijoz'}
      footer={
        <>
          <Button onClick={onClose}>Bekor</Button>
          <Button variant="primary" loading={busy} onClick={save}>Saqlash</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Nomi" required>
          <Input value={d.name ?? ''} onChange={(v) => set('name', v)} autoFocus />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="STIR"><Input value={d.inn ?? ''} onChange={(v) => set('inn', v)} /></Field>
          <Field label="Telefon"><Input value={d.phone ?? ''} onChange={(v) => set('phone', v)} /></Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Menejer">
            <Select
              value={d.manager_id ?? ''} onChange={(v) => set('manager_id', v || null)}
              placeholder="— taqsimlanmagan —"
              options={refs.profiles.filter((p) => p.role !== 'accountant')
                .map((p) => ({ value: p.id, label: p.full_name }))}
            />
          </Field>
          <Field label="Toifa" hint="Narx shu toifadan olinadi">
            <Select
              value={d.tier_id ?? ''} onChange={(v) => set('tier_id', v ? Number(v) : null)}
              placeholder="—" options={refs.tiers.map((t) => ({ value: t.id, label: t.name }))}
            />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="To'lov muddati">
            <Select
              value={d.payment_term_id ?? ''} onChange={(v) => set('payment_term_id', v ? Number(v) : null)}
              placeholder="—" options={refs.terms.map((t) => ({ value: t.id, label: t.name }))}
            />
          </Field>
          <Field label="Kredit limiti" hint="0 = sozlamadagi">
            <Input
              type="number" className="text-right tnum"
              value={d.credit_limit ?? ''} onChange={(v) => set('credit_limit', v === '' ? null : Number(v))}
            />
          </Field>
          <Field label="Holat">
            <Select
              value={d.status ?? 'active'} onChange={(v) => set('status', v as CustomerStatus)}
              options={(Object.keys(STATUS_LABEL) as CustomerStatus[])
                .map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
            />
          </Field>
        </div>
        <Field label="Manzil"><Input value={d.address ?? ''} onChange={(v) => set('address', v)} /></Field>
        <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border-2)' }}>
          <div className="mb-2 text-[13px] font-medium">Boshlang'ich qoldiq</div>
          <p className="mb-2 text-[12px]" style={{ color: 'var(--text-3)' }}>
            1C dan kelgan qarz allaqachon hujjatlarga aylantirilgan. Bu yerda faqat
            hujjatlashtirilmagan qoldiqni to'g'rilaysiz.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Qarzi" hint="Bizga qarzdor">
              <Input
                type="number" className="text-right tnum"
                value={d.opening_debt ?? 0}
                onChange={(v) => set('opening_debt', Number(v) || 0)}
              />
            </Field>
            <Field label="Avansi" hint="Biz qarzdormiz">
              <Input
                type="number" className="text-right tnum"
                value={d.opening_advance ?? 0}
                onChange={(v) => set('opening_advance', Number(v) || 0)}
              />
            </Field>
          </div>
        </div>
        <Field label="Izoh"><Textarea value={d.note ?? ''} onChange={(v) => set('note', v)} rows={2} /></Field>
        <Toggle checked={d.is_active ?? true} onChange={(v) => set('is_active', v)} label="Faol" />
        {err && <ErrorBox>{err}</ErrorBox>}
      </div>
    </Modal>
  )
}
