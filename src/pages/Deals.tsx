import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, Handshake, Plus, Trash2, TrendingUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useCustomers, useRefs, translateDbError } from '../lib/useRefs'
import { useWindows } from '../lib/windows'
import {
  Button, Card, Empty, ErrorBox, Field, Input, Loading, Modal,
  PageHeader, Select, Stat, Textarea,
} from '../components/ui'
import { DocTable, DocTd, DocTh, DocTr, type RowTone } from '../components/docList'
import { dateShort, isoDate, money, moneyShort, pct, relativeDays } from '../lib/format'

/**
 * Voronka — hali sotuvga aylanmagan imkoniyatlar.
 * Bosqichlar Sozlamalardagi spravochnikdan keladi, shuning uchun
 * jarayonni o'zingiz o'zgartirishingiz mumkin.
 */

interface Deal {
  id: number
  customer_id: number
  title: string
  stage_id: number | null
  amount: number
  manager_id: string | null
  expected_close: string | null
  probability: number | null
  loss_reason_id: number | null
  won_sale_id: number | null
  closed_at: string | null
  note: string | null
  created_at: string
}

export default function Deals() {
  const { profile, scope } = useAuth()
  const refs = useRefs()
  const { customers } = useCustomers()
  const { open } = useWindows()

  const [rows, setRows] = useState<Deal[]>([])
  const [lossReasons, setLossReasons] = useState<{ id: number; name: string }[]>([])
  const [showClosed, setShowClosed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [edit, setEdit] = useState<Deal | 'new' | null>(null)
  const [closing, setClosing] = useState<{ deal: Deal; won: boolean } | null>(null)

  const load = useCallback(async () => {
    const [d, l] = await Promise.all([
      supabase.from('ip_deals').select('*').order('created_at', { ascending: false }).limit(400),
      supabase.from('ip_loss_reasons').select('id, name').eq('is_active', true).order('sort_order'),
    ])
    if (d.error) setErr(translateDbError(d.error.message))
    else setErr('')
    setRows((d.data as Deal[]) ?? [])
    setLossReasons((l.data as { id: number; name: string }[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const stages = refs.stages
  const openDeals = rows.filter((r) => !r.closed_at)
  const won = rows.filter((r) => r.closed_at && r.won_sale_id)
  const lost = rows.filter((r) => r.closed_at && !r.won_sale_id)

  const pipeline = openDeals.reduce((a, r) => a + Number(r.amount), 0)
  const weighted = openDeals.reduce(
    (a, r) => a + Number(r.amount) * (Number(r.probability ?? 0) / 100), 0)
  const winRate = won.length + lost.length > 0
    ? (won.length / (won.length + lost.length)) * 100 : null

  const byStage = useMemo(() => stages.map((s) => ({
    stage: s,
    deals: openDeals.filter((d) => d.stage_id === s.id),
  })), [stages, openDeals])

  const custOf = (cid: number) => customers.find((c) => c.id === cid)?.name ?? `#${cid}`
  const mgrOf = (uid: string | null) =>
    refs.profiles.find((p) => p.id === uid)?.full_name ?? '—'

  async function moveStage(d: Deal, stageId: number) {
    setErr('')
    const st = stages.find((s) => s.id === stageId)
    const { error } = await supabase.from('ip_deals').update({
      stage_id: stageId,
      probability: st?.probability ?? d.probability,
    } as never).eq('id', d.id)
    if (error) { setErr(translateDbError(error.message)); return }
    await load()
  }

  async function remove(d: Deal) {
    if (!confirm(`"${d.title}" o'chirilsinmi?`)) return
    const { error } = await supabase.from('ip_deals').delete().eq('id', d.id)
    if (error) { setErr(translateDbError(error.message)); return }
    await load()
  }

  if (loading || refs.loading) return <Loading />

  const list = showClosed ? rows.filter((r) => r.closed_at) : openDeals

  return (
    <div>
      <PageHeader
        title="Voronka"
        sub={`${openDeals.length} ta ochiq imkoniyat · ${moneyShort(pipeline)}`}
        actions={
          <Button variant="primary" size="sm" onClick={() => setEdit('new')}>
            <Plus size={14} />Imkoniyat
          </Button>
        }
      />

      {err && <div className="mb-4"><ErrorBox>{err}</ErrorBox></div>}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Voronkada" value={moneyShort(pipeline)} icon={<Handshake size={16} />}
              tone="brand" sub={`${openDeals.length} ta imkoniyat`} />
        <Stat label="Ehtimollik bilan" value={moneyShort(weighted)}
              icon={<TrendingUp size={16} />}
              sub="Har biri o'z foiziga ko'paytirilgan" />
        <Stat label="Yutilgan" value={String(won.length)} tone="ok"
              sub={won.length > 0 ? moneyShort(won.reduce((a, r) => a + Number(r.amount), 0)) : undefined} />
        <Stat label="Yutish darajasi" value={winRate != null ? pct(winRate) : '—'}
              tone={winRate == null ? 'neutral' : winRate >= 50 ? 'ok' : 'warn'}
              sub={`${lost.length} ta yo'qotilgan`} />
      </div>

      {/* Bosqichlar bo'yicha qisqacha */}
      {!showClosed && stages.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {byStage.map(({ stage, deals }) => {
            const sum = deals.reduce((a, d) => a + Number(d.amount), 0)
            return (
              <div
                key={stage.id}
                className="min-w-[150px] flex-1 rounded-lg border px-3 py-2"
                style={{
                  background: 'var(--surface)',
                  borderColor: deals.length > 0 ? 'var(--border-2)' : 'var(--border)',
                }}
              >
                <div className="flex items-center gap-1.5 text-[12px] font-medium"
                     style={{ color: 'var(--text-2)' }}>
                  <span className="inline-block h-2 w-2 rounded-full"
                        style={{ background: stage.color ?? 'var(--brand)' }} />
                  {stage.name}
                </div>
                <div className="tnum mt-0.5 text-[16px] font-semibold">{deals.length}</div>
                <div className="tnum text-[11.5px]" style={{ color: 'var(--text-3)' }}>
                  {sum > 0 ? moneyShort(sum) : '—'}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-1.5">
        {([
          { k: false, l: `Ochiq (${openDeals.length})` },
          { k: true, l: `Yopilgan (${won.length + lost.length})` },
        ] as { k: boolean; l: string }[]).map((t) => (
          <button
            key={String(t.k)} onClick={() => setShowClosed(t.k)}
            className="rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors"
            style={{
              background: showClosed === t.k ? 'var(--brand-soft)' : 'var(--surface)',
              color: showClosed === t.k ? 'var(--brand)' : 'var(--text-2)',
              borderColor: showClosed === t.k ? 'var(--brand)' : 'var(--border-2)',
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
              title="Imkoniyat yo'q"
              hint="Mijoz qiziqish bildirdi, lekin hali sotuv bo'lmadi — shuni shu yerga yozasiz."
              action={<Button variant="primary" onClick={() => setEdit('new')}>
                <Plus size={14} />Imkoniyat
              </Button>}
            />
          ) : (
            <DocTable minWidth={1040}>
              <thead>
                <tr>
                  <DocTh>Imkoniyat</DocTh>
                  <DocTh w={170}>Mijoz</DocTh>
                  <DocTh w={190}>Bosqich</DocTh>
                  <DocTh w={130} align="right">Summa</DocTh>
                  <DocTh w={80} align="right">Ehtimol</DocTh>
                  <DocTh w={115}>Kutilgan</DocTh>
                  <DocTh w={120}>Menejer</DocTh>
                  <DocTh w={110} align="center" />
                </tr>
              </thead>
              <tbody>
                {list.map((d, i) => {
                  const st = stages.find((s) => s.id === d.stage_id)
                  const late = !d.closed_at && d.expected_close
                    && d.expected_close < isoDate()
                  const tone: RowTone = d.closed_at
                    ? (d.won_sale_id ? 'normal' : 'muted')
                    : late ? 'attention' : 'active'
                  return (
                    <DocTr key={d.id} alt={i % 2 === 1} tone={tone}
                           onDoubleClick={() => setEdit(d)}>
                      <DocTd>
                        {d.title}
                        {d.closed_at && (
                          <div className="text-[11px]"
                               style={{ color: d.won_sale_id ? 'var(--ok)' : 'var(--danger)' }}>
                            {d.won_sale_id ? 'Yutildi' : "Yo'qotildi"}
                            {!d.won_sale_id && d.loss_reason_id && (
                              <> · {lossReasons.find((l) => l.id === d.loss_reason_id)?.name}</>
                            )}
                          </div>
                        )}
                      </DocTd>
                      <DocTd tone="link">{custOf(d.customer_id)}</DocTd>
                      <DocTd stopClick>
                        {d.closed_at ? (
                          <span style={{ color: 'var(--text-3)' }}>{st?.name ?? '—'}</span>
                        ) : (
                          <Select
                            value={d.stage_id ?? ''} className="h-[28px] py-0 text-[12.5px]"
                            onChange={(v) => v && void moveStage(d, Number(v))}
                            options={stages.map((s) => ({ value: s.id, label: s.name }))}
                          />
                        )}
                      </DocTd>
                      <DocTd align="right" mono>{money(d.amount, false)}</DocTd>
                      <DocTd align="right" mono tone="muted">
                        {d.probability != null ? `${Number(d.probability)}%` : '—'}
                      </DocTd>
                      <DocTd mono tone={late ? 'danger' : 'normal'}>
                        {d.expected_close ? (
                          <>
                            {dateShort(d.expected_close)}
                            <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>
                              {relativeDays(d.expected_close)}
                            </div>
                          </>
                        ) : '—'}
                      </DocTd>
                      <DocTd tone="link">{mgrOf(d.manager_id)}</DocTd>
                      <DocTd align="center" stopClick>
                        {d.closed_at ? (
                          d.won_sale_id ? (
                            <Button size="sm" variant="ghost" onClick={() => open({
                              kind: 'sale', key: `sale:${d.won_sale_id}`,
                              title: 'Sotuv', params: { id: d.won_sale_id },
                            })}>
                              Sotuv
                            </Button>
                          ) : (
                            <button title="O'chirish" onClick={() => void remove(d)}
                                    style={{ color: 'var(--text-3)' }}>
                              <Trash2 size={13} />
                            </button>
                          )
                        ) : (
                          <span className="flex justify-center gap-1">
                            <Button size="sm" variant="subtle"
                                    onClick={() => setClosing({ deal: d, won: true })}>
                              Yutildi
                            </Button>
                            <Button size="sm" variant="ghost"
                                    onClick={() => setClosing({ deal: d, won: false })}>
                              <ArrowRight size={13} />
                            </Button>
                          </span>
                        )}
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
        <DealModal
          deal={edit === 'new' ? null : edit}
          stages={stages}
          profiles={refs.profiles}
          customers={customers}
          myId={profile?.id ?? ''}
          canAssign={scope === 'all'}
          onClose={() => setEdit(null)}
          onDone={() => { setEdit(null); void load() }}
        />
      )}

      {closing && (
        <CloseModal
          deal={closing.deal} won={closing.won} lossReasons={lossReasons}
          customerName={custOf(closing.deal.customer_id)}
          onClose={() => setClosing(null)}
          onDone={() => { setClosing(null); void load() }}
        />
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- */

function DealModal({
  deal, stages, profiles, customers, myId, canAssign, onClose, onDone,
}: {
  deal: Deal | null
  stages: { id: number; name: string; probability: number | null }[]
  profiles: { id: string; full_name: string }[]
  customers: { id: number; name: string }[]
  myId: string
  canAssign: boolean
  onClose: () => void
  onDone: () => void
}) {
  const [title, setTitle] = useState(deal?.title ?? '')
  const [customer, setCustomer] = useState<number | null>(deal?.customer_id ?? null)
  const [stage, setStage] = useState<number | null>(deal?.stage_id ?? stages[0]?.id ?? null)
  const [amount, setAmount] = useState(deal ? String(deal.amount) : '')
  const [manager, setManager] = useState(deal?.manager_id ?? myId)
  const [close, setClose] = useState(deal?.expected_close ?? '')
  const [note, setNote] = useState(deal?.note ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function save() {
    if (!title.trim()) { setErr('Nomi kiritilmagan'); return }
    if (!customer) { setErr('Mijoz tanlanmagan'); return }
    setBusy(true); setErr('')
    const st = stages.find((s) => s.id === stage)
    const payload = {
      title: title.trim(),
      customer_id: customer,
      stage_id: stage,
      amount: Number(amount) || 0,
      probability: st?.probability ?? null,
      manager_id: manager || null,
      expected_close: close || null,
      note: note.trim() || null,
    }
    const { error } = deal
      ? await supabase.from('ip_deals').update(payload as never).eq('id', deal.id)
      : await supabase.from('ip_deals').insert({
          ...payload, created_by: myId, currency: 'UZS', source: 'manual',
        } as never)
    setBusy(false)
    if (error) { setErr(translateDbError(error.message)); return }
    onDone()
  }

  return (
    <Modal
      open onClose={onClose} width={560}
      title={deal ? 'Imkoniyatni tahrirlash' : 'Yangi imkoniyat'}
      footer={<>
        <Button onClick={onClose}>Bekor</Button>
        <Button variant="primary" loading={busy} onClick={save}>Saqlash</Button>
      </>}
    >
      <div className="space-y-3">
        <Field label="Nomi" required>
          <Input value={title} onChange={setTitle}
                 placeholder="Masalan: Yangi turar-joy obyekti — gipsokarton" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Mijoz" required>
            <Select
              value={customer ?? ''} onChange={(v) => setCustomer(v ? Number(v) : null)}
              placeholder="Tanlang…"
              options={customers.map((c) => ({ value: c.id, label: c.name }))}
            />
          </Field>
          <Field label="Bosqich">
            <Select
              value={stage ?? ''} onChange={(v) => setStage(v ? Number(v) : null)}
              options={stages.map((s) => ({ value: s.id, label: s.name }))}
            />
          </Field>
          <Field label="Taxminiy summa">
            <Input type="number" value={amount} onChange={setAmount} />
          </Field>
          <Field label="Kutilgan sana">
            <Input type="date" value={close} onChange={setClose} />
          </Field>
          <Field label="Menejer">
            <Select
              value={manager} onChange={setManager} disabled={!canAssign}
              options={profiles.map((p) => ({ value: p.id, label: p.full_name }))}
            />
          </Field>
        </div>
        <Field label="Izoh">
          <Textarea value={note} onChange={setNote} rows={3} />
        </Field>
        {err && <ErrorBox>{err}</ErrorBox>}
      </div>
    </Modal>
  )
}

/* ---------------------------------------------------------------- */

function CloseModal({
  deal, won, lossReasons, customerName, onClose, onDone,
}: {
  deal: Deal
  won: boolean
  lossReasons: { id: number; name: string }[]
  customerName: string
  onClose: () => void
  onDone: () => void
}) {
  const [reason, setReason] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function save() {
    if (!won && !reason) { setErr('Sabab tanlanmagan'); return }
    setBusy(true); setErr('')
    const { error } = await supabase.from('ip_deals').update({
      closed_at: new Date().toISOString(),
      loss_reason_id: won ? null : reason,
      note: note.trim() ? `${deal.note ? deal.note + '\n' : ''}${note.trim()}` : deal.note,
    } as never).eq('id', deal.id)
    setBusy(false)
    if (error) { setErr(translateDbError(error.message)); return }
    onDone()
  }

  return (
    <Modal
      open onClose={onClose} width={480}
      title={won ? 'Imkoniyat yutildi' : "Imkoniyat yo'qotildi"}
      footer={<>
        <Button onClick={onClose}>Bekor</Button>
        <Button variant={won ? 'primary' : 'danger'} loading={busy} onClick={save}>
          Yopish
        </Button>
      </>}
    >
      <div className="space-y-3">
        <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border-2)' }}>
          <div className="text-[13px] font-medium">{deal.title}</div>
          <div className="mt-0.5 text-[12.5px]" style={{ color: 'var(--text-3)' }}>
            {customerName} · {money(deal.amount)}
          </div>
        </div>

        {won ? (
          <p className="text-[13px]" style={{ color: 'var(--text-2)' }}>
            Imkoniyat yopiladi. Sotuvni Sotuv bo'limidan rasmiylashtirasiz —
            keyin shu imkoniyatga bog'lanadi.
          </p>
        ) : (
          <Field label="Nega yo'qotildi" required>
            <Select
              value={reason ?? ''} onChange={(v) => setReason(v ? Number(v) : null)}
              placeholder="Tanlang…"
              options={lossReasons.map((l) => ({ value: l.id, label: l.name }))}
            />
          </Field>
        )}

        <Field label="Izoh">
          <Textarea value={note} onChange={setNote} rows={3} />
        </Field>
        {err && <ErrorBox>{err}</ErrorBox>}
      </div>
    </Modal>
  )
}
