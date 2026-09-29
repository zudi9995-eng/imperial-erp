import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Clock, ShieldCheck, X as XIcon } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useWindows, useSignal } from '../lib/windows'
import {
  Button, Card, Empty, ErrorBox, Field, InfoBox, Loading, Modal,
  PageHeader, Stat, Textarea,
} from '../components/ui'
import { DocTable, DocTd, DocTh, DocTr, type RowTone } from '../components/docList'
import { dateShort, dateTimeUz, money, pct } from '../lib/format'
import { translateDbError } from '../lib/useRefs'

/**
 * Tasdiqlash — marja yoki limitdan oshgan sotuvlar shu yerda hal
 * qilinadi. Tasdiqlansa hujjat darhol o'tkaziladi va tovar ombordan
 * yechiladi; rad etilsa qoralama bo'lib qoladi, menejer narxni
 * tuzatib qayta yuboradi.
 */

interface Row {
  id: number
  doc_type: string
  doc_id: number
  reason: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  decided_at: string | null
  comment: string | null
  requested_by_name: string | null
  decided_by_name: string | null
  doc_no: string | null
  doc_date: string | null
  customer_id: number | null
  customer_name: string | null
  total_base: number | null
  amount_ex_vat_base: number | null
  margin_pct: number | null
  min_margin_pct: number | null
  doc_status: string | null
  manager_name: string | null
  waiting_hours: number | null
}

type Tab = 'pending' | 'done'

export default function Approvals() {
  const { can } = useAuth()
  const { open } = useWindows()
  const sig = useSignal('approvals')
  const salesSig = useSignal('sales')

  const [rows, setRows] = useState<Row[]>([])
  const [tab, setTab] = useState<Tab>('pending')
  const [sel, setSel] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [decide, setDecide] = useState<{ row: Row; approve: boolean } | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('ip_approvals_board')
      .select('*').order('created_at', { ascending: false }).limit(300)
    if (error) setErr(translateDbError(error.message))
    else setErr('')
    setRows((data as Row[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load, sig, salesSig])

  const pending = useMemo(() => rows.filter((r) => r.status === 'pending'), [rows])
  const done = useMemo(() => rows.filter((r) => r.status !== 'pending'), [rows])
  const list = tab === 'pending' ? pending : done
  const current = rows.find((r) => r.id === sel) ?? null

  const waitingLong = pending.filter((r) => Number(r.waiting_hours ?? 0) > 24).length
  const totalPending = pending.reduce((a, r) => a + Number(r.total_base ?? 0), 0)

  if (loading) return <Loading />

  if (!can('approvals.decide') && pending.length === 0 && done.length === 0) {
    return (
      <div>
        <PageHeader title="Tasdiqlash" sub="Marja yoki limitdan oshgan hujjatlar" />
        <Empty
          title="So'rov yo'q"
          hint="Marja eng past chegaradan pastga tushsa yoki summa limitdan oshsa, hujjat shu yerga tushadi."
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Tasdiqlash"
        sub={`${pending.length} ta so'rov kutmoqda`}
      />

      {err && <div className="mb-4"><ErrorBox>{err}</ErrorBox></div>}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Stat
          label="Kutayotgan" value={String(pending.length)}
          tone={pending.length > 0 ? 'warn' : 'ok'}
          icon={<Clock size={16} />}
          sub={pending.length > 0 ? money(totalPending, false) : 'Hammasi hal qilingan'}
        />
        <Stat
          label="Bir kundan ortiq kutayotgan" value={String(waitingLong)}
          tone={waitingLong > 0 ? 'danger' : 'ok'}
          sub={waitingLong > 0 ? 'Menejer ishlay olmayapti' : undefined}
        />
        <Stat label="Hal qilingan" value={String(done.length)} icon={<ShieldCheck size={16} />} />
      </div>

      {pending.length > 0 && (
        <div className="mb-4">
          <InfoBox tone="warn">
            Kutayotgan hujjatda <b>tovar ombordan yechilmaydi</b> va mijoz qarzi
            yozilmaydi. Qaror qabul qilinmaguncha sotuv haqiqiy hisoblanmaydi.
          </InfoBox>
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-1.5">
        {([
          { k: 'pending', l: `Kutmoqda (${pending.length})` },
          { k: 'done', l: `Hal qilingan (${done.length})` },
        ] as { k: Tab; l: string }[]).map((t) => (
          <button
            key={t.k} onClick={() => { setTab(t.k); setSel(null) }}
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
              title={tab === 'pending' ? "Kutayotgan so'rov yo'q" : 'Tarix bo\'sh'}
              hint={tab === 'pending'
                ? 'Hamma hujjat hal qilingan.'
                : 'Hal qilingan so\'rovlar shu yerda saqlanadi.'}
            />
          ) : (
            <DocTable minWidth={1080}>
              <thead>
                <tr>
                  <DocTh w={95}>Sana</DocTh>
                  <DocTh w={120}>Hujjat</DocTh>
                  <DocTh>Mijoz</DocTh>
                  <DocTh w={130} align="right">Summa</DocTh>
                  <DocTh w={90} align="right">Marja</DocTh>
                  <DocTh>Sabab</DocTh>
                  <DocTh w={120}>So'ragan</DocTh>
                  <DocTh w={110}>Holat</DocTh>
                </tr>
              </thead>
              <tbody>
                {list.map((r, i) => {
                  const tone: RowTone = r.status === 'pending' ? 'attention'
                    : r.status === 'rejected' ? 'muted' : 'normal'
                  const low = r.margin_pct != null && r.min_margin_pct != null
                    && Number(r.margin_pct) < Number(r.min_margin_pct)
                  return (
                    <DocTr
                      key={r.id} alt={i % 2 === 1} tone={tone}
                      selected={sel === r.id}
                      onClick={() => setSel(sel === r.id ? null : r.id)}
                      onDoubleClick={() => r.doc_id && open({
                        kind: 'sale', key: `sale:${r.doc_id}`,
                        title: `Sotuv · ${r.customer_name ?? ''}`.slice(0, 30),
                        params: { id: r.doc_id },
                      })}
                    >
                      <DocTd mono>{r.doc_date ? dateShort(r.doc_date) : '—'}</DocTd>
                      <DocTd mono tone="link">{r.doc_no ?? `#${r.doc_id}`}</DocTd>
                      <DocTd tone="link">{r.customer_name ?? '—'}</DocTd>
                      <DocTd align="right" mono>{money(r.total_base ?? 0, false)}</DocTd>
                      <DocTd align="right" mono tone={low ? 'danger' : 'normal'}>
                        {r.margin_pct != null ? pct(r.margin_pct) : '—'}
                        {r.min_margin_pct != null && (
                          <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>
                            min {pct(r.min_margin_pct)}
                          </div>
                        )}
                      </DocTd>
                      <DocTd>
                        <span className="text-[12.5px]">{r.reason ?? '—'}</span>
                      </DocTd>
                      <DocTd tone="link">{r.requested_by_name ?? '—'}</DocTd>
                      <DocTd>
                        {r.status === 'pending' ? (
                          <span>
                            Kutmoqda
                            <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>
                              {Math.round(Number(r.waiting_hours ?? 0))} soat
                            </div>
                          </span>
                        ) : r.status === 'approved' ? (
                          <span style={{ color: 'var(--ok)' }}>Tasdiqlandi</span>
                        ) : (
                          <span style={{ color: 'var(--danger)' }}>Rad etildi</span>
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

      {current && (
        <Card className="mt-3">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-[260px] flex-1">
              <div className="mb-1 text-[13px] font-semibold">
                {current.doc_no ?? `#${current.doc_id}`} · {current.customer_name}
              </div>
              <div className="text-[13px]" style={{ color: 'var(--text-2)' }}>
                {current.reason}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[12.5px]"
                   style={{ color: 'var(--text-3)' }}>
                <span>So'radi: {current.requested_by_name ?? '—'}</span>
                <span>{dateTimeUz(current.created_at)}</span>
                {current.manager_name && <span>Menejer: {current.manager_name}</span>}
              </div>
              {current.status !== 'pending' && (
                <div className="mt-2 text-[12.5px]" style={{ color: 'var(--text-3)' }}>
                  {current.decided_by_name} ·{' '}
                  {current.decided_at ? dateTimeUz(current.decided_at) : ''}
                  {current.comment && (
                    <div style={{ color: 'var(--text-2)' }}>«{current.comment}»</div>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" onClick={() => open({
                kind: 'sale', key: `sale:${current.doc_id}`,
                title: `Sotuv · ${current.customer_name ?? ''}`.slice(0, 30),
                params: { id: current.doc_id },
              })}>
                Hujjatni ochish
              </Button>
              {current.status === 'pending' && can('approvals.decide') && (
                <>
                  <Button size="sm" variant="primary"
                          onClick={() => setDecide({ row: current, approve: true })}>
                    <Check size={14} />Tasdiqlash
                  </Button>
                  <Button size="sm" variant="danger"
                          onClick={() => setDecide({ row: current, approve: false })}>
                    <XIcon size={14} />Rad etish
                  </Button>
                </>
              )}
            </div>
          </div>
        </Card>
      )}

      {decide && (
        <DecideModal
          row={decide.row} approve={decide.approve}
          onClose={() => setDecide(null)}
          onDone={() => { setDecide(null); setSel(null); void load() }}
        />
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- */

function DecideModal({
  row, approve, onClose, onDone,
}: { row: Row; approve: boolean; onClose: () => void; onDone: () => void }) {
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function submit() {
    setBusy(true); setErr('')
    const { error } = await supabase.rpc('ip_decide_approval', {
      p_id: row.id, p_approve: approve, p_comment: comment.trim() || null,
    })
    setBusy(false)
    if (error) { setErr(translateDbError(error.message)); return }
    onDone()
  }

  return (
    <Modal
      open onClose={onClose} width={520}
      title={approve ? 'Tasdiqlash' : 'Rad etish'}
      footer={<>
        <Button onClick={onClose}>Bekor</Button>
        <Button
          variant={approve ? 'primary' : 'danger'} loading={busy} onClick={submit}
          disabled={!approve && !comment.trim()}
        >
          {approve ? <Check size={14} /> : <XIcon size={14} />}
          {approve ? 'Tasdiqlash' : 'Rad etish'}
        </Button>
      </>}
    >
      <div className="space-y-3">
        <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border-2)' }}>
          <div className="text-[13px] font-medium">
            {row.doc_no ?? `#${row.doc_id}`} · {row.customer_name}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px]"
               style={{ color: 'var(--text-2)' }}>
            <span>Summa: <b>{money(row.total_base ?? 0)}</b></span>
            {row.margin_pct != null && <span>Marja: <b>{pct(row.margin_pct)}</b></span>}
          </div>
          <div className="mt-1.5 text-[12.5px]" style={{ color: 'var(--warn)' }}>
            {row.reason}
          </div>
        </div>

        {approve ? (
          <InfoBox tone="warn">
            Tasdiqlansa hujjat <b>darhol o'tkaziladi</b>: tovar ombordan yechiladi,
            mijoz qarzi yoziladi. Buni orqaga qaytarib bo'lmaydi.
          </InfoBox>
        ) : (
          <InfoBox>
            Rad etilsa hujjat <b>qoralama</b> bo'lib qoladi. Menejer narxni tuzatib
            qayta yuborishi mumkin — sabab yozib bering.
          </InfoBox>
        )}

        <Field label="Izoh" required={!approve} hint={approve ? 'Ixtiyoriy' : undefined}>
          <Textarea
            value={comment} onChange={setComment} rows={3}
            placeholder={approve
              ? 'Masalan: doimiy mijoz, hajm uchun chegirma kelishilgan'
              : 'Nega rad etilayotganini yozing — menejer shuni ko\'radi'}
          />
        </Field>

        {err && <ErrorBox>{err}</ErrorBox>}
      </div>
    </Modal>
  )
}
