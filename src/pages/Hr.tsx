import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  UserPlus, KeyRound, UserX, UserCheck, Copy, Check, Calculator, Clock,
  CalendarOff, TrendingUp, Send, Link2, RefreshCw,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useSettings } from '../lib/settings'
import { translateDbError } from '../lib/useRefs'
import type { Attendance, ManagerKpi, Payroll, Profile, Role } from '../lib/types'
import {
  Badge, Button, Card, CardTitle, Empty, ErrorBox, Field, InfoBox, Input, Loading,
  Modal, PageHeader, Progress, Select, Stat, Table, Td, Textarea, Th, Toggle, Tr,
} from '../components/ui'
import {
  dateShort, initials, isoDate, money, moneyShort, monthLabel, monthStart, num, pct, timeUz,
} from '../lib/format'

type Tab = 'staff' | 'kpi' | 'attendance' | 'leaves' | 'payroll'

const ROLE_LABEL: Record<Role, string> = {
  owner: "Ta'sischi", manager: 'Sotuv menejeri', accountant: 'Buxgalter',
}

export default function Hr() {
  const { isOwner, profile } = useAuth()
  const [tab, setTab] = useState<Tab>('staff')

  const TABS = ([
    { key: 'staff',      label: 'Xodimlar' },
    { key: 'kpi',        label: 'KPI va reyting' },
    { key: 'attendance', label: 'Davomat' },
    { key: 'leaves',     label: "Ta'til va ruxsat" },
    { key: 'payroll',    label: 'Oylik', owner: true },
  ] as { key: Tab; label: string; owner?: boolean }[])
    .filter((t) => !t.owner || isOwner)

  return (
    <div>
      <PageHeader
        title="Xodimlar"
        sub={isOwner ? 'Hisob ochish, KPI, davomat, oylik va bonus' : "O'z ko'rsatkichlaringiz"}
      />

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

      {tab === 'staff'      && <StaffTab isOwner={isOwner} meId={profile!.id} />}
      {tab === 'kpi'        && <KpiTab />}
      {tab === 'attendance' && <AttendanceTab isOwner={isOwner} meId={profile!.id} />}
      {tab === 'leaves'     && <LeavesTab isOwner={isOwner} meId={profile!.id} />}
      {tab === 'payroll'    && <PayrollTab />}
    </div>
  )
}

/* ================================================================ */
/*  XODIMLAR                                                         */
/* ================================================================ */

function StaffTab({ isOwner, meId }: { isOwner: boolean; meId: string }) {
  const { n } = useSettings()
  const [rows, setRows] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [creating, setCreating] = useState(false)
  const [resetFor, setResetFor] = useState<Profile | null>(null)
  const [tgCode, setTgCode] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('ip_profiles').select('*').order('role').order('full_name')
    if (error) setErr(translateDbError(error.message))
    setRows((data as Profile[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  async function toggleActive(p: Profile) {
    if (!confirm(p.is_active
      ? `${p.full_name} faolsizlantirilsinmi? U tizimga kira olmaydi.`
      : `${p.full_name} qayta faollashtirilsinmi?`)) return
    setErr('')
    const { data, error } = await supabase.functions.invoke('ip-staff', {
      body: { action: 'set_active', id: p.id, is_active: !p.is_active },
    })
    if (error || (data as { error?: string })?.error) {
      setErr((data as { error?: string })?.error ?? error?.message ?? 'Xato')
      return
    }
    await load()
  }

  async function updateField(id: string, patch: Partial<Profile>) {
    const { error } = await supabase.from('ip_profiles').update(patch as never).eq('id', id)
    if (error) { setErr(translateDbError(error.message)); return }
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
    if ('salary' in patch || 'role' in patch) {
      await supabase.rpc('ip_refresh_budget', { p_month: null })
    }
  }

  async function linkTelegram() {
    const { data, error } = await supabase.rpc('ip_tg_generate_code')
    if (error) { setErr(translateDbError(error.message)); return }
    setTgCode(data as string)
  }

  if (loading) return <Loading />

  const managers = rows.filter((r) => r.role === 'manager' && r.is_active)
  const payrollTotal = rows.filter((r) => r.is_active).reduce((a, r) => a + Number(r.salary), 0)
  const taxPct = n('payroll_tax_pct', 0)

  return (
    <div className="space-y-4">
      {err && <ErrorBox>{err}</ErrorBox>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Faol xodim" value={rows.filter((r) => r.is_active).length} />
        <Stat label="Sotuv menejeri" value={managers.length} tone="brand" />
        <Stat label="Oylik fondi" value={moneyShort(payrollTotal)} sub="Bonussiz" />
        <Stat
          label="Oylikdan soliq" value={moneyShort(payrollTotal * taxPct / 100)}
          sub={`${pct(taxPct)} — sozlamadan`}
        />
      </div>

      {isOwner && managers.length === 0 && (
        <InfoBox tone="warn">
          Hali birorta sotuv menejeri yo'q. Ular qo'shilgunicha byudjetdagi oklad
          qatori <b>nol</b> turadi va mijozlarni taqsimlab bo'lmaydi.
        </InfoBox>
      )}

      <Card pad={false}>
        <div className="p-4">
          <CardTitle
            sub={isOwner ? "Oklad va bonusni shu yerda o'zgartirasiz — byudjet darhol qayta hisoblanadi" : undefined}
            right={isOwner && (
              <Button size="sm" variant="primary" onClick={() => setCreating(true)}>
                <UserPlus size={14} />Hisob ochish
              </Button>
            )}
          >
            Jamoa
          </CardTitle>

          <Table minWidth={isOwner ? 940 : 620}>
            <thead>
              <tr>
                <Th>Xodim</Th>
                <Th w={150}>Rol</Th>
                {isOwner && <Th w={160} align="right">Oklad</Th>}
                {isOwner && <Th w={120} align="right">Bonus %</Th>}
                <Th w={110} align="center">Telegram</Th>
                <Th w={90} align="center">Holat</Th>
                {isOwner && <Th w={110} align="right">Amal</Th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <Tr key={p.id}>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11.5px] font-bold"
                        style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}
                      >
                        {initials(p.full_name)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium">{p.full_name}</div>
                        <div className="text-[12px]" style={{ color: 'var(--text-3)' }}>{p.email}</div>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    {isOwner && p.id !== meId ? (
                      <Select
                        value={p.role}
                        onChange={(v) => updateField(p.id, { role: v as Role })}
                        options={(Object.keys(ROLE_LABEL) as Role[]).map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
                      />
                    ) : <Badge tone={p.role === 'owner' ? 'brand' : 'neutral'}>{ROLE_LABEL[p.role]}</Badge>}
                  </Td>
                  {isOwner && (
                    <Td align="right">
                      <Input
                        type="number" className="text-right tnum" value={p.salary}
                        onChange={(v) => updateField(p.id, { salary: Number(v) || 0 })}
                      />
                    </Td>
                  )}
                  {isOwner && (
                    <Td align="right">
                      <Input
                        type="number" className="text-right tnum"
                        value={p.bonus_pct ?? ''}
                        onChange={(v) => updateField(p.id, { bonus_pct: v === '' ? null : Number(v) })}
                      />
                    </Td>
                  )}
                  <Td align="center">
                    {p.tg_chat_id
                      ? <Badge tone="ok"><Check size={11} />ulangan</Badge>
                      : p.id === meId
                        ? <Button size="sm" variant="ghost" onClick={linkTelegram}><Link2 size={13} />ulash</Button>
                        : <span style={{ color: 'var(--text-3)' }}>—</span>}
                  </Td>
                  <Td align="center">
                    <Badge tone={p.is_active ? 'ok' : 'neutral'}>{p.is_active ? 'faol' : 'faolsiz'}</Badge>
                  </Td>
                  {isOwner && (
                    <Td align="right">
                      <span className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" title="Parolni almashtirish" onClick={() => setResetFor(p)}>
                          <KeyRound size={14} />
                        </Button>
                        {p.id !== meId && (
                          <Button
                            size="sm" variant="ghost"
                            title={p.is_active ? 'Faolsizlantirish' : 'Faollashtirish'}
                            onClick={() => void toggleActive(p)}
                          >
                            {p.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                          </Button>
                        )}
                      </span>
                    </Td>
                  )}
                </Tr>
              ))}
            </tbody>
          </Table>

          {isOwner && (
            <p className="mt-3 text-[12px]" style={{ color: 'var(--text-3)' }}>
              Bonus % bo'sh bo'lsa sozlamadagi umumiy {pct(n('manager_bonus_pct', 8))} ishlatiladi.
            </p>
          )}
        </div>
      </Card>

      {creating && (
        <CreateStaffModal onClose={() => setCreating(false)} onDone={() => { setCreating(false); void load() }} />
      )}
      {resetFor && (
        <ResetPasswordModal profile={resetFor} onClose={() => setResetFor(null)} />
      )}
      {tgCode && <TelegramCodeModal code={tgCode} onClose={() => setTgCode(null)} />}
    </div>
  )
}

function CreateStaffModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { n } = useSettings()
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<Role>('manager')
  const [phone, setPhone] = useState('')
  const [salary, setSalary] = useState(String(n('manager_salary_default', 0)))
  const [bonus, setBonus] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [created, setCreated] = useState<{ email: string; password: string | null } | null>(null)

  useEffect(() => {
    setSalary(String(role === 'owner' ? n('owner_salary', 0) : n('manager_salary_default', 0)))
  }, [role, n])

  async function save() {
    if (!email.includes('@')) { setErr("Email noto'g'ri"); return }
    if (!fullName.trim()) { setErr('Ism kiritilmagan'); return }
    setBusy(true); setErr('')
    const { data, error } = await supabase.functions.invoke('ip-staff', {
      body: {
        action: 'create',
        email: email.trim(), full_name: fullName.trim(), role,
        phone: phone.trim() || null,
        salary: Number(salary) || 0,
        bonus_pct: bonus === '' ? null : Number(bonus),
      },
    })
    setBusy(false)
    const payload = data as { error?: string; email?: string; password?: string | null }
    if (error || payload?.error) {
      setErr(payload?.error ?? error?.message ?? 'Xato')
      return
    }
    setCreated({ email: payload.email!, password: payload.password ?? null })
  }

  if (created) {
    return (
      <Modal
        open onClose={onDone} width={480} title="Hisob ochildi"
        footer={<Button variant="primary" onClick={onDone}>Yopish</Button>}
      >
        <div className="space-y-3">
          <InfoBox tone="ok">Xodim endi tizimga kira oladi.</InfoBox>
          <CopyRow label="Email" value={created.email} />
          {created.password && <CopyRow label="Vaqtinchalik parol" value={created.password} secret />}
          <InfoBox tone="warn">
            Parol <b>faqat shu yerda bir marta</b> ko'rsatiladi. Xodimga bering va
            birinchi kirishdan keyin almashtirishni ayting.
          </InfoBox>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      open onClose={onClose} width={560} title="Yangi xodim hisobi"
      footer={
        <>
          <Button onClick={onClose}>Bekor</Button>
          <Button variant="primary" loading={busy} onClick={save}><UserPlus size={14} />Yaratish</Button>
        </>
      }
    >
      <div className="space-y-3">
        <InfoBox>
          Parol avtomatik yaratiladi va bir marta ko'rsatiladi. Xodim shu email va
          parol bilan kiradi.
        </InfoBox>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="To'liq ism" required>
            <Input value={fullName} onChange={setFullName} placeholder="Aliyev Aziz" autoFocus />
          </Field>
          <Field label="Email" required>
            <Input value={email} onChange={setEmail} type="email" placeholder="aziz@imperial.uz" />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Rol" required>
            <Select
              value={role} onChange={(v) => setRole(v as Role)}
              options={(Object.keys(ROLE_LABEL) as Role[]).map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
            />
          </Field>
          <Field label="Telefon"><Input value={phone} onChange={setPhone} placeholder="+998 90 123 45 67" /></Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Oylik oklad" hint="Sozlamadagi standart qiymat">
            <Input type="number" className="text-right tnum" value={salary} onChange={setSalary} />
          </Field>
          <Field label="Bonus %" hint={`Bo'sh qoldirsangiz ${pct(n('manager_bonus_pct', 8))}`}>
            <Input type="number" className="text-right tnum" value={bonus} onChange={setBonus} />
          </Field>
        </div>

        {err && <ErrorBox>{err}</ErrorBox>}
      </div>
    </Modal>
  )
}

function ResetPasswordModal({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [pw, setPw] = useState<string | null>(null)

  async function reset() {
    setBusy(true); setErr('')
    const { data, error } = await supabase.functions.invoke('ip-staff', {
      body: { action: 'reset_password', id: profile.id },
    })
    setBusy(false)
    const payload = data as { error?: string; password?: string | null }
    if (error || payload?.error) { setErr(payload?.error ?? error?.message ?? 'Xato'); return }
    setPw(payload.password ?? null)
  }

  return (
    <Modal
      open onClose={onClose} width={440}
      title={<span>Parol — <span style={{ color: 'var(--text-2)' }}>{profile.full_name}</span></span>}
      footer={pw
        ? <Button variant="primary" onClick={onClose}>Yopish</Button>
        : <>
            <Button onClick={onClose}>Bekor</Button>
            <Button variant="primary" loading={busy} onClick={reset}>
              <KeyRound size={14} />Yangi parol yaratish
            </Button>
          </>}
    >
      {pw ? (
        <div className="space-y-3">
          <CopyRow label="Yangi parol" value={pw} secret />
          <InfoBox tone="warn">Faqat shu yerda bir marta ko'rsatiladi.</InfoBox>
        </div>
      ) : (
        <div className="space-y-3">
          <InfoBox>
            Eski parol bekor qilinadi va yangisi yaratiladi. Xodimga yangi parolni
            berishingiz kerak bo'ladi.
          </InfoBox>
          {err && <ErrorBox>{err}</ErrorBox>}
        </div>
      )}
    </Modal>
  )
}

function TelegramCodeModal({ code, onClose }: { code: string; onClose: () => void }) {
  return (
    <Modal
      open onClose={onClose} width={440} title="Telegramni ulash"
      footer={<Button variant="primary" onClick={onClose}>Yopish</Button>}
    >
      <div className="space-y-3">
        <InfoBox>
          Botga <b>/start</b> yozing, keyin shu kodni yuboring. Bot sizni tanib
          oladi va bildirishnomalar kela boshlaydi.
        </InfoBox>
        <CopyRow label="Ulanish kodi" value={code} />
        <p className="text-[12px]" style={{ color: 'var(--text-3)' }}>
          <Send size={12} className="mr-1 inline" />
          Telegram bot hali sozlanmagan bo'lsa, kod keyinroq ishlaydi.
        </p>
      </div>
    </Modal>
  )
}

function CopyRow({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  const [done, setDone] = useState(false)
  return (
    <div>
      <div className="mb-1 text-[13px] font-medium">{label}</div>
      <div
        className="flex items-center gap-2 rounded-lg border px-3 py-2"
        style={{ background: 'var(--surface-2)', borderColor: 'var(--border-2)' }}
      >
        <code className="flex-1 text-[14px]" style={{ fontFamily: 'var(--font-mono)' }}>{value}</code>
        <Button
          size="sm" variant="ghost"
          onClick={() => {
            try {
              void navigator.clipboard.writeText(value)
              setDone(true); setTimeout(() => setDone(false), 1500)
            } catch { /* clipboard bo'lmasligi mumkin */ }
          }}
        >
          {done ? <Check size={14} /> : <Copy size={14} />}
        </Button>
      </div>
      {secret && (
        <p className="mt-1 text-[11.5px]" style={{ color: 'var(--text-3)' }}>
          Nusxa olib, xavfsiz kanal orqali bering
        </p>
      )}
    </div>
  )
}

/* ================================================================ */
/*  KPI                                                              */
/* ================================================================ */

function KpiTab() {
  const { n } = useSettings()
  const [rows, setRows] = useState<ManagerKpi[]>([])
  const [plans, setPlans] = useState<{ manager_id: string; amount: number }[]>([])
  const [month, setMonth] = useState(monthStart())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    void Promise.all([
      supabase.from('ip_manager_kpi').select('*').eq('period_month', month),
      supabase.from('ip_sales_plans').select('manager_id, amount').eq('period_month', month),
    ]).then(([k, p]) => {
      if (!alive) return
      setRows((k.data as ManagerKpi[]) ?? [])
      setPlans((p.data as never) ?? [])
      setLoading(false)
    })
    return () => { alive = false }
  }, [month])

  if (loading) return <Loading />

  const target = n('target_gross_margin_pct', 17)
  const planOf = (id: string) => Number(plans.find((p) => p.manager_id === id)?.amount ?? 0)
  const sorted = [...rows].sort((a, b) => Number(b.revenue_base) - Number(a.revenue_base))

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2">
        <div className="w-[170px]">
          <Field label="Oy"><Input type="month" value={month.slice(0, 7)} onChange={(v) => setMonth(v + '-01')} /></Field>
        </div>
      </div>

      {sorted.length === 0 || sorted.every((r) => Number(r.revenue_base) === 0) ? (
        <Card>
          <Empty
            title="Bu oyda sotuv yo'q"
            hint="Menejerlar sotuv kiritgach reyting, marja va undirish foizi shu yerda ko'rinadi."
            icon={<TrendingUp size={22} />}
          />
        </Card>
      ) : (
        <Card pad={false}>
          <div className="p-4">
            <CardTitle sub="Kim haqiqatan foyda keltirayotgani — aylanma emas, marja va undirish muhim">
              Menejerlar reytingi
            </CardTitle>
            <Table minWidth={900}>
              <thead>
                <tr>
                  <Th w={40}>#</Th>
                  <Th>Menejer</Th>
                  <Th w={140} align="right">Sotuv</Th>
                  <Th w={140} align="right">Yalpi foyda</Th>
                  <Th w={100} align="right">Marja</Th>
                  <Th w={110} align="right">Undirish</Th>
                  <Th w={140} align="right">Muddati o'tgan</Th>
                  <Th w={140} align="right">Reja</Th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => {
                  const plan = planOf(r.manager_id)
                  const done = plan > 0 ? (Number(r.revenue_base) / plan) * 100 : null
                  return (
                    <Tr key={r.manager_id}>
                      <Td mono><span style={{ color: 'var(--text-3)' }}>{i + 1}</span></Td>
                      <Td><span className="font-medium">{r.full_name}</span></Td>
                      <Td align="right" mono>{money(r.revenue_base, false)}</Td>
                      <Td align="right" mono>{money(r.gross_profit_base, false)}</Td>
                      <Td align="right" mono>
                        {r.margin_pct != null ? (
                          <span style={{ color: Number(r.margin_pct) >= target ? 'var(--ok)' : 'var(--warn)' }}>
                            {pct(r.margin_pct)}
                          </span>
                        ) : '—'}
                      </Td>
                      <Td align="right" mono>
                        {r.collection_pct != null ? (
                          <span style={{ color: Number(r.collection_pct) >= 90 ? 'var(--ok)' : 'var(--warn)' }}>
                            {pct(r.collection_pct)}
                          </span>
                        ) : '—'}
                      </Td>
                      <Td align="right" mono>
                        {Number(r.overdue_base) > 0 ? (
                          <span style={{ color: 'var(--danger)' }}>{money(r.overdue_base, false)}</span>
                        ) : '—'}
                      </Td>
                      <Td align="right">
                        {done != null ? (
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-14"><Progress value={Number(r.revenue_base)} max={plan} /></div>
                            <span className="tnum text-[12.5px]">{pct(done)}</span>
                          </div>
                        ) : <span style={{ color: 'var(--text-3)' }}>—</span>}
                      </Td>
                    </Tr>
                  )
                })}
              </tbody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  )
}

/* ================================================================ */
/*  DAVOMAT                                                          */
/* ================================================================ */

function AttendanceTab({ isOwner, meId }: { isOwner: boolean; meId: string }) {
  const { s, n } = useSettings()
  const [rows, setRows] = useState<(Attendance & { profile: { full_name: string } | null })[]>([])
  const [date, setDate] = useState(isoDate())
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('ip_attendance')
      .select('*, profile:ip_profiles(full_name)')
      .eq('work_date', date).order('check_in')
    if (error) setErr(translateDbError(error.message))
    setRows((data as never) ?? [])
    setLoading(false)
  }, [date])

  useEffect(() => { void load() }, [load])

  const mine = rows.find((r) => r.profile_id === meId)

  async function mark(kind: 'in' | 'out') {
    setErr('')
    const now = new Date().toISOString()
    if (kind === 'in') {
      const { error } = await supabase.from('ip_attendance')
        .upsert({ profile_id: meId, work_date: date, check_in: now } as never,
          { onConflict: 'profile_id,work_date' })
      if (error) { setErr(translateDbError(error.message)); return }
    } else {
      if (!mine) { setErr('Avval kelganingizni belgilang'); return }
      const { error } = await supabase.from('ip_attendance')
        .update({ check_out: now } as never).eq('id', mine.id)
      if (error) { setErr(translateDbError(error.message)); return }
    }
    await load()
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-4">
      {err && <ErrorBox>{err}</ErrorBox>}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[13.5px] font-medium">Bugungi davomatim</div>
            <div className="mt-0.5 text-[12.5px]" style={{ color: 'var(--text-3)' }}>
              Ish vaqti {s('work_start', '09:00')} – {s('work_end', '18:00')} ·
              kechikishga chidam {n('late_tolerance_min', 0)} daqiqa
            </div>
          </div>
          <div className="flex items-center gap-2">
            {mine?.check_in && (
              <Badge tone={mine.late_min > 0 ? 'warn' : 'ok'}>
                <Clock size={11} />{timeUz(mine.check_in)}
                {mine.late_min > 0 && ` · ${mine.late_min} daq kech`}
              </Badge>
            )}
            {mine?.check_out && <Badge tone="neutral">ketdi {timeUz(mine.check_out)}</Badge>}
            {!mine?.check_in && <Button variant="primary" onClick={() => void mark('in')}>Keldim</Button>}
            {mine?.check_in && !mine?.check_out && (
              <Button onClick={() => void mark('out')}>Ketdim</Button>
            )}
          </div>
        </div>
      </Card>

      <Card pad={false}>
        <div className="p-4">
          <CardTitle
            right={<div className="w-[150px]"><Input type="date" value={date} onChange={setDate} /></div>}
          >
            {isOwner ? 'Jamoa davomati' : 'Davomatim'}
          </CardTitle>

          {rows.length === 0 ? (
            <Empty title="Bu kunda yozuv yo'q" />
          ) : (
            <Table minWidth={620}>
              <thead>
                <tr>
                  <Th>Xodim</Th>
                  <Th w={110} align="center">Keldi</Th>
                  <Th w={110} align="center">Ketdi</Th>
                  <Th w={120} align="right">Ishladi</Th>
                  <Th w={120} align="center">Holat</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Tr key={r.id}>
                    <Td>{r.profile?.full_name ?? '—'}</Td>
                    <Td align="center" mono>{r.check_in ? timeUz(r.check_in) : '—'}</Td>
                    <Td align="center" mono>{r.check_out ? timeUz(r.check_out) : '—'}</Td>
                    <Td align="right" mono>
                      {r.worked_min ? `${num(r.worked_min / 60, 1)} soat` : '—'}
                    </Td>
                    <Td align="center">
                      <Badge tone={r.status === 'late' ? 'warn' : r.status === 'present' ? 'ok' : 'neutral'}>
                        {r.status === 'late' ? `${r.late_min} daq kech`
                          : r.status === 'present' ? 'keldi' : r.status}
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

/* ================================================================ */
/*  TA'TIL                                                           */
/* ================================================================ */

interface Leave {
  id: number; profile_id: string; kind: string
  from_date: string; to_date: string; days: number | null
  reason: string | null; status: string; comment: string | null
  profile?: { full_name: string } | null
}

function LeavesTab({ isOwner, meId }: { isOwner: boolean; meId: string }) {
  const { n } = useSettings()
  const [rows, setRows] = useState<Leave[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase.from('ip_leaves')
      .select('*, profile:ip_profiles(full_name)')
      .order('from_date', { ascending: false })
    setRows((data as never) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  async function decide(id: number, approve: boolean) {
    setErr('')
    const { error } = await supabase.from('ip_leaves').update({
      status: approve ? 'approved' : 'rejected',
      decided_by: meId, decided_at: new Date().toISOString(),
    } as never).eq('id', id)
    if (error) { setErr(translateDbError(error.message)); return }
    await load()
  }

  if (loading) return <Loading />

  const used = rows.filter((r) => r.profile_id === meId && r.status === 'approved' && r.kind === 'annual')
    .reduce((a, r) => a + Number(r.days ?? 0), 0)
  const quota = n('annual_leave_days', 15)

  return (
    <div className="space-y-4">
      {err && <ErrorBox>{err}</ErrorBox>}

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Yillik ta'til normasi" value={`${quota} kun`} />
        <Stat label="Ishlatilgan" value={`${num(used, 0)} kun`} tone={used >= quota ? 'warn' : 'neutral'} />
        <Stat label="Qolgan" value={`${num(Math.max(0, quota - used), 0)} kun`} tone="ok" />
      </div>

      <Card pad={false}>
        <div className="p-4">
          <CardTitle
            right={<Button size="sm" variant="primary" onClick={() => setOpen(true)}>
              <CalendarOff size={14} />So'rov
            </Button>}
          >
            Ta'til va ruxsat so'rovlari
          </CardTitle>

          {rows.length === 0 ? (
            <Empty title="So'rov yo'q" hint="Ta'til, kasallik yoki shaxsiy ruxsat so'rovini shu yerdan yuborasiz." />
          ) : (
            <Table minWidth={760}>
              <thead>
                <tr>
                  <Th>Xodim</Th>
                  <Th w={120}>Turi</Th>
                  <Th w={200}>Muddat</Th>
                  <Th w={80} align="right">Kun</Th>
                  <Th w={110} align="center">Holat</Th>
                  {isOwner && <Th w={140} align="right">Amal</Th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Tr key={r.id}>
                    <Td>
                      <div className="font-medium">{r.profile?.full_name ?? '—'}</div>
                      {r.reason && (
                        <div className="text-[12px]" style={{ color: 'var(--text-3)' }}>{r.reason}</div>
                      )}
                    </Td>
                    <Td>{LEAVE_KIND[r.kind] ?? r.kind}</Td>
                    <Td mono>{dateShort(r.from_date)} — {dateShort(r.to_date)}</Td>
                    <Td align="right" mono>{r.days != null ? num(r.days, 0) : '—'}</Td>
                    <Td align="center">
                      <Badge tone={r.status === 'approved' ? 'ok' : r.status === 'rejected' ? 'danger' : 'warn'}>
                        {r.status === 'approved' ? 'tasdiqlandi'
                          : r.status === 'rejected' ? 'rad etildi' : 'kutmoqda'}
                      </Badge>
                    </Td>
                    {isOwner && (
                      <Td align="right">
                        {r.status === 'pending' && (
                          <span className="flex justify-end gap-1">
                            <Button size="sm" variant="primary" onClick={() => void decide(r.id, true)}>
                              <Check size={14} />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => void decide(r.id, false)}>
                              <UserX size={14} />
                            </Button>
                          </span>
                        )}
                      </Td>
                    )}
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </Card>

      {open && (
        <LeaveModal meId={meId} onClose={() => setOpen(false)} onDone={() => { setOpen(false); void load() }} />
      )}
    </div>
  )
}

const LEAVE_KIND: Record<string, string> = {
  annual: "Yillik ta'til", sick: 'Kasallik', unpaid: "To'lovsiz",
  personal: 'Shaxsiy', other: 'Boshqa',
}

function LeaveModal({ meId, onClose, onDone }: { meId: string; onClose: () => void; onDone: () => void }) {
  const [kind, setKind] = useState('annual')
  const [from, setFrom] = useState(isoDate())
  const [to, setTo] = useState(isoDate())
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const days = useMemo(() => {
    const a = new Date(from), b = new Date(to)
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) return 0
    return Math.round((b.getTime() - a.getTime()) / 86400000) + 1
  }, [from, to])

  async function save() {
    if (days <= 0) { setErr("Muddat noto'g'ri"); return }
    setBusy(true); setErr('')
    const { error } = await supabase.from('ip_leaves').insert({
      profile_id: meId, kind, from_date: from, to_date: to, days,
      reason: reason.trim() || null,
    } as never)
    setBusy(false)
    if (error) { setErr(translateDbError(error.message)); return }
    onDone()
  }

  return (
    <Modal
      open onClose={onClose} width={480} title="Ta'til / ruxsat so'rovi"
      footer={
        <>
          <Button onClick={onClose}>Bekor</Button>
          <Button variant="primary" loading={busy} onClick={save} disabled={days <= 0}>Yuborish</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Turi" required>
          <Select
            value={kind} onChange={setKind}
            options={Object.entries(LEAVE_KIND).map(([v, l]) => ({ value: v, label: l }))}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Dan"><Input type="date" value={from} onChange={setFrom} /></Field>
          <Field label="Gacha"><Input type="date" value={to} onChange={setTo} /></Field>
        </div>
        {days > 0 && <InfoBox>Jami <b>{days} kun</b></InfoBox>}
        <Field label="Sabab"><Textarea value={reason} onChange={setReason} rows={2} /></Field>
        {err && <ErrorBox>{err}</ErrorBox>}
      </div>
    </Modal>
  )
}

/* ================================================================ */
/*  OYLIK                                                            */
/* ================================================================ */

function PayrollTab() {
  const { b, n } = useSettings()
  const [rows, setRows] = useState<(Payroll & { profile: { full_name: string; role: Role } | null })[]>([])
  const [month, setMonth] = useState(monthStart())
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase.from('ip_payroll')
      .select('*, profile:ip_profiles(full_name, role)')
      .eq('period_month', month).order('total_gross', { ascending: false })
    setRows((data as never) ?? [])
    setLoading(false)
  }, [month])

  useEffect(() => { void load() }, [load])

  async function calc() {
    setBusy(true); setErr('')
    const { error } = await supabase.rpc('ip_calc_payroll', { p_month: month })
    setBusy(false)
    if (error) { setErr(translateDbError(error.message)); return }
    await load()
  }

  async function markPaid(id: number) {
    const { error } = await supabase.from('ip_payroll')
      .update({ status: 'paid', paid_at: isoDate() } as never).eq('id', id)
    if (error) { setErr(translateDbError(error.message)); return }
    await load()
  }

  if (loading) return <Loading />

  const tot = rows.reduce((a, r) => ({
    salary: a.salary + Number(r.salary),
    bonus: a.bonus + Number(r.bonus_amount),
    tax: a.tax + Number(r.tax_amount),
    net: a.net + Number(r.total_net),
  }), { salary: 0, bonus: 0, tax: 0, net: 0 })

  return (
    <div className="space-y-4">
      {err && <ErrorBox>{err}</ErrorBox>}

      <div className="flex flex-wrap items-end gap-2">
        <div className="w-[170px]">
          <Field label="Oy"><Input type="month" value={month.slice(0, 7)} onChange={(v) => setMonth(v + '-01')} /></Field>
        </div>
        <Button variant="primary" loading={busy} onClick={calc}>
          <Calculator size={14} />Hisoblash
        </Button>
        <Button onClick={() => void load()}><RefreshCw size={14} /></Button>
      </div>

      <InfoBox>
        Bonus <b>{pct(n('manager_bonus_pct', 8))}</b> yalpi foydadan hisoblanadi
        {b('bonus_requires_collection', true)
          ? <>, lekin <b>faqat undirilgan</b> qismidan — qarz qolgan sotuvga bonus berilmaydi.</>
          : <>, undirilganiga qaramasdan.</>}
        {' '}Buni Sozlamalar → Xodimlar dan o'zgartirasiz.
      </InfoBox>

      {rows.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Oklad" value={moneyShort(tot.salary)} />
          <Stat label="Bonus" value={moneyShort(tot.bonus)} tone="brand" />
          <Stat label="Soliq" value={moneyShort(tot.tax)} sub={pct(n('payroll_tax_pct', 0))} />
          <Stat label="Qo'lga tegadi" value={moneyShort(tot.net)} tone="ok" />
        </div>
      )}

      <Card pad={false}>
        <div className="p-4">
          <CardTitle sub={monthLabel(month)}>Oylik hisob-kitobi</CardTitle>

          {rows.length === 0 ? (
            <Empty
              title="Hisoblanmagan"
              hint="«Hisoblash» tugmasini bosing — oklad xodim kartochkasidan, bonus esa shu oydagi yalpi foydadan olinadi."
              action={<Button variant="primary" loading={busy} onClick={calc}><Calculator size={14} />Hisoblash</Button>}
            />
          ) : (
            <Table minWidth={900}>
              <thead>
                <tr>
                  <Th>Xodim</Th>
                  <Th w={140} align="right">Oklad</Th>
                  <Th w={150} align="right">Bonus bazasi</Th>
                  <Th w={90} align="right">%</Th>
                  <Th w={130} align="right">Bonus</Th>
                  <Th w={130} align="right">Jami</Th>
                  <Th w={110} align="center">Holat</Th>
                  <Th w={100} align="right">Amal</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Tr key={r.id}>
                    <Td>
                      <div className="font-medium">{r.profile?.full_name ?? '—'}</div>
                      <div className="text-[12px]" style={{ color: 'var(--text-3)' }}>
                        {r.profile ? ROLE_LABEL[r.profile.role] : ''}
                      </div>
                    </Td>
                    <Td align="right" mono>{money(r.salary, false)}</Td>
                    <Td align="right" mono>
                      {Number(r.bonus_base) > 0 ? money(r.bonus_base, false) : '—'}
                    </Td>
                    <Td align="right" mono>{r.bonus_pct != null ? pct(r.bonus_pct) : '—'}</Td>
                    <Td align="right" mono>
                      {Number(r.bonus_amount) > 0
                        ? <span style={{ color: 'var(--brand)' }}>{money(r.bonus_amount, false)}</span>
                        : '—'}
                    </Td>
                    <Td align="right" mono className="font-semibold">{money(r.total_net, false)}</Td>
                    <Td align="center">
                      <Badge tone={r.status === 'paid' ? 'ok' : 'warn'}>
                        {r.status === 'paid' ? "to'langan" : 'qoralama'}
                      </Badge>
                    </Td>
                    <Td align="right">
                      {r.status !== 'paid' && (
                        <Button size="sm" onClick={() => void markPaid(r.id)}>To'landi</Button>
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
