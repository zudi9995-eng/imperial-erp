import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft, Pencil, UserMinus, UserPlus, Banknote, Gavel, Award,
  Briefcase, Clock, CalendarOff, Wallet, IdCard, Check, AlertTriangle,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useSettings } from '../lib/settings'
import { invokeFn, translateDbError } from '../lib/useRefs'
import type {
  Attendance, EmploymentEvent, FinalSettlement, HandoverItem, Payroll,
  Profile, StaffAdjustment, StaffAdvance,
} from '../lib/types'
import {
  Badge, Button, Card, CardTitle, Empty, ErrorBox, Field, InfoBox, Input, Loading,
  Modal, Select, Stat, Table, Td, Textarea, Th, Toggle, Tr, type Tone,
} from './ui'
import {
  dateShort, initials, isoDate, money, moneyShort, monthLabel, monthStart, num, pct, timeUz,
} from '../lib/format'

type Tab = 'info' | 'history' | 'payroll' | 'attendance' | 'money'

const EVENT_LABEL: Record<string, string> = {
  hire: 'Ishga olindi', rehire: 'Qayta ishga olindi', terminate: "Bo'shatildi",
  position: "Lavozim o'zgardi", salary: "Oklad o'zgardi", role: "Rol o'zgardi", note: 'Izoh',
}
const EVENT_TONE: Record<string, Tone> = {
  hire: 'ok', rehire: 'ok', terminate: 'danger',
  position: 'info', salary: 'brand', role: 'info', note: 'neutral',
}
const EMP_TYPE: Record<string, string> = {
  permanent: 'Doimiy', fixed_term: 'Muddatli', contract: 'Shartnoma asosida',
}

export default function EmployeeCard({ id, onBack }: { id: string; onBack: () => void }) {
  const { can, profile: me } = useAuth()
  const canHr = can('hr.manage')
  const canPay = can('hr.payroll')

  const [p, setP] = useState<Profile | null>(null)
  const [events, setEvents] = useState<EmploymentEvent[]>([])
  const [payroll, setPayroll] = useState<Payroll[]>([])
  const [att, setAtt] = useState<Attendance[]>([])
  const [leaves, setLeaves] = useState<{ id: number; kind: string; from_date: string; to_date: string; days: number | null; status: string; reason: string | null }[]>([])
  const [advances, setAdvances] = useState<StaffAdvance[]>([])
  const [adjust, setAdjust] = useState<StaffAdjustment[]>([])
  const [handover, setHandover] = useState<HandoverItem[]>([])
  const [tab, setTab] = useState<Tab>('info')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [modal, setModal] = useState<'edit' | 'hire' | 'terminate' | 'advance' | 'adjust' | null>(null)

  const load = useCallback(async () => {
    const [a, e, pr, at, lv, ad, aj, ho] = await Promise.all([
      supabase.from('ip_profiles').select('*').eq('id', id).maybeSingle(),
      supabase.from('ip_employment_events').select('*').eq('profile_id', id)
        .order('effective_date', { ascending: false }).order('id', { ascending: false }),
      supabase.from('ip_payroll').select('*').eq('profile_id', id)
        .order('period_month', { ascending: false }).limit(24),
      supabase.from('ip_attendance').select('*').eq('profile_id', id)
        .order('work_date', { ascending: false }).limit(60),
      supabase.from('ip_leaves').select('id, kind, from_date, to_date, days, status, reason')
        .eq('profile_id', id).order('from_date', { ascending: false }),
      supabase.from('ip_staff_advance_balance').select('*').eq('profile_id', id)
        .order('issue_date', { ascending: false }),
      supabase.from('ip_staff_adjustments').select('*').eq('profile_id', id)
        .order('period_month', { ascending: false }).limit(50),
      supabase.from('ip_handover_items').select('*').eq('profile_id', id).order('item_type'),
    ])
    setP(a.data as Profile | null)
    setEvents((e.data as EmploymentEvent[]) ?? [])
    setPayroll((pr.data as Payroll[]) ?? [])
    setAtt((at.data as Attendance[]) ?? [])
    setLeaves((lv.data as never) ?? [])
    setAdvances((ad.data as StaffAdvance[]) ?? [])
    setAdjust((aj.data as StaffAdjustment[]) ?? [])
    setHandover((ho.data as HandoverItem[]) ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => { void load() }, [load])
  if (loading) return <Loading />
  if (!p) return <Empty title="Xodim topilmadi" action={<Button onClick={onBack}>Orqaga</Button>} />

  const openAdvance = advances.filter((a) => a.status === 'open')
    .reduce((s, a) => s + Number(a.balance), 0)
  const yearPay = payroll
    .filter((r) => new Date(r.period_month).getFullYear() === new Date().getFullYear())
    .reduce((s, r) => s + Number(r.total_net), 0)
  const leaveUsed = leaves.filter((l) => l.status === 'approved' && l.kind === 'annual')
    .reduce((s, l) => s + Number(l.days ?? 0), 0)

  const TABS = ([
    { key: 'info',       label: "Ma'lumot" },
    { key: 'history',    label: 'Mehnat tarixi' },
    { key: 'payroll',    label: 'Oylik tarixi', need: canPay || id === me?.id },
    { key: 'attendance', label: "Davomat va ta'til" },
    { key: 'money',      label: 'Avans, jazo, rag\'bat', need: canPay || id === me?.id },
  ] as { key: Tab; label: string; need?: boolean }[]).filter((t) => t.need !== false)

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button variant="ghost" onClick={onBack}><ArrowLeft size={16} /></Button>
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[15px] font-bold"
            style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}
          >
            {initials(p.full_name)}
          </div>
          <div>
            <h1 className="text-[20px] font-semibold leading-tight">{p.full_name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px]" style={{ color: 'var(--text-3)' }}>
              {p.position && <Badge tone="brand">{p.position}</Badge>}
              <Badge tone={p.is_active ? 'ok' : 'neutral'}>
                {p.is_active ? 'ishlayapti' : "bo'shatilgan"}
              </Badge>
              {p.employment_type && <span>{EMP_TYPE[p.employment_type] ?? p.employment_type}</span>}
              <span>{p.email}</span>
              {p.phone && <span className="tnum">{p.phone}</span>}
            </div>
          </div>
        </div>

        {canHr && (
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" onClick={() => setModal('edit')}><Pencil size={14} />Tahrirlash</Button>
            {canPay && (
              <>
                <Button size="sm" onClick={() => setModal('advance')}><Banknote size={14} />Avans</Button>
                <Button size="sm" onClick={() => setModal('adjust')}><Gavel size={14} />Jazo / rag'bat</Button>
              </>
            )}
            {p.is_active
              ? <Button size="sm" variant="danger" onClick={() => setModal('terminate')}>
                  <UserMinus size={14} />Bo'shatish
                </Button>
              : <Button size="sm" variant="primary" onClick={() => setModal('hire')}>
                  <UserPlus size={14} />Qayta ishga olish
                </Button>}
          </div>
        )}
      </div>

      {err && <div className="mb-4"><ErrorBox>{err}</ErrorBox></div>}

      {!p.is_active && p.terminated_at && (
        <div className="mb-4">
          <InfoBox tone="warn">
            <span className="flex items-start gap-2">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <span>
                <b>{dateShort(p.terminated_at)}</b> da bo'shatilgan
                {p.termination_reason && <> — {p.termination_reason}</>}.
                Tizimga kira olmaydi.
              </span>
            </span>
          </InfoBox>
        </div>
      )}

      {p.probation_until && p.is_active && new Date(p.probation_until) > new Date() && (
        <div className="mb-4">
          <InfoBox>
            Sinov muddati <b>{dateShort(p.probation_until)}</b> gacha
          </InfoBox>
        </div>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {canPay && <Stat label="Joriy oklad" value={moneyShort(p.salary)} tone="brand" />}
        {canPay && (
          <Stat
            label="Bu yil olgani" value={moneyShort(yearPay)}
            sub={`${payroll.length} oylik yozuvi`}
          />
        )}
        <Stat
          label="Ta'til" value={`${num(leaveUsed, 0)} kun`}
          sub={`Norma ${useSettings().n('annual_leave_days', 0)} kun`}
        />
        {canPay && (
          <Stat
            label="Avans qoldig'i" value={moneyShort(openAdvance)}
            tone={openAdvance > 0 ? 'warn' : 'ok'}
          />
        )}
      </div>

      {handover.filter((h) => !h.is_done).length > 0 && (
        <Card className="mb-4">
          <CardTitle sub="Bo'shatishda topshirilishi kerak">Ish topshirish</CardTitle>
          <HandoverList items={handover} canHr={canHr} onChanged={load} />
        </Card>
      )}

      <div className="mb-4 flex flex-wrap gap-1.5">
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
      </div>

      {tab === 'info'       && <InfoTab p={p} />}
      {tab === 'history'    && <HistoryTab events={events} canPay={canPay} />}
      {tab === 'payroll'    && <PayrollTab rows={payroll} />}
      {tab === 'attendance' && <AttendanceTab att={att} leaves={leaves} />}
      {tab === 'money'      && <MoneyTab advances={advances} adjust={adjust} />}

      {modal === 'edit' && (
        <ProfileModal p={p} onClose={() => setModal(null)} onDone={() => { setModal(null); void load() }} />
      )}
      {modal === 'hire' && (
        <HireModal p={p} onClose={() => setModal(null)} onDone={() => { setModal(null); void load() }} />
      )}
      {modal === 'terminate' && (
        <TerminateModal p={p} onClose={() => setModal(null)} onDone={() => { setModal(null); void load() }} />
      )}
      {modal === 'advance' && (
        <AdvanceModal p={p} onClose={() => setModal(null)} onDone={() => { setModal(null); void load() }} />
      )}
      {modal === 'adjust' && (
        <AdjustModal p={p} onClose={() => setModal(null)} onDone={() => { setModal(null); void load() }} />
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- */

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-[13px]" style={{ color: 'var(--text-3)' }}>{label}</span>
      <span className="text-right text-[13px] font-medium">{value || '—'}</span>
    </div>
  )
}

function InfoTab({ p }: { p: Profile }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardTitle>
          <span className="inline-flex items-center gap-1.5"><IdCard size={15} />Shaxsiy</span>
        </CardTitle>
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          <Row label="Tug'ilgan sana" value={p.birth_date ? dateShort(p.birth_date) : null} />
          <Row label="Pasport" value={p.passport} />
          <Row label="JSHSHIR" value={p.pinfl} />
          <Row label="Telefon" value={p.phone} />
          <Row label="Manzil" value={p.address} />
          <Row label="Favqulodda aloqa" value={
            p.emergency_name ? `${p.emergency_name}${p.emergency_phone ? ` · ${p.emergency_phone}` : ''}` : null
          } />
        </div>
      </Card>

      <Card>
        <CardTitle>
          <span className="inline-flex items-center gap-1.5"><Briefcase size={15} />Mehnat</span>
        </CardTitle>
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          <Row label="Lavozim" value={p.position} />
          <Row label="Ishga kirgan" value={p.hired_at ? dateShort(p.hired_at) : null} />
          <Row label="Shartnoma turi" value={p.employment_type ? EMP_TYPE[p.employment_type] : null} />
          <Row label="Sinov muddati" value={p.probation_until ? dateShort(p.probation_until) : null} />
          <Row label="Shartnoma tugaydi" value={p.contract_until ? dateShort(p.contract_until) : null} />
          <Row label="Bo'shatilgan" value={p.terminated_at ? dateShort(p.terminated_at) : null} />
          <Row label="Bo'shatish sababi" value={p.termination_reason} />
        </div>
        {p.note && (
          <div className="mt-3 border-t pt-3">
            <div className="mb-1 text-[12px]" style={{ color: 'var(--text-3)' }}>Izoh</div>
            <div className="text-[13px]" style={{ color: 'var(--text-2)' }}>{p.note}</div>
          </div>
        )}
      </Card>
    </div>
  )
}

function HistoryTab({ events, canPay }: { events: EmploymentEvent[]; canPay: boolean }) {
  if (events.length === 0) {
    return <Card><Empty title="Tarix bo'sh" hint="Ishga olish, oklad va lavozim o'zgarishlari shu yerda to'planadi." /></Card>
  }
  return (
    <Card pad={false}>
      <div className="p-4">
        <div className="space-y-3">
          {events.map((e) => (
            <div key={e.id} className="border-l-2 pl-3" style={{ borderColor: 'var(--border-2)' }}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={EVENT_TONE[e.event_type] ?? 'neutral'}>
                  {EVENT_LABEL[e.event_type] ?? e.event_type}
                </Badge>
                <span className="tnum text-[12.5px]" style={{ color: 'var(--text-3)' }}>
                  {dateShort(e.effective_date)}
                </span>
                {!e.is_applied && <Badge tone="warn">kutilmoqda</Badge>}
                {e.order_no && (
                  <span className="text-[12px]" style={{ color: 'var(--text-3)' }}>
                    Buyruq {e.order_no}
                    {e.order_date && ` · ${dateShort(e.order_date)}`}
                  </span>
                )}
              </div>

              <div className="mt-1 text-[13px]">
                {e.event_type === 'salary' && canPay && (
                  <span>
                    {e.salary_from != null && <>{money(e.salary_from, false)} → </>}
                    <b>{money(e.salary_to ?? 0, false)}</b>
                    {e.bonus_pct_to != null && e.bonus_pct_to !== e.bonus_pct_from && (
                      <> · bonus {pct(e.bonus_pct_to)}</>
                    )}
                  </span>
                )}
                {e.event_type === 'position' && <span>{e.position}</span>}
                {(e.event_type === 'hire' || e.event_type === 'rehire') && (
                  <span>
                    {e.position}
                    {e.employment_type && ` · ${EMP_TYPE[e.employment_type] ?? e.employment_type}`}
                    {e.probation_until && ` · sinov ${dateShort(e.probation_until)} gacha`}
                  </span>
                )}
                {e.event_type === 'terminate' && <span>{e.reason}</span>}
              </div>

              {e.note && (
                <div className="mt-0.5 text-[12.5px]" style={{ color: 'var(--text-3)' }}>{e.note}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

function PayrollTab({ rows }: { rows: Payroll[] }) {
  if (rows.length === 0) return <Card><Empty title="Oylik hisoblanmagan" /></Card>
  const tot = rows.reduce((a, r) => ({
    net: a.net + Number(r.total_net),
    bonus: a.bonus + Number(r.bonus_amount) + Number(r.extra_bonus ?? 0),
  }), { net: 0, bonus: 0 })

  return (
    <Card pad={false}>
      <div className="p-4">
        <CardTitle sub={`Jami ${money(tot.net)} · shundan bonus ${money(tot.bonus)}`}>
          Oylik va bonus tarixi
        </CardTitle>
        <Table minWidth={860}>
          <thead>
            <tr>
              <Th w={100}>Oy</Th>
              <Th w={130} align="right">Oklad</Th>
              <Th w={140} align="right">Bonus bazasi</Th>
              <Th w={120} align="right">Bonus</Th>
              <Th w={110} align="right">Rag'bat</Th>
              <Th w={110} align="right">Jazo</Th>
              <Th w={120} align="right">Avans</Th>
              <Th w={130} align="right">Qo'lga</Th>
              <Th w={100} align="center">Holat</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Tr key={r.id}>
                <Td mono>{monthLabel(r.period_month)}</Td>
                <Td align="right" mono>{money(r.salary, false)}</Td>
                <Td align="right" mono>
                  {Number(r.bonus_base) > 0 ? moneyShort(r.bonus_base) : '—'}
                </Td>
                <Td align="right" mono>
                  {Number(r.bonus_amount) > 0
                    ? <span style={{ color: 'var(--brand)' }}>{money(r.bonus_amount, false)}</span>
                    : '—'}
                </Td>
                <Td align="right" mono>
                  {Number(r.extra_bonus ?? 0) > 0
                    ? <span style={{ color: 'var(--ok)' }}>+{money(r.extra_bonus, false)}</span>
                    : '—'}
                </Td>
                <Td align="right" mono>
                  {Number(r.penalties) > 0
                    ? <span style={{ color: 'var(--danger)' }}>−{money(r.penalties, false)}</span>
                    : '—'}
                </Td>
                <Td align="right" mono>
                  {Number(r.advance_repaid ?? 0) > 0
                    ? <span style={{ color: 'var(--warn)' }}>−{money(r.advance_repaid, false)}</span>
                    : '—'}
                </Td>
                <Td align="right" mono className="font-semibold">{money(r.total_net, false)}</Td>
                <Td align="center">
                  <Badge tone={r.status === 'paid' ? 'ok' : 'warn'}>
                    {r.status === 'paid' ? "to'langan" : 'qoralama'}
                  </Badge>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </div>
    </Card>
  )
}

function AttendanceTab({
  att, leaves,
}: {
  att: Attendance[]
  leaves: { id: number; kind: string; from_date: string; to_date: string; days: number | null; status: string; reason: string | null }[]
}) {
  const late = att.filter((a) => a.late_min > 0).length
  const totalHours = att.reduce((s, a) => s + (a.worked_min ?? 0), 0) / 60

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Yozuvlar" value={att.length} sub="Oxirgi 60 kun" icon={<Clock size={16} />} />
        <Stat label="Kechikkan kunlar" value={late} tone={late > 0 ? 'warn' : 'ok'} />
        <Stat label="Ishlagan soat" value={num(totalHours, 1)} />
      </div>

      <Card pad={false}>
        <div className="p-4">
          <CardTitle>Davomat</CardTitle>
          {att.length === 0 ? <Empty title="Yozuv yo'q" /> : (
            <Table minWidth={560}>
              <thead>
                <tr>
                  <Th w={120}>Sana</Th>
                  <Th w={110} align="center">Keldi</Th>
                  <Th w={110} align="center">Ketdi</Th>
                  <Th w={120} align="right">Ishladi</Th>
                  <Th align="center">Holat</Th>
                </tr>
              </thead>
              <tbody>
                {att.map((a) => (
                  <Tr key={a.id}>
                    <Td mono>{dateShort(a.work_date)}</Td>
                    <Td align="center" mono>{a.check_in ? timeUz(a.check_in) : '—'}</Td>
                    <Td align="center" mono>{a.check_out ? timeUz(a.check_out) : '—'}</Td>
                    <Td align="right" mono>{a.worked_min ? `${num(a.worked_min / 60, 1)} soat` : '—'}</Td>
                    <Td align="center">
                      <Badge tone={a.late_min > 0 ? 'warn' : 'ok'}>
                        {a.late_min > 0 ? `${a.late_min} daq kech` : 'vaqtida'}
                      </Badge>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </Card>

      <Card pad={false}>
        <div className="p-4">
          <CardTitle>
            <span className="inline-flex items-center gap-1.5"><CalendarOff size={15} />Ta'til va ruxsat</span>
          </CardTitle>
          {leaves.length === 0 ? <Empty title="So'rov yo'q" /> : (
            <Table minWidth={560}>
              <thead>
                <tr>
                  <Th w={130}>Turi</Th>
                  <Th w={200}>Muddat</Th>
                  <Th w={80} align="right">Kun</Th>
                  <Th>Sabab</Th>
                  <Th w={110} align="center">Holat</Th>
                </tr>
              </thead>
              <tbody>
                {leaves.map((l) => (
                  <Tr key={l.id}>
                    <Td>{l.kind === 'annual' ? "Yillik ta'til" : l.kind === 'sick' ? 'Kasallik' : l.kind}</Td>
                    <Td mono>{dateShort(l.from_date)} — {dateShort(l.to_date)}</Td>
                    <Td align="right" mono>{l.days != null ? num(l.days, 0) : '—'}</Td>
                    <Td><span style={{ color: 'var(--text-2)' }}>{l.reason ?? '—'}</span></Td>
                    <Td align="center">
                      <Badge tone={l.status === 'approved' ? 'ok' : l.status === 'rejected' ? 'danger' : 'warn'}>
                        {l.status === 'approved' ? 'tasdiqlandi'
                          : l.status === 'rejected' ? 'rad etildi' : 'kutmoqda'}
                      </Badge>
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

function MoneyTab({
  advances, adjust,
}: { advances: StaffAdvance[]; adjust: StaffAdjustment[] }) {
  return (
    <div className="space-y-4">
      <Card pad={false}>
        <div className="p-4">
          <CardTitle sub="Oylikdan bo'lib ushlab qolinadi">
            <span className="inline-flex items-center gap-1.5"><Wallet size={15} />Avans va qarz</span>
          </CardTitle>
          {advances.length === 0 ? <Empty title="Avans berilmagan" /> : (
            <Table minWidth={620}>
              <thead>
                <tr>
                  <Th w={110}>Sana</Th>
                  <Th w={140} align="right">Summa</Th>
                  <Th w={140} align="right">Oyiga ushlash</Th>
                  <Th w={140} align="right">Qoldiq</Th>
                  <Th>Sabab</Th>
                  <Th w={100} align="center">Holat</Th>
                </tr>
              </thead>
              <tbody>
                {advances.map((a) => (
                  <Tr key={a.id}>
                    <Td mono>{dateShort(a.issue_date)}</Td>
                    <Td align="right" mono>{money(a.amount, false)}</Td>
                    <Td align="right" mono>
                      {Number(a.repay_monthly) > 0 ? money(a.repay_monthly, false) : 'to\'liq'}
                    </Td>
                    <Td align="right" mono className="font-semibold">
                      <span style={{ color: Number(a.balance) > 0 ? 'var(--warn)' : 'var(--ok)' }}>
                        {money(a.balance, false)}
                      </span>
                    </Td>
                    <Td><span style={{ color: 'var(--text-2)' }}>{a.reason ?? '—'}</span></Td>
                    <Td align="center">
                      <Badge tone={a.status === 'open' ? 'warn' : 'ok'}>
                        {a.status === 'open' ? 'ochiq' : 'yopilgan'}
                      </Badge>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </Card>

      <Card pad={false}>
        <div className="p-4">
          <CardTitle sub="Oylik hisobiga avtomatik kiradi">
            <span className="inline-flex items-center gap-1.5"><Award size={15} />Jazo va rag'bat</span>
          </CardTitle>
          {adjust.length === 0 ? <Empty title="Yozuv yo'q" /> : (
            <Table minWidth={520}>
              <thead>
                <tr>
                  <Th w={110}>Oy</Th>
                  <Th w={110} align="center">Turi</Th>
                  <Th w={140} align="right">Summa</Th>
                  <Th>Sabab</Th>
                </tr>
              </thead>
              <tbody>
                {adjust.map((a) => (
                  <Tr key={a.id}>
                    <Td mono>{monthLabel(a.period_month)}</Td>
                    <Td align="center">
                      <Badge tone={a.kind === 'penalty' ? 'danger' : 'ok'}>
                        {a.kind === 'penalty' ? 'jazo' : "rag'bat"}
                      </Badge>
                    </Td>
                    <Td align="right" mono>
                      <span style={{ color: a.kind === 'penalty' ? 'var(--danger)' : 'var(--ok)' }}>
                        {a.kind === 'penalty' ? '−' : '+'}{money(a.amount, false)}
                      </span>
                    </Td>
                    <Td>{a.reason}</Td>
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

function HandoverList({
  items, canHr, onChanged,
}: { items: HandoverItem[]; canHr: boolean; onChanged: () => void }) {
  const TYPE: Record<string, string> = {
    customer: 'Mijoz', receivable: 'Qarz', task: 'Vazifa', advance: 'Avans', other: 'Boshqa',
  }
  async function toggle(h: HandoverItem) {
    await supabase.from('ip_handover_items')
      .update({ is_done: !h.is_done, done_at: h.is_done ? null : new Date().toISOString() } as never)
      .eq('id', h.id)
    onChanged()
  }
  return (
    <Table minWidth={620}>
      <thead>
        <tr>
          <Th w={110}>Turi</Th>
          <Th>Nima</Th>
          <Th w={140} align="right">Summa</Th>
          <Th w={110} align="center">Topshirildi</Th>
        </tr>
      </thead>
      <tbody>
        {items.map((h) => (
          <Tr key={h.id}>
            <Td><Badge tone="neutral">{TYPE[h.item_type] ?? h.item_type}</Badge></Td>
            <Td>{h.description}</Td>
            <Td align="right" mono>{h.amount_base != null ? money(h.amount_base, false) : '—'}</Td>
            <Td align="center">
              {canHr
                ? <Toggle checked={h.is_done} onChange={() => void toggle(h)} />
                : h.is_done ? <Check size={15} style={{ color: 'var(--ok)' }} /> : '—'}
            </Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  )
}

/* ================================================================ */
/*  MODALLAR                                                         */
/* ================================================================ */

function ProfileModal({ p, onClose, onDone }: { p: Profile; onClose: () => void; onDone: () => void }) {
  const [d, setD] = useState<Partial<Profile>>(p)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  function set<K extends keyof Profile>(k: K, v: Profile[K]) { setD((x) => ({ ...x, [k]: v })) }

  async function save() {
    setBusy(true); setErr('')
    const { error } = await supabase.from('ip_profiles').update({
      full_name: d.full_name?.trim(),
      phone: d.phone?.trim() || null,
      position: d.position?.trim() || null,
      birth_date: d.birth_date || null,
      passport: d.passport?.trim() || null,
      pinfl: d.pinfl?.trim() || null,
      address: d.address?.trim() || null,
      emergency_name: d.emergency_name?.trim() || null,
      emergency_phone: d.emergency_phone?.trim() || null,
      employment_type: d.employment_type || null,
      probation_until: d.probation_until || null,
      contract_until: d.contract_until || null,
      note: d.note?.trim() || null,
    } as never).eq('id', p.id)
    setBusy(false)
    if (error) { setErr(translateDbError(error.message)); return }
    onDone()
  }

  return (
    <Modal
      open onClose={onClose} width={620} title="Xodim kartochkasi"
      footer={<><Button onClick={onClose}>Bekor</Button>
        <Button variant="primary" loading={busy} onClick={save}>Saqlash</Button></>}
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="To'liq ism" required>
            <Input value={d.full_name ?? ''} onChange={(v) => set('full_name', v)} />
          </Field>
          <Field label="Lavozim">
            <Input value={d.position ?? ''} onChange={(v) => set('position', v)} placeholder="Sotuv menejeri" />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Telefon"><Input value={d.phone ?? ''} onChange={(v) => set('phone', v)} /></Field>
          <Field label="Tug'ilgan sana">
            <Input type="date" value={d.birth_date ?? ''} onChange={(v) => set('birth_date', v)} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Pasport" hint="Seriya va raqam">
            <Input value={d.passport ?? ''} onChange={(v) => set('passport', v)} placeholder="AA 1234567" />
          </Field>
          <Field label="JSHSHIR">
            <Input value={d.pinfl ?? ''} onChange={(v) => set('pinfl', v)} />
          </Field>
        </div>
        <Field label="Manzil"><Input value={d.address ?? ''} onChange={(v) => set('address', v)} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Favqulodda holatda kim" hint="Ism">
            <Input value={d.emergency_name ?? ''} onChange={(v) => set('emergency_name', v)} />
          </Field>
          <Field label="Telefoni">
            <Input value={d.emergency_phone ?? ''} onChange={(v) => set('emergency_phone', v)} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Shartnoma turi">
            <Select
              value={d.employment_type ?? 'permanent'} onChange={(v) => set('employment_type', v)}
              options={Object.entries(EMP_TYPE).map(([k, l]) => ({ value: k, label: l }))}
            />
          </Field>
          <Field label="Sinov muddati">
            <Input type="date" value={d.probation_until ?? ''} onChange={(v) => set('probation_until', v)} />
          </Field>
          <Field label="Shartnoma tugaydi">
            <Input type="date" value={d.contract_until ?? ''} onChange={(v) => set('contract_until', v)} />
          </Field>
        </div>
        <Field label="Izoh"><Textarea value={d.note ?? ''} onChange={(v) => set('note', v)} rows={2} /></Field>
        {err && <ErrorBox>{err}</ErrorBox>}
      </div>
    </Modal>
  )
}

function HireModal({ p, onClose, onDone }: { p: Profile; onClose: () => void; onDone: () => void }) {
  const [date, setDate] = useState(isoDate())
  const [position, setPosition] = useState(p.position ?? '')
  const [type, setType] = useState(p.employment_type ?? 'permanent')
  const [probation, setProbation] = useState('')
  const [contract, setContract] = useState('')
  const [orderNo, setOrderNo] = useState('')
  const [orderDate, setOrderDate] = useState(isoDate())
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function save() {
    setBusy(true); setErr('')
    const { error } = await supabase.rpc('ip_hire', {
      p_profile: p.id, p_date: date, p_position: position.trim() || null,
      p_type: type, p_probation: probation || null, p_contract: contract || null,
      p_order_no: orderNo.trim() || null, p_order_date: orderDate || null,
      p_note: note.trim() || null,
    })
    setBusy(false)
    if (error) { setErr(translateDbError(error.message)); return }
    onDone()
  }

  const future = new Date(date) > new Date()

  return (
    <Modal
      open onClose={onClose} width={560}
      title={p.hired_at ? 'Qayta ishga olish' : 'Ishga olish'}
      footer={<><Button onClick={onClose}>Bekor</Button>
        <Button variant="primary" loading={busy} onClick={save}>Rasmiylashtirish</Button></>}
    >
      <div className="space-y-3">
        {future && (
          <InfoBox tone="info">
            Sana kelajakda — yozuv saqlanadi va <b>{dateShort(date)}</b> kuni
            avtomatik kuchga kiradi.
          </InfoBox>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Ishga olish sanasi" required>
            <Input type="date" value={date} onChange={setDate} />
          </Field>
          <Field label="Lavozim">
            <Input value={position} onChange={setPosition} placeholder="Sotuv menejeri" />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Shartnoma turi">
            <Select
              value={type} onChange={setType}
              options={Object.entries(EMP_TYPE).map(([k, l]) => ({ value: k, label: l }))}
            />
          </Field>
          <Field label="Sinov muddati">
            <Input type="date" value={probation} onChange={setProbation} />
          </Field>
          <Field label="Shartnoma tugaydi">
            <Input type="date" value={contract} onChange={setContract} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Buyruq raqami"><Input value={orderNo} onChange={setOrderNo} placeholder="12-B" /></Field>
          <Field label="Buyruq sanasi"><Input type="date" value={orderDate} onChange={setOrderDate} /></Field>
        </div>
        <Field label="Izoh"><Textarea value={note} onChange={setNote} rows={2} /></Field>
        {err && <ErrorBox>{err}</ErrorBox>}
      </div>
    </Modal>
  )
}

function TerminateModal({ p, onClose, onDone }: { p: Profile; onClose: () => void; onDone: () => void }) {
  const [date, setDate] = useState(isoDate())
  const [reason, setReason] = useState('')
  const [orderNo, setOrderNo] = useState('')
  const [orderDate, setOrderDate] = useState(isoDate())
  const [note, setNote] = useState('')
  const [settlement, setSettlement] = useState<FinalSettlement | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [step, setStep] = useState<'form' | 'done'>('form')

  const REASONS = [
    "O'z xohishi bilan", 'Kelishuv asosida', 'Shartnoma muddati tugadi',
    'Sinov muddatidan o\'tmadi', 'Intizom buzilishi', 'Shtat qisqarishi', 'Boshqa',
  ]

  // Yakuniy hisobni oldindan ko'rsatamiz
  useEffect(() => {
    let alive = true
    void supabase.rpc('ip_final_settlement', { p_profile: p.id, p_date: date })
      .then(({ data }) => { if (alive && data) setSettlement(data as FinalSettlement) })
    return () => { alive = false }
  }, [p.id, date])

  async function save() {
    if (!reason.trim()) { setErr('Sabab tanlanmagan'); return }
    setBusy(true); setErr('')
    const { error } = await supabase.rpc('ip_terminate', {
      p_profile: p.id, p_date: date, p_reason: reason,
      p_order_no: orderNo.trim() || null, p_order_date: orderDate || null,
      p_note: note.trim() || null,
    })
    if (!error) {
      try { await invokeFn('ip-staff', { action: 'set_active', id: p.id, is_active: false }) }
      catch { /* profil allaqachon faolsiz, kirish bloklanmasa ham xato emas */ }
    }
    setBusy(false)
    if (error) { setErr(translateDbError(error.message)); return }
    setStep('done')
  }

  if (step === 'done') {
    return (
      <Modal
        open onClose={onDone} width={520} title="Bo'shatildi"
        footer={<Button variant="primary" onClick={onDone}>Yopish</Button>}
      >
        <div className="space-y-3">
          <InfoBox tone="ok">
            <b>{p.full_name}</b> bo'shatildi va tizimga kira olmaydi.
            Ish topshirish ro'yxati kartochkada tayyor turibdi.
          </InfoBox>
          {settlement && <SettlementBox s={settlement} />}
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      open onClose={onClose} width={560} title={`Bo'shatish — ${p.full_name}`}
      footer={<><Button onClick={onClose}>Bekor</Button>
        <Button variant="danger" loading={busy} onClick={save} disabled={!reason}>
          <UserMinus size={14} />Bo'shatish
        </Button></>}
    >
      <div className="space-y-3">
        <InfoBox tone="warn">
          Bo'shatilgach xodim tizimga kira olmaydi. Uning mijozlari, qarzlari va
          vazifalari <b>ish topshirish ro'yxatiga</b> tushadi — keyin boshqa
          xodimga taqsimlaysiz.
        </InfoBox>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Bo'shatish sanasi" required>
            <Input type="date" value={date} onChange={setDate} />
          </Field>
          <Field label="Sabab" required>
            <Select
              value={reason} onChange={setReason} placeholder="Tanlang…"
              options={REASONS.map((r) => ({ value: r, label: r }))}
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Buyruq raqami"><Input value={orderNo} onChange={setOrderNo} placeholder="7-B" /></Field>
          <Field label="Buyruq sanasi"><Input type="date" value={orderDate} onChange={setOrderDate} /></Field>
        </div>

        <Field label="Izoh"><Textarea value={note} onChange={setNote} rows={2} /></Field>

        {settlement && <SettlementBox s={settlement} />}
        {err && <ErrorBox>{err}</ErrorBox>}
      </div>
    </Modal>
  )
}

function SettlementBox({ s }: { s: FinalSettlement }) {
  const lines: { label: string; value: number; neg?: boolean }[] = [
    { label: `Ishlangan ${s.worked_days}/${s.work_days} kun uchun oylik`, value: s.salary_part },
    { label: `Foydalanilmagan ta'til (${num(s.leave_days_left, 0)} kun)`, value: s.leave_comp },
    { label: 'Bonus', value: s.bonus },
    { label: "Rag'bat", value: s.extra_bonus },
    { label: 'Jazo', value: s.penalty, neg: true },
    { label: 'Yopilmagan avans', value: s.advance_due, neg: true },
  ].filter((l) => Number(l.value) !== 0)

  return (
    <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border-2)', background: 'var(--surface-2)' }}>
      <div className="mb-2 text-[13px] font-medium">Yakuniy hisob-kitob</div>
      <div className="space-y-1">
        {lines.map((l) => (
          <div key={l.label} className="flex justify-between gap-3 text-[12.5px]">
            <span style={{ color: 'var(--text-3)' }}>{l.label}</span>
            <span className="tnum font-medium" style={{ color: l.neg ? 'var(--danger)' : undefined }}>
              {l.neg ? '−' : ''}{money(l.value, false)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between border-t pt-2 text-[13.5px] font-semibold">
        <span>To'lanadi</span>
        <span className="tnum" style={{ color: Number(s.total) >= 0 ? 'var(--ok)' : 'var(--danger)' }}>
          {money(s.total)}
        </span>
      </div>
    </div>
  )
}

function AdvanceModal({ p, onClose, onDone }: { p: Profile; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState('')
  const [monthly, setMonthly] = useState('')
  const [account, setAccount] = useState<number | null>(null)
  const [date, setDate] = useState(isoDate())
  const [reason, setReason] = useState('')
  const [accounts, setAccounts] = useState<{ cash_account_id: number; name: string; balance_base: number }[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

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
    const { error } = await supabase.rpc('ip_give_advance', {
      p_profile: p.id, p_amount: Number(amount), p_account: account,
      p_monthly: Number(monthly) || 0, p_date: date, p_reason: reason.trim() || null,
    })
    setBusy(false)
    if (error) { setErr(translateDbError(error.message)); return }
    onDone()
  }

  const months = Number(amount) > 0 && Number(monthly) > 0
    ? Math.ceil(Number(amount) / Number(monthly)) : null

  return (
    <Modal
      open onClose={onClose} width={500} title={`Avans — ${p.full_name}`}
      footer={<><Button onClick={onClose}>Bekor</Button>
        <Button variant="primary" loading={busy} onClick={save} disabled={!(Number(amount) > 0)}>
          Berish
        </Button></>}
    >
      <div className="space-y-3">
        <InfoBox>
          Pul kassadan chiqim sifatida yoziladi va oylik hisobida avtomatik
          ushlab qolinadi.
        </InfoBox>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Summa" required>
            <Input type="number" className="text-right tnum" value={amount} onChange={setAmount} autoFocus />
          </Field>
          <Field
            label="Oyiga ushlash" hint={months ? `${months} oyda yopiladi` : "Bo'sh = bir oyda to'liq"}
          >
            <Input type="number" className="text-right tnum" value={monthly} onChange={setMonthly} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Qaysi kassadan" required>
            <Select
              value={account ?? ''} onChange={(v) => setAccount(v ? Number(v) : null)}
              options={accounts.map((a) => ({
                value: a.cash_account_id, label: `${a.name} — ${money(a.balance_base, false)}`,
              }))}
            />
          </Field>
          <Field label="Sana"><Input type="date" value={date} onChange={setDate} /></Field>
        </div>
        <Field label="Sabab"><Textarea value={reason} onChange={setReason} rows={2} /></Field>
        {err && <ErrorBox>{err}</ErrorBox>}
      </div>
    </Modal>
  )
}

function AdjustModal({ p, onClose, onDone }: { p: Profile; onClose: () => void; onDone: () => void }) {
  const [kind, setKind] = useState<'penalty' | 'bonus'>('bonus')
  const [amount, setAmount] = useState('')
  const [month, setMonth] = useState(monthStart())
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function save() {
    if (!reason.trim()) { setErr('Sabab kiritilmagan'); return }
    setBusy(true); setErr('')
    const { error } = await supabase.from('ip_staff_adjustments').insert({
      profile_id: p.id, period_month: month, kind,
      amount: Number(amount), reason: reason.trim(),
    } as never)
    setBusy(false)
    if (error) { setErr(translateDbError(error.message)); return }
    onDone()
  }

  return (
    <Modal
      open onClose={onClose} width={480} title={`Jazo / rag'bat — ${p.full_name}`}
      footer={<><Button onClick={onClose}>Bekor</Button>
        <Button variant="primary" loading={busy} onClick={save} disabled={!(Number(amount) > 0)}>
          Saqlash
        </Button></>}
    >
      <div className="space-y-3">
        <InfoBox>Shu oyning oylik hisobiga avtomatik kiradi.</InfoBox>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Turi" required>
            <Select
              value={kind} onChange={(v) => setKind(v as 'penalty' | 'bonus')}
              options={[
                { value: 'bonus', label: "Rag'bat (qo'shiladi)" },
                { value: 'penalty', label: 'Jazo (ushlab qolinadi)' },
              ]}
            />
          </Field>
          <Field label="Oy" required>
            <Input type="month" value={month.slice(0, 7)} onChange={(v) => setMonth(v + '-01')} />
          </Field>
        </div>
        <Field label="Summa" required>
          <Input type="number" className="text-right tnum" value={amount} onChange={setAmount} autoFocus />
        </Field>
        <Field label="Sabab" required>
          <Textarea value={reason} onChange={setReason} rows={2}
            placeholder={kind === 'penalty' ? 'Masalan: kechikish' : 'Masalan: rejadan ortiq bajardi'} />
        </Field>
        {err && <ErrorBox>{err}</ErrorBox>}
      </div>
    </Modal>
  )
}
