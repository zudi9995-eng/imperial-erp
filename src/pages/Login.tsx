import { useState } from 'react'
import { Building2 } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { Button, Card, ErrorBox, Field, Input, InfoBox } from '../components/ui'

export default function Login() {
  const { signIn, needsProfile, noOwnerYet, bootstrapOwner, signOut } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    setErr(''); setBusy(true)
    try {
      await signIn(email.trim(), password)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Kirishda xato')
    } finally { setBusy(false) }
  }

  async function makeOwner() {
    setErr(''); setBusy(true)
    try {
      await bootstrapOwner(fullName.trim())
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Xato')
    } finally { setBusy(false) }
  }

  /* Auth bor, lekin xodim profili yo'q */
  if (needsProfile) {
    return (
      <Shell>
        {noOwnerYet ? (
          <>
            <h2 className="mb-1 text-[17px] font-semibold">Birinchi kirish</h2>
            <p className="mb-4 text-[13px]" style={{ color: 'var(--text-3)' }}>
              Tizimda hali xodim yo'q. O'zingizni ta'sischi qilib ro'yxatdan o'tkazasiz —
              keyin qolgan xodimlarga hisob ochasiz.
            </p>
            <div className="space-y-3">
              <Field label="To'liq ismingiz" required>
                <Input
                  value={fullName} onChange={setFullName}
                  placeholder="Masalan: Zuhriddin Ismoilov"
                  onEnter={makeOwner} autoFocus
                />
              </Field>
              {err && <ErrorBox>{err}</ErrorBox>}
              <Button
                variant="primary" full loading={busy}
                disabled={!fullName.trim()} onClick={makeOwner}
              >
                Ta'sischi sifatida boshlash
              </Button>
              <Button variant="ghost" full onClick={() => void signOut()}>Chiqish</Button>
            </div>
          </>
        ) : (
          <>
            <h2 className="mb-1 text-[17px] font-semibold">Hisob ulanmagan</h2>
            <p className="mb-4 text-[13px]" style={{ color: 'var(--text-3)' }}>
              Bu email tizimga kirdi, lekin xodim sifatida ro'yxatga olinmagan.
            </p>
            <InfoBox tone="warn">
              Ta'sischidan sizga hisob ochib berishni so'rang — u <b>Xodimlar</b> bo'limidan
              sizni qo'shadi.
            </InfoBox>
            <Button variant="ghost" full className="mt-3" onClick={() => void signOut()}>
              Chiqish
            </Button>
          </>
        )}
      </Shell>
    )
  }

  return (
    <Shell>
      <h2 className="mb-1 text-[17px] font-semibold">Tizimga kirish</h2>
      <p className="mb-4 text-[13px]" style={{ color: 'var(--text-3)' }}>
        Hisobni ta'sischi ochadi. Ochiq ro'yxatdan o'tish yo'q.
      </p>
      <div className="space-y-3">
        <Field label="Email" required>
          <Input value={email} onChange={setEmail} type="email" placeholder="ism@imperial.uz" autoFocus />
        </Field>
        <Field label="Parol" required>
          <Input value={password} onChange={setPassword} type="password" placeholder="••••••••" onEnter={submit} />
        </Field>
        {err && <ErrorBox>{err}</ErrorBox>}
        <Button
          variant="primary" full loading={busy}
          disabled={!email.trim() || !password} onClick={submit}
        >
          Kirish
        </Button>
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-[400px]">
        <div className="mb-5 flex flex-col items-center gap-2 text-center">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl"
            style={{ background: 'var(--brand)', color: 'var(--brand-fg)' }}
          >
            <Building2 size={22} />
          </div>
          <div>
            <div className="text-[16px] font-semibold">Imperial Partners MChJ</div>
            <div className="text-[12.5px]" style={{ color: 'var(--text-3)' }}>
              Boshqaruv platformasi
            </div>
          </div>
        </div>
        <Card className="ip-fade">{children}</Card>
      </div>
    </div>
  )
}
