import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw, Send, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useSettings } from '../lib/settings'
import { invokeFn } from '../lib/useRefs'
import {
  Button, Card, CardTitle, Empty, ErrorBox, InfoBox, Loading, PageHeader,
} from '../components/ui'
import { dateShort, dateTimeUz } from '../lib/format'

/**
 * AI tahlil — kunlik brifing va savol-javob.
 * Ma'lumot kesimi bazadagi ip_ai_snapshot() ichida ruxsatga qarab
 * chegaralanadi: menejer AI orqali ham kassani ko'ra olmaydi.
 */

interface Briefing {
  id: number
  brief_date: string
  content: string
  created_at: string
  model: string | null
}

interface Msg {
  role: 'user' | 'assistant'
  content: string
}

export default function Ai() {
  const { can } = useAuth()
  const { b, s } = useSettings()
  const enabled = b('ai_enabled', true)

  const [brief, setBrief] = useState<Briefing | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [chatId, setChatId] = useState<number | null>(null)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('ip_ai_briefings')
      .select('id, brief_date, content, created_at, model')
      .order('brief_date', { ascending: false }).limit(1).maybeSingle()
    setBrief(data as Briefing | null)
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  async function makeBriefing() {
    setBusy(true); setErr('')
    try {
      const r = await invokeFn<{ content: string }>('ip-ai', { mode: 'briefing' })
      setBrief({
        id: 0, brief_date: new Date().toISOString().slice(0, 10),
        content: r.content, created_at: new Date().toISOString(), model: null,
      })
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Xato')
    } finally { setBusy(false) }
  }

  async function ask() {
    const text = q.trim()
    if (!text) return
    setQ('')
    setMsgs((m) => [...m, { role: 'user', content: text }])
    setBusy(true); setErr('')
    try {
      const r = await invokeFn<{ content: string; chat_id: number | null }>('ip-ai', {
        mode: 'chat', question: text, chat_id: chatId,
      })
      setChatId(r.chat_id)
      setMsgs((m) => [...m, { role: 'assistant', content: r.content }])
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Xato')
      setMsgs((m) => m.slice(0, -1))
      setQ(text)
    } finally { setBusy(false) }
  }

  if (loading) return <Loading />

  if (!can('view.ai')) {
    return (
      <div>
        <PageHeader title="AI tahlil" />
        <Empty title="Ruxsat yo'q" hint="Bu bo'limni ko'rish uchun ruxsat kerak." />
      </div>
    )
  }

  const SAMPLES = [
    'Qaysi mijozga qo\'ng\'iroq qilish kerak?',
    'Qaysi tovar tugab qolyapti?',
    'Bu oy o\'tgan oyga nisbatan qanday?',
    'Eng katta qarzdorlar kimlar?',
  ]

  return (
    <div>
      <PageHeader
        title="AI tahlil"
        sub={`Model: ${s('ai_model', 'claude-opus-5')}`}
        actions={
          <Button size="sm" variant="primary" loading={busy} onClick={makeBriefing}>
            <RefreshCw size={14} />Brifing yangilash
          </Button>
        }
      />

      {!enabled && (
        <div className="mb-4">
          <InfoBox tone="warn">
            AI qatlami Sozlamalarda o'chirilgan. Yoqish uchun
            Sozlamalar → AI bo'limiga o'ting.
          </InfoBox>
        </div>
      )}

      {err && <div className="mb-4"><ErrorBox>{err}</ErrorBox></div>}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Kunlik brifing */}
        <Card>
          <CardTitle sub={brief ? dateShort(brief.brief_date) : undefined}>
            Kunlik brifing
          </CardTitle>
          {brief ? (
            <>
              <div className="whitespace-pre-wrap text-[13.5px] leading-relaxed">
                {brief.content}
              </div>
              <div className="mt-3 text-[11.5px]" style={{ color: 'var(--text-3)' }}>
                {dateTimeUz(brief.created_at)}
                {brief.model && ` · ${brief.model}`}
              </div>
            </>
          ) : (
            <Empty
              title="Brifing hali tayyorlanmagan"
              hint="«Brifing yangilash» ni bosing — bugungi holat bo'yicha qisqacha xulosa tayyorlanadi."
            />
          )}
        </Card>

        {/* Savol-javob */}
        <Card pad={false}>
          <div className="border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}>
            <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold">
              <Sparkles size={15} />Savol bering
            </span>
            <p className="mt-0.5 text-[12px]" style={{ color: 'var(--text-3)' }}>
              AI faqat sizga ko'rinadigan ma'lumot bilan javob beradi
            </p>
          </div>

          <div className="max-h-[420px] min-h-[220px] overflow-y-auto px-4 py-3">
            {msgs.length === 0 ? (
              <div className="space-y-2">
                <p className="text-[13px]" style={{ color: 'var(--text-3)' }}>
                  Masalan:
                </p>
                {SAMPLES.map((x) => (
                  <button
                    key={x} onClick={() => setQ(x)}
                    className="block w-full rounded-lg border px-2.5 py-1.5 text-left text-[13px]
                      transition-colors hover:border-[var(--brand)]"
                    style={{ borderColor: 'var(--border-2)', color: 'var(--text-2)' }}
                  >
                    {x}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {msgs.map((m, i) => (
                  <div
                    key={i}
                    className={`max-w-[92%] rounded-lg px-3 py-2 text-[13.5px] leading-relaxed
                      ${m.role === 'user' ? 'ml-auto' : ''}`}
                    style={{
                      background: m.role === 'user' ? 'var(--brand-soft)' : 'var(--surface-2)',
                      color: m.role === 'user' ? 'var(--brand)' : 'var(--text)',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {m.content}
                  </div>
                ))}
                {busy && (
                  <div className="text-[13px]" style={{ color: 'var(--text-3)' }}>
                    O'ylanmoqda…
                  </div>
                )}
                <div ref={endRef} />
              </div>
            )}
          </div>

          <div className="flex gap-2 border-t px-4 py-3" style={{ borderColor: 'var(--border)' }}>
            <input
              value={q} onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !busy) void ask() }}
              placeholder="Savolingizni yozing…"
              disabled={busy || !enabled}
              className="flex-1 rounded-lg border px-2.5 py-2 text-[13.5px] outline-none
                focus:border-[var(--brand)] disabled:opacity-60"
              style={{ background: 'var(--surface)', borderColor: 'var(--border-2)' }}
            />
            <Button variant="primary" loading={busy} onClick={ask}
                    disabled={!q.trim() || !enabled}>
              <Send size={14} />
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
