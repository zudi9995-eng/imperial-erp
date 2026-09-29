import { useEffect, useState } from 'react'
import { Cake, CalendarClock, Gift, ShieldAlert } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { dateShort } from '../lib/format'

/**
 * HR eslatmalari — tug'ilgan kun, ish yubileyi, sinov muddati va
 * shartnoma tugashi. Baza shuni allaqachon hisoblab turardi, lekin
 * hech qayerda ko'rinmasdi.
 */

interface Reminder {
  profile_id: string
  full_name: string
  kind: string
  label: string
  event_date: string
  days_left: number
}

const ICON: Record<string, typeof Cake> = {
  birthday: Cake,
  anniversary: Gift,
  probation: ShieldAlert,
  contract: CalendarClock,
}

export default function HrReminders({ days = 30 }: { days?: number }) {
  const [rows, setRows] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    void supabase.from('ip_hr_reminders').select('*')
      .lte('days_left', days).gte('days_left', 0)
      .order('days_left').limit(20)
      .then(({ data }) => {
        if (!alive) return
        setRows((data as Reminder[]) ?? [])
        setLoading(false)
      })
    return () => { alive = false }
  }, [days])

  if (loading || rows.length === 0) return null

  return (
    <div
      className="mb-4 rounded-lg border px-3 py-2.5"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider"
           style={{ color: 'var(--text-3)' }}>
        Yaqin kunlarda
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1.5">
        {rows.map((r) => {
          const Icon = ICON[r.kind] ?? CalendarClock
          const soon = r.days_left <= 3
          const urgent = r.kind === 'probation' || r.kind === 'contract'
          return (
            <span
              key={`${r.profile_id}-${r.kind}-${r.event_date}`}
              className="inline-flex items-center gap-1.5 text-[13px]"
              style={{ color: urgent && soon ? 'var(--danger)' : undefined }}
            >
              <Icon size={14} style={{ color: urgent ? 'var(--warn)' : 'var(--text-3)' }} />
              <b>{r.full_name}</b>
              <span style={{ color: 'var(--text-2)' }}>{r.label}</span>
              <span style={{ color: soon ? 'var(--warn)' : 'var(--text-3)' }}>
                {r.days_left === 0 ? 'bugun'
                  : r.days_left === 1 ? 'ertaga'
                  : `${r.days_left} kundan keyin`}
                {' · '}{dateShort(r.event_date)}
              </span>
            </span>
          )
        })}
      </div>
    </div>
  )
}
