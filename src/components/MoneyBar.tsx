import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Wallet, Scale, RefreshCw, AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useSettings } from '../lib/settings'
import type { CashBalance, FxCurrent, Position } from '../lib/types'
import { dateShort, money, moneyShort, num, timeUz } from '../lib/format'
import { Button, Spinner } from './ui'

/**
 * Doimiy ko'rinib turadigan pul paneli.
 * Ta'sischi va buxgalter — kassa va sof pozitsiya.
 * Hamma xodim — valyuta kursi (manba va sana bilan).
 */
export default function MoneyBar() {
  const { isOwner, isAccountant } = useAuth()
  const { n } = useSettings()
  const canSeeMoney = isOwner || isAccountant

  const [cash, setCash] = useState<CashBalance[]>([])
  const [pos, setPos] = useState<Position | null>(null)
  const [fx, setFx] = useState<FxCurrent[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [open, setOpen] = useState(false)

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
      <div className="flex h-9 items-center px-4"><Spinner size={14} /></div>
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
            <span className="tnum font-semibold">{num(usd.rate, 2)}</span>
            <span className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>
              {usd.source} · {dateShort(usd.rate_date)}
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

        {usd?.last_sync_at && (
          <span className="ml-auto text-[11.5px]" style={{ color: 'var(--text-3)' }}>
            Kurs har kuni 08:00 da yangilanadi · oxirgi {timeUz(usd.last_sync_at)}
          </span>
        )}
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
