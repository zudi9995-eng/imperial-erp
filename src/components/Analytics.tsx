import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp, Award, Package, Users, Lightbulb, Moon, ArrowRight, Percent,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type {
  CrossSellRow, ManagerKpi, StockSignal, TopCustomer, TopProduct,
} from '../lib/types'
import {
  Badge, Button, Card, CardTitle, Empty, Loading, Table, Td, Th, Tr,
} from './ui'
import { dateShort, money, moneyShort, num, pct } from '../lib/format'

interface Sleeping {
  customer_id: number
  name: string
  phone: string | null
  days_since_sale: number
  revenue_base: number | null
}

/** Kunlik paneldagi analitika bloki */
export default function Analytics() {
  const { isOwner } = useAuth()
  const [products, setProducts] = useState<TopProduct[]>([])
  const [customers, setCustomers] = useState<TopCustomer[]>([])
  const [managers, setManagers] = useState<ManagerKpi[]>([])
  const [cross, setCross] = useState<CrossSellRow[]>([])
  const [sleeping, setSleeping] = useState<Sleeping[]>([])
  const [low, setLow] = useState<StockSignal[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [p, c, m, x, s, l] = await Promise.all([
      supabase.from('ip_top_products').select('*')
        .order('gross_profit_base', { ascending: false }).limit(8),
      supabase.from('ip_top_customers').select('*')
        .order('gross_profit_base', { ascending: false }).limit(8),
      isOwner
        ? supabase.from('ip_manager_kpi').select('*')
            .not('period_month', 'is', null)
            .order('gross_profit_base', { ascending: false }).limit(6)
        : Promise.resolve({ data: [] }),
      supabase.from('ip_cross_sell').select('*')
        .order('other_buyers', { ascending: false }).limit(10),
      supabase.from('ip_sleeping_customers').select('*')
        .order('days_since_sale', { ascending: false }).limit(6),
      supabase.from(isOwner ? 'ip_stock_signals' : 'ip_stock_signals_lite').select('*')
        .in('signal', ['TUGAGAN', 'BUYURTMA']).limit(8),
    ])
    setProducts((p.data as TopProduct[]) ?? [])
    setCustomers((c.data as TopCustomer[]) ?? [])
    setManagers((m.data as ManagerKpi[]) ?? [])
    setCross((x.data as CrossSellRow[]) ?? [])
    setSleeping((s.data as Sleeping[]) ?? [])
    setLow((l.data as StockSignal[]) ?? [])
    setLoading(false)
  }, [isOwner])

  useEffect(() => { void load() }, [load])
  if (loading) return <Loading />

  const hasSales = products.length > 0

  if (!hasSales) {
    return (
      <Card>
        <CardTitle sub="Sotuv kiritilgach shu yerda eng yaxshi tovar, mijoz, marja va menejer ko'rinadi">
          Analitika
        </CardTitle>
        <Empty
          title="Hali sotuv yo'q"
          hint="Birinchi sotuv hujjati kiritilgandan keyin reytinglar va kross-sotuv tavsiyalari avtomatik hisoblanadi."
          icon={<TrendingUp size={22} />}
        />
      </Card>
    )
  }

  const bestMargin = [...products].filter((p) => p.margin_pct != null)
    .sort((a, b) => Number(b.margin_pct) - Number(a.margin_pct))[0]
  const mostSold = [...products].sort((a, b) => Number(b.qty_sold) - Number(a.qty_sold))[0]
  const bestCustomer = customers[0]
  const bestManager = managers[0]

  return (
    <div className="space-y-4">
      {/* Yulduzlar */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Highlight
          icon={<Package size={15} />} tone="brand"
          label="Eng ko'p sotilgan"
          value={mostSold?.name ?? '—'}
          sub={mostSold ? `${num(mostSold.qty_sold, 0)} ${mostSold.unit_code ?? ''} · ${moneyShort(mostSold.revenue_base)}` : undefined}
        />
        <Highlight
          icon={<Percent size={15} />} tone="ok"
          label="Eng yaxshi marja"
          value={bestMargin?.name ?? '—'}
          sub={bestMargin ? `${pct(bestMargin.margin_pct)} · foyda ${moneyShort(bestMargin.gross_profit_base)}` : undefined}
        />
        <Highlight
          icon={<Users size={15} />} tone="info"
          label="Eng yaxshi mijoz"
          value={bestCustomer?.name ?? '—'}
          sub={bestCustomer ? `Foyda ${moneyShort(bestCustomer.gross_profit_base)} · marja ${pct(bestCustomer.margin_pct)}` : undefined}
        />
        {isOwner && (
          <Highlight
            icon={<Award size={15} />} tone="warn"
            label="Eng yaxshi menejer"
            value={bestManager?.full_name ?? '—'}
            sub={bestManager ? `Foyda ${moneyShort(bestManager.gross_profit_base)} · undirish ${pct(bestManager.collection_pct)}` : undefined}
          />
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Tovarlar */}
        <Card pad={false}>
          <div className="p-4">
            <CardTitle
              sub="Yalpi foyda bo'yicha"
              right={<Link to="/products"><Button size="sm" variant="ghost">Hammasi <ArrowRight size={13} /></Button></Link>}
            >
              Tovarlar reytingi
            </CardTitle>
            <Table minWidth={520}>
              <thead>
                <tr>
                  <Th>Tovar</Th>
                  <Th w={90} align="right">Sotildi</Th>
                  {isOwner && <Th w={120} align="right">Foyda</Th>}
                  <Th w={80} align="right">Marja</Th>
                  <Th w={90} align="right">Qoldiq</Th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <Tr key={p.product_id}>
                    <Td>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>
                        {p.customer_count} mijoz
                      </div>
                    </Td>
                    <Td align="right" mono>{num(p.qty_sold, 1)}</Td>
                    {isOwner && <Td align="right" mono>{moneyShort(p.gross_profit_base)}</Td>}
                    <Td align="right" mono>
                      {p.margin_pct != null ? (
                        <span style={{ color: Number(p.margin_pct) >= 15 ? 'var(--ok)' : 'var(--warn)' }}>
                          {pct(p.margin_pct)}
                        </span>
                      ) : '—'}
                    </Td>
                    <Td align="right" mono>
                      <span style={{ color: Number(p.stock_qty) <= 0 ? 'var(--danger)' : undefined }}>
                        {num(p.stock_qty, 1)}
                      </span>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>

        {/* Mijozlar */}
        <Card pad={false}>
          <div className="p-4">
            <CardTitle
              sub="Aylanma emas, keltirgan foyda bo'yicha"
              right={<Link to="/customers"><Button size="sm" variant="ghost">Hammasi <ArrowRight size={13} /></Button></Link>}
            >
              Mijozlar reytingi
            </CardTitle>
            <Table minWidth={520}>
              <thead>
                <tr>
                  <Th>Mijoz</Th>
                  <Th w={110} align="right">Sotuv</Th>
                  {isOwner && <Th w={110} align="right">Foyda</Th>}
                  <Th w={80} align="right">Marja</Th>
                  <Th w={90} align="right">Undirish</Th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <Tr key={c.customer_id}>
                    <Td>
                      <div className="font-medium">{c.name}</div>
                      <div className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>
                        {c.sale_count} hujjat · o'rtacha {moneyShort(c.avg_check_base)}
                      </div>
                    </Td>
                    <Td align="right" mono>{moneyShort(c.revenue_base)}</Td>
                    {isOwner && <Td align="right" mono>{moneyShort(c.gross_profit_base)}</Td>}
                    <Td align="right" mono>
                      {c.margin_pct != null ? pct(c.margin_pct) : '—'}
                    </Td>
                    <Td align="right" mono>
                      {c.collection_pct != null ? (
                        <span style={{ color: Number(c.collection_pct) >= 90 ? 'var(--ok)' : 'var(--warn)' }}>
                          {pct(c.collection_pct)}
                        </span>
                      ) : '—'}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Kross-sotuv */}
        {cross.length > 0 && (
          <Card pad={false}>
            <div className="p-4">
              <CardTitle sub="Shu kategoriyadan xarid qiladigan boshqa mijozlar olgan, lekin bu mijoz hali olmagan tovarlar">
                <span className="inline-flex items-center gap-1.5">
                  <Lightbulb size={15} style={{ color: 'var(--warn)' }} />
                  Kimga nima sotsa bo'ladi
                </span>
              </CardTitle>
              <Table minWidth={520}>
                <thead>
                  <tr>
                    <Th>Mijoz</Th>
                    <Th>Taklif qilinadigan tovar</Th>
                    <Th w={90} align="right">Kim olgan</Th>
                    <Th w={90} align="right">Qoldiq</Th>
                  </tr>
                </thead>
                <tbody>
                  {cross.map((r) => (
                    <Tr key={`${r.customer_id}-${r.product_id}`}>
                      <Td><span className="font-medium">{r.customer_name}</span></Td>
                      <Td>
                        <div>{r.product_name}</div>
                        {r.margin_pct != null && (
                          <div className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>
                            marja {pct(r.margin_pct)}
                          </div>
                        )}
                      </Td>
                      <Td align="right" mono>
                        <Badge tone="info">{r.other_buyers} mijoz</Badge>
                      </Td>
                      <Td align="right" mono>{num(r.stock_qty, 1)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card>
        )}

        <div className="space-y-4">
          {/* Uxlab qolganlar */}
          {sleeping.length > 0 && (
            <Card pad={false}>
              <div className="p-4">
                <CardTitle sub="60 kundan beri xarid qilmagan">
                  <span className="inline-flex items-center gap-1.5">
                    <Moon size={15} style={{ color: 'var(--warn)' }} />
                    Uxlab qolgan mijozlar
                  </span>
                </CardTitle>
                <Table minWidth={420}>
                  <thead>
                    <tr>
                      <Th>Mijoz</Th>
                      <Th w={110} align="right">Oxirgi sotuv</Th>
                      <Th w={100} align="right">Jami sotuv</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {sleeping.map((s) => (
                      <Tr key={s.customer_id}>
                        <Td>
                          <div className="font-medium">{s.name}</div>
                          <div className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>
                            {s.phone ?? "telefon yo'q"}
                          </div>
                        </Td>
                        <Td align="right">
                          <Badge tone={s.days_since_sale > 120 ? 'danger' : 'warn'}>
                            {s.days_since_sale} kun
                          </Badge>
                        </Td>
                        <Td align="right" mono>
                          {s.revenue_base != null ? moneyShort(s.revenue_base) : '—'}
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </Card>
          )}

          {/* Kam qolgan tovar */}
          {low.length > 0 && (
            <Card pad={false}>
              <div className="p-4">
                <CardTitle
                  sub="Zaxira sozlamadagi normadan kam"
                  right={<Link to="/stock"><Button size="sm" variant="ghost">Ombor <ArrowRight size={13} /></Button></Link>}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Package size={15} style={{ color: 'var(--danger)' }} />
                    Kam qolgan tovar
                  </span>
                </CardTitle>
                <Table minWidth={420}>
                  <thead>
                    <tr>
                      <Th>Tovar</Th>
                      <Th w={110} align="right">Qoldiq</Th>
                      <Th w={100} align="center">Signal</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {low.map((r) => (
                      <Tr key={r.product_id}>
                        <Td>{r.name}</Td>
                        <Td align="right" mono>{num(r.qty, 1)} {r.unit_code}</Td>
                        <Td align="center">
                          <Badge tone={r.signal === 'TUGAGAN' ? 'danger' : 'warn'}>
                            {r.signal === 'TUGAGAN' ? 'tugagan'
                              : r.cover_days != null ? `${num(r.cover_days, 0)} kun` : 'buyurtma'}
                          </Badge>
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Menejerlar */}
      {isOwner && managers.length > 0 && (
        <Card pad={false}>
          <div className="p-4">
            <CardTitle
              sub="Foyda va undirish bo'yicha"
              right={<Link to="/hr"><Button size="sm" variant="ghost">Batafsil <ArrowRight size={13} /></Button></Link>}
            >
              Menejerlar
            </CardTitle>
            <Table minWidth={680}>
              <thead>
                <tr>
                  <Th w={40}>#</Th>
                  <Th>Menejer</Th>
                  <Th w={100}>Oy</Th>
                  <Th w={130} align="right">Sotuv</Th>
                  <Th w={130} align="right">Foyda</Th>
                  <Th w={90} align="right">Marja</Th>
                  <Th w={100} align="right">Undirish</Th>
                </tr>
              </thead>
              <tbody>
                {managers.map((m, i) => (
                  <Tr key={`${m.manager_id}-${m.period_month}`}>
                    <Td mono><span style={{ color: 'var(--text-3)' }}>{i + 1}</span></Td>
                    <Td><span className="font-medium">{m.full_name}</span></Td>
                    <Td mono>{m.period_month ? dateShort(m.period_month).slice(3) : '—'}</Td>
                    <Td align="right" mono>{money(m.revenue_base, false)}</Td>
                    <Td align="right" mono>{money(m.gross_profit_base, false)}</Td>
                    <Td align="right" mono>{m.margin_pct != null ? pct(m.margin_pct) : '—'}</Td>
                    <Td align="right" mono>{m.collection_pct != null ? pct(m.collection_pct) : '—'}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  )
}

function Highlight({
  icon, label, value, sub, tone,
}: {
  icon: React.ReactNode; label: string; value: string
  sub?: string; tone: 'brand' | 'ok' | 'info' | 'warn'
}) {
  const color = `var(--${tone === 'brand' ? 'brand' : tone})`
  return (
    <div
      className="rounded-[10px] border p-3.5"
      style={{ background: 'var(--surface)', boxShadow: 'var(--shadow-sm)' }}
    >
      <div className="flex items-center gap-1.5">
        <span style={{ color }}>{icon}</span>
        <span className="text-[12px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>
          {label}
        </span>
      </div>
      <div className="mt-1.5 line-clamp-2 text-[14.5px] font-semibold leading-tight">{value}</div>
      {sub && <div className="mt-1 text-[12px]" style={{ color: 'var(--text-3)' }}>{sub}</div>}
    </div>
  )
}
