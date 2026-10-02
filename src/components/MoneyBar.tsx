import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Wallet, Scale, RefreshCw, AlertTriangle, TrendingDown, TrendingUp,
  ArrowDownLeft, ArrowUpRight, Check, Pencil, X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useSettings } from '../lib/settings'
import type { CashBalance, FxCurrent, Position } from '../lib/types'
import { dateShort, money, moneyShort, num, timeUz } from '../lib/format'
import { Button, Spinner } from './ui'
import NotifyBell from './NotifyBell'

/**
 * Doimiy ko'rinib turadigan pul paneli.
 * Ta'sischi va buxgalter — kassa va sof pozitsiya.
 * Hamma xodim — valyuta kursi (manba va sana bilan).
 */
export default function MoneyBar() {
  const { can } = useAuth()
  const { n, save } = useSettings()
  const canSeeMoney = can('cash.view')
  const canEditFx = can('settings.manage')

  const [cash, setCash] = useState<CashBalance[]>([])
  const [pos, setPos] = useState<Position | null>(null)
  const [fx, setFx] = useState<FxCurrent[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [open, setOpen] = useState(false)
  // Olish/sotish kursini shu yerda tahrirlash
  const [fxEdit, setFxEdit] = useState<{ buy: string; sell: string } | null>(null)
  const [fxSaving, setFxSaving] = useState(false)

  const load = useCallback(async () => {
    const tasks: PromiseLike<unknown>[] = [
      supabase.from('ip_fx_current').select('*').then(({ data }) => setFx((data as FxCurrent[]) ?? [])),
    ]
    if (canSeeMoney) {
      tasks.push(
        supabase.from('ip_cash_balances').select('*').order('cash_account_id')
          .then(({ data }) => setCash((data as CashBalance[]) ?? [])),
        supabase.from('ip_position').select('*').maybeSingle()
          .then(({ data }) => setPos(data as Position | null)),
      )
    }
    await Promise.all(tasks)
    setLoading(false)
  }, [canSeeMoney])

  useEffect(() => {
    void load()
    const t = setInterval(load, 120_000)
    return () => clearInterval(t)
  }, [load])

  async function syncFx() {
    setSyncing(true)
    try {
      await supabase.rpc('ip_fx_request')
      // Javob kelishiga bir oz vaqt kerak
      await new Promise((r) => setTimeout(r, 2500))
      await supabase.rpc('ip_fx_collect')
      await load()
    } finally { setSyncing(false) }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 border-b px-4 py-2 lg:px-6"
           style={{ background: 'var(--surface)' }}>
        <Spinner size={14} />
        <span className="ml-auto"><NotifyBell /></span>
      </div>
    )
  }

  const total = cash.reduce((a, c) => a + Number(c.balance_base), 0)
  const minSafe = n('min_safe_cash', 0)
  const low = canSeeMoney && total < minSafe

  const net = pos
    ? Number(pos.cash_base) + Number(pos.stock_base) + Number(pos.receivable_base)
      + Number(pos.supplier_advance_base) - Number(pos.supplier_debt_base)
      - Number(pos.customer_advance_base) - Number(pos.loan_base)
    : null

  const usd = fx.find((f) => f.currency === 'USD') ?? fx[0]

  // Kompaniyaning o'z kursi. Qo'yilmagan bo'lsa rasmiy kurs ko'rsatiladi.
  const official = usd ? Number(usd.rate) : 0
  const buy = n('fx_usd_buy', 0) || official
  const sell = n('fx_usd_sell', 0) || official

  async function saveFx() {
    if (!fxEdit) return
    const b = Number(fxEdit.buy.replace(/\s/g, '').replace(',', '.'))
    const s = Number(fxEdit.sell.replace(/\s/g, '').replace(',', '.'))
    if (!Number.isFinite(b) || !Number.isFinite(s) || b < 0 || s < 0) return
    setFxSaving(true)
    try {
      await save('fx_usd_buy', b)
      await save('fx_usd_sell', s)
      setFxEdit(null)
    } finally { setFxSaving(false) }
  }

  return (
    <div
      className="border-b"
      style={{ background: 'var(--surface)' }}
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-4 py-2 lg:px-6">
        {canSeeMoney && (
          <>
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex items-center gap-1.5 text-[13px]"
              title="Kassalar bo'yicha taqsimot"
            >
              <Wallet size={14} style={{ color: low ? 'var(--danger)' : 'var(--ok)' }} />
              <span style={{ color: 'var(--text-3)' }}>Kassa</span>
              <span
                className="tnum font-semibold"
                style={{ color: low ? 'var(--danger)' : 'var(--text)' }}
              >
                {money(total, false)}
              </span>
              {low && <AlertTriangle size={13} style={{ color: 'var(--danger)' }} />}
            </button>

            {net != null && (
              <Link to="/finance" className="flex items-center gap-1.5 text-[13px]">
                <Scale size={14} style={{ color: net >= 0 ? 'var(--ok)' : 'var(--danger)' }} />
                <span style={{ color: 'var(--text-3)' }}>Sof pozitsiya</span>
                <span
                  className="tnum font-semibold"
                  style={{ color: net >= 0 ? 'var(--ok)' : 'var(--danger)' }}
                >
                  {moneyShort(net)}
                </span>
              </Link>
            )}
          </>
        )}

        {usd && (
          <div className="flex items-center gap-1.5 text-[13px]">
            <span style={{ color: 'var(--text-3)' }}>{usd.currency}</span>

            {/* Olish / sotish — kompaniyaning o'z kursi */}
            {fxEdit ? (
              <span className="flex items-center gap-1">
                <FxInput
                  value={fxEdit.buy} tone="ok" title="Olish kursi" autoFocus
                  onChange={(v) => setFxEdit({ ...fxEdit, buy: v })}
                  onEnter={() => void saveFx()}
                />
                <span style={{ color: 'var(--text-3)' }}>/</span>
                <FxInput
                  value={fxEdit.sell} tone="danger" title="Sotish kursi"
                  onChange={(v) => setFxEdit({ ...fxEdit, sell: v })}
                  onEnter={() => void saveFx()}
                />
                <Button size="sm" variant="ghost" loading={fxSaving}
                        onClick={() => void saveFx()} title="Saqlash">
                  <Check size={13} style={{ color: 'var(--ok)' }} />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setFxEdit(null)} title="Bekor">
                  <X size={13} />
                </Button>
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <span className="flex items-center gap-0.5" title="Olish kursi">
                  <ArrowDownLeft size={13} style={{ color: 'var(--ok)' }} />
                  <span className="tnum font-semibold">{num(buy, 0)}</span>
                </span>
                <span style={{ color: 'var(--border-2)' }}>/</span>
                <span className="flex items-center gap-0.5" title="Sotish kursi">
                  <ArrowUpRight size={13} style={{ color: 'var(--danger)' }} />
                  <span className="tnum font-semibold">{num(sell, 0)}</span>
                </span>
                {canEditFx && (
                  <button
                    onClick={() => setFxEdit({
                      buy: String(n('fx_usd_buy', 0) || official),
                      sell: String(n('fx_usd_sell', 0) || official),
                    })}
                    title="Olish/sotish kursini o'zgartirish"
                    className="rounded p-0.5 hover:bg-[var(--surface-2)]"
                    style={{ color: 'var(--text-3)' }}
                  >
                    <Pencil size={11} />
                  </button>
                )}
              </span>
            )}

            <span className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>
              rasmiy {num(usd.rate, 2)} · {usd.source} · {dateShort(usd.rate_date)}
            </span>
            {usd.days_old > 1 && (
              <span
                className="rounded px-1 text-[11px] font-semibold"
                style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }}
                title="Kurs eskirgan"
              >
                {usd.days_old} kun
              </span>
            )}
            {canSeeMoney && (
              <Button size="sm" variant="ghost" loading={syncing} onClick={syncFx} title="Hozir yangilash">
                <RefreshCw size={12} />
              </Button>
            )}
          </div>
        )}

        <div className="ml-auto flex items-center gap-3">
          {usd?.last_sync_at && (
            <span className="hidden text-[11.5px] xl:inline" style={{ color: 'var(--text-3)' }}>
              Rasmiy kurs 08:00 da yangilanadi · oxirgi {timeUz(usd.last_sync_at)}
            </span>
          )}
          <NotifyBell />
        </div>
      </div>

      {open && canSeeMoney && (
        <div
          className="flex flex-wrap gap-x-6 gap-y-1 border-t px-4 py-2 lg:px-6"
          style={{ background: 'var(--surface-2)' }}
        >
          {cash.map((c) => (
            <span key={c.cash_account_id} className="text-[12.5px]">
              <span style={{ color: 'var(--text-3)' }}>{c.name}: </span>
              <span className="tnum font-medium">{money(c.balance_base, false)}</span>
            </span>
          ))}
          {pos && (
            <>
              <span className="text-[12.5px]">
                <span style={{ color: 'var(--text-3)' }}>Ombor: </span>
                <span className="tnum font-medium">{moneyShort(pos.stock_base)}</span>
              </span>
              <span className="text-[12.5px]">
                <TrendingUp size={11} className="mr-0.5 inline" style={{ color: 'var(--ok)' }} />
                <span style={{ color: 'var(--text-3)' }}>Bizga qarz: </span>
                <span className="tnum font-medium">{moneyShort(pos.receivable_base)}</span>
              </span>
              <span className="text-[12.5px]">
                <TrendingDown size={11} className="mr-0.5 inline" style={{ color: 'var(--danger)' }} />
                <span style={{ color: 'var(--text-3)' }}>Biz qarzdormiz: </span>
                <span className="tnum font-medium">
                  {moneyShort(Number(pos.supplier_debt_base) + Number(pos.customer_advance_base))}
                </span>
              </span>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/** Panel ichidagi kichik kurs maydoni */
function FxInput({
  value, onChange, onEnter, tone, title, autoFocus,
}: {
  value: string
  onChange: (v: string) => void
  onEnter: () => void
  tone: 'ok' | 'danger'
  title: string
  autoFocus?: boolean
}) {
  return (
    <input
      value={value}
      title={title}
      autoFocus={autoFocus}
      inputMode="decimal"
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter') onEnter() }}
      className="tnum w-[76px] rounded border px-1.5 py-0.5 text-right text-[13px] font-semibold
        outline-none focus:border-[var(--brand)]"
      style={{
        background: 'var(--surface-2)',
        borderColor: 'var(--border-2)',
        color: tone === 'ok' ? 'var(--ok)' : 'var(--danger)',
      }}
    />
  )
}
