import { useCallback, useEffect, useState } from 'react'
import { Check, Link2, Send, Unlink } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Button, Card, CardTitle, ErrorBox, InfoBox } from './ui'
import { dateTimeUz } from '../lib/format'
import { translateDbError } from '../lib/useRefs'

/**
 * Telegram hisobini ulash. Kod bir martalik va 15 daqiqada eskiradi,
 * shuning uchun uni birovga yuborib qo'yish xavfli emas.
 */
export default function TelegramLink() {
  const { profile } = useAuth()
  const [linked, setLinked] = useState<{ chat_id: number | null; at: string | null }>({
    chat_id: null, at: null,
  })
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    if (!profile?.id) return
    const { data } = await supabase.from('ip_profiles')
      .select('tg_chat_id, tg_linked_at').eq('id', profile.id).maybeSingle()
    const d = data as { tg_chat_id: number | null; tg_linked_at: string | null } | null
    setLinked({ chat_id: d?.tg_chat_id ?? null, at: d?.tg_linked_at ?? null })
  }, [profile?.id])

  useEffect(() => { void load() }, [load])

  async function newCode() {
    setBusy(true); setErr('')
    const { data, error } = await supabase.rpc('ip_tg_new_code')
    setBusy(false)
    if (error) { setErr(translateDbError(error.message)); return }
    setCode(String(data))
    setCopied(false)
  }

  async function unlink() {
    if (!profile?.id) return
    if (!confirm("Telegram uzilsinmi? Bildirishnomalar kelmay qo'yadi.")) return
    setBusy(true); setErr('')
    const { error } = await supabase.from('ip_profiles')
      .update({ tg_chat_id: null, tg_linked_at: null } as never).eq('id', profile.id)
    setBusy(false)
    if (error) { setErr(translateDbError(error.message)); return }
    setCode('')
    await load()
  }

  function copy() {
    void navigator.clipboard?.writeText(`/start ${code}`)
      .then(() => setCopied(true))
      .catch(() => setErr('Nusxa olinmadi — qo\'lda ko\'chiring'))
  }

  return (
    <Card>
      <CardTitle sub="Bildirishnomalar va savol-javob shu yerga keladi">
        Telegram
      </CardTitle>

      {err && <div className="mb-3"><ErrorBox>{err}</ErrorBox></div>}

      {linked.chat_id ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--ok)' }}>
              <Check size={15} />Ulangan
            </span>
            {linked.at && (
              <span style={{ color: 'var(--text-3)' }}>· {dateTimeUz(linked.at)}</span>
            )}
          </div>
          <Button size="sm" variant="danger" loading={busy} onClick={unlink}>
            <Unlink size={14} />Uzish
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <InfoBox>
            Botni oching, so'ng quyidagi kodni unga yuboring. Kod{' '}
            <b>15 daqiqa</b> amal qiladi.
          </InfoBox>

          {code ? (
            <div className="space-y-2">
              <div
                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--border-2)' }}
              >
                <code className="tnum text-[16px] font-bold tracking-wider">
                  /start {code}
                </code>
                <Button size="sm" onClick={copy}>
                  {copied ? <Check size={14} /> : null}
                  {copied ? 'Nusxa olindi' : 'Nusxa olish'}
                </Button>
              </div>
              <p className="text-[12.5px]" style={{ color: 'var(--text-3)' }}>
                Shu qatorni botga xabar sifatida yuboring.
              </p>
            </div>
          ) : (
            <Button variant="primary" loading={busy} onClick={newCode}>
              <Link2 size={14} />Ulash kodini olish
            </Button>
          )}

          <div className="rounded-lg border p-3 text-[12.5px]"
               style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}>
            <div className="mb-1 inline-flex items-center gap-1.5 font-medium">
              <Send size={13} />Botda nima bor
            </div>
            <ul className="ml-4 list-disc space-y-0.5">
              <li><b>Holat</b> — kassa, debitor, tasdiq kutayotganlar</li>
              <li><b>Qarzlar</b> — eng katta qarzdorlar va kechikish</li>
              <li><b>Ombor</b> — kam qolgan tovarlar</li>
              <li>Oddiy savol yozsangiz AI javob beradi</li>
              <li>Muhim bildirishnomalar o'zi kelib turadi</li>
            </ul>
          </div>
        </div>
      )}
    </Card>
  )
}
