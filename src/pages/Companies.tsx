import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Ban, Building2, Check, Clock, PauseCircle, Play, Trash2,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import {
  Button, Card, Empty, ErrorBox, Field, InfoBox, Loading, Modal,
  PageHeader, Stat, Textarea,
} from '../components/ui'
import { DocTable, DocTd, DocTh, DocTr, type RowTone } from '../components/docList'
import { dateShort, dateTimeUz } from '../lib/format'
import { translateDbError } from '../lib/useRefs'

/**
 * Kompaniyalar — faqat platforma egasiga ko'rinadi.
 * Ariza tasdiqlansa kompaniya jihozlanadi va ta'sischi ishlay boshlaydi.
 */

interface Company {
  id: number
  name: string
  inn: string | null
  phone: string | null
  email: string | null
  status: 'pending' | 'active' | 'suspended' | 'rejected'
  plan: string
  reject_reason: string | null
  approved_at: string | null
  created_at: string
}

const STATUS: Record<string, { label: string; tone: RowTone }> = {
  pending:   { label: 'Kutmoqda',       tone: 'attention' },
  active:    { label: 'Faol',           tone: 'normal' },
  suspended: { label: "To'xtatilgan",   tone: 'muted' },
  rejected:  { label: 'Rad etilgan',    tone: 'muted' },
}

export default function Companies() {
  const { isPlatformAdmin, company: mine } = useAuth()
  const [rows, setRows] = useState<Company[]>([])
  const [counts, setCounts] = useState<Record<number, { xodim: number; sotuv: number }>>({})
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [decide, setDecide] = useState<{ c: Company; approve: boolean } | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('ip_companies')
      .select('*').order('status').order('created_at', { ascending: false })
    if (error) setErr(translateDbError(error.message))
    else setErr('')
    const list = (data as Company[]) ?? []
    setRows(list)

    // Har bir kompaniyada nechta xodim va sotuv bor
    const [p, s] = await Promise.all([
      supabase.from('ip_profiles').select('company_id'),
      supabase.from('ip_sales').select('company_id'),
    ])
    const m: Record<number, { xodim: number; sotuv: number }> = {}
    for (const r of (p.data ?? []) as { company_id: number | null }[]) {
      if (r.company_id == null) continue
      m[r.company_id] = m[r.company_id] ?? { xodim: 0, sotuv: 0 }
      m[r.company_id].xodim++
    }
    for (const r of (s.data ?? []) as { company_id: number | null }[]) {
      if (r.company_id == null) continue
      m[r.company_id] = m[r.company_id] ?? { xodim: 0, sotuv: 0 }
      m[r.company_id].sotuv++
    }
    setCounts(m)
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const pending = useMemo(() => rows.filter((r) => r.status === 'pending'), [rows])
  const active = useMemo(() => rows.filter((r) => r.status === 'active'), [rows])

  async function setStatus(c: Company, status: string) {
    const word = status === 'suspended' ? "to'xtatilsinmi" : 'qayta yoqilsinmi'
    if (!confirm(`"${c.name}" ${word}?`)) return
    setErr('')
    const { error } = await supabase.from('ip_companies')
      .update({ status, updated_at: new Date().toISOString() } as never).eq('id', c.id)
    if (error) { setErr(translateDbError(error.message)); return }
    await load()
  }

  async function remove(c: Company) {
    if (!confirm(`"${c.name}" butunlay o'chirilsinmi? Buni qaytarib bo'lmaydi.`)) return
    setErr('')
    const { error } = await supabase.rpc('ip_delete_company', { p_company: c.id })
    if (error) { setErr(translateDbError(error.message)); return }
    await load()
  }

  if (loading) return <Loading />

  if (!isPlatformAdmin) {
    return (
      <div>
        <PageHeader title="Kompaniyalar" />
        <Empty title="Ruxsat yo'q" hint="Bu bo'lim faqat platforma egasiga ko'rinadi." />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Kompaniyalar"
        sub={`${active.length} ta faol · ${pending.length} ta ariza kutmoqda`}
      />

      {err && <div className="mb-4"><ErrorBox>{err}</ErrorBox></div>}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Faol" value={String(active.length)} icon={<Building2 size={16} />}
              tone="ok" />
        <Stat label="Ariza kutmoqda" value={String(pending.length)}
              icon={<Clock size={16} />} tone={pending.length > 0 ? 'warn' : 'neutral'} />
        <Stat label="To'xtatilgan"
              value={String(rows.filter((r) => r.status === 'suspended').length)} />
        <Stat label="Jami xodim"
              value={String(Object.values(counts).reduce((a, x) => a + x.xodim, 0))} />
      </div>

      {pending.length > 0 && (
        <div className="mb-4">
          <InfoBox tone="warn">
            <b>{pending.length} ta ariza</b> javob kutmoqda. Tasdiqlaguningizcha
            ular platformaga kira olmaydi.
          </InfoBox>
        </div>
      )}

      <Card pad={false}>
        <div className="p-4">
          {rows.length === 0 ? (
            <Empty title="Kompaniya yo'q" />
          ) : (
            <DocTable minWidth={1040}>
              <thead>
                <tr>
                  <DocTh w={40} align="center">№</DocTh>
                  <DocTh>Kompaniya</DocTh>
                  <DocTh w={140}>Telefon</DocTh>
                  <DocTh w={120}>STIR</DocTh>
                  <DocTh w={110}>Holat</DocTh>
                  <DocTh w={80} align="right">Xodim</DocTh>
                  <DocTh w={80} align="right">Sotuv</DocTh>
                  <DocTh w={105}>Ariza</DocTh>
                  <DocTh w={210} align="center" />
                </tr>
              </thead>
              <tbody>
                {rows.map((c, i) => {
                  const st = STATUS[c.status] ?? STATUS.pending
                  const n = counts[c.id] ?? { xodim: 0, sotuv: 0 }
                  const isMine = c.id === mine?.id
                  return (
                    <DocTr key={c.id} alt={i % 2 === 1} tone={st.tone}>
                      <DocTd align="center" tone="muted">{c.id}</DocTd>
                      <DocTd>
                        {c.name}
                        {isMine && (
                          <span className="ml-1.5 text-[11px]" style={{ color: 'var(--brand)' }}>
                            sizniki
                          </span>
                        )}
                        {c.status === 'rejected' && c.reject_reason && (
                          <div className="text-[11px]" style={{ color: 'var(--danger)' }}>
                            {c.reject_reason}
                          </div>
                        )}
                      </DocTd>
                      <DocTd mono tone="muted">{c.phone ?? '—'}</DocTd>
                      <DocTd mono tone="muted">{c.inn ?? '—'}</DocTd>
                      <DocTd>{st.label}</DocTd>
                      <DocTd align="right" mono>{n.xodim}</DocTd>
                      <DocTd align="right" mono>{n.sotuv}</DocTd>
                      <DocTd mono tone="muted">{dateShort(c.created_at)}</DocTd>
                      <DocTd align="center" stopClick>
                        <span className="flex flex-wrap justify-center gap-1">
                          {c.status === 'pending' && (
                            <>
                              <Button size="sm" variant="primary"
                                      onClick={() => setDecide({ c, approve: true })}>
                                <Check size={13} />Tasdiqlash
                              </Button>
                              <Button size="sm" variant="ghost"
                                      onClick={() => setDecide({ c, approve: false })}>
                                <Ban size={13} />
                              </Button>
                            </>
                          )}
                          {c.status === 'active' && !isMine && (
                            <Button size="sm" onClick={() => void setStatus(c, 'suspended')}>
                              <PauseCircle size={13} />To'xtatish
                            </Button>
                          )}
                          {c.status === 'suspended' && (
                            <Button size="sm" onClick={() => void setStatus(c, 'active')}>
                              <Play size={13} />Yoqish
                            </Button>
                          )}
                          {c.status === 'rejected' && (
                            <Button size="sm" variant="ghost" onClick={() => void remove(c)}>
                              <Trash2 size={13} />
                            </Button>
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

      {decide && (
        <DecideModal
          company={decide.c} approve={decide.approve}
          onClose={() => setDecide(null)}
          onDone={() => { setDecide(null); void load() }}
        />
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- */

function DecideModal({
  company, approve, onClose, onDone,
}: { company: Company; approve: boolean; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function submit() {
    setBusy(true); setErr('')
    const { error } = await supabase.rpc('ip_decide_company', {
      p_company: company.id, p_approve: approve, p_reason: reason.trim() || null,
    })
    setBusy(false)
    if (error) { setErr(translateDbError(error.message)); return }
    onDone()
  }

  return (
    <Modal
      open onClose={onClose} width={520}
      title={approve ? 'Kompaniyani tasdiqlash' : 'Arizani rad etish'}
      footer={<>
        <Button onClick={onClose}>Bekor</Button>
        <Button variant={approve ? 'primary' : 'danger'} loading={busy}
                onClick={submit} disabled={!approve && !reason.trim()}>
          {approve ? <Check size={14} /> : <Ban size={14} />}
          {approve ? 'Tasdiqlash' : 'Rad etish'}
        </Button>
      </>}
    >
      <div className="space-y-3">
        <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border-2)' }}>
          <div className="text-[13px] font-medium">{company.name}</div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[12.5px]"
               style={{ color: 'var(--text-3)' }}>
            {company.phone && <span>{company.phone}</span>}
            {company.email && <span>{company.email}</span>}
            {company.inn && <span>STIR {company.inn}</span>}
            <span>{dateTimeUz(company.created_at)}</span>
          </div>
        </div>

        {approve ? (
          <InfoBox tone="ok">
            Tasdiqlansa kompaniya <b>avtomatik jihozlanadi</b>: ombor, o'lchov
            birliklari, narx turlari, to'lov shartlari, rollar va sozlamalar
            tayyor holda beriladi. Ta'sischi darhol ishlay boshlaydi.
          </InfoBox>
        ) : (
          <InfoBox>
            Rad etilsa ariza yopiladi. Sabab foydalanuvchiga ko'rinadi —
            tushunarli yozing.
          </InfoBox>
        )}

        <Field label={approve ? 'Izoh' : 'Sabab'} required={!approve}
               hint={approve ? 'Ixtiyoriy' : undefined}>
          <Textarea
            value={reason} onChange={setReason} rows={3}
            placeholder={approve ? '' : "Masalan: kompaniya ma'lumotlari tasdiqlanmadi"}
          />
        </Field>

        {err && <ErrorBox>{err}</ErrorBox>}
      </div>
    </Modal>
  )
}
