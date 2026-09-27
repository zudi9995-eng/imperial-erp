import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, Undo2, Download, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { translateDbError } from '../lib/useRefs'
import {
  Badge, Button, Card, Empty, ErrorBox, Input, Loading, Select, Stat,
  Table, Td, Th, Tr,
} from './ui'
import { dateShort, isoDate, money, moneyShort, monthStart, num } from '../lib/format'
import { useWindows, useSignal } from '../lib/windows'

interface ReturnRow {
  id: number
  doc_no: string | null
  doc_date: string
  status: string
  reason: string | null
  note: string | null
  customer_id: number
  customer_name: string
  sale_id: number | null
  sale_doc_no: string | null
  warehouse_name: string | null
  total_base: number
  cogs_base: number
  margin_lost_base: number
  line_count: number
  qty_total: number
  manager_id: string | null
  manager_name: string | null
}

export default function ReturnsTab() {
  const { open } = useWindows()
  const retSignal = useSignal('returns')

  /** Qaytarish hujjatini alohida oynada ochadi */
  const openReturn = useCallback((o: {
    returnId?: number | null; saleId?: number | null; name?: string
  }) => {
    open({
      kind: 'return',
      key: o.returnId ? `return:${o.returnId}` : 'return:new',
      title: o.name ? `Qaytarish · ${o.name.slice(0, 20)}` : 'Qaytarish (yaratish)',
      params: { returnId: o.returnId ?? null, saleId: o.saleId ?? null },
    })
  }, [open])

  const { can } = useAuth()
  const [rows, setRows] = useState<ReturnRow[]>([])
  const [from, setFrom] = useState(monthStart(new Date(new Date().setMonth(new Date().getMonth() - 2))))
  const [to, setTo] = useState(isoDate())
  const [q, setQ] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('ip_returns_board').select('*')
      .gte('doc_date', from).lte('doc_date', to)
      .order('doc_date', { ascending: false }).order('id', { ascending: false })
    if (error) setErr(translateDbError(error.message))
    else setErr('')
    setRows((data as ReturnRow[]) ?? [])
    setLoading(false)
  }, [from, to])

  useEffect(() => { void load() }, [load, retSignal])

  const reasons = useMemo(
    () => [...new Set(rows.map((r) => r.reason).filter(Boolean))] as string[], [rows])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (reason && r.reason !== reason) return false
      if (!s) return true
      return r.customer_name.toLowerCase().includes(s)
        || (r.doc_no ?? '').toLowerCase().includes(s)
        || (r.sale_doc_no ?? '').toLowerCase().includes(s)
    })
  }, [rows, q, reason])

  const total = filtered.filter((r) => r.status === 'posted')
    .reduce((a, r) => a + Number(r.total_base), 0)
  const lostMargin = filtered.filter((r) => r.status === 'posted')
    .reduce((a, r) => a + Number(r.margin_lost_base), 0)

  // Sabablar bo'yicha eng ko'pi
  const topReason = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of filtered) {
      if (!r.reason) continue
      m.set(r.reason, (m.get(r.reason) ?? 0) + Number(r.total_base))
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1])[0]
  }, [filtered])

  function exportCsv() {
    const head = ['Hujjat', 'Sana', 'Mijoz', 'Sotuv', 'Sabab', 'Miqdor', 'Summa', 'Menejer']
    const body = filtered.map((r) => [
      r.doc_no ?? `#${r.id}`, r.doc_date, r.customer_name, r.sale_doc_no ?? '',
      r.reason ?? '', r.qty_total, r.total_base, r.manager_name ?? '',
    ])
    const esc = (v: unknown) => {
      const s = String(v ?? '')
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const csv = '﻿' + [head, ...body].map((r) => r.map(esc).join(';')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `qaytarish-${isoDate()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-4">
      {err && <ErrorBox>{err}</ErrorBox>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Qaytarilgan" value={moneyShort(total)} tone={total > 0 ? 'warn' : 'ok'}
          icon={<Undo2 size={16} />} sub={`${filtered.length} hujjat`} />
        {can('cost.view') && (
          <Stat label="Yo'qotilgan foyda" value={moneyShort(lostMargin)}
            tone={lostMargin > 0 ? 'danger' : 'ok'} />
        )}
        <Stat label="Pozitsiya" value={num(filtered.reduce((a, r) => a + Number(r.qty_total), 0), 1)} />
        <Stat
          label="Asosiy sabab" value={topReason ? topReason[0] : '—'}
          sub={topReason ? moneyShort(topReason[1]) : undefined}
        />
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
          <input
            value={q} onChange={(e) => setQ(e.target.value)} placeholder="Mijoz yoki hujjat…"
            className="w-full rounded-lg border py-2 pl-8 pr-2.5 text-sm outline-none focus:border-[var(--brand)]"
            style={{ background: 'var(--surface)', borderColor: 'var(--border-2)' }}
          />
        </div>
        <div className="w-[150px]"><Input type="date" value={from} onChange={setFrom} /></div>
        <div className="w-[150px]"><Input type="date" value={to} onChange={setTo} /></div>
        <div className="w-[190px]">
          <Select
            value={reason} onChange={setReason} placeholder="Hamma sabab"
            options={reasons.map((r) => ({ value: r, label: r }))}
          />
        </div>
        <Button variant="primary" onClick={() => openReturn({})}>
          <Plus size={14} />Yaratish
        </Button>
        <Button onClick={exportCsv}><Download size={14} />Yuklash</Button>
      </div>

      <Card pad={false}>
        <div className="p-4">
          {filtered.length === 0 ? (
            <Empty
              title="Qaytarish yo'q"
              hint="Tovar qaytarilsa sotuv kartochkasidagi «Qaytarish» tugmasi orqali rasmiylashtiriladi."
            />
          ) : (
            <Table minWidth={940}>
              <thead>
                <tr>
                  <Th w={125}>Hujjat</Th>
                  <Th w={100}>Sana</Th>
                  <Th>Mijoz</Th>
                  <Th w={130}>Sotuv</Th>
                  <Th w={170}>Sabab</Th>
                  <Th w={100} align="right">Miqdor</Th>
                  <Th w={140} align="right">Summa</Th>
                  <Th w={120}>Menejer</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <Tr key={r.id} onClick={() => openReturn({ returnId: r.id, name: r.customer_name })}>
                    <Td mono>
                      <span className="text-[12.5px]">{r.doc_no ?? `#${r.id}`}</span>
                      {r.status !== 'posted' && (
                        <div><Badge tone="info">qoralama</Badge></div>
                      )}
                    </Td>
                    <Td mono>{dateShort(r.doc_date)}</Td>
                    <Td><span className="font-medium">{r.customer_name}</span></Td>
                    <Td mono>
                      <span className="text-[12.5px]" style={{ color: 'var(--brand)' }}>
                        {r.sale_doc_no ?? '—'}
                      </span>
                    </Td>
                    <Td><Badge tone="warn">{r.reason ?? '—'}</Badge></Td>
                    <Td align="right" mono>{num(r.qty_total, 2)}</Td>
                    <Td align="right" mono className="font-semibold">
                      <span style={{ color: 'var(--warn)' }}>{money(r.total_base, false)}</span>
                    </Td>
                    <Td><span className="text-[12.5px]">{r.manager_name ?? '—'}</span></Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </Card>
    </div>
  )
}
