import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { dateTimeUz } from '../lib/format'

/**
 * Bildirishnomalar qo'ng'irog'i. Shu paytgacha faqat soni ko'rinardi —
 * ro'yxatini ochib o'qish imkoni yo'q edi.
 */

interface Note {
  id: number
  kind: string
  title: string
  body: string | null
  severity: string | null
  url: string | null
  is_read: boolean
  created_at: string
}

const TONE: Record<string, string> = {
  danger: 'var(--danger)', warn: 'var(--warn)',
  ok: 'var(--ok)', info: 'var(--info)',
}

export default function NotifyBell({ compact }: { compact?: boolean }) {
  const nav = useNavigate()
  const [rows, setRows] = useState<Note[]>([])
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('ip_notifications')
      .select('id, kind, title, body, severity, url, is_read, created_at')
      .order('created_at', { ascending: false }).limit(50)
    setRows((data as Note[]) ?? [])
  }, [])

  useEffect(() => {
    void load()
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [load])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const unread = rows.filter((r) => !r.is_read)

  async function markRead(ids: number[]) {
    if (ids.length === 0) return
    setRows((p) => p.map((r) => (ids.includes(r.id) ? { ...r, is_read: true } : r)))
    await supabase.from('ip_notifications').update({ is_read: true } as never).in('id', ids)
  }

  async function openNote(n: Note) {
    if (!n.is_read) void markRead([n.id])
    setOpen(false)
    if (n.url) nav(n.url)
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Bildirishnomalar"
        className="relative flex items-center gap-1 rounded p-1"
        style={{ color: unread.length > 0 ? 'var(--warn)' : 'var(--text-2)' }}
      >
        <Bell size={compact ? 16 : 17} />
        {unread.length > 0 && (
          <span
            className="tnum absolute -right-1 -top-1 flex h-[15px] min-w-[15px] items-center
              justify-center rounded-full px-[3px] text-[10px] font-bold"
            style={{ background: 'var(--warn)', color: '#fff' }}
          >
            {unread.length > 99 ? '99+' : unread.length}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-[30px] z-50 max-h-[420px] w-[340px] overflow-auto
            rounded-lg border shadow-lg"
          style={{ background: 'var(--surface)', borderColor: 'var(--border-2)' }}
        >
          <div className="sticky top-0 flex items-center justify-between border-b px-3 py-2"
               style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <span className="text-[13px] font-semibold">Bildirishnomalar</span>
            {unread.length > 0 && (
              <button
                onClick={() => void markRead(unread.map((r) => r.id))}
                className="inline-flex items-center gap-1 text-[12px] hover:underline"
                style={{ color: 'var(--brand)' }}
              >
                <Check size={12} />Hammasini o'qildi
              </button>
            )}
          </div>

          {rows.length === 0 ? (
            <div className="px-3 py-6 text-center text-[13px]" style={{ color: 'var(--text-3)' }}>
              Bildirishnoma yo'q
            </div>
          ) : rows.map((n) => (
            <button
              key={n.id}
              onClick={() => void openNote(n)}
              className="block w-full border-b px-3 py-2 text-left last:border-b-0
                hover:bg-[var(--surface-2)]"
              style={{
                borderColor: 'var(--border)',
                background: n.is_read ? undefined : 'var(--brand-soft)',
              }}
            >
              <div className="flex items-start gap-2">
                <span
                  className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: TONE[n.severity ?? 'info'] ?? 'var(--text-3)' }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium">{n.title}</span>
                  {n.body && (
                    <span className="line-clamp-2 block text-[12px]"
                          style={{ color: 'var(--text-2)' }}>
                      {n.body}
                    </span>
                  )}
                  <span className="block text-[11px]" style={{ color: 'var(--text-3)' }}>
                    {dateTimeUz(n.created_at)}
                  </span>
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
