import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Wallet, AlertTriangle, PhoneCall, Package, TrendingUp, ShieldCheck,
  CalendarDays, Snowflake, ArrowRight, RefreshCw, Sparkles,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useSettings } from '../lib/settings'
import type { AiInsight, ArAging, DailySnapshot, StockSignal } from '../lib/types'
import {
  Badge, Button, Card, CardTitle, Empty, ErrorBox, Loading, PageHeader,
  Progress, Stat, Table, Td, Th, Tr,
} from '../components/ui'
import { dateUz, money, moneyShort, num, pct } from '../lib/format'
import Analytics from '../components/Analytics'

interface MyMonth { revenue: number; plan: number; margin: number | null; overdue: number }

export default function Dashboard() {
  const { profile, isOwner } = useAuth()
  const { n } = useSettings()
  const [snap, setSnap] = useState<DailySnapshot | null>(null)
  const [calls, setCalls] = useState<ArAging[]>([])
  const [reorder, setReorder] = useState<StockSignal[]>([])
  const [insights, setInsights] = useState<AiInsight[]>([])
  const [mine, setMine] = useState<MyMonth | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setErr('')
    const tasks: PromiseLike<unknown>[] = []

    if (isOwner) {
      tasks.push(
        supabase.from('ip_daily_snapshot').select('*').maybeSingle()
          .then(({ data, error }) => { if (error) throw error; setSnap(data as DailySnapshot | null) }),
      )
    }

    tasks.push(
      supabase.from('ip_ar_aging').select('*')
        .eq('priority', 1).order('outstanding_base', { ascending: false }).limit(8)
        .then(({ data }) => setCalls((data as ArAging[]) ?? [])),
    )

    tasks.push(
      supabase.from(isOwner ? 'ip_stock_signals' : 'ip_stock_signals_lite').select('*')
        .in('signal', ['BUYURTMA', 'TUGAGAN']).order('cover_days', { nullsFirst: true }).limit(8)
        .then(({ data }) => setReorder((data as StockSignal[]) ?? [])),
    )

    tasks.push(
      supabase.from('ip_ai_insights').select('*')
        .eq('status', 'open').order('severity').order('created_at', { ascending: false }).limit(5)
        .then(({ data }) => setInsights((data as AiInsight[]) ?? [])),
    )

    // Menejer uchun o'z oyi
    if (profile) {
      const from = new Date(); from.setDate(1)
      const fromIso = from.toISOString().slice(0, 10)
      tasks.push(
        Promise.all([
          supabase.from('ip_sales')
            .select('total_base, gross_profit_base, paid_base, due_date')
            .eq('status', 'posted').gte('doc_date', fromIso)
            .eq(isOwner ? 'status' : 'manager_id', isOwner ? 'posted' : profile.id),
          supabase.from('ip_sales_plans')
            .select('amount').eq('period_month', fromIso)
            .eq('manager_id', profile.id).maybeSingle(),
          supabase.from('ip_periods')
            .select('sales_plan').eq('period_month', fromIso).maybeSingle(),
        ]).then(([s, mp, pp]) => {
          const rows = (s.data ?? []) as { total_base: number; gross_profit_base: number; paid_base: number; due_date: string | null }[]
          const revenue = rows.reduce((a, r) => a + Number(r.total_base), 0)
          const gp = rows.reduce((a, r) => a + Number(r.gross_profit_base), 0)
          const today = new Date().toISOString().slice(0, 10)
          const overdue = rows
            .filter((r) => r.due_date && r.due_date < today)
            .reduce((a, r) => a + (Number(r.total_base) - Number(r.paid_base)), 0)
          const plan = Number(
            (mp.data as { amount: number } | null)?.amount
            ?? (isOwner ? (pp.data as { sales_plan: number } | null)?.sales_plan : 0)
            ?? 0,
          )
          setMine({ revenue, plan, margin: revenue > 0 ? (gp / revenue) * 100 : null, overdue })
        }),
      )
    }

    try { await Promise.all(tasks) } catch (e) {
      setErr(e instanceof Error ? e.message : 'Yuklashda xato')
    }
    setLoading(false)
  }, [isOwner, profile])

  useEffect(() => { void load() }, [load])

  if (loading) return <Loading />

  const minSafe = snap?.min_safe_cash ?? n('min_safe_cash', 0)
  const cashTone = !snap ? 'neutral'
    : snap.cash_base < 0 ? 'danger'
    : snap.cash_base < minSafe ? 'warn' : 'ok'

  const planPct = mine && mine.plan > 0 ? (mine.revenue / mine.plan) * 100 : null

  return (
    <div>
      <PageHeader
        title={`Salom, ${profile?.full_name.split(' ')[0]}`}
        sub={`${dateUz(new Date())} · ${isOwner ? "kompaniya ko'rinishi" : 'sizning ko\'rsatkichlaringiz'}`}
        actions={<Button size="sm" onClick={() => void load()}><RefreshCw size={14} />Yangilash</Button>}
      />

      {err && <div className="mb-4"><ErrorBox>{err}</ErrorBox></div>}

      {/* ---------------- Ta'sischi: kompaniya holati ---------------- */}
      {isOwner && snap && (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="Kassa" value={moneyShort(snap.cash_base)} tone={cashTone}
              icon={<Wallet size={16} />}
              sub={
                snap.cash_base < minSafe
                  ? `Xavfsiz darajadan ${moneyShort(minSafe - snap.cash_base)} kam`
                  : `Xavfsiz darajadan ${moneyShort(snap.cash_base - minSafe)} yuqori`
              }
            />
            <Stat
              label="Muddati o'tgan qarz" value={moneyShort(snap.overdue_base)}
              tone={snap.overdue_base > 0 ? 'danger' : 'ok'}
              icon={<AlertTriangle size={16} />}
              sub={`${snap.call_count} mijoz · bugun ${moneyShort(snap.call_amount_base)}`}
            />
            <Stat
              label="Bu oy sotuv" value={moneyShort(snap.month_sales_base)}
              tone="brand" icon={<TrendingUp size={16} />}
              sub={
                snap.month_plan_base > 0
                  ? `Reja ${moneyShort(snap.month_plan_base)} · ${pct((snap.month_sales_base / snap.month_plan_base) * 100)}`
                  : 'Reja kiritilmagan'
              }
            />
            <Stat
              label="Ombor" value={moneyShort(snap.stock_value_base)}
              tone={snap.reorder_count > 0 ? 'warn' : 'neutral'}
              icon={<Package size={16} />}
              sub={`${snap.reorder_count} ta buyurtma · ${moneyShort(snap.frozen_stock_base)} muzlagan`}
            />
          </div>

          {snap.month_plan_base > 0 && (
            <Card className="mb-4">
              <div className="mb-2 flex items-end justify-between gap-3">
                <div>
                  <div className="text-[13px] font-medium">Oylik reja bajarilishi</div>
                  <div className="text-[12px]" style={{ color: 'var(--text-3)' }}>
                    {money(snap.month_sales_base)} / {money(snap.month_plan_base)}
                  </div>
                </div>
                <div className="tnum text-[20px] font-semibold">
                  {pct((snap.month_sales_base / snap.month_plan_base) * 100)}
                </div>
              </div>
              <Progress
                value={snap.month_sales_base} max={snap.month_plan_base}
                tone={snap.month_sales_base >= snap.month_plan_base ? 'ok' : 'brand'}
                height={8}
              />
            </Card>
          )}

          {(snap.pending_approvals > 0 || snap.today_meetings > 0) && (
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              {snap.pending_approvals > 0 && (
                <Link to="/approvals">
                  <Stat
                    label="Tasdiq kutmoqda" value={snap.pending_approvals}
                    tone="warn" icon={<ShieldCheck size={16} />}
                    sub="Sotuv tasdiqlanmaguncha omborga tegmaydi"
                  />
                </Link>
              )}
              {snap.today_meetings > 0 && (
                <Link to="/meetings">
                  <Stat
                    label="Bugungi uchrashuv" value={snap.today_meetings}
                    tone="info" icon={<CalendarDays size={16} />}
                  />
                </Link>
              )}
            </div>
          )}
        </>
      )}

      {/* ---------------- Menejer: o'z natijasi ---------------- */}
      {!isOwner && mine && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Bu oy sotuvim" value={moneyShort(mine.revenue)} tone="brand" icon={<TrendingUp size={16} />} />
          <Stat
            label="Reja" value={mine.plan > 0 ? moneyShort(mine.plan) : '—'}
            sub={planPct != null ? `Bajarildi ${pct(planPct)}` : 'Reja kiritilmagan'}
            tone={planPct != null && planPct >= 100 ? 'ok' : 'neutral'}
          />
          <Stat
            label="O'rtacha marja" value={mine.margin != null ? pct(mine.margin) : '—'}
            tone={mine.margin == null ? 'neutral' : mine.margin >= n('target_gross_margin_pct', 17) ? 'ok' : 'warn'}
            sub={`Maqsad ${pct(n('target_gross_margin_pct', 17))}`}
          />
          <Stat
            label="Mijozlarim qarzi" value={moneyShort(mine.overdue)}
            tone={mine.overdue > 0 ? 'danger' : 'ok'}
            icon={<AlertTriangle size={16} />}
            sub="Muddati o'tgan"
          />
        </div>
      )}

      {mine && mine.plan > 0 && !isOwner && (
        <Card className="mb-4">
          <div className="mb-2 flex items-end justify-between gap-3">
            <div className="text-[13px] font-medium">Oylik rejam</div>
            <div className="tnum text-[18px] font-semibold">{pct(planPct ?? 0)}</div>
          </div>
          <Progress value={mine.revenue} max={mine.plan} tone={mine.revenue >= mine.plan ? 'ok' : 'brand'} height={8} />
          <div className="mt-1.5 text-[12px]" style={{ color: 'var(--text-3)' }}>
            Qolgan summa: {money(Math.max(0, mine.plan - mine.revenue))}
          </div>
        </Card>
      )}

      {/* ---------------- AI tavsiyalari ---------------- */}
      {insights.length > 0 && (
        <Card className="mb-4">
          <CardTitle
            sub="AI bazani o'qib topgan narsalar. Qarorni siz qabul qilasiz."
            right={<Link to="/ai"><Button size="sm" variant="ghost">Hammasi <ArrowRight size={14} /></Button></Link>}
          >
            <span className="inline-flex items-center gap-1.5">
              <Sparkles size={15} style={{ color: 'var(--brand)' }} />AI tavsiyalari
            </span>
          </CardTitle>
          <div className="space-y-2">
            {insights.map((i) => (
              <div
                key={i.id}
                className="rounded-lg border px-3 py-2.5"
                style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
              >
                <div className="flex items-start gap-2">
                  <Badge tone={i.severity === 'high' ? 'danger' : i.severity === 'medium' ? 'warn' : 'info'}>
                    {i.severity === 'high' ? 'muhim' : i.severity === 'medium' ? "o'rta" : 'past'}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-medium">{i.title}</div>
                    {i.body && <p className="mt-0.5 text-[12.5px]" style={{ color: 'var(--text-2)' }}>{i.body}</p>}
                    {i.suggested_action && (
                      <p className="mt-1 text-[12.5px] font-medium" style={{ color: 'var(--brand)' }}>
                        → {i.suggested_action}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ---------------- Keyingi qadam: qo'ng'iroq + buyurtma ---------------- */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardTitle
            sub="Muddati o'tgan yoki 3 kun ichida to'lanishi kerak"
            right={<Link to="/receivables"><Button size="sm" variant="ghost">Hammasi <ArrowRight size={14} /></Button></Link>}
          >
            <span className="inline-flex items-center gap-1.5">
              <PhoneCall size={15} style={{ color: 'var(--danger)' }} />Bugun qo'ng'iroq qilinadi
            </span>
          </CardTitle>

          {calls.length === 0 ? (
            <Empty title="Qo'ng'iroq navbati bo'sh" hint="Muddati o'tgan qarz yo'q — yaxshi holat." />
          ) : (
            <Table minWidth={460}>
              <thead>
                <tr>
                  <Th>Mijoz</Th>
                  <Th align="right">Qarz</Th>
                  <Th align="right">Kechikish</Th>
                </tr>
              </thead>
              <tbody>
                {calls.map((c) => (
                  <Tr key={c.sale_id}>
                    <Td>
                      <div className="font-medium">{c.customer_name}</div>
                      <div className="text-[12px]" style={{ color: 'var(--text-3)' }}>
                        {c.doc_no ? `${c.doc_no} · ` : ''}{c.phone ?? 'telefon yo\'q'}
                      </div>
                    </Td>
                    <Td align="right" mono>{moneyShort(c.outstanding_base)}</Td>
                    <Td align="right">
                      <Badge tone={c.overdue_days > 30 ? 'danger' : c.overdue_days > 0 ? 'warn' : 'info'}>
                        {c.overdue_days > 0 ? `${c.overdue_days} kun` : c.bucket}
                      </Badge>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardTitle
            sub="Zaxira sozlamada belgilangan kundan kam qolgan"
            right={<Link to="/stock"><Button size="sm" variant="ghost">Hammasi <ArrowRight size={14} /></Button></Link>}
          >
            <span className="inline-flex items-center gap-1.5">
              <Package size={15} style={{ color: 'var(--warn)' }} />Buyurtma berish kerak
            </span>
          </CardTitle>

          {reorder.length === 0 ? (
            <Empty title="Hamma tovar yetarli" hint="Zaxira belgilangan normadan yuqori." icon={<Snowflake size={20} />} />
          ) : (
            <Table minWidth={460}>
              <thead>
                <tr>
                  <Th>Tovar</Th>
                  <Th align="right">Qoldiq</Th>
                  <Th align="right">Zaxira</Th>
                </tr>
              </thead>
              <tbody>
                {reorder.map((r) => (
                  <Tr key={r.product_id}>
                    <Td>
                      <div className="font-medium">{r.name}</div>
                      <div className="text-[12px]" style={{ color: 'var(--text-3)' }}>
                        {r.category_name ?? '—'}
                      </div>
                    </Td>
                    <Td align="right" mono>{num(r.qty, 2)} {r.unit_code}</Td>
                    <Td align="right">
                      <Badge tone={r.signal === 'TUGAGAN' ? 'danger' : 'warn'}>
                        {r.signal === 'TUGAGAN' ? 'tugagan' : `${num(r.cover_days ?? 0, 0)} kun`}
                      </Badge>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <Analytics />
      </div>

      <p className="mt-4 text-[12px]" style={{ color: 'var(--text-3)' }}>
        Prioritet tartibi: kassa → debitor → sotuv → ombor (tugash) → ombor (muzlash) → o'sish.
      </p>
    </div>
  )
}
