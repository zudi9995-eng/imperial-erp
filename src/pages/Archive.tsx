import { useCallback, useEffect, useMemo, useState } from 'react'
import { Archive as ArchiveIcon, Eye } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useRefs } from '../lib/useRefs'
import {
  Button, Card, Empty, Input, Loading, Modal, PageHeader, Select,
} from '../components/ui'
import { DocTable, DocTd, DocTh, DocTr } from '../components/docList'
import { dateTimeUz, money } from '../lib/format'

/**
 * Arxiv — o'chirilgan hujjatlar.
 *
 * Hujjat o'chirilganda butun mazmuni (sarlavha + qatorlar) jsonb
 * ko'rinishida saqlanadi. Shu sahifa o'sha yozuvlarni ko'rsatadi:
 * nima o'chgan, qachon, kim va nega.
 */

interface Row {
  id: number
  entity: string
  entity_id: string
  doc_no: string | null
  title: string
  doc_date: string | null
  amount_base: string | null
  payload: Record<string, unknown>
  reason: string | null
  deleted_by: string | null
  deleted_at: string
}

const ENTITY: Record<string, string> = {
  sale: 'Sotuv', order: 'Buyurtma', purchase: 'Xarid', return: 'Qaytarish',
  customer: 'Mijoz', expense: 'Harajat', payment: "To'lov",
  product: 'Tovar', deal: 'Bitim', task: 'Vazifa', profile: 'Xodim',
}

export default function Archive() {
  const { profiles } = useRefs()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [kind, setKind] = useState('')
  const [view, setView] = useState<Row | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('ip_archive')
      .select('*').order('deleted_at', { ascending: false }).limit(300)
    setRows((data as Row[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const who = useCallback(
    (id: string | null) => profiles.find((p) => p.id === id)?.full_name ?? '—',
    [profiles],
  )

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (kind && r.entity !== kind) return false
      if (!s) return true
      return r.title.toLowerCase().includes(s)
        || (r.doc_no ?? '').toLowerCase().includes(s)
        || (r.reason ?? '').toLowerCase().includes(s)
    })
  }, [rows, q, kind])

  const kinds = useMemo(
    () => [...new Set(rows.map((r) => r.entity))].sort(),
    [rows],
  )

  if (loading) return <Loading />

  return (
    <div className="space-y-4">
      <PageHeader
        title="Arxiv"
        sub="O'chirilgan hujjatlar shu yerda to'liq saqlanadi"
      />

      <Card pad={false}>
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
          <span className="inline-block w-[250px]">
            <Input value={q} onChange={setQ} placeholder="Nom, raqam yoki sabab" />
          </span>
          <Select
            value={kind}
            onChange={setKind}
            options={[
              { value: '', label: 'Barcha turlar' },
              ...kinds.map((k) => ({ value: k, label: ENTITY[k] ?? k })),
            ]}
          />
          <span className="ml-auto text-[12.5px]" style={{ color: 'var(--text-3)' }}>
            {shown.length} ta yozuv
          </span>
        </div>

        {shown.length === 0 ? (
          <Empty
            icon={<ArchiveIcon size={26} />}
            title="Arxiv bo'sh"
            hint="Hujjat o'chirilsa, u shu yerga tushadi"
          />
        ) : (
          <DocTable minWidth={900}>
            <thead>
              <tr>
                <DocTh w={110}>Turi</DocTh>
                <DocTh w={150}>Raqami</DocTh>
                <DocTh>Nomi</DocTh>
                <DocTh w={140} align="right">Summa</DocTh>
                <DocTh w={150}>O'chirgan</DocTh>
                <DocTh w={150}>Qachon</DocTh>
                <DocTh>Sabab</DocTh>
                <DocTh w={60} />
              </tr>
            </thead>
            <tbody>
              {shown.map((r, i) => (
                <DocTr key={r.id} alt={i % 2 === 1} onClick={() => setView(r)}>
                  <DocTd>{ENTITY[r.entity] ?? r.entity}</DocTd>
                  <DocTd tone="muted">{r.doc_no ?? '—'}</DocTd>
                  <DocTd>{r.title}</DocTd>
                  <DocTd align="right">
                    {r.amount_base == null ? '—' : money(r.amount_base, false)}
                  </DocTd>
                  <DocTd tone="muted">{who(r.deleted_by)}</DocTd>
                  <DocTd tone="muted">{dateTimeUz(r.deleted_at)}</DocTd>
                  <DocTd tone="muted">{r.reason ?? '—'}</DocTd>
                  <DocTd align="center">
                    <Eye size={14} style={{ color: 'var(--text-3)' }} />
                  </DocTd>
                </DocTr>
              ))}
            </tbody>
          </DocTable>
        )}
      </Card>

      <Modal
        open={Boolean(view)}
        onClose={() => setView(null)}
        title={view ? `${ENTITY[view.entity] ?? view.entity} — ${view.title}` : ''}
        width={760}
        footer={<Button onClick={() => setView(null)}>Yopish</Button>}
      >
        {view && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-[13px] sm:grid-cols-4">
              <Meta label="Raqami" value={view.doc_no ?? '—'} />
              <Meta label="Sanasi" value={view.doc_date ?? '—'} />
              <Meta label="O'chirgan" value={who(view.deleted_by)} />
              <Meta label="Qachon" value={dateTimeUz(view.deleted_at)} />
            </div>
            {view.reason && (
              <div className="text-[13px]">
                <span style={{ color: 'var(--text-3)' }}>Sabab: </span>{view.reason}
              </div>
            )}
            <div>
              <div className="mb-1 text-[12px] font-semibold uppercase tracking-wide"
                   style={{ color: 'var(--text-3)' }}>
                Hujjat mazmuni
              </div>
              <pre
                className="max-h-[380px] overflow-auto rounded-lg border p-3 text-[11.5px] leading-relaxed"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
              >
                {JSON.stringify(view.payload, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  )
}
