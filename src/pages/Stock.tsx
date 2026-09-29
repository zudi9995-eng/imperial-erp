import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Search, Package, AlertTriangle, Snowflake, ArrowLeftRight, Plus, Trash2, Send,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useSettings } from '../lib/settings'
import { useProducts, useRefs, translateDbError } from '../lib/useRefs'
import type { StockSignal } from '../lib/types'
import {
  Badge, Button, Card, Empty, ErrorBox, Field, InfoBox, Input, Loading, Modal,
  PageHeader, Select, Stat, Table, Td, Th, Tr, type Tone,
} from '../components/ui'
import { dateTimeUz, money, moneyShort, num } from '../lib/format'
import InventoryTab from '../components/InventoryTab'

type Tab = 'signals' | 'stock' | 'batches' | 'moves' | 'transfers' | 'inventory'

interface StockRow {
  product_id: number; code: string | null; name: string
  category_name: string | null; unit_code: string | null
  warehouse_id: number; warehouse_name: string; qty: number
}
interface Batch {
  id: number; product_id: number; warehouse_id: number
  qty_in: number; qty_left: number; unit_cost_base: number
  received_at: string; source: string; note: string | null
  product: { name: string; code: string | null } | null
}
interface Move {
  id: number; product_id: number; warehouse_id: number; direction: number
  qty: number; unit_cost_base: number; cost_base: number
  doc_type: string; doc_id: number | null; moved_at: string
  product: { name: string } | null
}
interface Transfer {
  id: number; doc_no: string | null; from_warehouse: number; to_warehouse: number
  doc_date: string; status: string; note: string | null
}

const SIGNAL_TONE: Record<string, Tone> = {
  TUGAGAN: 'danger', BUYURTMA: 'warn', CHEGIRMA: 'info',
  HARAKATSIZ: 'neutral', Normal: 'ok',
}
const SIGNAL_LABEL: Record<string, string> = {
  TUGAGAN: 'tugagan', BUYURTMA: 'buyurtma', CHEGIRMA: 'chegirma',
  HARAKATSIZ: 'harakatsiz', Normal: 'normal',
}

export default function Stock() {
  const { isOwner } = useAuth()
  const { n } = useSettings()
  const refs = useRefs()
  const [tab, setTab] = useState<Tab>('signals')
  const [wh, setWh] = useState<string>('')
  const [q, setQ] = useState('')
  const [signals, setSignals] = useState<StockSignal[]>([])
  const [stock, setStock] = useState<StockRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [s, st] = await Promise.all([
      supabase.from(isOwner ? 'ip_stock_signals' : 'ip_stock_signals_lite').select('*'),
      supabase.rpc('ip_stock_list_rows', { p_warehouse: wh ? Number(wh) : null }),
    ])
    if (s.error) setErr(translateDbError(s.error.message))
    else if (st.error) setErr(translateDbError(st.error.message))
    else setErr('')
    setSignals((s.data as StockSignal[]) ?? [])
    setStock((st.data as StockRow[]) ?? [])
    setLoading(false)
  }, [isOwner, wh])

  useEffect(() => { void load() }, [load])

  const summary = useMemo(() => {
    const value = signals.reduce((a, r) => a + Number(r.value_base ?? 0), 0)
    const reorder = signals.filter((r) => r.signal === 'BUYURTMA' || r.signal === 'TUGAGAN').length
    const frozen = signals.filter((r) => r.signal === 'CHEGIRMA' || r.signal === 'HARAKATSIZ')
    return {
      value,
      reorder,
      frozenCount: frozen.length,
      frozenValue: frozen.reduce((a, r) => a + Number(r.value_base ?? 0), 0),
      positions: signals.filter((r) => Number(r.qty) > 0).length,
    }
  }, [signals])

  const filteredSignals = useMemo(() => {
    const s = q.trim().toLowerCase()
    return signals
      .filter((r) => !s || r.name.toLowerCase().includes(s) || (r.code ?? '').toLowerCase().includes(s))
      .sort((a, b) => rank(a.signal) - rank(b.signal) || (a.cover_days ?? 0) - (b.cover_days ?? 0))
  }, [signals, q])

  const filteredStock = useMemo(() => {
    const s = q.trim().toLowerCase()
    return stock.filter((r) => !s || r.name.toLowerCase().includes(s) || (r.code ?? '').toLowerCase().includes(s))
  }, [stock, q])

  if (loading || refs.loading) return <Loading />

  const TABS = ([
    { key: 'signals',   label: 'Signallar' },
    { key: 'stock',     label: 'Qoldiq' },
    { key: 'batches',   label: 'Partiyalar', owner: true },
    { key: 'moves',     label: 'Harakatlar', owner: true },
    { key: 'transfers', label: "Ko'chirish" },
    { key: 'inventory', label: 'Inventarizatsiya' },
  ] as { key: Tab; label: string; owner?: boolean }[]).filter((t) => !t.owner || isOwner)

  return (
    <div>
      <PageHeader
        title="Ombor"
        sub={`Partiya (FIFO) hisobi · ${summary.positions} pozitsiya${isOwner ? ` · ${moneyShort(summary.value)}` : ''}`}
      />

      {err && <div className="mb-4"><ErrorBox>{err}</ErrorBox></div>}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {isOwner && (
          <Stat label="Ombor qiymati" value={moneyShort(summary.value)} tone="brand" icon={<Package size={16} />} />
        )}
        <Stat
          label="Buyurtma kerak" value={summary.reorder}
          tone={summary.reorder > 0 ? 'warn' : 'ok'} icon={<AlertTriangle size={16} />}
          sub={`Zaxira ${n('reorder_days', 15)} kundan kam`}
        />
        <Stat
          label="Muzlagan tovar" value={summary.frozenCount}
          tone={summary.frozenCount > 0 ? 'info' : 'ok'} icon={<Snowflake size={16} />}
          sub={isOwner ? moneyShort(summary.frozenValue) : `Zaxira ${n('overstock_days', 90)} kundan ko'p`}
        />
        <Stat label="Pozitsiya" value={summary.positions} />
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors"
            style={{
              background: tab === t.key ? 'var(--brand-soft)' : 'var(--surface)',
              color: tab === t.key ? 'var(--brand)' : 'var(--text-2)',
              borderColor: tab === t.key ? 'var(--brand)' : 'var(--border-2)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {(tab === 'signals' || tab === 'stock') && (
        <div className="mb-3 flex flex-wrap gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
            <input
              value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Tovar nomi yoki kodi…"
              className="w-full rounded-lg border py-2 pl-8 pr-2.5 text-sm outline-none focus:border-[var(--brand)]"
              style={{ background: 'var(--surface)', borderColor: 'var(--border-2)' }}
            />
          </div>
          {tab === 'stock' && (
            <div className="w-[200px]">
              <Select
                value={wh} onChange={setWh} placeholder="Hamma ombor"
                options={refs.warehouses.map((w) => ({ value: String(w.id), label: w.name }))}
              />
            </div>
          )}
        </div>
      )}

      {/* Inventarizatsiya o'z kartochkalarini chizadi — ikki qavat ramka bo'lmasin */}
      {tab === 'inventory' ? <InventoryTab /> : (
        <Card pad={false}>
          <div className="p-4">
            {tab === 'signals' && <Signals rows={filteredSignals} isOwner={isOwner} />}
            {tab === 'stock' && <StockList rows={filteredStock} />}
            {tab === 'batches' && <Batches />}
            {tab === 'moves' && <Moves />}
            {tab === 'transfers' && <Transfers refs={refs} canWrite={isOwner} onDone={load} />}
          </div>
        </Card>
      )}
    </div>
  )
}

function rank(s: string) {
  return s === 'TUGAGAN' ? 0 : s === 'BUYURTMA' ? 1 : s === 'CHEGIRMA' ? 2 : s === 'HARAKATSIZ' ? 3 : 4
}

/* ---------------------------------------------------------------- */

function Signals({ rows, isOwner }: { rows: StockSignal[]; isOwner: boolean }) {
  if (rows.length === 0) {
    return <Empty title="Tovar yo'q" hint="Avval nomenklatura va xarid kiriting — signallar sotuv tarixidan hisoblanadi." />
  }
  return (
    <>
      <InfoBox>
        Signal <b>sotuv tezligidan</b> hisoblanadi: qoldiq ÷ kunlik o'rtacha sarf = necha kunga yetadi.
        Chegaralarni <b>Sozlamalar → Ombor</b> dan o'zgartirasiz.
      </InfoBox>
      <div className="mt-3">
        <Table minWidth={isOwner ? 900 : 760}>
          <thead>
            <tr>
              <Th>Tovar</Th>
              <Th w={160}>Kategoriya</Th>
              <Th w={120} align="right">Qoldiq</Th>
              <Th w={130} align="right">Kunlik sarf</Th>
              <Th w={110} align="right">Yetadi</Th>
              {isOwner && <Th w={140} align="right">Qiymat</Th>}
              <Th w={120} align="center">Signal</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Tr key={r.product_id}>
                <Td>
                  <div className="font-medium">{r.name}</div>
                  {r.code && <div className="text-[12px]" style={{ color: 'var(--text-3)' }}>{r.code}</div>}
                </Td>
                <Td>{r.category_name ?? '—'}</Td>
                <Td align="right" mono>{num(r.qty, 2)} <span style={{ color: 'var(--text-3)' }}>{r.unit_code}</span></Td>
                <Td align="right" mono>{r.daily_consumption > 0 ? num(r.daily_consumption, 2) : '—'}</Td>
                <Td align="right" mono>{r.cover_days != null ? `${num(r.cover_days, 0)} kun` : '—'}</Td>
                {isOwner && <Td align="right" mono>{money(r.value_base ?? 0, false)}</Td>}
                <Td align="center">
                  <Badge tone={SIGNAL_TONE[r.signal] ?? 'neutral'}>{SIGNAL_LABEL[r.signal] ?? r.signal}</Badge>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </div>
    </>
  )
}

function StockList({ rows }: { rows: StockRow[] }) {
  if (rows.length === 0) return <Empty title="Qoldiq yo'q" hint="Xarid hujjati postlangach partiya yaratiladi va qoldiq paydo bo'ladi." />
  return (
    <Table minWidth={680}>
      <thead>
        <tr>
          <Th>Tovar</Th>
          <Th w={180}>Ombor</Th>
          <Th w={160}>Kategoriya</Th>
          <Th w={140} align="right">Qoldiq</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <Tr key={`${r.product_id}:${r.warehouse_id}`}>
            <Td>
              <div className="font-medium">{r.name}</div>
              {r.code && <div className="text-[12px]" style={{ color: 'var(--text-3)' }}>{r.code}</div>}
            </Td>
            <Td>{r.warehouse_name}</Td>
            <Td>{r.category_name ?? '—'}</Td>
            <Td align="right" mono>
              <span style={{ color: r.qty < 0 ? 'var(--danger)' : undefined }}>{num(r.qty, 2)}</span>
              <span style={{ color: 'var(--text-3)' }}> {r.unit_code}</span>
            </Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  )
}

function Batches() {
  const [rows, setRows] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)
  const [onlyOpen, setOnlyOpen] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    let q = supabase.from('ip_batches')
      .select('*, product:ip_products(name, code)')
      .order('received_at', { ascending: false }).limit(300)
    if (onlyOpen) q = q.gt('qty_left', 0)
    void q.then(({ data }) => {
      if (!alive) return
      setRows((data as never) ?? [])
      setLoading(false)
    })
    return () => { alive = false }
  }, [onlyOpen])

  if (loading) return <Loading />

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <InfoBox>
          FIFO: sotuvda eng eski partiya birinchi sarflanadi. Tan narx va marja
          shu partiyalardan hisoblanadi.
        </InfoBox>
        <Button size="sm" onClick={() => setOnlyOpen((v) => !v)}>
          {onlyOpen ? 'Hammasi' : 'Faqat ochiq'}
        </Button>
      </div>

      {rows.length === 0 ? (
        <Empty title="Partiya yo'q" hint="Xarid hujjati postlanganda partiya avtomatik yaratiladi." />
      ) : (
        <Table minWidth={820}>
          <thead>
            <tr>
              <Th w={70}>#</Th>
              <Th>Tovar</Th>
              <Th w={150}>Kelgan</Th>
              <Th w={120} align="right">Kirgan</Th>
              <Th w={120} align="right">Qolgan</Th>
              <Th w={140} align="right">Tan narx</Th>
              <Th w={140} align="right">Qiymat</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <Tr key={b.id}>
                <Td mono><span style={{ color: 'var(--text-3)' }}>{b.id}</span></Td>
                <Td><span className="font-medium">{b.product?.name ?? `#${b.product_id}`}</span></Td>
                <Td mono>{dateTimeUz(b.received_at)}</Td>
                <Td align="right" mono>{num(b.qty_in, 2)}</Td>
                <Td align="right" mono>
                  <span style={{ color: Number(b.qty_left) === 0 ? 'var(--text-3)' : undefined }}>
                    {num(b.qty_left, 2)}
                  </span>
                </Td>
                <Td align="right" mono>{money(b.unit_cost_base, false)}</Td>
                <Td align="right" mono>{money(Number(b.qty_left) * Number(b.unit_cost_base), false)}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  )
}

function Moves() {
  const [rows, setRows] = useState<Move[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    void supabase.from('ip_stock_moves')
      .select('*, product:ip_products(name)')
      .order('moved_at', { ascending: false }).limit(200)
      .then(({ data }) => {
        if (!alive) return
        setRows((data as never) ?? [])
        setLoading(false)
      })
    return () => { alive = false }
  }, [])

  if (loading) return <Loading />
  if (rows.length === 0) return <Empty title="Harakat yo'q" hint="Xarid, sotuv va ko'chirish hujjatlari shu yerga tushadi." />

  const DOC: Record<string, string> = {
    purchase: 'Xarid', sale: 'Sotuv', transfer: "Ko'chirish",
    'sale:return': 'Sotuv qaytarildi', inventory: 'Inventarizatsiya',
  }

  return (
    <Table minWidth={800}>
      <thead>
        <tr>
          <Th w={150}>Vaqt</Th>
          <Th>Tovar</Th>
          <Th w={140}>Hujjat</Th>
          <Th w={100} align="center">Yo'nalish</Th>
          <Th w={120} align="right">Miqdor</Th>
          <Th w={140} align="right">Tan narx</Th>
          <Th w={140} align="right">Summa</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((m) => (
          <Tr key={m.id}>
            <Td mono>{dateTimeUz(m.moved_at)}</Td>
            <Td>{m.product?.name ?? `#${m.product_id}`}</Td>
            <Td>
              {DOC[m.doc_type] ?? m.doc_type}
              {m.doc_id != null && <span style={{ color: 'var(--text-3)' }}> #{m.doc_id}</span>}
            </Td>
            <Td align="center">
              <Badge tone={m.direction === 1 ? 'ok' : 'warn'}>
                {m.direction === 1 ? 'kirim' : 'chiqim'}
              </Badge>
            </Td>
            <Td align="right" mono>{num(m.qty, 2)}</Td>
            <Td align="right" mono>{money(m.unit_cost_base, false)}</Td>
            <Td align="right" mono>{money(m.cost_base, false)}</Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  )
}

/* ---------------------------------------------------------------- */

function Transfers({
  refs, canWrite, onDone,
}: { refs: ReturnType<typeof useRefs>; canWrite: boolean; onDone: () => void }) {
  const [rows, setRows] = useState<Transfer[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase.from('ip_transfers').select('*')
      .order('doc_date', { ascending: false }).limit(100)
    setRows((data as Transfer[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const whName = (id: number) => refs.warehouses.find((w) => w.id === id)?.name ?? `#${id}`

  if (loading) return <Loading />

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <InfoBox>
          Ko'chirishda tovar FIFO bo'yicha chiqadi va <b>o'sha tan narx bilan</b> yangi
          omborga kiradi — marja buzilmaydi.
        </InfoBox>
        {canWrite && (
          <Button size="sm" variant="primary" onClick={() => setOpen(true)}>
            <ArrowLeftRight size={14} />Ko'chirish
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <Empty
          title="Ko'chirish hujjati yo'q"
          action={canWrite ? <Button variant="primary" onClick={() => setOpen(true)}><Plus size={14} />Yangi</Button> : undefined}
        />
      ) : (
        <Table minWidth={680}>
          <thead>
            <tr>
              <Th w={140}>Hujjat</Th>
              <Th w={110}>Sana</Th>
              <Th>Qayerdan</Th>
              <Th>Qayerga</Th>
              <Th w={120} align="center">Holat</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <Tr key={t.id}>
                <Td mono>{t.doc_no ?? `#${t.id}`}</Td>
                <Td mono>{t.doc_date}</Td>
                <Td>{whName(t.from_warehouse)}</Td>
                <Td>{whName(t.to_warehouse)}</Td>
                <Td align="center">
                  <Badge tone={t.status === 'posted' ? 'ok' : t.status === 'cancelled' ? 'neutral' : 'info'}>
                    {t.status === 'posted' ? 'postlangan' : t.status === 'cancelled' ? 'bekor' : 'qoralama'}
                  </Badge>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}

      {open && (
        <TransferModal
          refs={refs}
          onClose={() => setOpen(false)}
          onDone={() => { setOpen(false); void load(); onDone() }}
        />
      )}
    </>
  )
}

function TransferModal({
  refs, onClose, onDone,
}: { refs: ReturnType<typeof useRefs>; onClose: () => void; onDone: () => void }) {
  const { products } = useProducts()
  const [fromW, setFromW] = useState<number | null>(null)
  const [toW, setToW] = useState<number | null>(null)
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [lines, setLines] = useState<{ key: string; product_id: number | null; qty: string }[]>([
    { key: 'a', product_id: null, qty: '' },
  ])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const valid = lines.filter((l) => l.product_id && Number(l.qty) > 0)

  async function save() {
    if (!fromW || !toW) { setErr('Omborlar tanlanmagan'); return }
    if (fromW === toW) { setErr("Bir xil ombor tanlangan"); return }
    if (valid.length === 0) { setErr('Tovar kiritilmagan'); return }

    setBusy(true); setErr('')
    try {
      const { data: no } = await supabase.rpc('ip_next_doc_no', { p_prefix: 'KOCH', p_date: date })
      const { data: t, error: e1 } = await supabase.from('ip_transfers')
        .insert({ doc_no: no, from_warehouse: fromW, to_warehouse: toW, doc_date: date } as never)
        .select().single()
      if (e1) throw new Error(e1.message)

      const tid = (t as Transfer).id
      const { error: e2 } = await supabase.from('ip_transfer_items').insert(
        valid.map((l) => ({ transfer_id: tid, product_id: l.product_id, qty: Number(l.qty) })) as never,
      )
      if (e2) throw new Error(e2.message)

      const { error: e3 } = await supabase.rpc('ip_post_transfer', { p_transfer_id: tid })
      if (e3) throw new Error(e3.message)

      onDone()
    } catch (e) {
      setErr(translateDbError(e instanceof Error ? e.message : 'Xato'))
    } finally { setBusy(false) }
  }

  return (
    <Modal
      open onClose={onClose} width={720} title="Omborlar orasida ko'chirish"
      footer={
        <>
          <Button onClick={onClose}>Bekor</Button>
          <Button variant="primary" loading={busy} onClick={save} disabled={valid.length === 0}>
            <Send size={14} />Ko'chirish
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Qayerdan" required>
            <Select
              value={fromW ?? ''} onChange={(v) => setFromW(v ? Number(v) : null)}
              placeholder="Tanlang…" options={refs.warehouses.map((w) => ({ value: w.id, label: w.name }))}
            />
          </Field>
          <Field label="Qayerga" required>
            <Select
              value={toW ?? ''} onChange={(v) => setToW(v ? Number(v) : null)}
              placeholder="Tanlang…" options={refs.warehouses.map((w) => ({ value: w.id, label: w.name }))}
            />
          </Field>
          <Field label="Sana"><Input type="date" value={date} onChange={setDate} /></Field>
        </div>

        <Table minWidth={520}>
          <thead>
            <tr>
              <Th>Tovar</Th>
              <Th w={130} align="right">Miqdor</Th>
              <Th w={44} />
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <Tr key={l.key}>
                <Td>
                  <Select
                    value={l.product_id ?? ''}
                    onChange={(v) => setLines((ls) => ls.map((x) => x.key === l.key ? { ...x, product_id: Number(v) } : x))}
                    placeholder="Tovarni tanlang…"
                    options={products.map((p) => ({ value: p.id, label: p.code ? `${p.code} — ${p.name}` : p.name }))}
                  />
                </Td>
                <Td>
                  <Input
                    type="number" className="text-right" value={l.qty}
                    onChange={(v) => setLines((ls) => ls.map((x) => x.key === l.key ? { ...x, qty: v } : x))}
                  />
                </Td>
                <Td align="center">
                  <Button
                    size="sm" variant="ghost"
                    onClick={() => setLines((ls) => ls.length > 1 ? ls.filter((x) => x.key !== l.key) : ls)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>

        <Button size="sm" onClick={() => setLines((ls) => [...ls, { key: Math.random().toString(36).slice(2), product_id: null, qty: '' }])}>
          <Plus size={14} />Qator
        </Button>

        {err && <ErrorBox>{err}</ErrorBox>}
      </div>
    </Modal>
  )
}
