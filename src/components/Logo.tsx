/**
 * Sales Growth belgisi.
 * To'q kvadrat ichida o'sish strelkasi — qoraytirilgan fonda oq,
 * shuning uchun kunduzgi va tungi rejimda bir xil ko'rinadi.
 */

export function LogoMark({ size = 40 }: { size?: number }) {
  const r = size * 0.24
  return (
    <svg
      width={size} height={size} viewBox="0 0 48 48" fill="none"
      xmlns="http://www.w3.org/2000/svg" aria-hidden
      style={{ display: 'block', borderRadius: r }}
    >
      <defs>
        <linearGradient id="sg-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a3a3c" />
          <stop offset="100%" stopColor="#1c1c1e" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="11.5" fill="url(#sg-bg)" />
      <g
        stroke="#fff" strokeWidth="3.4"
        strokeLinecap="round" strokeLinejoin="round" fill="none"
      >
        {/* pastdan yuqoriga ko'tarilayotgan chiziq */}
        <path d="M12 31.5 L20.5 23 L25.5 28 L35.5 16.5" />
        {/* strelka uchi */}
        <path d="M28.5 16.5 L35.5 16.5 L35.5 23.5" />
      </g>
    </svg>
  )
}

/** Belgi + yozuv */
export function Logo({
  size = 36, className = '', showText = true,
}: { size?: number; className?: string; showText?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      {showText && (
        <span
          className="font-semibold leading-none tracking-[-0.02em]"
          style={{ fontSize: size * 0.62 }}
        >
          Sales Growth
        </span>
      )}
    </span>
  )
}
