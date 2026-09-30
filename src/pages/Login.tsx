import { useState } from 'react'
import { Building2, CheckCircle2, Clock, Ban, PauseCircle } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { Button, Card, ErrorBox, Field, Input, InfoBox } from '../components/ui'

/**
 * Kirish va ro'yxatdan o'tish.
 * Kompaniya arizasi platforma egasi tasdiqlagandan keyin ishlaydi —
 * shuning uchun bu yerda kutish va rad etish holatlari ham bor.
 */

type Mode = 'login' | 'signup'

export default function Login() {
  const {
    signIn, signUpCompany, signOut, bootstrapOwner,
    accessState, company, noOwnerYet, profile,
  } = useAuth()

  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [phone, setPhone] = useState('')
  const [inn, setInn] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function run(fn: () => Promise<void>) {
    setErr(''); setBusy(true)
    try { await fn() } catch (e) {
      setErr(e instanceof Error ? e.message : 'Xato')
    } finally { setBusy(false) }
  }

  /* ---------------- Ariza ko'rib chiqilmoqda ---------------- */
  if (accessState === 'pending') {
    return (
      <Shell>
        <div className="mb-3 flex items-center gap-2" style={{ color: 'var(--warn)' }}>
          <Clock size={18} />
          <h2 className="text-[17px] font-semibold">Ariza ko'rib chiqilmoqda</h2>
        </div>
        <p className="mb-3 text-[13px]" style={{ color: 'var(--text-2)' }}>
          <b>{company?.name}</b> uchun arizangiz qabul qilindi. Platforma egasi
          tasdiqlagandan keyin darhol ishlay boshlaysiz.
        </p>
        <InfoBox>
          Odatda bir ish kuni ichida hal qilinadi. Tasdiqlangach shu yerga
          qaytib kiring — boshqa hech narsa qilish shart emas.
        </InfoBox>
        <Button variant="ghost" full className="mt-3" onClick={() => void signOut()}>
          Chiqish
        </Button>
      </Shell>
    )
  }

  /* ---------------- Rad etilgan ---------------- */
  if (accessState === 'rejected') {
    return (
      <Shell>
        <div className="mb-3 flex items-center gap-2" style={{ color: 'var(--danger)' }}>
          <Ban size={18} />
          <h2 className="text-[17px] font-semibold">Ariza rad etildi</h2>
        </div>
        {company?.reject_reason ? (
          <InfoBox tone="danger">{company.reject_reason}</InfoBox>
        ) : (
          <p className="text-[13px]" style={{ color: 'var(--text-2)' }}>
            Sabab ko'rsatilmagan. Platforma egasi bilan bog'laning.
          </p>
        )}
        <Button variant="ghost" full className="mt-3" onClick={() => void signOut()}>
          Chiqish
        </Button>
      </Shell>
    )
  }

  /* ---------------- To'xtatilgan ---------------- */
  if (accessState === 'suspended') {
    return (
      <Shell>
        <div className="mb-3 flex items-center gap-2" style={{ color: 'var(--warn)' }}>
          <PauseCircle size={18} />
          <h2 className="text-[17px] font-semibold">Kompaniya to'xtatilgan</h2>
        </div>
        <p className="mb-3 text-[13px]" style={{ color: 'var(--text-2)' }}>
          <b>{company?.name}</b> vaqtincha to'xtatilgan. Ma'lumotlaringiz
          joyida turibdi.
        </p>
        <Button variant="ghost" full onClick={() => void signOut()}>Chiqish</Button>
      </Shell>
    )
  }

  /* ---------------- Hisob faol emas ---------------- */
  if (accessState === 'inactive') {
    return (
      <Shell>
        <h2 className="mb-1 text-[17px] font-semibold">Hisob faol emas</h2>
        <p className="mb-3 text-[13px]" style={{ color: 'var(--text-2)' }}>
          {profile?.full_name}, sizning hisobingiz o'chirilgan.
        </p>
        <InfoBox tone="warn">
          <b>{company?.name}</b> ta'sischisidan hisobni qayta yoqishni so'rang.
        </InfoBox>
        <Button variant="ghost" full className="mt-3" onClick={() => void signOut()}>
          Chiqish
        </Button>
      </Shell>
    )
  }

  /* ---------------- Auth bor, profil yo'q ---------------- */
  if (accessState === 'no_profile') {
    return (
      <Shell>
        {noOwnerYet ? (
          <>
            <h2 className="mb-1 text-[17px] font-semibold">Birinchi kirish</h2>
            <p className="mb-4 text-[13px]" style={{ color: 'var(--text-3)' }}>
              Tizimda hali xodim yo'q. O'zingizni ta'sischi qilib ro'yxatdan
              o'tkazasiz.
            </p>
            <div className="space-y-3">
              <Field label="To'liq ismingiz" required>
                <Input
                  value={fullName} onChange={setFullName} autoFocus
                  placeholder="Masalan: Zuhriddin Ismoilov"
                  onEnter={() => void run(() => bootstrapOwner(fullName.trim()))}
                />
              </Field>
              {err && <ErrorBox>{err}</ErrorBox>}
              <Button
                variant="primary" full loading={busy} disabled={!fullName.trim()}
                onClick={() => void run(() => bootstrapOwner(fullName.trim()))}
              >
                Ta'sischi sifatida boshlash
              </Button>
              <Button variant="ghost" full onClick={() => void signOut()}>Chiqish</Button>
            </div>
          </>
        ) : (
          <>
            <h2 className="mb-1 text-[17px] font-semibold">Kompaniya biriktirilmagan</h2>
            <p className="mb-4 text-[13px]" style={{ color: 'var(--text-3)' }}>
              Bu email tizimga kirdi, lekin birorta kompaniyaga bog'lanmagan.
            </p>
            <div className="space-y-3">
              <Field label="Kompaniya nomi" required>
                <Input value={companyName} onChange={setCompanyName}
                       placeholder="Masalan: Oq Yo'l Savdo MChJ" autoFocus />
              </Field>
              <Field label="To'liq ismingiz" required>
                <Input value={fullName} onChange={setFullName} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Telefon"><Input value={phone} onChange={setPhone} /></Field>
                <Field label="STIR"><Input value={inn} onChange={setInn} /></Field>
              </div>
              {err && <ErrorBox>{err}</ErrorBox>}
              <Button
                variant="primary" full loading={busy}
                disabled={!companyName.trim() || !fullName.trim()}
                onClick={() => void run(async () => {
                  const { supabase } = await import('../lib/supabase')
                  const { error } = await supabase.rpc('ip_request_company', {
                    p_company: companyName.trim(), p_full_name: fullName.trim(),
                    p_phone: phone.trim() || null, p_inn: inn.trim() || null,
                    p_email: null,
                  })
                  if (error) throw new Error(error.message)
                  window.location.reload()
                })}
              >
                Ariza yuborish
              </Button>
              <Button variant="ghost" full onClick={() => void signOut()}>Chiqish</Button>
            </div>
          </>
        )}
      </Shell>
    )
  }

  /* ---------------- Ro'yxatdan o'tish ---------------- */
  if (mode === 'signup') {
    return (
      <Shell>
        <h2 className="mb-1 text-[17px] font-semibold">Kompaniya ro'yxatdan o'tkazish</h2>
        <p className="mb-4 text-[13px]" style={{ color: 'var(--text-3)' }}>
          Ariza yuborasiz, tasdiqlangandan keyin ishlay boshlaysiz.
        </p>
        <div className="space-y-3">
          <Field label="Kompaniya nomi" required>
            <Input value={companyName} onChange={setCompanyName}
                   placeholder="Oq Yo'l Savdo MChJ" autoFocus />
          </Field>
          <Field label="To'liq ismingiz" required>
            <Input value={fullName} onChange={setFullName} placeholder="Ism Familiya" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Telefon"><Input value={phone} onChange={setPhone}
                                          placeholder="+998 90 123 45 67" /></Field>
            <Field label="STIR" hint="Ixtiyoriy"><Input value={inn} onChange={setInn} /></Field>
          </div>
          <Field label="Email" required>
            <Input value={email} onChange={setEmail} type="email"
                   placeholder="ism@kompaniya.uz" />
          </Field>
          <Field label="Parol" required hint="Kamida 6 belgi">
            <Input value={password} onChange={setPassword} type="password"
                   placeholder="••••••••" />
          </Field>

          {err && <ErrorBox>{err}</ErrorBox>}

          <Button
            variant="primary" full loading={busy}
            disabled={!companyName.trim() || !fullName.trim()
              || !email.trim() || password.length < 6}
            onClick={() => void run(() => signUpCompany({
              email, password, fullName, company: companyName, phone, inn,
            }))}
          >
            Ariza yuborish
          </Button>
          <Button variant="ghost" full onClick={() => { setMode('login'); setErr('') }}>
            Hisobim bor — kirish
          </Button>
        </div>
      </Shell>
    )
  }

  /* ---------------- Kirish ---------------- */
  return (
    <Shell>
      <h2 className="mb-1 text-[17px] font-semibold">Tizimga kirish</h2>
      <p className="mb-4 text-[13px]" style={{ color: 'var(--text-3)' }}>
        Hisobni kompaniya ta'sischisi ochadi.
      </p>
      <div className="space-y-3">
        <Field label="Email" required>
          <Input value={email} onChange={setEmail} type="email"
                 placeholder="ism@kompaniya.uz" autoFocus />
        </Field>
        <Field label="Parol" required>
          <Input value={password} onChange={setPassword} type="password"
                 placeholder="••••••••"
                 onEnter={() => void run(() => signIn(email.trim(), password))} />
        </Field>
        {err && <ErrorBox>{err}</ErrorBox>}
        <Button
          variant="primary" full loading={busy}
          disabled={!email.trim() || !password}
          onClick={() => void run(() => signIn(email.trim(), password))}
        >
          Kirish
        </Button>

        <div className="flex items-center gap-2 pt-1">
          <span className="h-px flex-1" style={{ background: 'var(--border)' }} />
          <span className="text-[12px]" style={{ color: 'var(--text-3)' }}>yoki</span>
          <span className="h-px flex-1" style={{ background: 'var(--border)' }} />
        </div>

        <Button full onClick={() => { setMode('signup'); setErr('') }}>
          <CheckCircle2 size={14} />Yangi kompaniya ro'yxatdan o'tkazish
        </Button>
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center p-4"
         style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-[420px]">
        <div className="mb-5 flex flex-col items-center gap-2 text-center">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl"
            style={{ background: 'var(--brand)', color: 'var(--brand-fg)' }}
          >
            <Building2 size={22} />
          </div>
          <div>
            <div className="text-[16px] font-semibold">Boshqaruv platformasi</div>
            <div className="text-[12.5px]" style={{ color: 'var(--text-3)' }}>
              Sotuv, ombor, moliya va xodimlar
            </div>
          </div>
        </div>
        <Card className="ip-fade">{children}</Card>
      </div>
    </div>
  )
}
