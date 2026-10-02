import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Button, ErrorBox, Field, InfoBox, Modal, Textarea } from './ui'
import { translateDbError } from '../lib/useRefs'
import { BarSep, DocBarButton } from './docForm'

/**
 * Hujjatni o'chirish.
 *
 * O'chirish arxivga olish bilan birga ketadi: baza avval hujjatning
 * qoldiq va pulga qilgan ta'sirini qaytaradi, so'ng butun mazmunini
 * ip_archive ga yozib qo'yadi. Shuning uchun bu yerda "nega" so'raladi —
 * arxivda sabab ko'rinib tursin.
 */

export type DocEntity =
  | 'sale' | 'order' | 'purchase' | 'return' | 'customer'
  | 'expense' | 'payment' | 'product' | 'deal' | 'task'

const ENTITY_LABEL: Record<DocEntity, string> = {
  sale: 'sotuv', order: 'buyurtma', purchase: 'xarid', return: 'qaytarish',
  customer: 'mijoz', expense: 'harajat', payment: "to'lov",
  product: 'tovar', deal: 'bitim', task: 'vazifa',
}

/** Tayyor tugma — ro'yxat va hujjat oynalarida ishlatiladi */
export default function DeleteDocButton({
  entity, id, title, onDone, size = 'sm', label,
}: {
  entity: DocEntity
  id: number | string
  title: string
  onDone: () => void
  size?: 'sm' | 'md'
  label?: string
}) {
  const { can } = useAuth()
  const [open, setOpen] = useState(false)
  if (!can('doc.delete')) return null

  return (
    // Ro'yxat qatorida tugma bosilganda qator ochilib ketmasin
    <span onClick={(e) => e.stopPropagation()}>
      <Button size={size} variant="ghost" title="O'chirish" onClick={() => setOpen(true)}>
        <Trash2 size={14} style={{ color: 'var(--danger)' }} />
        {label && <span style={{ color: 'var(--danger)' }}>{label}</span>}
      </Button>
      <DeleteDialog
        target={open ? { entity, id, title, onDone } : null}
        onClose={() => setOpen(false)}
      />
    </span>
  )
}

export function DeleteDialog({
  target, onClose,
}: {
  target: { entity: DocEntity; id: number | string; title: string; onDone: () => void } | null
  onClose: () => void
}) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function run() {
    if (!target) return
    setBusy(true); setErr('')
    const { error } = await supabase.rpc('ip_delete_doc', {
      p_entity: target.entity,
      p_id: String(target.id),
      p_reason: reason.trim() || null,
    })
    setBusy(false)
    if (error) { setErr(translateDbError(error.message)); return }
    setReason('')
    target.onDone()
    onClose()
  }

  return (
    <Modal
      open={Boolean(target)}
      onClose={() => { if (!busy) { setErr(''); onClose() } }}
      title={`${target ? ENTITY_LABEL[target.entity] : ''} o'chirilsinmi?`}
      width={480}
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={() => { setErr(''); onClose() }}>
            Bekor
          </Button>
          <Button variant="danger" loading={busy} onClick={() => void run()}>
            <Trash2 size={14} />O'chirish
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="text-[14px] font-medium">{target?.title}</div>
        <InfoBox tone="warn">
          Hujjat o'chadi, lekin butun mazmuni <b>Arxiv</b> bo'limida saqlanib
          qoladi. Qoldiq va pul holati avtomatik qaytariladi.
        </InfoBox>
        <Field label="Nega o'chiryapsiz">
          <Textarea
            value={reason} onChange={setReason} rows={2}
            placeholder="Masalan: xato kiritilgan"
          />
        </Field>
        {err && <ErrorBox>{err}</ErrorBox>}
      </div>
    </Modal>
  )
}

/**
 * Hujjat oynasining buyruqlar panelidagi o'chirish tugmasi.
 * Hujjat saqlanmagan bo'lsa (id yo'q) ko'rinmaydi.
 */
export function DocDeleteBarButton({
  entity, id, title, onDone, disabled,
}: {
  entity: DocEntity
  id: number | null
  title: string
  onDone: () => void
  disabled?: boolean
}) {
  const { can } = useAuth()
  const [open, setOpen] = useState(false)
  if (!can('doc.delete') || id == null) return null

  return (
    <>
      <BarSep />
      <DocBarButton onClick={() => setOpen(true)} disabled={disabled} title="O'chirish">
        <Trash2 size={14} style={{ color: 'var(--danger)' }} />
      </DocBarButton>
      <DeleteDialog
        target={open ? { entity, id, title, onDone } : null}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
