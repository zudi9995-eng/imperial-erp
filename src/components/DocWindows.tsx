import { useWindows } from '../lib/windows'
import OrderForm from './OrderForm'
import SaleDetail from './SaleDetail'
import SaleForm from './SaleForm'

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
              onSaved={() => signal('sales')}
              onPosted={(sid) => open({
                kind: 'sale', key: `sale:${sid}`, title: 'Sotuv', params: { id: sid },
              })}
            />
          )}
        </div>
      ))}
    </>
  )
}
