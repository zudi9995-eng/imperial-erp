import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  AlertTriangle, CheckCircle2, FileText, Package, Phone, Wallet,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { LogoMark } from '../components/Logo'
import { dateShort, money } from '../lib/format'

/**
 * Mijoz kabineti — parolsiz, havola orqali ochiladi.
 *
 * Mijoz o'z qarzini, to'lanmagan hujjatlarini va yetkazib berish
 * holatini ko'radi. Ichki raqamlar (tan narx, marja) bu yerga umuman
 * kelmaydi — ip_portal_open faqat ko'rsatsa bo'ladiganini qaytaradi.
 */

interface Doc {
  doc_no: string
  date: string
  due_date: string | null
  total: number
  paid: number
  due: number
  overdue: boolean
}
interface Ship {
  doc_no: string
  date: string
  status: string
  address: string | null
  delivered: string | null
}
interface Data {
  ok: boolean
  reason?: string
  company: string
  company_phone: string | null
  customer: string
  debt: number
  overdue: number
  next_due: string | null
  documents: Doc[]
  shipments: Ship[]
}

const SHIP_LABEL: Record<string, string> = {
  shipped: 'Chiqarilgan', partial: 'Qisman', not_shipped: 'Chiqmagan',
}

export default function Portal() {
  const { token = '' } = useParams()
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data: d } = await supabase.rpc('ip_portal_open', { p_token: token })
    setData((d as Data) ?? { ok: false } as Data)
    setLoading(false)
  }, [token])

  useEffect(() => { void load() }, [load])

  if (loading) {
    return (
      <Shell>
        <p className="text-center text-[14px]" style={{ color: 'var(--text-3)' }}>
          Yuklanmoqda…
        </p>
      </Shell>
    )
  }

  if (!data?.ok) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <AlertTriangle size={30} style={{ color: 'var(--warn)' }} />
          <h1 className="text-[17px] font-semibold">Havola ishlamaydi</h1>
          <p className="max-w-[360px] text-[13.5px]" style={{ color: 'var(--text-2)' }}>
            Havola eskirgan yoki bekor qilingan bo'lishi mumkin.
            Yangisini olish uchun menejeringizga murojaat qiling.
          </p>
        </div>
      </Shell>
    )
  }

  const clean = data.debt <= 0

  return (
    <Shell company={data.company}>
      <div className="mb-5">
        <div className="text-[12.5px]" style={{ color: 'var(--text-3)' }}>Mijoz</div>
        <h1 className="text-[20px] font-semibold leading-tight">{data.customer}</h1>
      </div>

      {/* Qarz holati */}
      <div
        className="mb-4 rounded-xl border p-5"
        style={{
          background: clean ? 'var(--ok-soft)' : data.overdue > 0 ? 'var(--danger-soft)' : 'var(--surface)',
          borderColor: 'var(--border)',
        }}
      >
        {clean ? (
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={22} style={{ color: 'var(--ok)' }} />
            <div>
              <div className="text-[15px] font-semibold">Qarz yo'q</div>
              <div className="text-[13px]" style={{ color: 'var(--text-2)' }}>
                Hamma hujjat to'liq to'langan. Rahmat!
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--text-2)' }}>
              <Wallet size={15} />Joriy qarz
            </div>
            <div className="tnum mt-1 text-[28px] font-semibold leading-none">
              {money(data.debt, false)} <span className="text-[16px]">so'm</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
              {data.overdue > 0 && (
                <span style={{ color: 'var(--danger)' }}>
                  Muddati o'tgan: <b className="tnum">{money(data.overdue, false)}</b>
                </span>
              )}
              {data.next_due && (
                <span style={{ color: 'var(--text-2)' }}>
                  Eng yaqin muddat: <b>{dateShort(data.next_due)}</b>
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* To'lanmagan hujjatlar */}
      {data.documents.length > 0 && (
        <Section icon={<FileText size={15} />} title="To'lanmagan hujjatlar">
          <div className="space-y-2">
            {data.documents.map((d) => (
              <div
                key={d.doc_no}
                className="rounded-lg border p-3"
                style={{
                  background: 'var(--surface)',
                  borderColor: d.overdue ? 'var(--danger)' : 'var(--border)',
                }}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">{d.doc_no}</span>
                  <span className="tnum text-[15px] font-semibold">
                    {money(d.due, false)} so'm
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[12.5px]"
                     style={{ color: 'var(--text-3)' }}>
                  <span>Sana: {dateShort(d.date)}</span>
                  {d.due_date && (
                    <span style={{ color: d.overdue ? 'var(--danger)' : undefined }}>
                      Muddat: {dateShort(d.due_date)}{d.overdue && ' · o‘tgan'}
                    </span>
                  )}
                  {Number(d.paid) > 0 && (
                    <span>
                      To'langan: {money(d.paid, false)} / {money(d.total, false)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Yetkazib berish */}
      {data.shipments.length > 0 && (
        <Section icon={<Package size={15} />} title="Oxirgi yuklar">
          <div className="space-y-1.5">
            {data.shipments.map((s) => (
              <div
                key={s.doc_no}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2 text-[13px]"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                <span className="font-medium">{s.doc_no}</span>
                <span style={{ color: 'var(--text-3)' }}>{dateShort(s.date)}</span>
                <span
                  className="rounded px-1.5 py-0.5 text-[11.5px] font-medium"
                  style={{
                    background: s.status === 'shipped' ? 'var(--ok-soft)' : 'var(--warn-soft)',
                    color: s.status === 'shipped' ? 'var(--ok)' : 'var(--warn)',
                  }}
                >
                  {SHIP_LABEL[s.status] ?? s.status}
                </span>
                {s.address && (
                  <span className="truncate" style={{ color: 'var(--text-3)' }}>{s.address}</span>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {data.company_phone && (
        <div className="mt-5 flex items-center justify-center gap-2 text-[13px]"
             style={{ color: 'var(--text-2)' }}>
          <Phone size={14} />
          Savol bo'lsa: <a href={`tel:${data.company_phone}`}
                           style={{ color: 'var(--brand)' }}>{data.company_phone}</a>
        </div>
      )}
    </Shell>
  )
}

function Section({
  icon, title, children,
}: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide"
           style={{ color: 'var(--text-3)' }}>
        {icon}{title}
      </div>
      {children}
    </div>
  )
}

function Shell({ children, company }: { children: React.ReactNode; company?: string }) {
  return (
    <div className="h-full overflow-y-auto" style={{ background: 'var(--bg)' }}>
      <div className="mx-auto max-w-[620px] px-4 py-6">
        <div className="mb-5 flex items-center gap-2.5">
          <LogoMark size={26} />
          <div className="text-[13.5px] font-semibold">{company ?? 'Sales Growth'}</div>
        </div>
        {children}
        <div className="mt-8 text-center text-[11.5px]" style={{ color: 'var(--text-3)' }}>
          Sales Growth · mijoz kabineti
        </div>
      </div>
    </div>
  )
}
