import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Search, Pencil, Tag, Check, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useRefs } from '../lib/useRefs'
import { translateDbError } from '../lib/useRefs'
import type { Product } from '../lib/types'
import {
  Badge, Button, Card, Empty, ErrorBox, Field, InfoBox, Input, Loading, Modal,
  PageHeader, Select, Table, Td, Th, Toggle, Tr,
} from '../components/ui'
import { money, num, pct } from '../lib/format'
import DeleteDocButton from '../components/DeleteDoc'

interface PriceRow { product_id: number; tier_id: number; price: number }

export default function Products() {
  const { isOwner } = useAuth()
  const refs = useRefs()
  const [items, setItems] = useState<Product[]>([])
  const [prices, setPrices] = useState<PriceRow[]>([])
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [edit, setEdit] = useState<Partial<Product> | null>(null)
  const [priceFor, setPriceFor] = useState<Product | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [p, pr] = await Promise.all([
      supabase.from('ip_products').select('*').order('name'),
      supabase.from('ip_current_prices').select('product_id, tier_id, price'),
    ])
    if (p.error) setErr(translateDbError(p.error.message))
    setItems((p.data as Product[]) ?? [])
    setPrices((pr.data as PriceRow[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const priceMap = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of prices) m.set(`${r.product_id}:${r.tier_id}`, Number(r.price))
    return m
  }, [prices])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return items.filter((p) => {
      if (cat && String(p.category_id) !== cat) return false
      if (!s) return true
      return p.name.toLowerCase().includes(s) || (p.code ?? '').toLowerCase().includes(s)
    })
  }, [items, q, cat])

  const catName = (id: number | null) => refs.categories.find((c) => c.id === id)?.name ?? '—'
  const unitCode = (id: number | null) => refs.units.find((u) => u.id === id)?.code ?? ''

  if (loading || refs.loading) return <Loading />

  return (
    <div>
      <PageHeader
        title="Tovar va narx"
        sub={`${items.length} pozitsiya · narxlar mijoz toifasi bo'yicha`}
        actions={isOwner && (
          <Button variant="primary" size="sm" onClick={() => setEdit({ is_active: true, is_stocked: true })}>
            <Plus size={14} />Yangi tovar
          </Button>
        )}
      />

      {err && <div className="mb-4"><ErrorBox>{err}</ErrorBox></div>}

      {items.length === 0 ? (
        <Card>
          <Empty
            title="Nomenklatura bo'sh"
            hint="1C dan eksport qilgan tovar ro'yxatini import qilamiz, yoki shu yerdan qo'lda qo'shasiz. Har tovarga mijoz toifasi bo'yicha narx qo'yiladi."
            action={isOwner && (
              <Button variant="primary" onClick={() => setEdit({ is_active: true, is_stocked: true })}>
                <Plus size={14} />Birinchi tovarni qo'shish
              </Button>
            )}
          />
        </Card>
      ) : (
        <>
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
            <div className="w-[200px]">
              <Select
                value={cat} onChange={setCat} placeholder="Hamma kategoriya"
                options={refs.categories.map((c) => ({ value: String(c.id), label: c.name }))}
              />
            </div>
          </div>

          <Card pad={false}>
            <div className="p-4">
              <Table minWidth={760 + refs.tiers.length * 120}>
                <thead>
                  <tr>
                    <Th w={110}>Kod</Th>
                    <Th>Nomi</Th>
                    <Th w={160}>Kategoriya</Th>
                    <Th w={70} align="center">Birlik</Th>
                    {refs.tiers.map((t) => (
                      <Th key={t.id} w={120} align="right">{t.name}</Th>
                    ))}
                    <Th w={90} align="center">Holat</Th>
                    {isOwner && <Th w={130} align="right">Amal</Th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <Tr key={p.id}>
                      <Td mono>
                        <span style={{ color: 'var(--text-3)' }}>{p.code ?? '—'}</span>
                      </Td>
                      <Td>
                        <div className="font-medium">{p.name}</div>
                        {p.min_margin_pct != null && (
                          <div className="text-[12px]" style={{ color: 'var(--text-3)' }}>
                            min. marja {pct(p.min_margin_pct)}
                          </div>
                        )}
                      </Td>
                      <Td>{catName(p.category_id)}</Td>
                      <Td align="center">{unitCode(p.unit_id)}</Td>
                      {refs.tiers.map((t) => {
                        const v = priceMap.get(`${p.id}:${t.id}`)
                        return (
                          <Td key={t.id} align="right" mono>
                            {v != null
                              ? money(v, false)
                              : <span style={{ color: 'var(--text-3)' }}>—</span>}
                          </Td>
                        )
                      })}
                      <Td align="center">
                        {!p.is_active ? <Badge tone="neutral">faol emas</Badge>
                          : !p.is_stocked ? <Badge tone="info">xizmat</Badge>
                          : <Badge tone="ok">faol</Badge>}
                      </Td>
                      {isOwner && (
                        <Td align="right">
                          <span className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" title="Narx" onClick={() => setPriceFor(p)}>
                              <Tag size={14} />
                            </Button>
                            <Button size="sm" variant="ghost" title="Tahrirlash" onClick={() => setEdit(p)}>
                              <Pencil size={14} />
                            </Button>
                            <DeleteDocButton
                              entity="product" id={p.id} title={p.name}
                              onDone={() => void load()}
                            />
                          </span>
                        </Td>
                      )}
                    </Tr>
                  ))}
                </tbody>
              </Table>

              {filtered.length === 0 && (
                <Empty title="Topilmadi" hint="Qidiruv yoki kategoriya filtrini o'zgartiring." />
              )}
            </div>
          </Card>
        </>
      )}

      {edit && (
        <ProductModal
          value={edit}
          refs={refs}
          onClose={() => setEdit(null)}
          onSaved={() => { setEdit(null); void load() }}
        />
      )}

      {priceFor && (
        <PriceModal
          product={priceFor}
          refs={refs}
          current={priceMap}
          onClose={() => setPriceFor(null)}
          onSaved={() => { setPriceFor(null); void load() }}
        />
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- */

function ProductModal({
  value, refs, onClose, onSaved,
}: {
  value: Partial<Product>
  refs: ReturnType<typeof useRefs>
  onClose: () => void
  onSaved: () => void
}) {
  const [d, setD] = useState<Partial<Product>>(value)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const isNew = !d.id

  function set<K extends keyof Product>(k: K, v: Product[K]) {
    setD((p) => ({ ...p, [k]: v }))
  }

  async function save() {
    if (!d.name?.trim()) { setErr('Nomi kiritilmagan'); return }
    setBusy(true); setErr('')
    const payload = {
      code: d.code?.trim() || null,
      name: d.name.trim(),
      category_id: d.category_id ?? null,
      unit_id: d.unit_id ?? null,
      barcode: d.barcode?.trim() || null,
      is_stocked: d.is_stocked ?? true,
      is_active: d.is_active ?? true,
      min_margin_pct: d.min_margin_pct ?? null,
      reorder_days: d.reorder_days ?? null,
      overstock_days: d.overstock_days ?? null,
      min_qty: d.min_qty ?? null,
      note: d.note?.trim() || null,
    }
    const res = isNew
      ? await supabase.from('ip_products').insert(payload as never)
      : await supabase.from('ip_products').update(payload as never).eq('id', d.id!)
    setBusy(false)
    if (res.error) { setErr(translateDbError(res.error.message)); return }
    onSaved()
  }

  return (
    <Modal
      open onClose={onClose} width={620}
      title={isNew ? 'Yangi tovar' : 'Tovarni tahrirlash'}
      footer={
        <>
          <Button onClick={onClose}>Bekor</Button>
          <Button variant="primary" loading={busy} onClick={save}>Saqlash</Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[130px_1fr]">
          <Field label="Kod"><Input value={d.code ?? ''} onChange={(v) => set('code', v)} placeholder="GK-95" /></Field>
          <Field label="Nomi" required>
            <Input value={d.name ?? ''} onChange={(v) => set('name', v)} placeholder="Gipsokarton 9,5 oq" autoFocus />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Kategoriya">
            <Select
              value={d.category_id ?? ''} onChange={(v) => set('category_id', v ? Number(v) : null)}
              placeholder="—" options={refs.categories.map((c) => ({ value: c.id, label: c.name }))}
            />
          </Field>
          <Field label="O'lchov birligi">
            <Select
              value={d.unit_id ?? ''} onChange={(v) => set('unit_id', v ? Number(v) : null)}
              placeholder="—" options={refs.units.map((u) => ({ value: u.id, label: `${u.code} — ${u.name}` }))}
            />
          </Field>
        </div>

        <InfoBox>
          Quyidagilarni bo'sh qoldirsangiz — <b>Sozlamalar</b> dagi umumiy qiymat
          ishlatiladi. Bu yerga faqat shu tovarga xos istisnoni yozing.
        </InfoBox>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Min. marja" hint="%">
            <Input type="number" value={d.min_margin_pct ?? ''} onChange={(v) => set('min_margin_pct', v === '' ? null : Number(v))} />
          </Field>
          <Field label="BUYURTMA" hint="kun">
            <Input type="number" value={d.reorder_days ?? ''} onChange={(v) => set('reorder_days', v === '' ? null : Number(v))} />
          </Field>
          <Field label="CHEGIRMA" hint="kun">
            <Input type="number" value={d.overstock_days ?? ''} onChange={(v) => set('overstock_days', v === '' ? null : Number(v))} />
          </Field>
        </div>

        <div className="flex flex-wrap gap-5 pt-1">
          <Toggle checked={d.is_stocked ?? true} onChange={(v) => set('is_stocked', v)} label="Omborda hisobga olinadi" />
          <Toggle checked={d.is_active ?? true} onChange={(v) => set('is_active', v)} label="Faol" />
        </div>

        {err && <ErrorBox>{err}</ErrorBox>}
      </div>
    </Modal>
  )
}

/* ---------------------------------------------------------------- */

function PriceModal({
  product, refs, current, onClose, onSaved,
}: {
  product: Product
  refs: ReturnType<typeof useRefs>
  current: Map<string, number>
  onClose: () => void
  onSaved: () => void
}) {
  const [vals, setVals] = useState<Record<number, string>>(() => {
    const o: Record<number, string> = {}
    for (const t of refs.tiers) {
      const v = current.get(`${product.id}:${t.id}`)
      o[t.id] = v != null ? String(v) : ''
    }
    return o
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function save() {
    setBusy(true); setErr('')
    const rows = refs.tiers
      .filter((t) => vals[t.id] !== '' && Number(vals[t.id]) > 0)
      .filter((t) => Number(vals[t.id]) !== current.get(`${product.id}:${t.id}`))
      .map((t) => ({
        product_id: product.id,
        tier_id: t.id,
        price: Number(vals[t.id]),
        currency: 'UZS',
        valid_from: new Date().toISOString().slice(0, 10),
      }))

    if (rows.length === 0) { setBusy(false); onClose(); return }

    const { error } = await supabase
      .from('ip_prices')
      .upsert(rows as never, { onConflict: 'product_id,tier_id,valid_from' })
    setBusy(false)
    if (error) { setErr(translateDbError(error.message)); return }
    onSaved()
  }

  return (
    <Modal
      open onClose={onClose} width={480}
      title={<span>Narx — <span style={{ color: 'var(--text-2)' }}>{product.name}</span></span>}
      footer={
        <>
          <Button onClick={onClose}>Bekor</Button>
          <Button variant="primary" loading={busy} onClick={save}>Saqlash</Button>
        </>
      }
    >
      <div className="space-y-3">
        <InfoBox>
          Narx bugundan kuchga kiradi. Eski narx tarixda qoladi — o'tgan sotuvlar
          o'zgarmaydi.
        </InfoBox>

        {refs.tiers.map((t) => {
          const old = current.get(`${product.id}:${t.id}`)
          const now = Number(vals[t.id])
          const diff = old != null && now > 0 && now !== old ? ((now - old) / old) * 100 : null
          return (
            <Field
              key={t.id}
              label={
                <span className="flex items-center gap-2">
                  {t.name}
                  {t.default_markup_pct != null && (
                    <Badge tone="neutral">ustama {pct(t.default_markup_pct)}</Badge>
                  )}
                </span>
              }
              hint={
                diff != null
                  ? `Oldin ${money(old!)} · ${diff > 0 ? '+' : ''}${num(diff, 1)}%`
                  : old != null ? `Hozirgi: ${money(old)}` : 'Narx qo\'yilmagan'
              }
            >
              <Input
                type="number" className="text-right tnum"
                value={vals[t.id]} onChange={(v) => setVals((p) => ({ ...p, [t.id]: v }))}
                placeholder="0"
              />
            </Field>
          )
        })}

        {err && <ErrorBox>{err}</ErrorBox>}
      </div>
    </Modal>
  )
}
