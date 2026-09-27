import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Plus, Trash2, Truck, Send, Banknote, CheckCircle2, Search, Pencil,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useProducts, useRefs, useSuppliers, translateDbError } from '../lib/useRefs'
import type { Purchase, Supplier, SupplierBalance } from '../lib/types'
import {
  Badge, Button, Card, CardTitle, Empty, ErrorBox, Field, InfoBox, Input, Loading,
  Modal, PageHeader, Select, Stat, Table, Td, Textarea, Th, Toggle, Tr,
} from '../components/ui'
import { dateShort, isoDate, money, moneyShort, monthStart, num } from '../lib/format'
import { useWindows, useSignal } from '../lib/windows'

type Tab = 'docs' | 'suppliers'

export default function Purchases() {
  const { isOwner } = useAuth()
  const [tab, setTab] = useState<Tab>('docs')

  return (
    <div>
      <PageHeader
        title="Xaridlar"
        sub="Postavshiklardan tovar qabul qilish — partiya va tan narx shu yerdan yaraladi"
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {([{ key: 'docs', label: 'Hujjatlar' }, { key: 'suppliers', label: 'Postavshiklar' }] as
          { key: Tab; label: string }[]).map((t) => (
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
      </div>

      {tab === 'docs'      && <DocsTab isOwner={isOwner} />}
      {tab === 'suppliers' && <SuppliersTab isOwner={isOwner} />}
    </div>
  )
}

/* ---------------------------------------------------------------- */

function DocsTab({ isOwner }: { isOwner: boolean }) {
  const [rows, setRows] = useState<(Purchase & { supplier: { name: string } | null })[]>([])
  const [from, setFrom] = useState(monthStart(new Date(new Date().setMonth(new Date().getMonth() - 2))))
  const [to, setTo] = useState(isoDate())
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const { open } = useWindows()
  const purchSignal = useSignal('purchases')

  /** Xaridni alohida oynada ochadi */
  const openPurchase = useCallback((o: { id?: number | null; name?: string; no?: string | null }) => {
    open({
      kind: 'purchase',
      key: o.id ? `purchase:${o.id}` : 'purchase:new',
      title: o.name ? `Xarid · ${o.name.slice(0, 22)}` : 'Xarid (yaratish)',
      subtitle: o.no ?? undefined,
      params: { purchaseId: o.id ?? null },
    })
  }, [open])

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('ip_purchases')
      .select('*, supplier:ip_suppliers(name)')
      .gte('doc_date', from).lte('doc_date', to)
      .order('doc_date', { ascending: false }).order('id', { ascending: false })
    if (error) setErr(translateDbError(error.message))
    setRows((data as never) ?? [])
    setLoading(false)
  }, [from, to])

  useEffect(() => { void load() }, [load, purchSignal])
  if (loading) return <Loading />

  const posted = rows.filter((r) => r.status === 'posted')
  const total = posted.reduce((a, r) => a + Number(r.total_base), 0)
  const unpaid = posted.reduce((a, r) => a + Number(r.total_base) - Number(r.paid_base), 0)

  return (
    <div className="space-y-4">
      {err && <ErrorBox>{err}</ErrorBox>}

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Xarid (postlangan)" value={moneyShort(total)} tone="brand" sub={`${posted.length} hujjat`} />
        <Stat label="To'lanmagan" value={moneyShort(unpaid)} tone={unpaid > 0 ? 'warn' : 'ok'} />
        <Stat label="Qoralama" value={rows.filter((r) => r.status === 'draft').length} />
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="w-[150px]"><Field label="Dan"><Input type="date" value={from} onChange={setFrom} /></Field></div>
        <div className="w-[150px]"><Field label="Gacha"><Input type="date" value={to} onChange={setTo} /></Field></div>
        {isOwner && (
          <Button variant="primary" onClick={() => openPurchase({})}><Plus size={14} />Yangi xarid</Button>
        )}
      </div>

      <Card pad={false}>
        <div className="p-4">
          {rows.length === 0 ? (
            <Empty
              title="Xarid hujjati yo'q"
              hint="Postavshikdan tovar kelganda shu yerga kiritasiz. Postlanganda partiya yaraladi va FIFO tan narx ishlay boshlaydi."
              action={isOwner && <Button variant="primary" onClick={() => openPurchase({})}><Plus size={14} />Birinchi xarid</Button>}
            />
          ) : (
            <Table minWidth={860}>
              <thead>
                <tr>
                  <Th w={140}>Hujjat</Th>
                  <Th w={110}>Sana</Th>
                  <Th>Postavshik</Th>
                  <Th w={100} align="center">Valyuta</Th>
                  <Th w={150} align="right">Summa</Th>
                  <Th w={140} align="right">To'langan</Th>
                  <Th w={120} align="center">Holat</Th>
                  <Th w={70} align="right" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Tr key={r.id}>
                    <Td mono><span className="text-[12.5px]">{r.doc_no ?? `#${r.id}`}</span></Td>
                    <Td mono>{dateShort(r.doc_date)}</Td>
                    <Td><span className="font-medium">{r.supplier?.name ?? '—'}</span></Td>
                    <Td align="center">
                      {r.currency === 'UZS'
                        ? <span style={{ color: 'var(--text-3)' }}>so'm</span>
                        : <Badge tone="info">{r.currency} · {num(r.fx_rate, 0)}</Badge>}
                    </Td>
                    <Td align="right" mono>{money(r.total_base, false)}</Td>
                    <Td align="right" mono>
                      {money(r.paid_base, false)}
                      {r.status === 'posted' && Number(r.total_base) > Number(r.paid_base) && (
                        <div className="text-[11.5px]" style={{ color: 'var(--warn)' }}>
                          qarz {moneyShort(Number(r.total_base) - Number(r.paid_base))}
                        </div>
                      )}
                    </Td>
                    <Td align="center">
                      <Badge tone={r.status === 'posted' ? 'ok' : r.status === 'cancelled' ? 'neutral' : 'info'}>
                        {r.status === 'posted' ? 'postlangan' : r.status === 'cancelled' ? 'bekor' : 'qoralama'}
                      </Badge>
                    </Td>
                    <Td align="right">
                      {isOwner && r.status === 'draft' && (
                        <Button size="sm" variant="ghost" onClick={() => openPurchase({ id: r.id, name: r.supplier?.name, no: r.doc_no })}>
                          <Pencil size={14} />
                        </Button>
                      )}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </Card>
    </div>
  )
}

function SuppliersTab({ isOwner }: { isOwner: boolean }) {
  const [rows, setRows] = useState<SupplierBalance[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [payFor, setPayFor] = useState<SupplierBalance | null>(null)
  const [edit, setEdit] = useState<Partial<Supplier> | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('ip_supplier_balance').select('*')
      .order('debt_base', { ascending: false })
    setRows((data as SupplierBalance[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])
  if (loading) return <Loading />

  const filtered = rows.filter((r) => !q.trim() || r.name.toLowerCase().includes(q.trim().toLowerCase()))
  const totalDebt = rows.filter((r) => r.debt_base > 0).reduce((a, r) => a + Number(r.debt_base), 0)
  const totalAdv = rows.filter((r) => r.debt_base < 0).reduce((a, r) => a - Number(r.debt_base), 0)

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Qarzimiz" value={moneyShort(totalDebt)} tone="danger" icon={<Truck size={16} />} />
        <Stat label="Avansimiz" value={moneyShort(totalAdv)} tone="info" sub="Pul berilgan, tovar kelmagan" />
        <Stat label="Postavshik" value={rows.length} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
          <input
            value={q} onChange={(e) => setQ(e.target.value)} placeholder="Postavshik nomi…"
            className="w-full rounded-lg border py-2 pl-8 pr-2.5 text-sm outline-none focus:border-[var(--brand)]"
            style={{ background: 'var(--surface)', borderColor: 'var(--border-2)' }}
          />
        </div>
        {isOwner && (
          <Button variant="primary" onClick={() => setEdit({ is_active: true, currency: 'UZS' })}>
            <Plus size={14} />Postavshik
          </Button>
        )}
      </div>

      <Card pad={false}>
        <div className="p-4">
          <Table minWidth={880}>
            <thead>
              <tr>
                <Th>Postavshik</Th>
                <Th w={140} align="right">Boshlang'ich qarz</Th>
                <Th w={130} align="right">Avans</Th>
                <Th w={130} align="right">Xarid</Th>
                <Th w={130} align="right">To'langan</Th>
                <Th w={140} align="right">Sof qarz</Th>
                <Th w={110} align="right">Amal</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <Tr key={s.supplier_id}>
                  <Td>
                    <div className="font-medium">{s.name}</div>
                    {s.note && (
                      <div className="line-clamp-1 text-[11.5px]" style={{ color: 'var(--text-3)' }}>
                        {s.note}
                      </div>
                    )}
                  </Td>
                  <Td align="right" mono>{s.opening_debt > 0 ? money(s.opening_debt, false) : '—'}</Td>
                  <Td align="right" mono>
                    {s.opening_advance > 0
                      ? <span style={{ color: 'var(--info)' }}>{money(s.opening_advance, false)}</span>
                      : '—'}
                  </Td>
                  <Td align="right" mono>{Number(s.purchased_base) > 0 ? money(s.purchased_base, false) : '—'}</Td>
                  <Td align="right" mono>{Number(s.paid_base) > 0 ? money(s.paid_base, false) : '—'}</Td>
                  <Td align="right" mono>
                    <span className="font-semibold" style={{ color: s.debt_base > 0 ? 'var(--danger)' : 'var(--info)' }}>
                      {money(s.debt_base, false)}
                    </span>
                  </Td>
                  <Td align="right">
                    {isOwner && s.debt_base > 0 && (
                      <Button size="sm" onClick={() => setPayFor(s)}><Banknote size={14} /></Button>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>

      {payFor && (
        <SupplierPayModal
          supplier={payFor} onClose={() => setPayFor(null)}
          onDone={() => { setPayFor(null); void load() }}
        />
      )}
      {edit && (
        <SupplierModal value={edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); void load() }} />
      )}
    </div>
  )
}

function SupplierPayModal({
  supplier, onClose, onDone,
}: { supplier: SupplierBalance; onClose: () => void; onDone: () => void }) {
  const refs = useRefs()
  const [amount, setAmount] = useState('')
  const [account, setAccount] = useState<number | null>(null)
  const [date, setDate] = useState(isoDate())
  const [method, setMethod] = useState('bank')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (account == null && refs.accounts.length) setAccount(refs.accounts[0].id)
  }, [refs.accounts, account])

  async function save() {
    if (!account) { setErr('Kassa tanlanmagan'); return }
    setBusy(true); setErr('')
    const { error } = await supabase.rpc('ip_pay_supplier', {
      p_supplier: supplier.supplier_id, p_amount: Number(amount),
      p_account: account, p_date: date, p_method: method, p_note: note.trim() || null,
    })
    setBusy(false)
    if (error) { setErr(translateDbError(error.message)); return }
    onDone()
  }

  return (
    <Modal
      open onClose={onClose} width={480}
      title={<span>To'lov — <span style={{ color: 'var(--text-2)' }}>{supplier.name}</span></span>}
      footer={
        <>
          <Button onClick={onClose}>Bekor</Button>
          <Button variant="primary" loading={busy} onClick={save} disabled={!(Number(amount) > 0)}>
            To'lash
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <InfoBox>
          Qarzimiz: <b>{money(supplier.debt_base)}</b>. Summa eng eski xariddan
          boshlab taqsimlanadi, ortgani boshlang'ich qarzga yoziladi.
        </InfoBox>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Summa" required>
            <Input type="number" className="text-right tnum" value={amount} onChange={setAmount} autoFocus />
          </Field>
          <Field label="Sana"><Input type="date" value={date} onChange={setDate} /></Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Qaysi kassadan" required>
            <Select
              value={account ?? ''} onChange={(v) => setAccount(v ? Number(v) : null)}
              options={refs.accounts.map((a) => ({ value: a.id, label: a.name }))}
            />
          </Field>
          <Field label="Turi">
            <Select
              value={method} onChange={setMethod}
              options={[
                { value: 'bank', label: "Bank o'tkazmasi" },
                { value: 'cash', label: 'Naqd' },
                { value: 'card', label: 'Karta' },
              ]}
            />
          </Field>
        </div>
        <Field label="Izoh"><Textarea value={note} onChange={setNote} rows={2} /></Field>
        {err && <ErrorBox>{err}</ErrorBox>}
      </div>
    </Modal>
  )
}

function SupplierModal({
  value, onClose, onDone,
}: { value: Partial<Supplier>; onClose: () => void; onDone: () => void }) {
  const refs = useRefs()
  const [d, setD] = useState<Partial<Supplier>>(value)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  function set<K extends keyof Supplier>(k: K, v: Supplier[K]) { setD((p) => ({ ...p, [k]: v })) }

  async function save() {
    if (!d.name?.trim()) { setErr('Nomi kiritilmagan'); return }
    setBusy(true); setErr('')
    const payload = {
      name: d.name.trim(),
      legal_name: d.legal_name?.trim() || null,
      inn: d.inn?.trim() || null,
      phone: d.phone?.trim() || null,
      email: d.email?.trim() || null,
      address: d.address?.trim() || null,
      contact_person: d.contact_person?.trim() || null,
      payment_term_id: d.payment_term_id ?? null,
      currency: d.currency ?? 'UZS',
      opening_debt: d.opening_debt ?? 0,
      opening_advance: d.opening_advance ?? 0,
      note: d.note?.trim() || null,
      is_active: d.is_active ?? true,
    }
    const res = d.id
      ? await supabase.from('ip_suppliers').update(payload as never).eq('id', d.id)
      : await supabase.from('ip_suppliers').insert(payload as never)
    setBusy(false)
    if (res.error) { setErr(translateDbError(res.error.message)); return }
    onDone()
  }

  return (
    <Modal
      open onClose={onClose} width={560} title={d.id ? 'Postavshikni tahrirlash' : 'Yangi postavshik'}
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
          <Field label="Aloqa shaxsi">
            <Input value={d.contact_person ?? ''} onChange={(v) => set('contact_person', v)} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Telefon"><Input value={d.phone ?? ''} onChange={(v) => set('phone', v)} /></Field>
          <Field label="Email"><Input value={d.email ?? ''} onChange={(v) => set('email', v)} /></Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="To'lov muddati">
            <Select
              value={d.payment_term_id ?? ''} onChange={(v) => set('payment_term_id', v ? Number(v) : null)}
              placeholder="—" options={refs.terms.map((t) => ({ value: t.id, label: t.name }))}
            />
          </Field>
          <Field label="Valyuta">
            <Select
              value={d.currency ?? 'UZS'} onChange={(v) => set('currency', v)}
              options={[{ value: 'UZS', label: "so'm" }, { value: 'USD', label: 'USD' }]}
            />
          </Field>
        </div>
        <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border-2)' }}>
          <div className="mb-2 text-[13px] font-medium">Boshlang'ich qoldiq</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Qarzimiz" hint="Biz to'lashimiz kerak">
              <Input
                type="number" className="text-right tnum"
                value={d.opening_debt ?? 0}
                onChange={(v) => set('opening_debt', Number(v) || 0)}
              />
            </Field>
            <Field label="Avansimiz" hint="Pul berdik, tovar kelmagan">
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
