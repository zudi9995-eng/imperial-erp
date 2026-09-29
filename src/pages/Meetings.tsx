import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, Check, MapPin, Plus, Trash2, X as XIcon } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useCustomers, useRefs, translateDbError } from '../lib/useRefs'
import {
  Button, Card, Empty, ErrorBox, Field, Input, Loading, Modal,
  PageHeader, Select, Stat, Textarea,
} from '../components/ui'
import { DocTable, DocTd, DocTh, DocTr, type RowTone } from '../components/docList'
import { dateShort, isoDate, relativeDays, timeUz } from '../lib/format'

/**
 * Uchrashuvlar — kim bilan, qachon, qayerda va natijasi nima bo'lgani.
 * Natija yozilmagan o'tgan uchrashuv alohida ko'rsatiladi: eng ko'p
 * yo'qoladigan ma'lumot shu.
 */

interface Meeting {
  id: number
  title: string
  customer_id: number | null
  organizer_id: string | null
  starts_at: string
  ends_at: string | null
  location: string | null
  description: string | null
  status: string
  outcome: string | null
  created_by: string | null
}

type Tab = 'upcoming' | 'past' | 'noresult'

export default function Meetings() {
  const { profile } = useAuth()
  const refs = useRefs()
  const { customers } = useCustomers()

  const [rows, setRows] = useState<Meeting[]>([])
  const [tab, setTab] = useState<Tab>('upcoming')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [edit, setEdit] = useState<Meeting | 'new' | null>(null)
  const [result, setResult] = useState<Meeting | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('ip_meetings').select('*')
      .order('starts_at', { ascending: false }).limit(400)
    if (error) setErr(translateDbError(error.message))
    else setErr('')
    setRows((data as Meeting[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const now = new Date().toISOString()
  const upcoming = rows.filter((r) => r.starts_at >= now && r.status !== 'cancelled')
  const past = rows.filter((r) => r.starts_at < now)
  const noResult = past.filter((r) => !r.outcome && r.status !== 'cancelled')
  const todayCount = rows.filter(
    (r) => r.starts_at.slice(0, 10) === isoDate() && r.status !== 'cancelled').length

  const list = useMemo(() => {
    if (tab === 'upcoming') return [...upcoming].reverse()
    if (tab === 'noresult') return noResult
    return past
  }, [tab, upcoming, past, noResult])

  const nameOf = (uid: string | null) =>
    refs.profiles.find((p) => p.id === uid)?.full_name ?? '—'
  const custOf = (cid: number | null) =>
    customers.find((c) => c.id === cid)?.name ?? null

  async function remove(m: Meeting) {
    if (!confirm(`"${m.title}" o'chirilsinmi?`)) return
    const { error } = await supabase.from('ip_meetings').delete().eq('id', m.id)
    if (error) { setErr(translateDbError(error.message)); return }
    await load()
  }

  if (loading || refs.loading) return <Loading />

  return (
    <div>
      <PageHeader
        title="Uchrashuvlar"
        sub={`${upcoming.length} ta rejalashtirilgan`}
        actions={
          <Button variant="primary" size="sm" onClick={() => setEdit('new')}>
            <Plus size={14} />Uchrashuv
          </Button>
        }
      />

      {err && <div className="mb-4"><ErrorBox>{err}</ErrorBox></div>}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Bugun" value={String(todayCount)} icon={<CalendarDays size={16} />}
              tone={todayCount > 0 ? 'brand' : 'neutral'} />
        <Stat label="Oldinda" value={String(upcoming.length)} />
        <Stat label="Natija yozilmagan" value={String(noResult.length)}
              tone={noResult.length > 0 ? 'warn' : 'ok'}
              sub={noResult.length > 0 ? "Kelishuv yo'qolib ketadi" : undefined} />
        <Stat label="Jami" value={String(rows.length)} />
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {([
          { k: 'upcoming', l: `Oldinda (${upcoming.length})` },
          { k: 'noresult', l: `Natijasiz (${noResult.length})` },
          { k: 'past', l: "O'tgan" },
        ] as { k: Tab; l: string }[]).map((t) => (
          <button
            key={t.k} onClick={() => setTab(t.k)}
            className="rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors"
            style={{
              background: tab === t.k ? 'var(--brand-soft)' : 'var(--surface)',
              color: tab === t.k ? 'var(--brand)' : 'var(--text-2)',
              borderColor: tab === t.k ? 'var(--brand)' : 'var(--border-2)',
            }}
          >
            {t.l}
          </button>
        ))}
      </div>

      <Card pad={false}>
        <div className="p-4">
          {list.length === 0 ? (
            <Empty
              title="Uchrashuv yo'q"
              hint="Mijoz bilan uchrashuvni shu yerga yozasiz — keyin natijasi ham shu yerda qoladi."
              action={<Button variant="primary" onClick={() => setEdit('new')}>
                <Plus size={14} />Uchrashuv
              </Button>}
            />
          ) : (
            <DocTable minWidth={940}>
              <thead>
                <tr>
                  <DocTh w={120}>Sana</DocTh>
                  <DocTh w={80}>Vaqt</DocTh>
                  <DocTh>Mavzu</DocTh>
                  <DocTh w={160}>Mijoz</DocTh>
                  <DocTh w={130}>Joy</DocTh>
                  <DocTh w={130}>Tashkilotchi</DocTh>
                  <DocTh w={120}>Natija</DocTh>
                  <DocTh w={70} align="center" />
                </tr>
              </thead>
              <tbody>
                {list.map((m, i) => {
                  const isPast = m.starts_at < now
                  const tone: RowTone = m.status === 'cancelled' ? 'muted'
                    : isPast && !m.outcome ? 'attention'
                    : isPast ? 'normal' : 'active'
                  return (
                    <DocTr key={m.id} alt={i % 2 === 1} tone={tone}
                           onDoubleClick={() => setEdit(m)}>
                      <DocTd mono>
                        {dateShort(m.starts_at)}
                        <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>
                          {relativeDays(m.starts_at)}
                        </div>
                      </DocTd>
                      <DocTd mono>{timeUz(m.starts_at)}</DocTd>
                      <DocTd>
                        {m.title}
                        {m.description && (
                          <div className="line-clamp-1 text-[11.5px]"
                               style={{ color: 'var(--text-3)' }}>
                            {m.description}
                          </div>
                        )}
                      </DocTd>
                      <DocTd tone="link">{custOf(m.customer_id) ?? '—'}</DocTd>
                      <DocTd tone="muted">{m.location ?? '—'}</DocTd>
                      <DocTd tone="link">{nameOf(m.organizer_id)}</DocTd>
                      <DocTd stopClick>
                        {m.outcome ? (
                          <span className="line-clamp-1" title={m.outcome}>{m.outcome}</span>
                        ) : isPast && m.status !== 'cancelled' ? (
                          <Button size="sm" variant="subtle" onClick={() => setResult(m)}>
                            Yozish
                          </Button>
                        ) : '—'}
                      </DocTd>
                      <DocTd align="center" stopClick>
                        <button title="O'chirish" onClick={() => void remove(m)}
                                style={{ color: 'var(--text-3)' }}>
                          <Trash2 size={13} />
                        </button>
                      </DocTd>
                    </DocTr>
                  )
                })}
              </tbody>
            </DocTable>
          )}
        </div>
      </Card>

      {edit && (
        <MeetingModal
          meeting={edit === 'new' ? null : edit}
          profiles={refs.profiles}
          customers={customers}
          myId={profile?.id ?? ''}
          onClose={() => setEdit(null)}
          onDone={() => { setEdit(null); void load() }}
        />
      )}

      {result && (
        <ResultModal
          meeting={result}
          onClose={() => setResult(null)}
          onDone={() => { setResult(null); void load() }}
        />
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- */

function MeetingModal({
  meeting, profiles, customers, myId, onClose, onDone,
}: {
  meeting: Meeting | null
  profiles: { id: string; full_name: string }[]
  customers: { id: number; name: string }[]
  myId: string
  onClose: () => void
  onDone: () => void
}) {
  const start = meeting?.starts_at ? new Date(meeting.starts_at) : null
  const [title, setTitle] = useState(meeting?.title ?? '')
  const [date, setDate] = useState(start ? start.toISOString().slice(0, 10) : isoDate())
  const [time, setTime] = useState(start
    ? `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`
    : '10:00')
  const [customer, setCustomer] = useState<number | null>(meeting?.customer_id ?? null)
  const [organizer, setOrganizer] = useState(meeting?.organizer_id ?? myId)
  const [location, setLocation] = useState(meeting?.location ?? '')
  const [desc, setDesc] = useState(meeting?.description ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function save() {
    if (!title.trim()) { setErr('Mavzu kiritilmagan'); return }
    setBusy(true); setErr('')
    const starts = new Date(`${date}T${time}:00`)
    const payload = {
      title: title.trim(),
      customer_id: customer,
      organizer_id: organizer || null,
      starts_at: starts.toISOString(),
      ends_at: new Date(starts.getTime() + 60 * 60 * 1000).toISOString(),
      location: location.trim() || null,
      description: desc.trim() || null,
    }
    const { error } = meeting
      ? await supabase.from('ip_meetings').update(payload as never).eq('id', meeting.id)
      : await supabase.from('ip_meetings').insert({
          ...payload, created_by: myId, status: 'planned',
        } as never)
    setBusy(false)
    if (error) { setErr(translateDbError(error.message)); return }
    onDone()
  }

  return (
    <Modal
      open onClose={onClose} width={560}
      title={meeting ? 'Uchrashuvni tahrirlash' : 'Yangi uchrashuv'}
      footer={<>
        <Button onClick={onClose}>Bekor</Button>
        <Button variant="primary" loading={busy} onClick={save}>Saqlash</Button>
      </>}
    >
      <div className="space-y-3">
        <Field label="Mavzu" required>
          <Input value={title} onChange={setTitle}
                 placeholder="Masalan: Gok-Yapi bilan yangi obyekt bo'yicha uchrashuv" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Sana" required><Input type="date" value={date} onChange={setDate} /></Field>
          <Field label="Vaqt" required><Input type="time" value={time} onChange={setTime} /></Field>
          <Field label="Mijoz">
            <Select
              value={customer ?? ''} onChange={(v) => setCustomer(v ? Number(v) : null)}
              placeholder="Bog'lanmagan"
              options={customers.map((c) => ({ value: c.id, label: c.name }))}
            />
          </Field>
          <Field label="Tashkilotchi">
            <Select
              value={organizer} onChange={setOrganizer}
              options={profiles.map((p) => ({ value: p.id, label: p.full_name }))}
            />
          </Field>
        </div>
        <Field label="Joy">
          <Input value={location} onChange={setLocation} placeholder="Ofis, obyekt, onlayn…" />
        </Field>
        <Field label="Tafsilot">
          <Textarea value={desc} onChange={setDesc} rows={3} />
        </Field>
        {err && <ErrorBox>{err}</ErrorBox>}
      </div>
    </Modal>
  )
}

/* ---------------------------------------------------------------- */

function ResultModal({
  meeting, onClose, onDone,
}: { meeting: Meeting; onClose: () => void; onDone: () => void }) {
  const [outcome, setOutcome] = useState('')
  const [cancelled, setCancelled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function save() {
    if (!cancelled && !outcome.trim()) { setErr('Natija yozilmagan'); return }
    setBusy(true); setErr('')
    const { error } = await supabase.from('ip_meetings').update({
      outcome: cancelled ? "Bo'lmadi" : outcome.trim(),
      status: cancelled ? 'cancelled' : 'done',
    } as never).eq('id', meeting.id)
    setBusy(false)
    if (error) { setErr(translateDbError(error.message)); return }
    onDone()
  }

  return (
    <Modal
      open onClose={onClose} width={520} title="Uchrashuv natijasi"
      footer={<>
        <Button onClick={onClose}>Bekor</Button>
        <Button variant="primary" loading={busy} onClick={save}>
          <Check size={14} />Saqlash
        </Button>
      </>}
    >
      <div className="space-y-3">
        <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border-2)' }}>
          <div className="text-[13px] font-medium">{meeting.title}</div>
          <div className="mt-1 flex flex-wrap gap-x-4 text-[12.5px]"
               style={{ color: 'var(--text-3)' }}>
            <span>{dateShort(meeting.starts_at)} · {timeUz(meeting.starts_at)}</span>
            {meeting.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={12} />{meeting.location}
              </span>
            )}
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-[13px]">
          <input type="checkbox" checked={cancelled}
                 onChange={(e) => setCancelled(e.target.checked)} />
          <XIcon size={13} />Uchrashuv bo'lmadi
        </label>

        {!cancelled && (
          <Field label="Nima kelishildi" required>
            <Textarea
              value={outcome} onChange={setOutcome} rows={4}
              placeholder="Masalan: 200 m² gipsokarton bo'yicha narx so'radi, juma kuni taklif yuboriladi"
            />
          </Field>
        )}

        {err && <ErrorBox>{err}</ErrorBox>}
      </div>
    </Modal>
  )
}
