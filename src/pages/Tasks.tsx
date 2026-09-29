import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, CheckSquare, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useCustomers, useRefs, translateDbError } from '../lib/useRefs'
import { useWindows } from '../lib/windows'
import {
  Button, Card, Empty, ErrorBox, Field, Input, Loading, Modal,
  PageHeader, Select, Stat, Textarea,
} from '../components/ui'
import { DocTable, DocTd, DocTh, DocTr, type RowTone } from '../components/docList'
import { dateShort, isoDate, relativeDays } from '../lib/format'

/**
 * Vazifalar — kimga nima topshirilgani va muddati.
 * Mijozga bog'lansa, vazifadan to'g'ri mijoz kartochkasiga o'tiladi.
 */

interface Task {
  id: number
  title: string
  description: string | null
  assignee_id: string | null
  created_by: string | null
  due_at: string | null
  priority: number
  status: string
  customer_id: number | null
  sale_id: number | null
  source: string
  completed_at: string | null
  created_at: string
}

const PRIORITY: Record<number, { label: string; tone: RowTone }> = {
  1: { label: 'Shoshilinch', tone: 'attention' },
  2: { label: 'Oddiy', tone: 'normal' },
  3: { label: 'Past', tone: 'muted' },
}

type Tab = 'mine' | 'all' | 'done'

export default function Tasks() {
  const { profile, can, scope } = useAuth()
  const refs = useRefs()
  const { customers } = useCustomers()
  const { open } = useWindows()

  const [rows, setRows] = useState<Task[]>([])
  const [tab, setTab] = useState<Tab>('mine')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [edit, setEdit] = useState<Task | 'new' | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('ip_tasks').select('*')
      .order('status').order('due_at', { nullsFirst: false }).limit(500)
    if (error) setErr(translateDbError(error.message))
    else setErr('')
    setRows((data as Task[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const today = isoDate()
  const openRows = rows.filter((r) => r.status !== 'done' && r.status !== 'cancelled')
  const mine = openRows.filter((r) => r.assignee_id === profile?.id)
  const overdue = openRows.filter((r) => r.due_at && r.due_at.slice(0, 10) < today)
  const dueToday = openRows.filter((r) => r.due_at && r.due_at.slice(0, 10) === today)

  const list = useMemo(() => {
    if (tab === 'mine') return mine
    if (tab === 'done') return rows.filter((r) => r.status === 'done' || r.status === 'cancelled')
    return openRows
  }, [tab, mine, openRows, rows])

  const nameOf = (uid: string | null) =>
    refs.profiles.find((p) => p.id === uid)?.full_name ?? '—'
  const custOf = (cid: number | null) =>
    customers.find((c) => c.id === cid)?.name ?? null

  async function setStatus(t: Task, status: string) {
    setErr('')
    const { error } = await supabase.from('ip_tasks').update({
      status,
      completed_at: status === 'done' ? new Date().toISOString() : null,
    } as never).eq('id', t.id)
    if (error) { setErr(translateDbError(error.message)); return }
    await load()
  }

  async function remove(t: Task) {
    if (!confirm(`"${t.title}" o'chirilsinmi?`)) return
    const { error } = await supabase.from('ip_tasks').delete().eq('id', t.id)
    if (error) { setErr(translateDbError(error.message)); return }
    await load()
  }

  if (loading || refs.loading) return <Loading />

  return (
    <div>
      <PageHeader
        title="Vazifalar"
        sub={`${openRows.length} ta ochiq${overdue.length ? ` · ${overdue.length} ta muddati o'tgan` : ''}`}
        actions={
          <Button variant="primary" size="sm" onClick={() => setEdit('new')}>
            <Plus size={14} />Vazifa
          </Button>
        }
      />

      {err && <div className="mb-4"><ErrorBox>{err}</ErrorBox></div>}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Menda" value={String(mine.length)} icon={<CheckSquare size={16} />}
              tone={mine.length > 0 ? 'brand' : 'ok'} />
        <Stat label="Bugun" value={String(dueToday.length)}
              tone={dueToday.length > 0 ? 'warn' : 'ok'} />
        <Stat label="Muddati o'tgan" value={String(overdue.length)}
              tone={overdue.length > 0 ? 'danger' : 'ok'}
              icon={overdue.length > 0 ? <AlertTriangle size={16} /> : undefined} />
        <Stat label="Jami ochiq" value={String(openRows.length)} />
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {([
          { k: 'mine', l: `Menda (${mine.length})` },
          { k: 'all', l: `Hammasi (${openRows.length})` },
          { k: 'done', l: 'Bajarilgan' },
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
              title={tab === 'done' ? 'Bajarilgan vazifa yo\'q' : 'Vazifa yo\'q'}
              hint="Topshiriqni shu yerdan berasiz — kimga, qachongacha va nima uchun."
              action={tab !== 'done'
                ? <Button variant="primary" onClick={() => setEdit('new')}>
                    <Plus size={14} />Vazifa
                  </Button>
                : undefined}
            />
          ) : (
            <DocTable minWidth={900}>
              <thead>
                <tr>
                  <DocTh w={34} align="center" />
                  <DocTh>Vazifa</DocTh>
                  <DocTh w={140}>Kimga</DocTh>
                  <DocTh w={150}>Mijoz</DocTh>
                  <DocTh w={110}>Muddat</DocTh>
                  <DocTh w={100}>Muhimlik</DocTh>
                  <DocTh w={70} align="center" />
                </tr>
              </thead>
              <tbody>
                {list.map((t, i) => {
                  const late = t.due_at && t.due_at.slice(0, 10) < today
                    && t.status !== 'done' && t.status !== 'cancelled'
                  const pr = PRIORITY[t.priority] ?? PRIORITY[2]
                  const done = t.status === 'done'
                  const tone: RowTone = done || t.status === 'cancelled' ? 'muted'
                    : late ? 'attention' : pr.tone
                  const cust = custOf(t.customer_id)
                  return (
                    <DocTr key={t.id} alt={i % 2 === 1} tone={tone}
                           onDoubleClick={() => setEdit(t)}>
                      <DocTd align="center" stopClick>
                        <input
                          type="checkbox" checked={done}
                          onChange={() => void setStatus(t, done ? 'open' : 'done')}
                          title={done ? 'Ochiq qilish' : 'Bajarildi'}
                        />
                      </DocTd>
                      <DocTd>
                        <span style={{ textDecoration: done ? 'line-through' : undefined }}>
                          {t.title}
                        </span>
                        {t.description && (
                          <div className="line-clamp-1 text-[11.5px]"
                               style={{ color: 'var(--text-3)' }}>
                            {t.description}
                          </div>
                        )}
                        {t.source === 'ai' && (
                          <span className="ml-1 text-[11px]" style={{ color: 'var(--brand)' }}>
                            AI tavsiyasi
                          </span>
                        )}
                      </DocTd>
                      <DocTd tone="link">{nameOf(t.assignee_id)}</DocTd>
                      <DocTd stopClick>
                        {cust ? (
                          <a href={`/customers?open=${t.customer_id}`}
                             style={{ color: 'var(--brand)' }} className="hover:underline">
                            {cust}
                          </a>
                        ) : '—'}
                      </DocTd>
                      <DocTd mono tone={late ? 'danger' : 'normal'}>
                        {t.due_at ? (
                          <>
                            {dateShort(t.due_at)}
                            <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>
                              {relativeDays(t.due_at)}
                            </div>
                          </>
                        ) : '—'}
                      </DocTd>
                      <DocTd>{pr.label}</DocTd>
                      <DocTd align="center" stopClick>
                        <span className="flex justify-center gap-1">
                          {t.sale_id && (
                            <button
                              title="Sotuvni ochish"
                              onClick={() => open({
                                kind: 'sale', key: `sale:${t.sale_id}`,
                                title: 'Sotuv', params: { id: t.sale_id },
                              })}
                              style={{ color: 'var(--text-3)' }}
                            >
                              <Check size={13} />
                            </button>
                          )}
                          {(t.created_by === profile?.id || scope === 'all') && (
                            <button title="O'chirish" onClick={() => void remove(t)}
                                    style={{ color: 'var(--text-3)' }}>
                              <Trash2 size={13} />
                            </button>
                          )}
                        </span>
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
        <TaskModal
          task={edit === 'new' ? null : edit}
          profiles={refs.profiles}
          customers={customers}
          myId={profile?.id ?? ''}
          canAssignOthers={scope === 'all' || can('customers.assign')}
          onClose={() => setEdit(null)}
          onDone={() => { setEdit(null); void load() }}
        />
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- */

function TaskModal({
  task, profiles, customers, myId, canAssignOthers, onClose, onDone,
}: {
  task: Task | null
  profiles: { id: string; full_name: string }[]
  customers: { id: number; name: string }[]
  myId: string
  canAssignOthers: boolean
  onClose: () => void
  onDone: () => void
}) {
  const [title, setTitle] = useState(task?.title ?? '')
  const [desc, setDesc] = useState(task?.description ?? '')
  const [assignee, setAssignee] = useState(task?.assignee_id ?? myId)
  const [due, setDue] = useState(task?.due_at ? task.due_at.slice(0, 10) : '')
  const [priority, setPriority] = useState(String(task?.priority ?? 2))
  const [customer, setCustomer] = useState<number | null>(task?.customer_id ?? null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function save() {
    if (!title.trim()) { setErr('Sarlavha kiritilmagan'); return }
    setBusy(true); setErr('')
    const payload = {
      title: title.trim(),
      description: desc.trim() || null,
      assignee_id: assignee || null,
      due_at: due ? new Date(`${due}T18:00:00`).toISOString() : null,
      priority: Number(priority),
      customer_id: customer,
    }
    const { error } = task
      ? await supabase.from('ip_tasks').update(payload as never).eq('id', task.id)
      : await supabase.from('ip_tasks').insert({
          ...payload, created_by: myId, status: 'open', source: 'manual',
        } as never)
    setBusy(false)
    if (error) { setErr(translateDbError(error.message)); return }
    onDone()
  }

  return (
    <Modal
      open onClose={onClose} width={560}
      title={task ? 'Vazifani tahrirlash' : 'Yangi vazifa'}
      footer={<>
        <Button onClick={onClose}>Bekor</Button>
        <Button variant="primary" loading={busy} onClick={save}>Saqlash</Button>
      </>}
    >
      <div className="space-y-3">
        <Field label="Nima qilish kerak" required>
          <Input value={title} onChange={setTitle}
                 placeholder="Masalan: Discover Invest bilan qarz bo'yicha gaplashish" />
        </Field>
        <Field label="Tafsilot">
          <Textarea value={desc} onChange={setDesc} rows={3} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Kimga">
            <Select
              value={assignee} onChange={setAssignee}
              disabled={!canAssignOthers}
              options={profiles.map((p) => ({ value: p.id, label: p.full_name }))}
            />
          </Field>
          <Field label="Muddat">
            <Input type="date" value={due} onChange={setDue} />
          </Field>
          <Field label="Muhimlik">
            <Select
              value={priority} onChange={setPriority}
              options={[
                { value: '1', label: 'Shoshilinch' },
                { value: '2', label: 'Oddiy' },
                { value: '3', label: 'Past' },
              ]}
            />
          </Field>
          <Field label="Mijoz" hint="Ixtiyoriy">
            <Select
              value={customer ?? ''} onChange={(v) => setCustomer(v ? Number(v) : null)}
              placeholder="Bog'lanmagan"
              options={customers.map((c) => ({ value: c.id, label: c.name }))}
            />
          </Field>
        </div>
        {err && <ErrorBox>{err}</ErrorBox>}
      </div>
    </Modal>
  )
}
