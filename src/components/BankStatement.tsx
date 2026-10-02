import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Banknote, Check, Sparkles, Upload, X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useCustomers, useRefs, useSuppliers, invokeFn, translateDbError } from '../lib/useRefs'
import {
  Badge, Button, Card, Empty, ErrorBox, InfoBox, Loading, Select, Stat,
} from './ui'
import { DocTable, DocTd, DocTh, DocTr } from './docList'
import ImportWizard from './ImportWizard'
import ReceivePayment from './ReceivePayment'
import { normalizeRows, type SheetField } from '../lib/sheet'
import { dateShort, money } from '../lib/format'

/**
 * Bank vipiskasi.
 *
 * Vipiska avval xom holda yuklanadi, keyin tanib chiqiladi: avval STIR
 * va nom bo'yicha aniq moslik (bazada), qolganiga AI. Siz ko'rib
 * chiqib tasdiqlaysiz — hech narsa so'ramasdan hujjatga aylanmaydi.
 *
 * Mijozdan kelgan pul alohida yo'ldan ketadi: u sotuvlarga
 * taqsimlanishi kerak, aks holda qarz kamaymaydi.
 */

interface Line {
  id: number
  op_date: string
  doc_no: string | null
  counterparty: string | null
  inn: string | null
  amount_in: number
  amount_out: number
  purpose: string | null
  kind: string | null
  customer_id: number | null
  supplier_id: number | null
  expense_category_id: number | null
  confidence: number | null
  reason: string | null
  guess_source: string | null
  status: string
}

const BANK_FIELDS: SheetField[] = [
  { key: 'date', label: 'Sana', required: true,
    aliases: ['дата', 'дата операции', 'date', 'сана'] },
  { key: 'doc_no', label: 'Hujjat №',
    aliases: ['номер', '№ док', 'документ', 'no dok', 'doc'] },
  { key: 'counterparty', label: 'Kontragent', required: true,
    aliases: ['контрагент', 'наименование', 'плательщик', 'получатель', 'korrespondent'] },
  { key: 'inn', label: 'STIR', aliases: ['инн', 'stir', 'инн контрагента'],
    hint: 'Bo‘lsa kontragent aniq topiladi' },
  { key: 'amount_in', label: 'Kirim', aliases: ['кредит', 'приход', 'credit', 'kirim'],
    hint: 'Pul kelgan summa' },
  { key: 'amount_out', label: 'Chiqim', aliases: ['дебет', 'расход', 'debit', 'chiqim'],
    hint: 'Pul chiqqan summa' },
  { key: 'purpose', label: "To'lov maqsadi", required: true,
    aliases: ['назначение', 'назначение платежа', 'purpose', 'maqsad'] },
]

const KIND_LABEL: Record<string, string> = {
  customer_in: 'Mijozdan to‘lov',
  supplier_out: 'Postavshikka to‘lov',
  expense: 'Harajat',
  transfer: 'O‘tkazma',
  other: 'Boshqa',
}

export default function BankStatement() {
  const { can, isOwner } = useAuth()
  const refs = useRefs()
  const { customers } = useCustomers()
  const { suppliers } = useSuppliers()

  const [rows, setRows] = useState<Line[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [sel, setSel] = useState<Set<number>>(new Set())
  const [importing, setImporting] = useState(false)
  const [account, setAccount] = useState('')
  const [payFor, setPayFor] = useState<Line | null>(null)
  const [expCats, setExpCats] = useState<{ id: number; name: string }[]>([])

  const mayImport = can('bank.import') || isOwner

  const load = useCallback(async () => {
    const [lines, cats] = await Promise.all([
      supabase.from('ip_bank_lines').select('*').eq('status', 'pending')
        .order('op_date').order('id').limit(500),
      supabase.from('ip_expense_categories').select('id, name')
        .eq('is_active', true).order('sort_order'),
    ])
    if (lines.error) setErr(translateDbError(lines.error.message))
    setRows((lines.data as Line[]) ?? [])
    setExpCats((cats.data as { id: number; name: string }[]) ?? [])
    setSel(new Set())
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!account && refs.accounts.length) setAccount(String(refs.accounts[0].id))
  }, [refs.accounts, account])

  const unknown = useMemo(
    () => rows.filter((r) => !r.kind || Number(r.confidence ?? 0) < 0.8).length,
    [rows],
  )
  const totals = useMemo(() => ({
    in: rows.reduce((a, r) => a + Number(r.amount_in), 0),
    out: rows.reduce((a, r) => a + Number(r.amount_out), 0),
  }), [rows])

  /** Qatorning taxminini qo'lda o'zgartirish */
  async function patch(id: number, p: Partial<Line>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)))
    const { error } = await supabase.from('ip_bank_lines')
      .update({ ...p, guess_source: 'manual', confidence: 1 } as never).eq('id', id)
    if (error) setErr(translateDbError(error.message))
  }

  async function runAi() {
    setBusy('ai'); setErr(''); setMsg('')
    try {
      const res = await invokeFn<{ updated: number; looked_at: number }>('ip-bank-ai', {})
      setMsg(`AI ${res.looked_at} qatorni ko'rib chiqdi, ${res.updated} tasiga taklif berdi.`)
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'AI xatosi')
    } finally { setBusy('') }
  }

  async function post() {
    const ids = [...sel]
    if (ids.length === 0) return
    setBusy('post'); setErr(''); setMsg('')
    const { data, error } = await supabase.rpc('ip_bank_post', { p_ids: ids })
    setBusy('')
    if (error) { setErr(translateDbError(error.message)); return }
    const r = data as { ok: number; failed: { id: number; reason: string }[] }
    setMsg(`${r.ok} qator o'tkazildi.`
      + (r.failed.length ? ` ${r.failed.length} tasi o'tmadi: ${r.failed[0].reason}` : ''))
    await load()
  }

  async function skip() {
    const ids = [...sel]
    if (ids.length === 0) return
    setBusy('skip')
    const { error } = await supabase.rpc('ip_bank_skip', { p_ids: ids })
    setBusy('')
    if (error) { setErr(translateDbError(error.message)); return }
    await load()
  }

  if (loading || refs.loading) return <Loading />

  return (
    <div className="space-y-4">
      {err && <ErrorBox>{err}</ErrorBox>}
      {msg && <InfoBox tone="ok">{msg}</InfoBox>}

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Kutayotgan qator" value={rows.length}
              sub={unknown > 0 ? `${unknown} tasi aniqlanmagan` : 'hammasi tanildi'}
              tone={unknown > 0 ? 'warn' : 'ok'} />
        <Stat label="Kirim" value={money(totals.in, false)} tone="ok" />
        <Stat label="Chiqim" value={money(totals.out, false)} tone="danger" />
      </div>

      <Card pad={false}>
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
          {mayImport && (
            <Button size="sm" variant="primary" onClick={() => setImporting(true)}>
              <Upload size={14} />Vipiska yuklash
            </Button>
          )}
          <Button size="sm" loading={busy === 'ai'} disabled={unknown === 0}
                  onClick={() => void runAi()}
                  title={unknown === 0 ? 'Aniqlanmagan qator yo‘q' : undefined}>
            <Sparkles size={14} />AI bilan tanib chiqish
          </Button>
          <span className="mx-1 h-5 w-px" style={{ background: 'var(--border-2)' }} />
          <Button size="sm" variant="primary" loading={busy === 'post'}
                  disabled={sel.size === 0} onClick={() => void post()}>
            <Check size={14} />Tanlanganni o'tkazish ({sel.size})
          </Button>
          <Button size="sm" loading={busy === 'skip'} disabled={sel.size === 0}
                  onClick={() => void skip()}>
            <X size={14} />Chetga surish
          </Button>
        </div>

        {rows.length === 0 ? (
          <Empty
            icon={<Banknote size={26} />}
            title="Kutayotgan qator yo'q"
            hint="Bank vipiskasini Excel yoki CSV ko'rinishida yuklang — tizim kontragentni STIR bo'yicha o'zi topadi."
          />
        ) : (
          <DocTable minWidth={1150}>
            <thead>
              <tr>
                <DocTh w={34}>
                  <input
                    type="checkbox"
                    checked={sel.size === rows.length && rows.length > 0}
                    onChange={(e) => setSel(e.target.checked
                      ? new Set(rows.map((r) => r.id)) : new Set())}
                  />
                </DocTh>
                <DocTh w={92}>Sana</DocTh>
                <DocTh w={80}>Hujjat</DocTh>
                <DocTh w={190}>Kontragent</DocTh>
                <DocTh w={120} align="right">Kirim</DocTh>
                <DocTh w={120} align="right">Chiqim</DocTh>
                <DocTh>Maqsad</DocTh>
                <DocTh w={300}>Nima deb tanildi</DocTh>
                <DocTh w={110} />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const conf = Number(r.confidence ?? 0)
                const weak = !r.kind || conf < 0.8
                return (
                  <DocTr key={r.id} alt={i % 2 === 1} tone={weak ? 'attention' : 'normal'}>
                    <DocTd stopClick>
                      <input
                        type="checkbox" checked={sel.has(r.id)}
                        onChange={(e) => {
                          const n = new Set(sel)
                          if (e.target.checked) n.add(r.id); else n.delete(r.id)
                          setSel(n)
                        }}
                      />
                    </DocTd>
                    <DocTd mono>{dateShort(r.op_date)}</DocTd>
                    <DocTd tone="muted">{r.doc_no ?? '—'}</DocTd>
                    <DocTd>
                      <div className="truncate">{r.counterparty ?? '—'}</div>
                      {r.inn && (
                        <div className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>
                          STIR {r.inn}
                        </div>
                      )}
                    </DocTd>
                    <DocTd align="right" mono>
                      {Number(r.amount_in) > 0
                        ? <span style={{ color: 'var(--ok)' }}>{money(r.amount_in, false)}</span>
                        : '—'}
                    </DocTd>
                    <DocTd align="right" mono>
                      {Number(r.amount_out) > 0
                        ? <span style={{ color: 'var(--danger)' }}>{money(r.amount_out, false)}</span>
                        : '—'}
                    </DocTd>
                    <DocTd title={r.purpose ?? ''}>
                      <span className="line-clamp-2 text-[12.5px]">{r.purpose ?? '—'}</span>
                    </DocTd>
                    <DocTd stopClick>
                      <div className="space-y-1">
                        <Select
                          value={r.kind ?? ''}
                          onChange={(v) => void patch(r.id, { kind: v || null })}
                          placeholder="— tanlang —"
                          options={Object.entries(KIND_LABEL)
                            .map(([k, v]) => ({ value: k, label: v }))}
                        />
                        {r.kind === 'customer_in' && (
                          <Select
                            value={r.customer_id ?? ''}
                            onChange={(v) => void patch(r.id, { customer_id: v ? Number(v) : null })}
                            placeholder="Mijozni tanlang"
                            options={customers.map((c) => ({ value: c.id, label: c.name }))}
                          />
                        )}
                        {r.kind === 'supplier_out' && (
                          <Select
                            value={r.supplier_id ?? ''}
                            onChange={(v) => void patch(r.id, { supplier_id: v ? Number(v) : null })}
                            placeholder="Postavshikni tanlang"
                            options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                          />
                        )}
                        {r.kind === 'expense' && (
                          <Select
                            value={r.expense_category_id ?? ''}
                            onChange={(v) => void patch(r.id, {
                              expense_category_id: v ? Number(v) : null,
                            })}
                            placeholder="Harajat moddasi"
                            options={expCats.map((c) => ({ value: c.id, label: c.name }))}
                          />
                        )}
                        {r.reason && (
                          <div className="flex items-center gap-1.5 text-[11.5px]"
                               style={{ color: 'var(--text-3)' }}>
                            {r.guess_source === 'ai' && <Sparkles size={10} />}
                            <span className="truncate">{r.reason}</span>
                            {conf > 0 && (
                              <Badge tone={conf >= 0.9 ? 'ok' : conf >= 0.6 ? 'warn' : 'neutral'}>
                                {Math.round(conf * 100)}%
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </DocTd>
                    <DocTd stopClick align="center">
                      {r.kind === 'customer_in' && r.customer_id && (
                        <Button size="sm" variant="primary" onClick={() => setPayFor(r)}>
                          Taqsimlash
                        </Button>
                      )}
                    </DocTd>
                  </DocTr>
                )
              })}
            </tbody>
          </DocTable>
        )}
      </Card>

      <ImportWizard
        open={importing}
        onClose={() => setImporting(false)}
        kind="bank"
        title="Bank vipiskasini yuklash"
        hint={"Qatorlar avval shu yerga tushadi — hech narsa darhol hujjatga "
          + "aylanmaydi. Kontragent STIR bo'yicha o'zi topiladi."}
        sampleNote={"Shu vipiskani ikkinchi marta yuklasangiz, takroriy qatorlar "
          + "o'tkazib yuboriladi."}
        fields={BANK_FIELDS}
        extra={(
          <span className="flex items-center gap-2 text-[13px]">
            <span style={{ color: 'var(--text-2)' }}>Qaysi hisob</span>
            <Select
              value={account} onChange={setAccount}
              options={refs.accounts.map((a) => ({ value: String(a.id), label: a.name }))}
            />
          </span>
        )}
        onImport={async (raw) => {
          const clean = normalizeRows(raw, {
            numeric: ['amount_in', 'amount_out'], date: ['date'],
          })
          const { data, error } = await supabase.rpc('ip_bank_stage', {
            p_rows: clean, p_account: Number(account), p_file: 'vipiska',
          })
          if (error) throw new Error(translateDbError(error.message))
          const res = data as {
            ok: number; duplicates: number
            failed: { row: number; reason: string }[]
          }
          await load()
          return {
            ok: res.ok,
            failed: [
              ...res.failed,
              ...(res.duplicates > 0
                ? [{ row: 0, reason: `${res.duplicates} qator allaqachon yuklangan edi` }]
                : []),
            ],
          }
        }}
      />

      {payFor && payFor.customer_id && (
        <ReceivePayment
          customerId={payFor.customer_id}
          customerName={payFor.counterparty ?? ''}
          onClose={() => setPayFor(null)}
          onDone={async () => {
            // To'lov yozildi — vipiska qatorini yopamiz
            const { data } = await supabase.from('ip_payments')
              .select('id').eq('customer_id', payFor.customer_id!)
              .order('id', { ascending: false }).limit(1).maybeSingle()
            const pid = (data as { id: number } | null)?.id ?? null
            await supabase.rpc('ip_bank_resolve', { p_line: payFor.id, p_payment: pid })
            setPayFor(null)
            await load()
          }}
        />
      )}
    </div>
  )
}
