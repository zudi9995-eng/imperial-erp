import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import type { Customer } from '../lib/types'

/**
 * Xaridorni qidirib topish.
 *
 * Oddiy ro'yxat 275 ta mijozda ishlamaydi — menejer kerakligini
 * topa olmaydi. Bu yerda yozgan sari filtrlanadi: nom, telefon va
 * STIR bo'yicha, so'zlar tartibi muhim emas ("bino koprik" ham
 * "«BINO VA KOPRIK BARPO ETISH»" ni topadi).
 *
 * Klaviatura bilan ham ishlaydi: yuqori/past o'q, Enter — tanlash,
 * Escape — yopish.
 */

/** Kirill va lotin apostroflarini bir ko'rinishga keltiramiz */
const norm = (s: string) =>
  s.toLowerCase()
    .replace(/[‘’'`«»"]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

/** Ro'yxat qancha ko'rsatiladi — undan ortig'i qidiruv bilan topiladi */
const MAX = 60

function matches(c: Customer, q: string): boolean {
  if (!q) return true
  const hay = norm(`${c.name} ${c.phone ?? ''} ${c.inn ?? ''}`)
  // Har bir so'zak alohida qidiriladi — tartibi muhim emas
  return norm(q).split(' ').every((w) => hay.includes(w))
}

export default function CustomerCombo({
  value, customers, onChange, disabled, placeholder = 'Qidiring yoki tanlang…',
}: {
  value: number | null
  customers: Customer[]
  onChange: (id: number | null) => void
  disabled?: boolean
  placeholder?: string
}) {
  const selected = value ? customers.find((c) => c.id === value) ?? null : null
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [hi, setHi] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const list = useMemo(
    () => customers.filter((c) => matches(c, q)).slice(0, MAX),
    [customers, q],
  )

  useEffect(() => { setHi(0) }, [q])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false); setQ('')
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function choose(id: number) {
    onChange(id)
    setOpen(false)
    setQ('')
  }

  return (
    <div ref={boxRef} className="relative">
      {open ? (
        <div className="relative">
          <Search
            size={13}
            className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--text-3)' }}
          />
          <input
            ref={inputRef}
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault(); setHi((h) => Math.min(h + 1, list.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault(); setHi((h) => Math.max(h - 1, 0))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                if (list[hi]) choose(list[hi].id)
              } else if (e.key === 'Escape') {
                e.preventDefault(); setOpen(false); setQ('')
              }
            }}
            className="w-full rounded border py-[5px] pl-7 pr-2 text-[13px] outline-none
              focus:border-[var(--brand)]"
            style={{ background: 'var(--surface)', borderColor: 'var(--brand)' }}
          />
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => { setOpen(true); setQ('') }}
          className="flex w-full items-center gap-1.5 rounded border py-[5px] pl-2 pr-1
            text-left text-[13px]"
          style={{
            background: disabled ? 'var(--surface-2)' : 'var(--surface)',
            borderColor: 'var(--border-2)',
            color: selected ? 'var(--text)' : 'var(--text-3)',
          }}
        >
          <span className="min-w-0 flex-1 truncate">
            {selected ? selected.name : placeholder}
          </span>
          {selected && !disabled && (
            <span
              role="button"
              title="Tozalash"
              onClick={(e) => { e.stopPropagation(); onChange(null) }}
              className="shrink-0 rounded p-0.5 hover:bg-[var(--surface-2)]"
              style={{ color: 'var(--text-3)' }}
            >
              <X size={12} />
            </span>
          )}
        </button>
      )}

      {open && (
        <div
          className="absolute z-50 mt-1 max-h-[300px] w-full min-w-[280px] overflow-auto
            rounded-lg border shadow-lg"
          style={{ background: 'var(--surface)', borderColor: 'var(--border-2)' }}
        >
          {list.length === 0 ? (
            <div className="px-3 py-4 text-center text-[12.5px]" style={{ color: 'var(--text-3)' }}>
              Topilmadi
            </div>
          ) : list.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onMouseEnter={() => setHi(i)}
              onClick={() => choose(c.id)}
              className="block w-full border-b px-3 py-1.5 text-left last:border-b-0"
              style={{
                borderColor: 'var(--border)',
                background: i === hi ? 'var(--brand-soft)' : undefined,
              }}
            >
              <div className="truncate text-[13px] font-medium">{c.name}</div>
              {(c.phone || c.inn) && (
                <div className="truncate text-[11.5px]" style={{ color: 'var(--text-3)' }}>
                  {[c.phone, c.inn && `STIR ${c.inn}`].filter(Boolean).join(' · ')}
                </div>
              )}
            </button>
          ))}
          {/* Faqat ro'yxat kesilganda — filtr natijasi kam bo'lsa emas */}
          {list.length === MAX && (
            <div
              className="px-3 py-1.5 text-[11.5px]"
              style={{ color: 'var(--text-3)', background: 'var(--surface-2)' }}
            >
              Dastlabki {MAX} tasi ko'rsatildi — qidiruvni aniqlashtiring
            </div>
          )}
        </div>
      )}
    </div>
  )
}
