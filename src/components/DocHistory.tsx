import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Empty, Loading } from './ui'
import { dateTimeUz, money } from '../lib/format'

/**
 * Hujjat tarixi — 1C dagi «События» ga mos.
 * Manba: ip_audit_log dagi trigger yozuvlari (faqat o'zgargan maydonlar).
 */

interface Row {
  id: number
  action: 'insert' | 'update' | 'delete'
  created_at: string
  actor_name: string
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
}

/** Ustun nomlarini o'qiladigan ko'rinishga o'tkazamiz */
const FIELD: Record<string, string> = {
  status: 'Holat',
  doc_date: 'Sana',
  valid_until: 'Amal qilish muddati',
  customer_id: 'Xaridor',
  contract_id: 'Shartnoma',
  warehouse_id: 'Ombor',
  manager_id: 'Menejer',
  total: 'Summa',
  note: 'Izoh',
  sale_id: 'Bog\'langan sotuv',
  doc_no: 'Raqam',
  due_date: "To'lov muddati",
  paid_base: "To'langan",
  returned_base: 'Qaytarilgan',
  shipment_status: 'Yuk holati',
  approval_status: 'Tasdiq holati',
  delivery_address: 'Manzil',
  delivery_driver: 'Haydovchi',
  delivery_vehicle: 'Mashina',
}

const STATUS: Record<string, string> = {
  draft: 'Qoralama', confirmed: 'Tasdiqlangan', converted: "Sotuvga o'tkazilgan",
  cancelled: 'Bekor qilingan', posted: 'Postlangan',
  pending: 'Kutilmoqda', approved: 'Tasdiqlangan', rejected: 'Rad etilgan',
  shipped: 'Chiqarilgan', partial: 'Qisman', none: 'Chiqmagan',
}

function show(field: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'ha' : "yo'q"
  if (field === 'status' || field.endsWith('_status')) {
    return STATUS[String(v)] ?? String(v)
  }
  if (field === 'total' || field.endsWith('_base')) return money(Number(v), false)
  return String(v)
}

export default function DocHistory({
  entity, entityId,
}: { entity: 'ip_orders' | 'ip_sales' | 'ip_returns' | 'ip_purchases'
     entityId: number | null }) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!entityId) { setRows([]); setLoading(false); return }
    let alive = true
    setLoading(true)
    void supabase.from('ip_doc_history')
      .select('id, action, created_at, actor_name, before, after')
      .eq('entity', entity).eq('entity_id', String(entityId))
      .order('created_at', { ascending: false }).limit(200)
      .then(({ data }) => {
        if (!alive) return
        setRows((data as Row[]) ?? [])
        setLoading(false)
      })
    return () => { alive = false }
  }, [entity, entityId])

  if (!entityId) {
    return (
      <Empty
        title="Hujjat hali saqlanmagan"
        hint="Tarix hujjat birinchi marta yozilgandan keyin to'plana boshlaydi."
      />
    )
  }
  if (loading) return <Loading />
  if (rows.length === 0) {
    return <Empty title="Tarix bo'sh" hint="Bu hujjatga hali o'zgarish kiritilmagan." />
  }

  return (
    <div className="max-w-[760px] pt-1">
      {rows.map((r) => {
        const fields = Object.keys(r.after ?? r.before ?? {})
        return (
          <div
            key={r.id}
            className="flex gap-3 border-b py-2.5 last:border-b-0"
            style={{ borderColor: 'var(--border)' }}
          >
            <div className="w-[130px] shrink-0">
              <div className="tnum text-[12.5px]">{dateTimeUz(r.created_at)}</div>
              <div className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>
                {r.actor_name}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              {r.action === 'insert' && (
                <span className="text-[13px]" style={{ color: 'var(--ok)' }}>
                  Hujjat yaratildi
                </span>
              )}
              {r.action === 'delete' && (
                <span className="text-[13px]" style={{ color: 'var(--danger)' }}>
                  Hujjat o'chirildi
                </span>
              )}
              {r.action === 'update' && (
                <div className="space-y-0.5">
                  {fields.map((f) => (
                    <div key={f} className="text-[13px]">
                      <span style={{ color: 'var(--text-2)' }}>{FIELD[f] ?? f}: </span>
                      <span style={{ color: 'var(--text-3)' }}>
                        {show(f, r.before?.[f])}
                      </span>
                      <span style={{ color: 'var(--text-3)' }}> → </span>
                      <b>{show(f, r.after?.[f])}</b>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
