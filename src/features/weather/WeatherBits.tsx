import { compass, skyFromSymbol, type Day, type Sky } from '../../lib/weather'
import { useI18n, type DictKey } from '../../lib/i18n'

/** Simple flat weather pictures. */
export function SkyIcon({ symbol, size = 40 }: { symbol: string | null | undefined; size?: number }) {
  const sky = skyFromSymbol(symbol)
  const sun = <g><circle cx="20" cy="18" r="8" fill="#FDB813" />{[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
    <line key={a} x1="20" y1="4" x2="20" y2="7.5" stroke="#FDB813" strokeWidth="2.5" strokeLinecap="round" transform={`rotate(${a} 20 18)`} />
  ))}</g>
  const cloud = (fill = '#E8EEF3', stroke = '#9AA9B5') => (
    <path d="M12 34h18a7 7 0 0 0 0-14 9 9 0 0 0-17-1 7.5 7.5 0 0 0-1 15z" fill={fill} stroke={stroke} strokeWidth="1.5" />
  )
  const drops = (n: number) => [...Array(n)].map((_, i) => (
    <line key={i} x1={15 + i * 6} y1="37" x2={13 + i * 6} y2="42" stroke="#2F80ED" strokeWidth="2.5" strokeLinecap="round" />
  ))
  const content: Record<Sky, React.ReactNode> = {
    sun,
    moon: <path d="M24 8a11 11 0 1 0 9 17A12 12 0 0 1 24 8z" fill="#F2C94C" />,
    partly: <g transform="translate(-4 -4)">{sun}<g transform="translate(6 6)">{cloud('#fff')}</g></g>,
    cloud: cloud(),
    fog: <g>{cloud()}<line x1="8" y1="38" x2="32" y2="38" stroke="#9AA9B5" strokeWidth="2.5" strokeLinecap="round" /></g>,
    rain: <g transform="translate(0 -4)">{cloud('#D5DEE6')}{drops(3)}</g>,
    showers: <g transform="translate(-2 -4)">{sun}<g transform="translate(4 4)">{cloud('#fff')}</g>{drops(2)}</g>,
    thunder: <g transform="translate(0 -4)">{cloud('#C3CDD6')}<path d="M21 34l-4 7h4l-2 6 7-9h-4l2-4z" fill="#F2C94C" /></g>,
    snow: <g transform="translate(0 -4)">{cloud()}<text x="20" y="44" fontSize="9" textAnchor="middle" fill="#2F80ED">✱ ✱</text></g>,
  }
  return <svg viewBox="0 0 40 44" width={size} height={size} aria-hidden="true">{content[sky]}</svg>
}

/** A ring that fills up with the chance of rain, like a pie chart. */
export function Ring({ value, label, centre, colour }: { value: number; label: string; centre: string; colour: string }) {
  const r = 26
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(100, value))
  return (
    <figure className="dial">
      <svg viewBox="0 0 64 64" width="76" height="76" aria-hidden="true">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--track)" strokeWidth="7" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={colour} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${(v / 100) * c} ${c}`} transform="rotate(-90 32 32)" />
        <text x="32" y="36" textAnchor="middle" className="dial-text">{centre}</text>
      </svg>
      <figcaption>{label}</figcaption>
    </figure>
  )
}

/** Compass with an arrow showing where the wind blows to, and the speed in the middle. */
export function WindDial({ kmh, from, label }: { kmh: number; from: number; label: string }) {
  const { lang } = useI18n()
  return (
    <figure className="dial">
      <svg viewBox="0 0 64 64" width="76" height="76" aria-hidden="true">
        <circle cx="32" cy="32" r="26" fill="none" stroke="var(--track)" strokeWidth="7" />
        {['N', 'E', 'S', 'W'].map((p, i) => (
          <text key={p} x={32 + 21 * Math.sin((i * Math.PI) / 2)} y={34.5 - 21 * Math.cos((i * Math.PI) / 2)} textAnchor="middle" className="dial-tick">{p}</text>
        ))}
        <g transform={`rotate(${from + 180} 32 32)`}>
          <path d="M32 9 l5 9 h-10 z" fill="var(--brand)" />
        </g>
        <text x="32" y="34" textAnchor="middle" className="dial-text">{kmh}</text>
        <text x="32" y="43" textAnchor="middle" className="dial-unit">km/h</text>
      </svg>
      <figcaption>{label} · {compass(from, lang)}</figcaption>
    </figure>
  )
}

export function dayName(date: string, lang: 'en' | 'af', t: (k: DictKey) => string, today: string): string {
  const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
  if (date === today) return t('today')
  if (date === tomorrow) return t('tomorrow')
  return new Intl.DateTimeFormat(lang === 'af' ? 'af-ZA' : 'en-ZA', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))
}

/** Scrollable row of days: picture, high/low, and rain as a small blue bar. */
export function DayStrip({ days, today }: { days: Day[]; today: string }) {
  const { t, lang } = useI18n()
  const maxRain = Math.max(10, ...days.map((d) => d.rainMm))
  return (
    <div className="day-strip">
      {days.map((d) => (
        <div key={d.date} className={`day-tile ${d.date === today ? 'on' : ''}`}>
          <span className="day-name">{dayName(d.date, lang, t, today)}</span>
          <SkyIcon symbol={d.symbol} size={34} />
          <span className="day-temp"><strong>{d.max}°</strong> <span className="muted">{d.min}°</span></span>
          <span className="rain-bar" aria-label={`${d.rainMm} mm`}><span style={{ height: `${(d.rainMm / maxRain) * 100}%` }} /></span>
          <span className="day-rain">{d.rainMm > 0 ? `${d.rainMm} mm` : '–'}</span>
        </div>
      ))}
    </div>
  )
}
