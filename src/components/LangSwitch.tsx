import { useLang, type Lang } from '../lib/i18n'

/**
 * Til tanlagich — UZ / RU.
 * Tanlov brauzerda saqlanadi, shuning uchun keyingi kirishda ham qoladi.
 */

const OPTS: { key: Lang; label: string; title: string }[] = [
  { key: 'uz', label: 'UZ', title: "O'zbekcha" },
  { key: 'ru', label: 'RU', title: 'Русский' },
]

export default function LangSwitch({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const { lang, setLang } = useLang()
  const pad = size === 'sm' ? 'px-1.5 py-[3px] text-[11px]' : 'px-2 py-1 text-[12px]'

  return (
    <div
      className="inline-flex overflow-hidden rounded-lg border"
      style={{ borderColor: 'var(--border-2)' }}
    >
      {OPTS.map((o) => {
        const on = lang === o.key
        return (
          <button
            key={o.key}
            onClick={() => setLang(o.key)}
            title={o.title}
            className={`${pad} font-semibold transition-colors`}
            style={{
              background: on ? 'var(--brand)' : 'transparent',
              color: on ? 'var(--brand-fg)' : 'var(--text-3)',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
