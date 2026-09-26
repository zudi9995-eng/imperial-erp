import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingCart, Users, Package, Wallet, Building2, Sparkles,
  Settings as SettingsIcon, BarChart3, CalendarDays, CheckSquare, Menu, X,
  LogOut, Moon, Sun, Truck, UserCog, Handshake, ShieldCheck, Bell,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { Badge, Button } from './ui'
import { initials } from '../lib/format'
import MoneyBar from './MoneyBar'

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  roles?: ('owner' | 'manager' | 'accountant')[]
  group: string
}

const NAV: NavItem[] = [
  { to: '/',            label: 'Kunlik panel',  icon: LayoutDashboard, group: 'Asosiy' },
  { to: '/ai',          label: 'AI tahlil',     icon: Sparkles,        group: 'Asosiy' },
  { to: '/tasks',       label: 'Vazifalar',     icon: CheckSquare,     group: 'Asosiy' },

  { to: '/sales',       label: 'Sotuv',         icon: ShoppingCart,    group: 'Sotuv' },
  { to: '/customers',   label: 'Mijozlar',      icon: Users,           group: 'Sotuv' },
  { to: '/deals',       label: 'Voronka',       icon: Handshake,       group: 'Sotuv' },
  { to: '/meetings',    label: 'Uchrashuvlar',  icon: CalendarDays,    group: 'Sotuv' },
  { to: '/receivables', label: 'Debitor',       icon: Wallet,          group: 'Sotuv' },

  { to: '/stock',       label: 'Ombor',         icon: Package,         group: 'Ombor' },
  { to: '/purchases',   label: 'Xaridlar',      icon: Truck,           group: 'Ombor', roles: ['owner', 'accountant'] },
  { to: '/products',    label: 'Tovar va narx', icon: BarChart3,       group: 'Ombor' },

  { to: '/finance',     label: 'Moliya va P&L', icon: Building2,       group: 'Boshqaruv', roles: ['owner', 'accountant'] },
  { to: '/hr',          label: 'Xodimlar',      icon: UserCog,         group: 'Boshqaruv' },
  { to: '/approvals',   label: 'Tasdiqlash',    icon: ShieldCheck,     group: 'Boshqaruv' },
  { to: '/settings',    label: 'Sozlamalar',    icon: SettingsIcon,    group: 'Boshqaruv', roles: ['owner'] },
]

export default function Layout() {
  const { profile, signOut, isOwner } = useAuth()
  const loc = useLocation()
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark' | 'auto'>(
    () => (localStorage.getItem('ip-theme') as 'light' | 'dark' | 'auto') ?? 'auto',
  )
  const [unread, setUnread] = useState(0)
  const [pending, setPending] = useState(0)

  useEffect(() => {
    try {
      if (theme === 'auto') document.documentElement.removeAttribute('data-theme')
      else document.documentElement.setAttribute('data-theme', theme)
      localStorage.setItem('ip-theme', theme)
    } catch { /* private rejimda ishlamasligi mumkin */ }
  }, [theme])

  useEffect(() => { setOpen(false) }, [loc.pathname])

  useEffect(() => {
    if (!profile) return
    let alive = true
    async function load() {
      const [n, a] = await Promise.all([
        supabase.from('ip_notifications').select('id', { count: 'exact', head: true })
          .eq('is_read', false),
        isOwner
          ? supabase.from('ip_approvals').select('id', { count: 'exact', head: true })
              .eq('status', 'pending')
          : Promise.resolve({ count: 0 } as { count: number | null }),
      ])
      if (!alive) return
      setUnread(n.count ?? 0)
      setPending(a.count ?? 0)
    }
    void load()
    const t = setInterval(load, 60_000)
    return () => { alive = false; clearInterval(t) }
  }, [profile, isOwner, loc.pathname])

  const visible = NAV.filter((n) => !n.roles || (profile && n.roles.includes(profile.role)))
  const groups = [...new Set(visible.map((n) => n.group))]

  return (
    <div className="flex h-full" style={{ background: 'var(--bg)' }}>
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r transition-transform
          lg:static lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: 'var(--surface)' }}
      >
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4">
          <div className="min-w-0">
            <div className="truncate text-[14px] font-semibold leading-tight">Imperial Partners</div>
            <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>Boshqaruv platformasi</div>
          </div>
          <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Yopish">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {groups.map((g) => (
            <div key={g} className="mb-3">
              <div
                className="px-2 pb-1 text-[10.5px] font-bold uppercase tracking-wider"
                style={{ color: 'var(--text-3)' }}
              >
                {g}
              </div>
              {visible.filter((n) => n.group === g).map((n) => {
                const Icon = n.icon
                const badge = n.to === '/approvals' ? pending : 0
                return (
                  <NavLink
                    key={n.to}
                    to={n.to}
                    end={n.to === '/'}
                    className="mb-0.5 flex items-center gap-2.5 rounded-lg px-2 py-[7px] text-[13.5px] transition-colors"
                    style={({ isActive }) => ({
                      background: isActive ? 'var(--brand-soft)' : 'transparent',
                      color: isActive ? 'var(--brand)' : 'var(--text-2)',
                      fontWeight: isActive ? 600 : 500,
                    })}
                  >
                    <Icon size={16} className="shrink-0" />
                    <span className="flex-1 truncate">{n.label}</span>
                    {badge > 0 && <Badge tone="warn">{badge}</Badge>}
                  </NavLink>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t p-3">
          <div className="mb-2 flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
              style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}
            >
              {profile ? initials(profile.full_name) : '?'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium">{profile?.full_name}</div>
              <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>
                {profile?.role === 'owner' ? "Ta'sischi"
                  : profile?.role === 'accountant' ? 'Buxgalter' : 'Sotuv menejeri'}
              </div>
            </div>
          </div>
          <div className="flex gap-1.5">
            <Button
              size="sm" variant="subtle" className="flex-1"
              title="Tema"
              onClick={() => setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'auto' : 'dark')}
            >
              {theme === 'dark' ? <Moon size={14} /> : theme === 'light' ? <Sun size={14} /> : <Sun size={14} />}
              <span className="text-[12px]">
                {theme === 'auto' ? 'Avto' : theme === 'dark' ? 'Tungi' : 'Kunduzgi'}
              </span>
            </Button>
            <Button size="sm" variant="subtle" onClick={() => void signOut()} title="Chiqish">
              <LogOut size={14} />
            </Button>
          </div>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-30 lg:hidden"
          style={{ background: 'rgba(8,10,14,.5)' }}
          onClick={() => setOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="flex h-14 shrink-0 items-center gap-3 border-b px-4 lg:hidden"
          style={{ background: 'var(--surface)' }}
        >
          <button onClick={() => setOpen(true)} aria-label="Menyu"><Menu size={20} /></button>
          <span className="font-semibold">Imperial Partners</span>
          {unread > 0 && (
            <span className="ml-auto flex items-center gap-1" style={{ color: 'var(--warn)' }}>
              <Bell size={16} /><span className="text-[13px] font-semibold">{unread}</span>
            </span>
          )}
        </header>

        <MoneyBar />

        <main className="min-w-0 flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="mx-auto max-w-[1400px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
