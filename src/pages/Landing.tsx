import { useNavigate } from 'react-router-dom'
import {
  ArrowRight, BarChart3, Boxes, Check, FileText, Layers,
  MessageCircle, ShieldCheck, Wallet,
} from 'lucide-react'
import { Logo, LogoMark } from '../components/Logo'
import { Button } from '../components/ui'
import LangSwitch from '../components/LangSwitch'

/**
 * Ochiq sahifa — hisobi yo'q odam shuni ko'radi.
 * Vazifasi bitta: platforma nima qilishini aytib, ro'yxatdan
 * o'tkazish yoki kirishga olib borish.
 */

const FEATURES = [
  {
    icon: FileText,
    title: '1C ga o‘xshash hujjatlar',
    body: 'Menejerlaringiz yillar davomida 1C da ishlagan bo‘lsa, qayta '
      + 'o‘rganishi shart emas. Buyruqlar paneli, zakladkalar, Insert va '
      + 'Ctrl+Enter — hammasi o‘sha joyda.',
  },
  {
    icon: Boxes,
    title: 'Ombor va partiya hisobi',
    body: 'FIFO bo‘yicha tan narx. Qaysi partiyadan qancha ketgani, erkin '
      + 'qoldiq qancha qolgani va nima tugab qolayotgani doim ko‘rinib turadi.',
  },
  {
    icon: Wallet,
    title: 'Pul zanjiri uzilmaydi',
    body: 'Sotuvdan qarzga, qarzdan to‘lovga, to‘lovdan kassaga — har bir '
      + 'so‘m izma-iz kuzatiladi. Pul qayerdadir qotib qolmaydi.',
  },
  {
    icon: BarChart3,
    title: 'Haqiqiy marja',
    body: 'Foyda QQS siz sof summadan hisoblanadi. Marja chegaradan pastga '
      + 'tushsa hujjat tasdiqqa tushadi — sizdan so‘ramay sotib bo‘lmaydi.',
  },
  {
    icon: ShieldCheck,
    title: 'Kim nimani ko‘radi',
    body: 'Rollarni o‘zingiz sozlaysiz: menejer faqat o‘z mijozini ko‘radi, '
      + 'tan narx va kassa yopiq. Cheklov interfeysda emas, bazada turadi.',
  },
  {
    icon: MessageCircle,
    title: 'Telegram',
    body: 'Kassa, qarzdorlar va tugayotgan tovar botga keladi. Tasdiqlashni '
      + 'ham to‘g‘ridan-to‘g‘ri Telegramdan qilasiz.',
  },
]

const MODULES = [
  'Sotuv va buyurtma', 'Qaytarish', 'Xaridlar', 'Ombor',
  'Inventarizatsiya', 'Mijozlar va CRM', 'Voronka', 'Uchrashuvlar',
  'Debitor', 'Moliya va P&L', 'Xodimlar va oylik', 'Vazifalar',
  'Tasdiqlash', 'AI tahlil', 'Tovar va narx', 'Hujjat chop etish',
]

const STEPS = [
  { n: '1', t: 'Ariza yuborasiz', b: 'Kompaniya nomi va aloqa ma’lumotlari — bir daqiqalik ish.' },
  { n: '2', t: 'Tasdiqlaymiz', b: 'Odatda bir ish kuni ichida. Tasdiqlangach xabar keladi.' },
  { n: '3', t: 'Ishlay boshlaysiz', b: 'Ombor, birliklar, narx turlari va rollar tayyor holda beriladi.' },
]

export default function Landing() {
  const nav = useNavigate()

  return (
    <div className="h-full overflow-y-auto" style={{ background: 'var(--bg)' }}>
      {/* ---------------- Yuqori panel ---------------- */}
      <header
        className="sticky top-0 z-30 border-b backdrop-blur"
        style={{ background: 'color-mix(in srgb, var(--surface) 88%, transparent)' }}
      >
        <div className="mx-auto flex h-14 max-w-[1100px] items-center justify-between px-4">
          <Logo size={30} />
          <div className="flex items-center gap-2">
            <LangSwitch size="sm" />
            <Button size="sm" variant="ghost" onClick={() => nav('/kirish')}>
              Kirish
            </Button>
            <Button size="sm" variant="primary" onClick={() => nav('/royxat')}>
              Boshlash
            </Button>
          </div>
        </div>
      </header>

      {/* ---------------- Sarlavha ---------------- */}
      <section className="mx-auto max-w-[1100px] px-4 pb-14 pt-16 sm:pt-24">
        <div className="max-w-[720px]">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px]"
            style={{ borderColor: 'var(--border-2)', color: 'var(--text-2)' }}
          >
            <Layers size={13} />
            Savdo va distributsiya uchun
          </span>

          <h1 className="mt-4 text-[34px] font-semibold leading-[1.12] tracking-[-0.02em]
            sm:text-[46px]">
            Biznesingiz bitta ekranda:
            <br />
            <span style={{ color: 'var(--brand)' }}>sotuvdan foydagacha</span>
          </h1>

          <p className="mt-4 max-w-[600px] text-[15.5px] leading-relaxed"
             style={{ color: 'var(--text-2)' }}>
            Sales Growth — sotuv, ombor, moliya va xodimlarni bir joyda
            boshqaradigan platforma. Har bir hujjat, har bir so‘m va har bir
            dona tovar izma-iz kuzatiladi.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button variant="primary" onClick={() => nav('/royxat')}>
              Kompaniyani ro‘yxatdan o‘tkazish
              <ArrowRight size={15} />
            </Button>
            <Button onClick={() => nav('/kirish')}>Hisobim bor</Button>
          </div>

          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px]"
               style={{ color: 'var(--text-3)' }}>
            {['O‘zbek tilida', 'QQS bilan ishlaydi', 'Ma’lumot ko‘chirib beriladi']
              .map((x) => (
                <span key={x} className="inline-flex items-center gap-1.5">
                  <Check size={13} style={{ color: 'var(--ok)' }} />{x}
                </span>
              ))}
          </div>
        </div>
      </section>

      {/* ---------------- Imkoniyatlar ---------------- */}
      <section className="mx-auto max-w-[1100px] px-4 pb-14">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = f.icon
            return (
              <div
                key={f.title}
                className="rounded-xl border p-5"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                <span
                  className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}
                >
                  <Icon size={17} />
                </span>
                <h3 className="mb-1.5 text-[15px] font-semibold">{f.title}</h3>
                <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
                  {f.body}
                </p>
              </div>
            )
          })}
        </div>
      </section>

      {/* ---------------- Modullar ---------------- */}
      <section className="mx-auto max-w-[1100px] px-4 pb-14">
        <div
          className="rounded-xl border p-6"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <h2 className="mb-1 text-[19px] font-semibold">Ichida nima bor</h2>
          <p className="mb-4 text-[13.5px]" style={{ color: 'var(--text-3)' }}>
            Bo‘limlar bir-biriga ulangan: ombordagi harakat moliyada,
            sotuvdagi marja esa menejer ko‘rsatkichida darhol aks etadi.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {MODULES.map((m) => (
              <span
                key={m}
                className="rounded-lg border px-2.5 py-1 text-[13px]"
                style={{ borderColor: 'var(--border-2)', color: 'var(--text-2)' }}
              >
                {m}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Qanday boshlanadi ---------------- */}
      <section className="mx-auto max-w-[1100px] px-4 pb-14">
        <h2 className="mb-4 text-[19px] font-semibold">Qanday boshlanadi</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="rounded-xl border p-5"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <span
                className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full
                  text-[14px] font-bold"
                style={{ background: 'var(--brand)', color: 'var(--brand-fg)' }}
              >
                {s.n}
              </span>
              <h3 className="mb-1 text-[15px] font-semibold">{s.t}</h3>
              <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
                {s.b}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- Chaqiruv ---------------- */}
      <section className="mx-auto max-w-[1100px] px-4 pb-16">
        <div
          className="flex flex-wrap items-center justify-between gap-5 rounded-xl p-7"
          style={{ background: '#1c1c1e', color: '#fff' }}
        >
          <div className="min-w-[260px] flex-1">
            <h2 className="text-[21px] font-semibold tracking-[-0.01em]">
              Bugun boshlang
            </h2>
            <p className="mt-1.5 text-[14px]" style={{ color: 'rgba(255,255,255,.72)' }}>
              Ariza bir daqiqa oladi. Tasdiqlangach kompaniyangiz ishga tayyor
              holda beriladi.
            </p>
          </div>
          <button
            onClick={() => nav('/royxat')}
            className="inline-flex h-11 items-center gap-2 rounded-lg px-5 text-[14px] font-semibold
              transition-opacity hover:opacity-85"
            style={{ background: '#fff', color: '#1c1c1e' }}
          >
            Ro‘yxatdan o‘tish
            <ArrowRight size={16} />
          </button>
        </div>
      </section>

      {/* ---------------- Pastki qism ---------------- */}
      <footer className="border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between
          gap-3 px-4 py-6">
          <span className="inline-flex items-center gap-2">
            <LogoMark size={22} />
            <span className="text-[13px] font-medium">Sales Growth</span>
          </span>
          <span className="text-[12.5px]" style={{ color: 'var(--text-3)' }}>
            Boshqaruv platformasi · O‘zbekiston
          </span>
        </div>
      </footer>
    </div>
  )
}
