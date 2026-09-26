import { useState } from 'react'
import {
  Building2, Wallet, ShoppingCart, Package, Users, Sparkles, Send,
  Database, Save, RotateCcw, Shield,
} from 'lucide-react'
import { useSettings } from '../lib/settings'
import { useAuth } from '../lib/auth'
import type { Setting } from '../lib/types'
import RefTable, { type Col } from '../components/RefTable'
import RolesEditor from '../components/RolesEditor'
import {
  Badge, Button, Card, CardTitle, ErrorBox, Field, InfoBox, Input, Loading,
  PageHeader, Select, Toggle,
} from '../components/ui'
import { money } from '../lib/format'

const GROUP_META: Record<string, { label: string; icon: typeof Building2; hint: string }> = {
  umumiy:   { label: 'Umumiy',        icon: Building2,    hint: 'Kompaniya ma\'lumotlari va asosiy parametrlar' },
  moliya:   { label: 'Moliya',        icon: Wallet,       hint: 'Marja, soliq, undirish, kassa xavfsizligi' },
  sotuv:    { label: 'Sotuv va narx', icon: ShoppingCart, hint: 'Chegirma nazorati, tasdiqlash chegaralari, to\'lov muddati' },
  ombor:    { label: 'Ombor',         icon: Package,      hint: 'Signal chegaralari, tan narx usuli' },
  hr:       { label: 'Xodimlar',      icon: Users,        hint: 'Oklad, bonus, ish vaqti, davomat, ta\'til' },
  ai:       { label: 'AI',            icon: Sparkles,     hint: 'Model, brifing vaqti, tavsiya darajasi' },
  telegram: { label: 'Telegram',      icon: Send,         hint: 'Qaysi bildirishnoma kimga va qachon boradi' },
}

type Tab = keyof typeof GROUP_META | 'spravochnik' | 'roles'

export default function SettingsPage() {
  const { isOwner } = useAuth()
  const { all, loading } = useSettings()
  const [tab, setTab] = useState<Tab>('umumiy')

  if (loading) return <Loading />

  const groups = Object.keys(GROUP_META).filter((g) => all.some((s) => s.grp === g))

  return (
    <div>
      <PageHeader
        title="Sozlamalar"
        sub="Hamma parametr shu yerda. Kodda hech qanday raqam qotirilmagan — o'zgartirsangiz butun tizim darhol qayta hisoblaydi."
      />

      {!isOwner && (
        <div className="mb-4">
          <InfoBox tone="warn">
            Sozlamalarni faqat ta'sischi o'zgartiradi. Siz ko'rish uchun ochilgan
            qiymatlarni ko'rasiz.
          </InfoBox>
        </div>
      )}

      {/* Tablar */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {groups.map((g) => {
          const m = GROUP_META[g]
          const Icon = m.icon
          const active = tab === g
          return (
            <button
              key={g}
              onClick={() => setTab(g as Tab)}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors"
              style={{
                background: active ? 'var(--brand-soft)' : 'var(--surface)',
                color: active ? 'var(--brand)' : 'var(--text-2)',
                borderColor: active ? 'var(--brand)' : 'var(--border-2)',
              }}
            >
              <Icon size={14} />{m.label}
            </button>
          )
        })}
        <button
          onClick={() => setTab('roles')}
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors"
          style={{
            background: tab === 'roles' ? 'var(--brand-soft)' : 'var(--surface)',
            color: tab === 'roles' ? 'var(--brand)' : 'var(--text-2)',
            borderColor: tab === 'roles' ? 'var(--brand)' : 'var(--border-2)',
          }}
        >
          <Shield size={14} />Rollar va ruxsatlar
        </button>
        <button
          onClick={() => setTab('spravochnik')}
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors"
          style={{
            background: tab === 'spravochnik' ? 'var(--brand-soft)' : 'var(--surface)',
            color: tab === 'spravochnik' ? 'var(--brand)' : 'var(--text-2)',
            borderColor: tab === 'spravochnik' ? 'var(--brand)' : 'var(--border-2)',
          }}
        >
          <Database size={14} />Spravochniklar
        </button>
      </div>

      {tab === 'roles'       ? <RolesEditor />
        : tab === 'spravochnik' ? <Directories canWrite={isOwner} />
        : <SettingGroup grp={tab} canWrite={isOwner} />}
    </div>
  )
}

/* ================================================================ */
/*  PARAMETRLAR — ip_settings dan avtomatik forma                    */
/* ================================================================ */

function SettingGroup({ grp, canWrite }: { grp: string; canWrite: boolean }) {
  const { all } = useSettings()
  const meta = GROUP_META[grp]
  const items = all.filter((s) => s.grp === grp).sort((a, b) => a.sort_order - b.sort_order)

  return (
    <Card>
      <CardTitle sub={meta.hint}>{meta.label}</CardTitle>
      <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
        {items.map((s) => <SettingRow key={s.key} s={s} canWrite={canWrite} />)}
      </div>
    </Card>
  )
}

function SettingRow({ s, canWrite }: { s: Setting; canWrite: boolean }) {
  const { save } = useSettings()
  const [val, setVal] = useState<unknown>(s.value)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const dirty = JSON.stringify(val) !== JSON.stringify(s.value)

  async function commit(next?: unknown) {
    const v = next === undefined ? val : next
    setBusy(true); setErr('')
    try { await save(s.key, v) } catch (e) {
      setErr(e instanceof Error ? e.message : 'Saqlashda xato')
      setVal(s.value)
    } finally { setBusy(false) }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 py-3">
      <div className="min-w-0 flex-1" style={{ minWidth: 220 }}>
        <div className="flex items-center gap-2">
          <span className="text-[13.5px] font-medium">{s.label}</span>
          {s.owner_only && <Badge tone="neutral">ta'sischi</Badge>}
        </div>
        {s.hint && <p className="mt-0.5 text-[12px]" style={{ color: 'var(--text-3)' }}>{s.hint}</p>}
        {err && <p className="mt-1 text-[12px]" style={{ color: 'var(--danger)' }}>{err}</p>}
        {s.value_type === 'money' && typeof val === 'number' && val > 0 && (
          <p className="mt-0.5 text-[12px]" style={{ color: 'var(--text-3)' }}>{money(val)}</p>
        )}
      </div>

      <div className="flex w-full items-center gap-2 sm:w-auto" style={{ minWidth: 200 }}>
        <div className="flex-1">
          <Editor
            s={s} value={val} disabled={!canWrite || busy}
            onChange={setVal}
            onCommitNow={(v) => void commit(v)}
          />
        </div>
        {s.unit && s.value_type !== 'percent' && (
          <span className="shrink-0 text-[12px]" style={{ color: 'var(--text-3)' }}>{s.unit}</span>
        )}
        {dirty && canWrite && (
          <>
            <Button size="sm" variant="primary" loading={busy} onClick={() => void commit()} title="Saqlash">
              <Save size={14} />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setVal(s.value)} title="Qaytarish">
              <RotateCcw size={14} />
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

function Editor({
  s, value, onChange, onCommitNow, disabled,
}: {
  s: Setting; value: unknown; disabled: boolean
  onChange: (v: unknown) => void
  onCommitNow: (v: unknown) => void
}) {
  switch (s.value_type) {
    case 'bool':
      return (
        <Toggle
          checked={Boolean(value)} disabled={disabled}
          onChange={(v) => { onChange(v); onCommitNow(v) }}
        />
      )
    case 'select':
      return (
        <Select
          value={(value as string) ?? ''} disabled={disabled}
          options={(s.options ?? []).map((o) => ({ value: o, label: o }))}
          onChange={(v) => { onChange(v); onCommitNow(v) }}
        />
      )
    case 'time':
      return (
        <Input
          type="time" value={(value as string) ?? ''} disabled={disabled}
          onChange={onChange}
        />
      )
    case 'number': case 'percent': case 'money':
      return (
        <Input
          type="number" className="text-right tnum"
          value={(value as number) ?? ''} disabled={disabled}
          step={s.value_type === 'percent' ? '0.1' : '1'}
          onChange={(v) => onChange(v === '' ? null : Number(v))}
        />
      )
    case 'json':
      return (
        <Input
          value={JSON.stringify(value)} disabled={disabled}
          onChange={(v) => { try { onChange(JSON.parse(v)) } catch { /* yozib turibdi */ } }}
        />
      )
    default:
      return <Input value={(value as string) ?? ''} disabled={disabled} onChange={onChange} />
  }
}

/* ================================================================ */
/*  SPRAVOCHNIKLAR                                                   */
/* ================================================================ */

const WAREHOUSE_KINDS = [
  { value: 'stock',       label: 'Ombor' },
  { value: 'office',      label: 'Ofis' },
  { value: 'transit',     label: "Tranzit (yo'lda)" },
  { value: 'consignment', label: 'Mijozda qolgan' },
]
const ACCOUNT_KINDS = [
  { value: 'cash',   label: 'Naqd kassa' },
  { value: 'bank',   label: 'Bank hisobi' },
  { value: 'card',   label: 'Karta' },
  { value: 'person', label: 'Shaxsda' },
]
const EXPENSE_KINDS = [
  { value: 'fixed',    label: 'Doimiy' },
  { value: 'variable', label: "O'zgaruvchi" },
  { value: 'other',    label: 'Boshqa' },
]

const DIRECTORIES: {
  key: string
  table: string
  label: string
  hint: string
  cols: Col[]
  defaults?: Record<string, unknown>
  minWidth?: number
}[] = [
  {
    key: 'warehouses', table: 'ip_warehouses', label: 'Omborlar',
    hint: 'Nechta ombor bo\'lsa shuncha qator. "Asosiy" belgilangani yangi hujjatda avtomatik tanlanadi.',
    cols: [
      { key: 'code', label: 'Kod', type: 'text', required: true, width: 110, hint: 'MAIN' },
      { key: 'name', label: 'Nomi', type: 'text', required: true },
      { key: 'kind', label: 'Turi', type: 'select', options: WAREHOUSE_KINDS, width: 150 },
      { key: 'address', label: 'Manzil', type: 'text' },
      { key: 'is_default', label: 'Asosiy', type: 'bool', width: 80 },
      { key: 'is_active', label: 'Faol', type: 'bool', width: 70 },
      { key: 'sort_order', label: 'Tartib', type: 'number', width: 80 },
    ],
    defaults: { kind: 'stock', is_active: true, is_default: false },
    minWidth: 900,
  },
  {
    key: 'categories', table: 'ip_categories', label: 'Tovar kategoriyalari',
    hint: 'Kategoriya darajasida signal kunini va minimal marjani bekor qilib qo\'yishingiz mumkin — bo\'sh qoldirsangiz umumiy sozlama ishlatiladi.',
    cols: [
      { key: 'name', label: 'Nomi', type: 'text', required: true },
      { key: 'reorder_days', label: 'BUYURTMA (kun)', type: 'number', width: 140 },
      { key: 'overstock_days', label: 'CHEGIRMA (kun)', type: 'number', width: 140 },
      { key: 'min_margin_pct', label: 'Min. marja', type: 'percent', width: 120 },
      { key: 'is_active', label: 'Faol', type: 'bool', width: 70 },
      { key: 'sort_order', label: 'Tartib', type: 'number', width: 80 },
    ],
    defaults: { is_active: true },
    minWidth: 820,
  },
  {
    key: 'tiers', table: 'ip_price_tiers', label: 'Mijoz toifalari (narx darajalari)',
    hint: 'Har toifaga o\'z ustamasi, ruxsat etilgan chegirmasi va minimal marjasi. Sotuvda mijoz toifasiga qarab narx tanlanadi.',
    cols: [
      { key: 'code', label: 'Kod', type: 'text', required: true, width: 90 },
      { key: 'name', label: 'Nomi', type: 'text', required: true },
      { key: 'default_markup_pct', label: 'Ustama', type: 'percent', width: 110 },
      { key: 'max_discount_pct', label: 'Maks. chegirma', type: 'percent', width: 140 },
      { key: 'min_margin_pct', label: 'Min. marja', type: 'percent', width: 120 },
      { key: 'is_default', label: 'Standart', type: 'bool', width: 90 },
      { key: 'is_active', label: 'Faol', type: 'bool', width: 70 },
      { key: 'sort_order', label: 'Tartib', type: 'number', width: 80 },
    ],
    defaults: { is_active: true, is_default: false },
    minWidth: 950,
  },
  {
    key: 'terms', table: 'ip_payment_terms', label: "To'lov muddatlari",
    hint: 'Sotuvda tanlanadi, to\'lov sanasi shundan avtomatik hisoblanadi.',
    cols: [
      { key: 'name', label: 'Nomi', type: 'text', required: true },
      { key: 'days', label: 'Kun', type: 'number', required: true, width: 100 },
      { key: 'is_default', label: 'Standart', type: 'bool', width: 90 },
      { key: 'is_active', label: 'Faol', type: 'bool', width: 70 },
      { key: 'sort_order', label: 'Tartib', type: 'number', width: 80 },
    ],
    defaults: { is_active: true, days: 30 },
    minWidth: 620,
  },
  {
    key: 'accounts', table: 'ip_cash_accounts', label: 'Kassa va bank hisoblari',
    hint: 'Naqd, karta, bank, shaxsda turgan pul — har biri alohida qator. Boshlang\'ich qoldiq bir marta kiritiladi.',
    cols: [
      { key: 'name', label: 'Nomi', type: 'text', required: true },
      { key: 'kind', label: 'Turi', type: 'select', options: ACCOUNT_KINDS, width: 140 },
      { key: 'holder', label: 'Kimda', type: 'text', width: 150 },
      { key: 'opening_balance', label: "Boshlang'ich qoldiq", type: 'money', width: 180 },
      { key: 'opening_date', label: 'Sanadan', type: 'date', width: 140 },
      { key: 'is_active', label: 'Faol', type: 'bool', width: 70 },
      { key: 'sort_order', label: 'Tartib', type: 'number', width: 80 },
    ],
    defaults: { kind: 'cash', currency: 'UZS', is_active: true },
    minWidth: 950,
  },
  {
    key: 'stages', table: 'ip_pipeline_stages', label: 'Sotuv voronkasi bosqichlari',
    hint: '"Sotildi" va "Yo\'qotildi" belgilangan bosqichlar voronkani yopadi. Ehtimollik prognoz uchun ishlatiladi.',
    cols: [
      { key: 'name', label: 'Bosqich', type: 'text', required: true },
      { key: 'probability', label: 'Ehtimollik', type: 'percent', width: 120 },
      { key: 'is_won', label: 'Sotildi', type: 'bool', width: 90 },
      { key: 'is_lost', label: "Yo'qotildi", type: 'bool', width: 100 },
      { key: 'color', label: 'Rang', type: 'color', width: 110 },
      { key: 'is_active', label: 'Faol', type: 'bool', width: 70 },
      { key: 'sort_order', label: 'Tartib', type: 'number', width: 80 },
    ],
    defaults: { is_active: true, is_won: false, is_lost: false, probability: 0, color: '#60a5fa' },
    minWidth: 850,
  },
  {
    key: 'expenses', table: 'ip_expense_categories', label: 'Harajat moddalari',
    hint: 'Doimiy harajat byudjeti shundan tuziladi. "Formula" bo\'lsa summa avtomatik hisoblanadi (oklad, soliq, bonus, logistika).',
    cols: [
      { key: 'name', label: 'Modda', type: 'text', required: true },
      { key: 'kind', label: 'Turi', type: 'select', options: EXPENSE_KINDS, width: 140 },
      { key: 'default_amount', label: 'Oylik summa', type: 'money', width: 170 },
      { key: 'formula', label: 'Formula', type: 'text', width: 140, readOnly: true },
      { key: 'is_payroll', label: 'Oylik fondi', type: 'bool', width: 110 },
      { key: 'is_active', label: 'Faol', type: 'bool', width: 70 },
      { key: 'sort_order', label: 'Tartib', type: 'number', width: 80 },
    ],
    defaults: { kind: 'fixed', is_active: true, is_payroll: false, default_amount: 0 },
    minWidth: 950,
  },
  {
    key: 'units', table: 'ip_units', label: "O'lchov birliklari",
    hint: null as unknown as string,
    cols: [
      { key: 'code', label: 'Kod', type: 'text', required: true, width: 110 },
      { key: 'name', label: 'Nomi', type: 'text', required: true },
      { key: 'decimals', label: 'Kasr xona', type: 'number', width: 120 },
      { key: 'sort_order', label: 'Tartib', type: 'number', width: 80 },
    ],
    defaults: { decimals: 2 },
    minWidth: 560,
  },
  {
    key: 'loss', table: 'ip_loss_reasons', label: "Yo'qotish sabablari",
    hint: 'Bitim yo\'qolganda tanlanadi — keyin AI qaysi sabab eng ko\'p uchrayotganini ko\'rsatadi.',
    cols: [
      { key: 'name', label: 'Sabab', type: 'text', required: true },
      { key: 'is_active', label: 'Faol', type: 'bool', width: 70 },
      { key: 'sort_order', label: 'Tartib', type: 'number', width: 80 },
    ],
    defaults: { is_active: true },
    minWidth: 480,
  },
]

function Directories({ canWrite }: { canWrite: boolean }) {
  const [active, setActive] = useState(DIRECTORIES[0].key)
  const dir = DIRECTORIES.find((d) => d.key === active)!
  const { reload } = useSettings()

  return (
    <div className="grid gap-4 lg:grid-cols-[236px_1fr]">
      <Card pad={false} className="h-fit">
        <div className="p-2">
          {DIRECTORIES.map((d) => (
            <button
              key={d.key}
              onClick={() => setActive(d.key)}
              className="mb-0.5 block w-full rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors"
              style={{
                background: active === d.key ? 'var(--brand-soft)' : 'transparent',
                color: active === d.key ? 'var(--brand)' : 'var(--text-2)',
                fontWeight: active === d.key ? 600 : 500,
              }}
            >
              {d.label}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle sub={dir.hint || undefined}>{dir.label}</CardTitle>
        <RefTable
          key={dir.key}
          table={dir.table}
          cols={dir.cols}
          defaults={dir.defaults}
          canWrite={canWrite}
          minWidth={dir.minWidth}
          onChanged={() => void reload()}
          emptyHint={dir.hint || undefined}
        />
      </Card>
    </div>
  )
}
