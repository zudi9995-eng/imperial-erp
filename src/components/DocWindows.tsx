import { Suspense, lazy } from 'react'
import { useWindows } from '../lib/windows'
import { Loading } from './ui'

// Hujjat formalari — jami 4000 qatordan ortiq. Ular faqat oyna
// ochilganda kerak, shuning uchun alohida yuklanadi: aks holda
// platformaning birinchi ochilishi shuncha kodni kutib turardi.
const OrderForm    = lazy(() => import('./OrderForm'))
const SaleDetail   = lazy(() => import('./SaleDetail'))
const SaleForm     = lazy(() => import('./SaleForm'))
const PurchaseForm = lazy(() => import('./PurchaseForm'))
const ReturnForm   = lazy(() => import('./ReturnForm'))

/**
 * Ochiq hujjat oynalari. Hammasi bir vaqtda DOM da turadi — faqat
 * faoli ko'rinadi. Shuning uchun oynalar orasida o'tganda kiritilgan
 * ma'lumot ham, aylantirilgan joy ham saqlanib qoladi.
 */
export default function DocWindows() {
  const { wins, active, close, open, signal } = useWindows()

  return (
    <>
      {wins.map((w) => (
        <div key={w.key} style={{ display: w.key === active ? 'block' : 'none' }}>
          <Suspense fallback={<Loading />}>
          {w.kind === 'order' && (
            <OrderForm
              winKey={w.key}
              orderId={(w.params.orderId as number | null) ?? null}
              copyFromId={(w.params.copyFromId as number | null) ?? null}
              onClose={() => close(w.key)}
              onSaved={() => signal('orders')}
              onOpenSale={(sid) => open({
                kind: 'sale', key: `sale:${sid}`, title: 'Sotuv', params: { id: sid },
              })}
            />
          )}
          {w.kind === 'sale' && (
            <SaleDetail
              id={w.params.id as number}
              onBack={() => { signal('sales'); close(w.key) }}
            />
          )}
          {w.kind === 'sale-edit' && (
            <SaleForm
              winKey={w.key}
              saleId={(w.params.saleId as number | null) ?? null}
              presetCustomerId={(w.params.customerId as number | null) ?? null}
              onClose={() => close(w.key)}
              onSaved={() => { signal('sales'); signal('approvals') }}
              onPosted={(sid) => open({
                kind: 'sale', key: `sale:${sid}`, title: 'Sotuv', params: { id: sid },
              })}
            />
          )}
          {w.kind === 'purchase' && (
            <PurchaseForm
              winKey={w.key}
              purchaseId={(w.params.purchaseId as number | null) ?? null}
              onClose={() => close(w.key)}
              onSaved={() => signal('purchases')}
            />
          )}
          {w.kind === 'return' && (
            <ReturnForm
              winKey={w.key}
              saleId={(w.params.saleId as number | null) ?? null}
              returnId={(w.params.returnId as number | null) ?? null}
              onClose={() => close(w.key)}
              onSaved={() => { signal('returns'); signal('sales') }}
              onOpenSale={(sid) => open({
                kind: 'sale', key: `sale:${sid}`, title: 'Sotuv', params: { id: sid },
              })}
            />
          )}
          </Suspense>
        </div>
      ))}
    </>
  )
}
