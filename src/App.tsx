import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { WindowsProvider } from './lib/windows'
import Layout from './components/Layout'
import Login from './pages/Login'
import Landing from './pages/Landing'
import { Empty, Loading } from './components/ui'

const Dashboard    = lazy(() => import('./pages/Dashboard'))
const SettingsPage = lazy(() => import('./pages/Settings'))
const Sales        = lazy(() => import('./pages/Sales'))
const Customers    = lazy(() => import('./pages/Customers'))
const Products     = lazy(() => import('./pages/Products'))
const Stock        = lazy(() => import('./pages/Stock'))
const Purchases    = lazy(() => import('./pages/Purchases'))
const Receivables  = lazy(() => import('./pages/Receivables'))
const Deals        = lazy(() => import('./pages/Deals'))
const Meetings     = lazy(() => import('./pages/Meetings'))
const Tasks        = lazy(() => import('./pages/Tasks'))
const Finance      = lazy(() => import('./pages/Finance'))
const Hr           = lazy(() => import('./pages/Hr'))
const Approvals    = lazy(() => import('./pages/Approvals'))
const Companies    = lazy(() => import('./pages/Companies'))
const Ai           = lazy(() => import('./pages/Ai'))

export default function App() {
  const { accessState, can, isPlatformAdmin } = useAuth()

  if (accessState === 'loading') {
    return (
      <div className="flex h-full items-center justify-center" style={{ background: 'var(--bg)' }}>
        <Loading label="Tekshirilmoqda…" />
      </div>
    )
  }

  // Hisobi yo'q odam ochiq sahifani ko'radi
  if (accessState === 'anon') {
    return (
      <Routes>
        <Route path="/kirish" element={<Login startMode="login" />} />
        <Route path="/royxat" element={<Login startMode="signup" />} />
        <Route path="*" element={<Landing />} />
      </Routes>
    )
  }

  // Kompaniya tasdiqlanmagan yoki hisob faol emas
  if (accessState !== 'ready') return <Login />

  return (
    <WindowsProvider>
    <Suspense fallback={<div className="p-8"><Loading /></div>}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/"            element={<Dashboard />} />
          <Route path="/ai"          element={<Ai />} />
          <Route path="/tasks"       element={<Tasks />} />
          <Route path="/sales"       element={<Sales />} />
          <Route path="/customers"   element={<Customers />} />
          <Route path="/deals"       element={<Deals />} />
          <Route path="/meetings"    element={<Meetings />} />
          <Route path="/receivables" element={<Receivables />} />
          <Route path="/stock"       element={<Stock />} />
          <Route path="/products"    element={<Products />} />
          <Route
            path="/purchases"
            element={<Guard allow={can('view.purchases')}><Purchases /></Guard>}
          />
          <Route
            path="/finance"
            element={<Guard allow={can('view.finance')}><Finance /></Guard>}
          />
          <Route path="/hr"        element={<Hr />} />
          <Route path="/approvals" element={<Approvals />} />
          <Route
            path="/companies"
            element={<Guard allow={isPlatformAdmin}><Companies /></Guard>}
          />
          <Route
            path="/settings"
            element={<Guard allow={can('view.settings')}><SettingsPage /></Guard>}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
    </WindowsProvider>
  )
}

function Guard({ allow, children }: { allow: boolean; children: React.ReactNode }) {
  if (!allow) {
    return (
      <Empty
        title="Bu bo'limga ruxsatingiz yo'q"
        hint="Agar bu xato bo'lsa, ta'sischidan rolingizni tekshirishni so'rang."
      />
    )
  }
  return <>{children}</>
}
