import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Wallet, Package, Users, Truck, Scale, TrendingUp, TrendingDown,
  Plus, RefreshCw, Banknote, Landmark, Calculator, AlertTriangle,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useSettings } from '../lib/settings'
import { useRefs, useSuppliers, translateDbError } from '../lib/useRefs'
import type {
  BudgetRow, CashFlowRow, Expense, Loan, Period, PlanVsFact, PnlRow,
  Position, SupplierBalance,
} from '../lib/types'
import {
  Badge, Button, Card, CardTitle, Empty, ErrorBox, Field, InfoBox, Input, Loading,
  Modal, PageHeader, Progress, Select, Stat, Table, Td, Textarea, Th, Tr,
} from '../components/ui'
import { dateShort, isoDate, money, moneyShort, monthLabel, num, pct } from '../lib/format'
import CashJournal from '../components/CashJournal'

type Tab = 'position' | 'journal' | 'pnl' | 'cash' | 'plan' | 'expenses' | 'loans'

export default function Finance() {
  const [tab, setTab] = useState<Tab>('position')

  const TABS = ([
    { key: 'position', label: 'Pozitsiya' },
    { key: 'journal',  label: 'Kassa jurnali' },
    { key: 'pnl',      label: 'Foyda va zarar' },
    { key: 'cash',     label: 'Naqd oqim' },
    { key: 'plan',     label: 'Reja va byudjet' },
    { key: 'expenses', label: 'Harajatlar' },
    { key: 'loans',    label: 'Qarzlar' },
  ] as { key: Tab; label: string }[])

  return (
    <div>
      <PageHeader title="Moliya" sub="Pozitsiya, foyda-zarar, naqd oqim, byudjet va qarzlar" />

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

      {tab === 'position' && <PositionTab />}
      {tab === 'journal'  && <CashJournal />}
      {tab === 'pnl'      && <PnlTab />}
      {tab === 'cash'     && <CashTab />}
      {tab === 'plan'     && <PlanTab />}
      {tab === 'expenses' && <ExpensesTab />}
      {tab === 'loans'    && <LoansTab />}
    </div>
  )
}

/* ================================================================ */
/*  POZITSIYA                                                        */
/* ================================================================ */

function PositionTab() {
  const [p, setP] = useState<Position | null>(null)
  const [sup, setSup] = useState<SupplierBalance[]>([])
  const [loading, setLoading] = useState(true)
  const { n } = useSettings()

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([
      supabase.from('ip_position').select('*').maybeSingle(),
      supabase.from('ip_supplier_balance').select('*').order('debt_base', { ascending: false }),
    ])
    setP(a.data as Position | null)
    setSup((b.data as SupplierBalance[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])
  if (loading) return <Loading />
  if (!p) return <Card><Empty title="Ma'lumot yo'q" /></Card>

  const assets = p.cash_base + p.stock_base + p.receivable_base + p.supplier_advance_base
  const liabilities = p.supplier_debt_base + p.customer_advance_base + p.loan_base
  const net = assets - liabilities
  const minSafe = n('min_safe_cash', 0)

  const ROWS: { label: string; value: number; icon: typeof Wallet; hint?: string }[] = [
    { label: 'Naqd va bank',            value: p.cash_base,             icon: Wallet },
    { label: 'Ombordagi tovar',         value: p.stock_base,            icon: Package, hint: 'Tan narxda' },
    { label: 'Mijozlar qarzi',          value: p.receivable_base,       icon: Users },
    { label: 'Postavshiklarga avans',   value: p.supplier_advance_base, icon: Truck },
  ]
  const LIAB: { label: string; value: number; icon: typeof Wallet; hint?: string }[] = [
    { label: 'Postavshiklarga qarz',    value: p.supplier_debt_base,    icon: Truck },
    { label: 'Mijozlardan olingan avans', value: p.customer_advance_base, icon: Users,
      hint: 'Tovar berishimiz kerak' },
    { label: 'Kredit va investor qarzi', value: p.loan_base,            icon: Landmark },
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Aktiv" value={moneyShort(assets)} tone="ok" icon={<TrendingUp size={16} />} />
        <Stat label="Majburiyat" value={moneyShort(liabilities)} tone="danger" icon={<TrendingDown size={16} />} />
        <Stat
          label="Sof pozitsiya" value={moneyShort(net)}
          tone={net >= 0 ? 'ok' : 'danger'} icon={<Scale size={16} />}
        />
        <Stat
          label="Kassa holati" value={moneyShort(p.cash_base)}
          tone={p.cash_base < minSafe ? 'danger' : 'ok'}
          sub={p.cash_base < minSafe
            ? `Xavfsiz darajadan ${moneyShort(minSafe - p.cash_base)} past`
            : 'Xavfsiz darajadan yuqori'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle sub="Bizda bor yoki bizga qarzdor">Aktiv</CardTitle>
          <div className="space-y-2.5">
            {ROWS.map((r) => {
              const Icon = r.icon
              return (
                <div key={r.label} className="flex items-center gap-3">
                  <Icon size={15} style={{ color: 'var(--ok)' }} className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px]">{r.label}</div>
                    {r.hint && <div className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>{r.hint}</div>}
                  </div>
                  <div className="tnum shrink-0 text-[13.5px] font-semibold">{money(r.value, false)}</div>
                </div>
              )
            })}
            <div className="flex justify-between border-t pt-2.5 text-[13.5px] font-semibold">
              <span>Jami aktiv</span>
              <span className="tnum" style={{ color: 'var(--ok)' }}>{money(assets, false)}</span>
            </div>
          </div>
        </Card>

        <Card>
          <CardTitle sub="Biz qarzdormiz">Majburiyat</CardTitle>
          <div className="space-y-2.5">
            {LIAB.map((r) => {
              const Icon = r.icon
              return (
                <div key={r.label} className="flex items-center gap-3">
                  <Icon size={15} style={{ color: 'var(--danger)' }} className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px]">{r.label}</div>
                    {r.hint && <div className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>{r.hint}</div>}
                  </div>
                  <div className="tnum shrink-0 text-[13.5px] font-semibold">{money(r.value, false)}</div>
                </div>
              )
            })}
            <div className="flex justify-between border-t pt-2.5 text-[13.5px] font-semibold">
              <span>Jami majburiyat</span>
              <span className="tnum" style={{ color: 'var(--danger)' }}>{money(liabilities, false)}</span>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[14px] font-semibold">Sof pozitsiya (aktiv − majburiyat)</div>
            <div className="mt-0.5 text-[12.5px]" style={{ color: 'var(--text-3)' }}>
              1C hisoboti 30.09.2026 holatiga + shundan keyingi harakatlar
            </div>
          </div>
          <div
            className="tnum text-[26px] font-semibold"
            style={{ color: net >= 0 ? 'var(--ok)' : 'var(--danger)' }}
          >
            {money(net)}
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle sub="Eng katta qarzdan boshlab">Postavshiklar</CardTitle>
        <Table minWidth={720}>
          <thead>
            <tr>
              <Th>Postavshik</Th>
              <Th w={150} align="right">Qarzimiz</Th>
              <Th w={150} align="right">Avansimiz</Th>
              <Th w={150} align="right">Sof</Th>
            </tr>
          </thead>
          <tbody>
            {sup.map((s) => (
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
                <Td align="right" mono>
                  <span className="font-semibold" style={{ color: s.debt_base > 0 ? 'var(--danger)' : 'var(--info)' }}>
                    {money(s.debt_base, false)}
                  </span>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  )
}

/* ================================================================ */
/*  FOYDA VA ZARAR                                                   */
/* ================================================================ */

function PnlTab() {
  const [rows, setRows] = useState<PnlRow[]>([])
  const [loading, setLoading] = useState(true)
  const { n } = useSettings()

  useEffect(() => {
    let alive = true
    void supabase.from('ip_pnl_monthly').select('*').then(({ data }) => {
      if (!alive) return
      setRows((data as PnlRow[]) ?? [])
      setLoading(false)
    })
    return () => { alive = false }
  }, [])

  if (loading) return <Loading />

  const hasFact = rows.some((r) => r.revenue > 0)
  const tot = rows.reduce((a, r) => ({
    revenue: a.revenue + Number(r.revenue),
    cogs: a.cogs + Number(r.cogs),
    gp: a.gp + Number(r.gross_profit),
    variable: a.variable + Number(r.variable_cost) + Number(r.bonus_cost),
    fixed: a.fixed + Number(r.fixed_cost),
    ebit: a.ebit + Number(r.ebit),
    tax: a.tax + Number(r.profit_tax),
    plan: a.plan + Number(r.sales_plan),
  }), { revenue: 0, cogs: 0, gp: 0, variable: 0, fixed: 0, ebit: 0, tax: 0, plan: 0 })

  const LINES: { label: string; get: (r: PnlRow) => number; total: number; bold?: boolean; tone?: string }[] = [
    { label: 'Sotuv (QQSsiz)',   get: (r) => Number(r.revenue),       total: tot.revenue, bold: true },
    { label: 'Tovar tan narxi',  get: (r) => -Number(r.cogs),         total: -tot.cogs },
    { label: 'YALPI FOYDA',      get: (r) => Number(r.gross_profit),  total: tot.gp, bold: true, tone: 'var(--ok)' },
    { label: "O'zgaruvchi harajat", get: (r) => -(Number(r.variable_cost) + Number(r.bonus_cost)), total: -tot.variable },
    { label: 'Doimiy harajat',   get: (r) => -Number(r.fixed_cost),   total: -tot.fixed },
    { label: 'OPERATSION FOYDA', get: (r) => Number(r.ebit),          total: tot.ebit, bold: true },
    { label: "Foyda solig'i",    get: (r) => -Number(r.profit_tax),   total: -tot.tax },
    { label: 'SOF FOYDA',        get: (r) => Number(r.ebit) - Number(r.profit_tax),
      total: tot.ebit - tot.tax, bold: true, tone: 'var(--brand)' },
  ]

  return (
    <div className="space-y-4">
      {!hasFact && (
        <InfoBox tone="warn">
          <span className="flex items-start gap-2">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <span>
              Hali sotuv hujjati kiritilmagan, shuning uchun fakt ustunlari bo'sh.
              Boshlang'ich debitor hujjatlari (1C dan kelgan qarz) <b>ataylab</b>
              {' '}hisobga olinmaydi — ular o'tgan davr qarzi, bu oyning daromadi emas.
            </span>
          </span>
        </InfoBox>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Sotuv (fakt)" value={moneyShort(tot.revenue)} tone="brand" />
        <Stat label="Sotuv (reja)" value={moneyShort(tot.plan)} />
        <Stat
          label="Yalpi marja"
          value={tot.revenue > 0 ? pct((tot.gp / tot.revenue) * 100) : '—'}
          tone={tot.revenue > 0 && tot.gp / tot.revenue * 100 >= n('target_gross_margin_pct', 17) ? 'ok' : 'warn'}
          sub={`Maqsad ${pct(n('target_gross_margin_pct', 17))}`}
        />
        <Stat
          label="Sof foyda" value={moneyShort(tot.ebit - tot.tax)}
          tone={tot.ebit - tot.tax >= 0 ? 'ok' : 'danger'}
        />
      </div>

      <Card pad={false}>
        <div className="p-4">
          <CardTitle sub="Barcha raqamlar so'mda, QQSsiz">Foyda va zarar</CardTitle>
          {rows.length === 0 ? (
            <Empty title="Davr yo'q" hint="Reja va byudjet bo'limidan oy qo'shing." />
          ) : (
            <Table minWidth={220 + rows.length * 130 + 140}>
              <thead>
                <tr>
                  <Th w={220}>Ko'rsatkich</Th>
                  {rows.map((r) => <Th key={r.period} w={130} align="right">{monthLabel(r.period)}</Th>)}
                  <Th w={140} align="right">Jami</Th>
                </tr>
              </thead>
              <tbody>
                {LINES.map((l) => (
                  <Tr key={l.label}>
                    <Td className={l.bold ? 'font-semibold' : ''}>
                      <span style={{ color: l.tone }}>{l.label}</span>
                    </Td>
                    {rows.map((r) => {
                      const v = l.get(r)
                      return (
                        <Td key={r.period} align="right" mono className={l.bold ? 'font-semibold' : ''}>
                          <span style={{ color: v < 0 ? 'var(--text-2)' : l.tone }}>
                            {v === 0 ? '—' : money(v, false)}
                          </span>
                        </Td>
                      )
                    })}
                    <Td align="right" mono className={l.bold ? 'font-semibold' : ''}>
                      <span style={{ color: l.tone }}>{l.total === 0 ? '—' : money(l.total, false)}</span>
                    </Td>
                  </Tr>
                ))}
                <Tr>
                  <Td className="font-semibold">Sotuv rejasi</Td>
                  {rows.map((r) => (
                    <Td key={r.period} align="right" mono>
                      <span style={{ color: 'var(--text-3)' }}>
                        {Number(r.sales_plan) > 0 ? money(r.sales_plan, false) : '—'}
                      </span>
                    </Td>
                  ))}
                  <Td align="right" mono>
                    <span style={{ color: 'var(--text-3)' }}>{money(tot.plan, false)}</span>
                  </Td>
                </Tr>
              </tbody>
            </Table>
          )}
        </div>
      </Card>
    </div>
  )
}

/* ================================================================ */
/*  NAQD OQIM                                                        */
/* ================================================================ */

function CashTab() {
  const [rows, setRows] = useState<CashFlowRow[]>([])
  const [balances, setBalances] = useState<{ cash_account_id: number; name: string; balance_base: number }[]>([])
  const [loading, setLoading] = useState(true)
  const { n } = useSettings()

  useEffect(() => {
    let alive = true
    void Promise.all([
      supabase.from('ip_cash_flow_monthly').select('*'),
      supabase.from('ip_cash_balances').select('*'),
    ]).then(([a, b]) => {
      if (!alive) return
      setRows((a.data as CashFlowRow[]) ?? [])
      setBalances((b.data as never) ?? [])
      setLoading(false)
    })
    return () => { alive = false }
  }, [])

  if (loading) return <Loading />
  const total = balances.reduce((a, b) => a + Number(b.balance_base), 0)
  const minSafe = n('min_safe_cash', 0)

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {balances.map((b) => (
          <Stat key={b.cash_account_id} label={b.name} value={moneyShort(b.balance_base)} />
        ))}
        <Stat
          label="Jami" value={moneyShort(total)}
          tone={total < minSafe ? 'danger' : 'ok'}
          sub={total < minSafe ? `Xavfsiz darajadan ${moneyShort(minSafe - total)} past` : undefined}
        />
      </div>

      <Card pad={false}>
        <div className="p-4">
          <CardTitle sub="Foyda ≠ pul. Bu yerda kassada haqiqatda nima bo'lgani ko'rinadi.">
            Oylik naqd oqim
          </CardTitle>
          {rows.length === 0 ? (
            <Empty title="Harakat yo'q" hint="To'lov va harajat kiritilgach shu yerda ko'rinadi." />
          ) : (
            <Table minWidth={760}>
              <thead>
                <tr>
                  <Th w={110}>Oy</Th>
                  <Th w={140} align="right">Kirim</Th>
                  <Th w={140} align="right">Chiqim</Th>
                  <Th w={150} align="right">Operatsion sof</Th>
                  <Th w={150} align="right">Moliyaviy sof</Th>
                  <Th w={150} align="right">Sof oqim</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Tr key={r.period}>
                    <Td mono>{monthLabel(r.period)}</Td>
                    <Td align="right" mono>
                      <span style={{ color: 'var(--ok)' }}>{money(r.inflow_base, false)}</span>
                    </Td>
                    <Td align="right" mono>
                      <span style={{ color: 'var(--danger)' }}>{money(r.outflow_base, false)}</span>
                    </Td>
                    <Td align="right" mono>
                      {money(Number(r.inflow_operating) - Number(r.outflow_operating), false)}
                    </Td>
                    <Td align="right" mono>
                      {money(Number(r.inflow_financing) - Number(r.outflow_financing), false)}
                    </Td>
                    <Td align="right" mono className="font-semibold">
                      <span style={{ color: Number(r.net_flow_base) >= 0 ? 'var(--ok)' : 'var(--danger)' }}>
                        {money(r.net_flow_base, false)}
                      </span>
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
/*  REJA VA BYUDJET                                                  */
/* ================================================================ */

function PlanTab() {
  const [periods, setPeriods] = useState<Period[]>([])
  const [pvf, setPvf] = useState<PlanVsFact[]>([])
  const [budget, setBudget] = useState<BudgetRow[]>([])
  const [month, setMonth] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const [p, f, b] = await Promise.all([
      supabase.from('ip_periods').select('*').order('period_month'),
      supabase.from('ip_plan_vs_fact').select('*').order('period_month'),
      supabase.from('ip_budget_vs_actual').select('*').order('period_month'),
    ])
    const ps = (p.data as Period[]) ?? []
    setPeriods(ps)
    setPvf((f.data as PlanVsFact[]) ?? [])
    setBudget((b.data as BudgetRow[]) ?? [])
    setMonth((m) => m || ps[0]?.period_month || '')
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  async function savePlan(pm: string, value: number) {
    const { error } = await supabase.from('ip_periods')
      .update({ sales_plan: value } as never).eq('period_month', pm)
    if (error) { setErr(translateDbError(error.message)); return }
    setPeriods((ps) => ps.map((p) => p.period_month === pm ? { ...p, sales_plan: value } : p))
  }

  async function saveBudget(pm: string, catId: number, value: number) {
    const { error } = await supabase.from('ip_budget_lines')
      .upsert({ period_month: pm, expense_category_id: catId, amount: value } as never,
        { onConflict: 'period_month,expense_category_id' })
    if (error) { setErr(translateDbError(error.message)); return }
    setBudget((b) => b.map((r) =>
      r.period_month === pm && r.category_id === catId ? { ...r, plan_base: value } : r))
  }

  async function refreshBudget() {
    setRefreshing(true); setErr('')
    const { error } = await supabase.rpc('ip_refresh_budget', { p_month: null })
    setRefreshing(false)
    if (error) { setErr(translateDbError(error.message)); return }
    await load()
  }

  if (loading) return <Loading />

  const monthBudget = budget.filter((b) => b.period_month === month)
  const budgetTotal = monthBudget.reduce((a, b) => a + Number(b.plan_base), 0)
  const monthPvf = pvf.filter((p) => p.period_month === month)

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle sub="Sotuv rejasi — oy bo'yicha. O'zgartirsangiz P&L darhol qayta hisoblanadi.">
          Oylik sotuv rejasi
        </CardTitle>
        {err && <div className="mb-3"><ErrorBox>{err}</ErrorBox></div>}
        <Table minWidth={620}>
          <thead>
            <tr>
              <Th w={130}>Oy</Th>
              <Th w={190} align="right">Reja</Th>
              <Th w={160} align="right">Fakt</Th>
              <Th align="right">Bajarilishi</Th>
            </tr>
          </thead>
          <tbody>
            {periods.map((p) => {
              const fact = pvf.filter((f) => f.period_month === p.period_month)
                .reduce((a, f) => a + Number(f.fact_base), 0)
              const done = Number(p.sales_plan) > 0 ? (fact / Number(p.sales_plan)) * 100 : null
              return (
                <Tr key={p.period_month}>
                  <Td mono>{monthLabel(p.period_month)}</Td>
                  <Td align="right">
                    <Input
                      type="number" className="text-right tnum"
                      value={p.sales_plan}
                      onChange={(v) => savePlan(p.period_month, Number(v) || 0)}
                    />
                  </Td>
                  <Td align="right" mono>{fact > 0 ? money(fact, false) : '—'}</Td>
                  <Td align="right">
                    {done != null ? (
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-24"><Progress value={fact} max={Number(p.sales_plan)} /></div>
                        <span className="tnum w-12 text-right text-[12.5px]">{pct(done)}</span>
                      </div>
                    ) : <span style={{ color: 'var(--text-3)' }}>—</span>}
                  </Td>
                </Tr>
              )
            })}
          </tbody>
        </Table>
      </Card>

      <Card>
        <CardTitle
          sub="Harajat moddalari bo'yicha reja va fakt. Oklad va soliq qatorlari xodimlar ro'yxatidan hisoblanadi."
          right={
            <div className="flex items-center gap-2">
              <Button size="sm" loading={refreshing} onClick={refreshBudget} title="Oklad va soliqni qayta hisoblash">
                <Calculator size={14} />Qayta hisoblash
              </Button>
              <div className="w-[150px]">
                <Select
                  value={month} onChange={setMonth}
                  options={periods.map((p) => ({ value: p.period_month, label: monthLabel(p.period_month) }))}
                />
              </div>
            </div>
          }
        >
          Doimiy harajat byudjeti
        </CardTitle>

        {monthBudget.length === 0 ? (
          <Empty title="Byudjet qatorlari yo'q" hint="Sozlamalar → Spravochniklar → Harajat moddalari dan qo'shing." />
        ) : (
          <>
            <Table minWidth={680}>
              <thead>
                <tr>
                  <Th>Modda</Th>
                  <Th w={110} align="center">Turi</Th>
                  <Th w={180} align="right">Reja</Th>
                  <Th w={150} align="right">Fakt</Th>
                  <Th w={140} align="right">Farq</Th>
                </tr>
              </thead>
              <tbody>
                {monthBudget.map((b) => (
                  <Tr key={b.category_id}>
                    <Td>
                      <div className="font-medium">{b.category_name}</div>
                      {b.formula && (
                        <div className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>
                          avtomatik: {b.formula}
                        </div>
                      )}
                    </Td>
                    <Td align="center">
                      <Badge tone={b.kind === 'fixed' ? 'neutral' : b.kind === 'variable' ? 'info' : 'warn'}>
                        {b.kind === 'fixed' ? 'doimiy' : b.kind === 'variable' ? "o'zgaruvchi" : 'boshqa'}
                      </Badge>
                    </Td>
                    <Td align="right">
                      <Input
                        type="number" className="text-right tnum"
                        value={b.plan_base}
                        onChange={(v) => saveBudget(b.period_month, b.category_id, Number(v) || 0)}
                      />
                    </Td>
                    <Td align="right" mono>
                      {Number(b.actual_base) > 0 ? money(b.actual_base, false) : '—'}
                    </Td>
                    <Td align="right" mono>
                      {Number(b.actual_base) > 0 ? (
                        <span style={{ color: Number(b.diff_base) > 0 ? 'var(--danger)' : 'var(--ok)' }}>
                          {Number(b.diff_base) > 0 ? '+' : ''}{money(b.diff_base, false)}
                        </span>
                      ) : '—'}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <div className="mt-3 flex justify-between border-t pt-3 text-[13.5px] font-semibold">
              <span>Jami doimiy harajat</span>
              <span className="tnum">{money(budgetTotal)}</span>
            </div>
          </>
        )}
      </Card>

      {monthPvf.length > 0 && (
        <Card>
          <CardTitle sub={monthLabel(month)}>Menejerlar bo'yicha reja</CardTitle>
          <Table minWidth={620}>
            <thead>
              <tr>
                <Th>Menejer</Th>
                <Th w={150} align="right">Reja</Th>
                <Th w={150} align="right">Fakt</Th>
                <Th w={110} align="right">Bajarildi</Th>
                <Th w={100} align="right">Marja</Th>
              </tr>
            </thead>
            <tbody>
              {monthPvf.map((f) => (
                <Tr key={f.manager_id}>
                  <Td>{f.full_name}</Td>
                  <Td align="right" mono>{Number(f.plan_base) > 0 ? money(f.plan_base, false) : '—'}</Td>
                  <Td align="right" mono>{Number(f.fact_base) > 0 ? money(f.fact_base, false) : '—'}</Td>
                  <Td align="right" mono>{f.done_pct != null ? pct(f.done_pct) : '—'}</Td>
                  <Td align="right" mono>{f.margin_pct != null ? pct(f.margin_pct) : '—'}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <p className="mt-2 text-[12px]" style={{ color: 'var(--text-3)' }}>
            Menejer rejasini kiritish uchun avval Xodimlar bo'limidan hisob oching.
          </p>
        </Card>
      )}
    </div>
  )
}

/* ================================================================ */
/*  HARAJATLAR                                                       */
/* ================================================================ */

function ExpensesTab() {
  const refs = useRefs()
  const { suppliers } = useSuppliers()
  const [rows, setRows] = useState<(Expense & { category: { name: string } | null })[]>([])
  const [cats, setCats] = useState<{ id: number; name: string; kind: string }[]>([])
  const [from, setFrom] = useState(isoDate(new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1)))
  const [to, setTo] = useState(isoDate())
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [e, c] = await Promise.all([
      supabase.from('ip_expenses').select('*, category:ip_expense_categories(name)')
        .gte('doc_date', from).lte('doc_date', to).order('doc_date', { ascending: false }),
      supabase.from('ip_expense_categories').select('id, name, kind')
        .eq('is_active', true).order('sort_order'),
    ])
    setRows((e.data as never) ?? [])
    setCats((c.data as never) ?? [])
    setLoading(false)
  }, [from, to])

  useEffect(() => { void load() }, [load])
  if (loading || refs.loading) return <Loading />

  const total = rows.reduce((a, r) => a + Number(r.amount_base), 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-[150px]"><Field label="Dan"><Input type="date" value={from} onChange={setFrom} /></Field></div>
        <div className="w-[150px]"><Field label="Gacha"><Input type="date" value={to} onChange={setTo} /></Field></div>
        <Button variant="primary" onClick={() => setOpen(true)}><Plus size={14} />Harajat</Button>
        <Button onClick={() => void load()}><RefreshCw size={14} /></Button>
        <div className="ml-auto text-right">
          <div className="text-[12px]" style={{ color: 'var(--text-3)' }}>Davr bo'yicha jami</div>
          <div className="tnum text-[18px] font-semibold">{money(total)}</div>
        </div>
      </div>

      <Card pad={false}>
        <div className="p-4">
          {rows.length === 0 ? (
            <Empty
              title="Harajat kiritilmagan"
              hint="Ofis ijarasi, kommunal, transport, bank xizmati — haqiqiy to'lovlar shu yerga kiradi va byudjet bilan solishtiriladi."
              action={<Button variant="primary" onClick={() => setOpen(true)}><Plus size={14} />Birinchi harajat</Button>}
            />
          ) : (
            <Table minWidth={720}>
              <thead>
                <tr>
                  <Th w={110}>Sana</Th>
                  <Th w={220}>Modda</Th>
                  <Th>Izoh</Th>
                  <Th w={150} align="right">Summa</Th>
                  <Th w={100} align="center">Holat</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Tr key={r.id}>
                    <Td mono>{dateShort(r.doc_date)}</Td>
                    <Td>{r.category?.name ?? '—'}</Td>
                    <Td><span style={{ color: 'var(--text-2)' }}>{r.description ?? '—'}</span></Td>
                    <Td align="right" mono>{money(r.amount_base, false)}</Td>
                    <Td align="center">
                      <Badge tone={r.is_paid ? 'ok' : 'warn'}>{r.is_paid ? "to'langan" : 'kutilmoqda'}</Badge>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </Card>

      {open && (
        <ExpenseModal
          cats={cats} accounts={refs.accounts} suppliers={suppliers}
          onClose={() => setOpen(false)}
          onDone={() => { setOpen(false); void load() }}
        />
      )}
    </div>
  )
}

function ExpenseModal({
  cats, accounts, suppliers, onClose, onDone,
}: {
  cats: { id: number; name: string; kind: string }[]
  accounts: { id: number; name: string }[]
  suppliers: { id: number; name: string }[]
  onClose: () => void; onDone: () => void
}) {
  const [cat, setCat] = useState<number | null>(null)
  const [amount, setAmount] = useState('')
  const [account, setAccount] = useState<number | null>(accounts[0]?.id ?? null)
  const [date, setDate] = useState(isoDate())
  const [desc, setDesc] = useState('')
  const [supplier, setSupplier] = useState<number | null>(null)
  const [paid, setPaid] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function save() {
    if (!cat) { setErr('Modda tanlanmagan'); return }
    if (!(Number(amount) > 0)) { setErr('Summa kiritilmagan'); return }
    setBusy(true); setErr('')
    const { error } = await supabase.rpc('ip_add_expense', {
      p_category: cat, p_amount: Number(amount),
      p_account: paid ? account : null, p_date: date,
      p_desc: desc.trim() || null, p_supplier: supplier, p_is_paid: paid,
    })
    setBusy(false)
    if (error) { setErr(translateDbError(error.message)); return }
    onDone()
  }

  return (
    <Modal
      open onClose={onClose} width={520} title="Harajat kiritish"
      footer={
        <>
          <Button onClick={onClose}>Bekor</Button>
          <Button variant="primary" loading={busy} onClick={save}><Banknote size={14} />Saqlash</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Harajat moddasi" required>
          <Select
            value={cat ?? ''} onChange={(v) => setCat(v ? Number(v) : null)}
            placeholder="Tanlang…"
            options={cats.map((c) => ({ value: c.id, label: c.name }))}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Summa" required>
            <Input type="number" className="text-right tnum" value={amount} onChange={setAmount} autoFocus />
          </Field>
          <Field label="Sana"><Input type="date" value={date} onChange={setDate} /></Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Qaysi kassadan">
            <Select
              value={account ?? ''} onChange={(v) => setAccount(v ? Number(v) : null)}
              disabled={!paid} options={accounts.map((a) => ({ value: a.id, label: a.name }))}
            />
          </Field>
          <Field label="Postavshik" hint="Ixtiyoriy">
            <Select
              value={supplier ?? ''} onChange={(v) => setSupplier(v ? Number(v) : null)}
              placeholder="—" options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
            />
          </Field>
        </div>
        <Field label="Izoh"><Textarea value={desc} onChange={setDesc} rows={2} /></Field>
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
          To'langan (kassadan chiqdi)
        </label>
        {err && <ErrorBox>{err}</ErrorBox>}
      </div>
    </Modal>
  )
}

/* ================================================================ */
/*  QARZLAR                                                          */
/* ================================================================ */

function LoansTab() {
  const refs = useRefs()
  const [rows, setRows] = useState<Loan[]>([])
  const [loading, setLoading] = useState(true)
  const [payFor, setPayFor] = useState<Loan | null>(null)
  const [showInactive, setShowInactive] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase.from('ip_loans').select('*').order('balance', { ascending: false })
    setRows((data as Loan[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])
  if (loading) return <Loading />

  const list = rows.filter((r) => showInactive || r.is_active)
  const active = rows.filter((r) => r.is_active)
  const totalBal = active.reduce((a, r) => a + Number(r.balance), 0)
  const totalMonthly = active.reduce((a, r) => a + Number(r.monthly_payment), 0)

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Qarz qoldig'i" value={moneyShort(totalBal)} tone={totalBal > 0 ? 'danger' : 'ok'} icon={<Landmark size={16} />} />
        <Stat label="Oylik to'lov" value={moneyShort(totalMonthly)} sub="Rejadagi" />
        <Stat label="Faol qarz" value={active.length} />
      </div>

      <Card pad={false}>
        <div className="p-4">
          <CardTitle
            sub="Postavshik va Discover qarzlari endi kontragent kartochkalarida — bu yerda faqat kredit va shartnomaviy qarzlar"
            right={
              <Button size="sm" onClick={() => setShowInactive((v) => !v)}>
                {showInactive ? 'Faqat faol' : 'Hammasi'}
              </Button>
            }
          >
            Qarzlar
          </CardTitle>

          {list.length === 0 ? (
            <Empty title="Faol qarz yo'q" />
          ) : (
            <Table minWidth={800}>
              <thead>
                <tr>
                  <Th>Nomi</Th>
                  <Th w={150} align="right">Asosiy</Th>
                  <Th w={150} align="right">Qoldiq</Th>
                  <Th w={140} align="right">Oylik</Th>
                  <Th w={100} align="center">Holat</Th>
                  <Th w={110} align="right">Amal</Th>
                </tr>
              </thead>
              <tbody>
                {list.map((l) => (
                  <Tr key={l.id}>
                    <Td>
                      <div className="font-medium">{l.name}</div>
                      {l.note && (
                        <div className="line-clamp-2 text-[11.5px]" style={{ color: 'var(--text-3)' }}>
                          {l.note}
                        </div>
                      )}
                    </Td>
                    <Td align="right" mono>{money(l.principal, false)}</Td>
                    <Td align="right" mono className="font-semibold">{money(l.balance, false)}</Td>
                    <Td align="right" mono>{money(l.monthly_payment, false)}</Td>
                    <Td align="center">
                      <Badge tone={l.is_active ? 'warn' : 'neutral'}>
                        {l.is_active ? 'faol' : 'yopilgan'}
                      </Badge>
                    </Td>
                    <Td align="right">
                      {l.is_active && Number(l.balance) > 0 && (
                        <Button size="sm" onClick={() => setPayFor(l)}><Banknote size={14} /></Button>
                      )}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </Card>

      {payFor && (
        <LoanPayModal
          loan={payFor} accounts={refs.accounts}
          onClose={() => setPayFor(null)}
          onDone={() => { setPayFor(null); void load() }}
        />
      )}
    </div>
  )
}

function LoanPayModal({
  loan, accounts, onClose, onDone,
}: {
  loan: Loan; accounts: { id: number; name: string }[]
  onClose: () => void; onDone: () => void
}) {
  const [amount, setAmount] = useState(String(loan.monthly_payment || ''))
  const [account, setAccount] = useState<number | null>(accounts[0]?.id ?? null)
  const [date, setDate] = useState(isoDate())
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function save() {
    if (!account) { setErr('Kassa tanlanmagan'); return }
    setBusy(true); setErr('')
    const { error } = await supabase.rpc('ip_pay_loan', {
      p_loan: loan.id, p_amount: Number(amount), p_account: account,
      p_date: date, p_note: note.trim() || null,
    })
    setBusy(false)
    if (error) { setErr(translateDbError(error.message)); return }
    onDone()
  }

  return (
    <Modal
      open onClose={onClose} width={460}
      title={<span>Qarz to'lovi — <span style={{ color: 'var(--text-2)' }}>{loan.name}</span></span>}
      footer={
        <>
          <Button onClick={onClose}>Bekor</Button>
          <Button variant="primary" loading={busy} onClick={save}>To'lash</Button>
        </>
      }
    >
      <div className="space-y-3">
        <InfoBox>Qoldiq: <b>{money(loan.balance)}</b></InfoBox>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Summa" required>
            <Input type="number" className="text-right tnum" value={amount} onChange={setAmount} autoFocus />
          </Field>
          <Field label="Sana"><Input type="date" value={date} onChange={setDate} /></Field>
        </div>
        <Field label="Qaysi kassadan" required>
          <Select
            value={account ?? ''} onChange={(v) => setAccount(v ? Number(v) : null)}
            options={accounts.map((a) => ({ value: a.id, label: a.name }))}
          />
        </Field>
        <Field label="Izoh"><Textarea value={note} onChange={setNote} rows={2} /></Field>
        {err && <ErrorBox>{err}</ErrorBox>}
      </div>
    </Modal>
  )
}
