import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Empty, Loading } from './ui'
import { DocTable, DocTd, DocTh, DocTr } from './docList'
import { dateShort, money, num } from '../lib/format'

/**
 * Mijoz bo'yicha qisqacha hisobot — 1C dagi «Отчеты» tugmasiga mos.
 * Hujjatdan chiqmasdan: qarz, oxirgi sotuvlar, eng ko'p olgan tovarlari.
 */

interface Bal {
  debt_base: number
  overdue_base: number
  max_overdue_days: number
  sales_base: number
  paid_base: number
}

interface RecentSale {
  id: number
  doc_no: string | null
  doc_date: string
  net_base: number
  due_base: number
  status: string
}

interface TopProduct {
  product_id: number
  name: string
  qty: number
  amount: number
}

export default function CustomerSnapshot({
  customerId, customerName, onOpenSale,
}: {
  customerId: number | null
  customerName: string
  onOpenSale: (id: number) => void
}) {
  const [bal, setBal] = useState<Bal | null>(null)
  const [sales, setSales] = useState<RecentSale[]>([])
  const [top, setTop] = useState<TopProduct[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!customerId) { setLoading(false); return }
    let alive = true
    setLoading(true)

    void (async () => {
      const [b, s] = await Promise.all([
        supabase.from('ip_customer_balance')
          .select('debt_base, overdue_base, max_overdue_days, sales_base, paid_base')
          .eq('customer_id', customerId).maybeSingle(),
        supabase.from('ip_sales_board')
          .select('id, doc_no, doc_date, net_base, due_base, status')
          .eq('customer_id', customerId)
          .order('doc_date', { ascending: false }).limit(10),
      ])
      if (!alive) return
      setBal((b.data as Bal | null) ?? null)
      const recent = (s.data as RecentSale[]) ?? []
      setSales(recent)

      // Eng ko'p olingan tovarlar — oxirgi sotuvlar bo'yicha
      const ids = recent.map((x) => x.id)
      if (ids.length) {
        const { data } = await supabase.from('ip_sale_items')
          .select('product_id, qty, line_total, product:ip_products(name)')
          .in('sale_id', ids)
        if (!alive) return
        const agg = new Map<number, TopProduct>()
        for (const r of (data ?? []) as unknown as {
          product_id: number; qty: number; line_total: number
          product?: { name: string } | null
        }[]) {
          const cur = agg.get(r.product_id)
            ?? { product_id: r.product_id, name: r.product?.name ?? `#${r.product_id}`,
                 qty: 0, amount: 0 }
          cur.qty += Number(r.qty)
          cur.amount += Number(r.line_total)
          agg.set(r.product_id, cur)
        }
        setTop([...agg.values()].sort((a, b2) => b2.amount - a.amount).slice(0, 8))
      } else {
        setTop([])
      }
      setLoading(false)
    })()

    return () => { alive = false }
  }, [customerId])

  if (!customerId) {
    return <Empty title="Xaridor tanlanmagan" hint="Avval xaridorni tanlang." />
  }
  if (loading) return <Loading />

  const debt = Number(bal?.debt_base ?? 0)

  return (
    <div className="space-y-5 pt-1">
      <div>
        <h3 className="mb-2 text-[13px] font-semibold">{customerName} — hisob-kitob</h3>
        <div className="flex flex-wrap gap-x-8 gap-y-2">
          <Fig label="Jami sotilgan" value={money(bal?.sales_base ?? 0)} />
          <Fig label="To'langan" value={money(bal?.paid_base ?? 0)} />
          <Fig
            label={debt >= 0 ? 'Bizga qarzi' : 'Biz qarzdormiz'}
            value={money(Math.abs(debt))}
            tone={debt > 0 ? 'danger' : 'ok'}
          />
          {Number(bal?.overdue_base ?? 0) > 0 && (
            <Fig
              label={`Muddati o'tgan (${bal?.max_overdue_days} kun)`}
              value={money(bal?.overdue_base ?? 0)}
              tone="danger"
            />
          )}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-[13px] font-semibold">Oxirgi sotuvlar</h3>
        {sales.length === 0 ? (
          <p className="text-[13px]" style={{ color: 'var(--text-3)' }}>
            Bu mijozga hali sotuv bo'lmagan.
          </p>
        ) : (
          <DocTable minWidth={520}>
            <thead>
              <tr>
                <DocTh w={95}>Sana</DocTh>
                <DocTh w={130}>Hujjat</DocTh>
                <DocTh align="right">Summa</DocTh>
                <DocTh w={130} align="right">Qarz</DocTh>
              </tr>
            </thead>
            <tbody>
              {sales.map((s, i) => (
                <DocTr key={s.id} alt={i % 2 === 1} onClick={() => onOpenSale(s.id)}
                       tone={s.status === 'cancelled' ? 'muted' : 'normal'}>
                  <DocTd mono>{dateShort(s.doc_date)}</DocTd>
                  <DocTd mono tone="link">{s.doc_no ?? `#${s.id}`}</DocTd>
                  <DocTd align="right" mono>{money(s.net_base, false)}</DocTd>
                  <DocTd align="right" mono
                         tone={Number(s.due_base) > 0 ? 'danger' : 'muted'}>
                    {Number(s.due_base) > 0 ? money(s.due_base, false) : '—'}
                  </DocTd>
                </DocTr>
              ))}
            </tbody>
          </DocTable>
        )}
      </div>

      {top.length > 0 && (
        <div>
          <h3 className="mb-2 text-[13px] font-semibold">Eng ko'p olgan tovarlari</h3>
          <p className="mb-1.5 text-[12px]" style={{ color: 'var(--text-3)' }}>
            Yuqoridagi oxirgi {sales.length} ta sotuv bo'yicha — yangi buyurtmada
            nimani taklif qilishni shu ko'rsatadi.
          </p>
          <DocTable minWidth={460}>
            <thead>
              <tr>
                <DocTh>Nomenklatura</DocTh>
                <DocTh w={110} align="right">Miqdor</DocTh>
                <DocTh w={140} align="right">Summa</DocTh>
              </tr>
            </thead>
            <tbody>
              {top.map((t, i) => (
                <DocTr key={t.product_id} alt={i % 2 === 1}>
                  <DocTd>{t.name}</DocTd>
                  <DocTd align="right" mono>{num(t.qty, 2)}</DocTd>
                  <DocTd align="right" mono>{money(t.amount, false)}</DocTd>
                </DocTr>
              ))}
            </tbody>
          </DocTable>
        </div>
      )}
    </div>
  )
}

function Fig({
  label, value, tone,
}: { label: string; value: string; tone?: 'ok' | 'danger' }) {
  return (
    <div>
      <div className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>{label}</div>
      <div
        className="tnum text-[15px] font-semibold"
        style={{ color: tone === 'danger' ? 'var(--danger)' : tone === 'ok' ? 'var(--ok)' : undefined }}
      >
        {value}
      </div>
    </div>
  )
}
