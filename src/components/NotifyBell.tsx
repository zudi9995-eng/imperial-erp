import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, BellOff, Check, ChevronRight, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { dateTimeUz } from '../lib/format'

/**
 * Bildirishnomalar qo'ng'irog'i.
 *
 * Panel Windows ning "Uvedomleniya" paneli kabi o'ng tomondan surilib
 * chiqadi: ekran bo'yi, kartochkalar, bugun / oldinroq ajratilgan.
 * Panel doim DOM da turadi va faqat surib yashiriladi — shu sababli
 * ochilish/yopilish silliq chiqadi.
 */

export interface Note {
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

const TONE_SOFT: Record<string, string> = {
  danger: 'var(--danger-soft)', warn: 'var(--warn-soft)',
  ok: 'var(--ok-soft)', info: 'var(--info-soft)',
}

export default function NotifyBell({ compact }: { compact?: boolean }) {
  const nav = useNavigate()
  const [rows, setRows] = useState<Note[]>([])
  const [open, setOpen] = useState(false)

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

  const unread = useMemo(() => rows.filter((r) => !r.is_read), [rows])

  const markRead = useCallback(async (ids: number[]) => {
    if (ids.length === 0) return
    setRows((p) => p.map((r) => (ids.includes(r.id) ? { ...r, is_read: true } : r)))
    await supabase.from('ip_notifications').update({ is_read: true } as never).in('id', ids)
  }, [])

  const openNote = useCallback((n: Note) => {
    if (!n.is_read) void markRead([n.id])
    setOpen(false)
    if (n.url) nav(n.url)
  }, [markRead, nav])

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Bildirishnomalar"
        className="relative flex items-center rounded p-1"
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

      <NotifyPanel
        rows={rows}
        open={open}
        onClose={() => setOpen(false)}
        onOpenNote={openNote}
        onMarkRead={(ids) => void markRead(ids)}
      />
    </>
  )
}

/**
 * Panelning o'zi — ma'lumotsiz, faqat ko'rinish.
 * Ajratilgani shuning uchun: tizimga kirmasdan ham sinab ko'rish mumkin.
 */
export function NotifyPanel({
  rows, open, onClose, onOpenNote, onMarkRead,
}: {
  rows: Note[]
  open: boolean
  onClose: () => void
  onOpenNote: (n: Note) => void
  onMarkRead: (ids: number[]) => void
}) {
  // Escape bilan yopilsin
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const unread = useMemo(() => rows.filter((r) => !r.is_read), [rows])

  /** Bugun kelganlar alohida guruh */
  const groups = useMemo(() => {
    const today = new Date().toDateString()
    const a: Note[] = [], b: Note[] = []
    for (const r of rows) {
      (new Date(r.created_at).toDateString() === today ? a : b).push(r)
    }
    return [
      { label: 'Bugun', items: a },
      { label: 'Oldinroq', items: b },
    ].filter((g) => g.items.length > 0)
  }, [rows])

  return (
    <>
      {/* Fon — panel ochiqligida bosilsa yopiladi */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 transition-opacity duration-200"
        style={{
          background: 'rgba(8,10,14,.35)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
      />

      {/* O'ngdan suriladigan panel */}
      <aside
        aria-hidden={!open}
        className="fixed right-0 top-0 z-50 flex h-full w-[min(380px,100vw)] flex-col
          border-l shadow-2xl transition-transform duration-200 ease-out"
        style={{
          background: 'var(--surface)',
          borderColor: 'var(--border-2)',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          visibility: open ? 'visible' : 'hidden',
        }}
      >
        <div
          className="flex h-14 shrink-0 items-center gap-2 border-b px-4"
          style={{ borderColor: 'var(--border)' }}
        >
          <Bell size={16} style={{ color: 'var(--text-2)' }} />
          <span className="text-[14px] font-semibold">Bildirishnomalar</span>
          {unread.length > 0 && (
            <span
              className="tnum rounded-full px-1.5 text-[11px] font-bold"
              style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }}
            >
              {unread.length}
            </span>
          )}
          <button
            onClick={onClose}
            aria-label="Yopish"
            className="ml-auto rounded p-1 hover:bg-[var(--surface-2)]"
            style={{ color: 'var(--text-2)' }}
          >
            <X size={16} />
          </button>
        </div>

        {unread.length > 0 && (
          <div className="shrink-0 border-b px-4 py-2" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={() => onMarkRead(unread.map((r) => r.id))}
              className="inline-flex items-center gap-1.5 text-[12.5px] hover:underline"
              style={{ color: 'var(--brand)' }}
            >
              <Check size={13} />Hammasini o'qildi deb belgilash
            </button>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {rows.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2"
                 style={{ color: 'var(--text-3)' }}>
              <BellOff size={26} />
              <span className="text-[13px]">Yangi bildirishnoma yo'q</span>
            </div>
          ) : groups.map((g) => (
            <div key={g.label} className="mb-3 last:mb-0">
              <div className="mb-1.5 px-1 text-[11.5px] font-semibold uppercase tracking-wide"
                   style={{ color: 'var(--text-3)' }}>
                {g.label}
              </div>
              <div className="space-y-1.5">
                {g.items.map((n) => {
                  const tone = n.severity ?? 'info'
                  return (
                    <button
                      key={n.id}
                      onClick={() => onOpenNote(n)}
                      className="group flex w-full items-start gap-2.5 rounded-lg border p-3
                        text-left transition-colors hover:border-[var(--border-2)]"
                      style={{
                        borderColor: n.is_read ? 'var(--border)' : 'transparent',
                        background: n.is_read
                          ? 'var(--surface-2)'
                          : (TONE_SOFT[tone] ?? 'var(--brand-soft)'),
                      }}
                    >
                      <span
                        className="mt-[6px] h-2 w-2 shrink-0 rounded-full"
                        style={{
                          background: n.is_read
                            ? 'var(--text-3)'
                            : (TONE[tone] ?? 'var(--info)'),
                        }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-medium leading-snug">
                          {n.title}
                        </span>
                        {n.body && (
                          <span className="mt-0.5 line-clamp-3 block text-[12px] leading-snug"
                                style={{ color: 'var(--text-2)' }}>
                            {n.body}
                          </span>
                        )}
                        <span className="mt-1 block text-[11px]" style={{ color: 'var(--text-3)' }}>
                          {dateTimeUz(n.created_at)}
                        </span>
                      </span>
                      {n.url && (
                        <ChevronRight
                          size={14} className="mt-[3px] shrink-0 opacity-0 group-hover:opacity-100"
                          style={{ color: 'var(--text-3)' }}
                        />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </aside>
    </>
  )
}
