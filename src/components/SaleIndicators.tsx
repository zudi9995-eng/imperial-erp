import type { PayStatus, SaleBoardRow, ShipStatus } from '../lib/types'
import { money, moneyShort, num } from '../lib/format'

/* To'lov ko'rsatkichi: to'liq / qisman / to'lanmagan / muddati o'tgan */
export function PayBadge({ r }: { r: SaleBoardRow }) {
  if (r.status !== 'posted') {
    return <Dot color="var(--text-3)" label="—" title="Postlanmagan" />
  }

  const overdue = r.is_overdue
  const st: PayStatus = r.pay_status

  const map: Record<PayStatus, { color: string; label: string }> = {
    paid:    { color: 'var(--ok)',     label: "to'langan" },
    partial: { color: 'var(--warn)',   label: `${num(r.paid_pct, 0)}%` },
    unpaid:  { color: 'var(--text-3)', label: "to'lanmagan" },
    'n/a':   { color: 'var(--text-3)', label: '—' },
  }

  const base = map[st]
  const color = overdue && st !== 'paid' ? 'var(--danger)' : base.color
  const label = overdue && st !== 'paid'
    ? `${r.overdue_days} kun kech`
    : base.label

  const title = st === 'paid'
    ? "To'liq to'langan"
    : `To'langan ${money(r.paid_base)} / ${money(r.net_base)}`
      + (overdue ? ` · ${r.overdue_days} kun kechikish` : '')

  return (
    <span className="inline-flex items-center gap-1.5" title={title}>
      <Dot color={color} label={label} />
      {st === 'partial' && (
        <span className="hidden h-1 w-10 overflow-hidden rounded-full sm:inline-block"
              style={{ background: 'var(--surface-2)' }}>
          <span className="block h-full rounded-full"
                style={{ width: `${Math.min(100, r.paid_pct)}%`, background: color }} />
        </span>
      )}
    </span>
  )
}

/* Yuk ko'rsatkichi: chiqdi / qisman / chiqmadi */
export function ShipBadge({ r }: { r: SaleBoardRow }) {
  if (r.source === 'opening') {
    return <span className="text-[12px]" style={{ color: 'var(--text-3)' }}>1C qoldig'i</span>
  }
  if (r.status !== 'posted') {
    return <Dot color="var(--text-3)" label="—" />
  }

  const map: Record<ShipStatus, { color: string; label: string }> = {
    shipped:     { color: 'var(--ok)',     label: 'chiqdi' },
    partial:     { color: 'var(--warn)',   label: `${num(r.qty_shipped, 0)}/${num(r.qty_total, 0)}` },
    not_shipped: { color: 'var(--danger)', label: 'chiqmadi' },
  }
  const s = map[r.shipment_status]

  const title = r.shipment_status === 'shipped'
    ? `Yuk chiqarilgan${r.shipped_at ? ` · ${new Date(r.shipped_at).toLocaleDateString('uz-UZ')}` : ''}`
    : r.shipment_status === 'partial'
      ? `${num(r.qty_shipped, 2)} / ${num(r.qty_total, 2)} chiqarilgan`
      : 'Tovar band qilingan, ombordan chiqmagan'

  return <Dot color={s.color} label={s.label} title={title} />
}

function Dot({ color, label, title }: { color: string; label: string; title?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px]" title={title}>
      <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
      <span style={{ color }}>{label}</span>
    </span>
  )
}

/* Ro'yxat tagidagi yig'indi */
export function SalesTotals({ rows }: { rows: SaleBoardRow[] }) {
  const posted = rows.filter((r) => r.status === 'posted')
  const net = posted.reduce((a, r) => a + Number(r.net_base), 0)
  const paid = posted.reduce((a, r) => a + Number(r.paid_base), 0)
  const gp = posted.reduce((a, r) => a + Number(r.gross_profit_base), 0)
  const returned = posted.reduce((a, r) => a + Number(r.returned_base), 0)

  return (
    <div
      className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t pt-3 text-[13px]"
      style={{ borderColor: 'var(--border)' }}
    >
      <span>
        <span style={{ color: 'var(--text-3)' }}>Jami: </span>
        <b className="tnum">{money(net)}</b>
      </span>
      {returned > 0 && (
        <span>
          <span style={{ color: 'var(--text-3)' }}>Qaytarilgan: </span>
          <b className="tnum" style={{ color: 'var(--warn)' }}>{moneyShort(returned)}</b>
        </span>
      )}
      <span>
        <span style={{ color: 'var(--text-3)' }}>To'langan: </span>
        <b className="tnum" style={{ color: 'var(--ok)' }}>{moneyShort(paid)}</b>
      </span>
      <span>
        <span style={{ color: 'var(--text-3)' }}>Qarz: </span>
        <b className="tnum" style={{ color: net - paid > 0 ? 'var(--warn)' : 'var(--ok)' }}>
          {moneyShort(net - paid)}
        </b>
      </span>
      <span>
        <span style={{ color: 'var(--text-3)' }}>Yalpi foyda: </span>
        <b className="tnum">{moneyShort(gp)}</b>
        {net > 0 && (
          <span style={{ color: 'var(--text-3)' }}> ({num((gp / net) * 100, 1)}%)</span>
        )}
      </span>
      <span className="ml-auto" style={{ color: 'var(--text-3)' }}>
        {posted.length} postlangan · {rows.length - posted.length} boshqa
      </span>
    </div>
  )
}

/** Ro'yxatni CSV qilib yuklaydi (Excel ochadi) */
export function exportSalesCsv(rows: SaleBoardRow[], filename = 'sotuv') {
  const head = [
    'Hujjat', 'Sana', 'Mijoz', 'Menejer', 'Summa', 'Qaytarilgan', 'Sof',
    "To'langan", 'Qarz', 'Marja %', 'Muddat', 'Kechikish', "To'lov", 'Yuk', 'Holat',
  ]
  const PAY: Record<string, string> = {
    paid: "to'langan", partial: 'qisman', unpaid: "to'lanmagan", 'n/a': '—',
  }
  const SHIP: Record<string, string> = {
    shipped: 'chiqdi', partial: 'qisman', not_shipped: 'chiqmadi',
  }
  const body = rows.map((r) => [
    r.doc_no ?? `#${r.id}`,
    r.doc_date,
    r.customer_name,
    r.manager_name ?? '',
    r.total_base,
    r.returned_base,
    r.net_base,
    r.paid_base,
    r.due_base,
    r.margin_pct ?? '',
    r.due_date ?? '',
    r.is_overdue ? r.overdue_days : 0,
    PAY[r.pay_status] ?? '',
    r.source === 'opening' ? '1C' : SHIP[r.shipment_status] ?? '',
    r.status,
  ])

  const esc = (v: unknown) => {
    const s = String(v ?? '')
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  // Excel uchun nuqtali vergul ajratgich va BOM
  const csv = '﻿' + [head, ...body].map((r) => r.map(esc).join(';')).join('\r\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
