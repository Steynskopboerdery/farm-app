import { Link } from 'react-router-dom'
import { ErrorText, Loading } from '../../components/ui'
import { todayIso } from '../../lib/calc/dates'
import { formatDateTime } from '../../lib/format'
import { useI18n, type DictKey } from '../../lib/i18n'
import { useFarmLocation, useWeather } from '../../lib/useWeather'
import { compass, goodForSpraying, skyFromSymbol } from '../../lib/weather'
import { dayName, SkyIcon } from './WeatherBits'

export function WeatherPage() {
  const { t, lang } = useI18n()
  const weather = useWeather()
  const location = useFarmLocation()
  const today = todayIso()

  if (weather.isLoading) return <Loading />
  if (!weather.data) return <div className="page"><ErrorText error={weather.error} /></div>
  const { hours, days, sprayWindows } = weather.data
  const next48 = hours.slice(0, 48)
  const maxRain = Math.max(2, ...next48.map((h) => h.rainMm ?? 0))
  const tMin = Math.min(...days.map((d) => d.min))
  const tMax = Math.max(...days.map((d) => d.max))
  const fmtHour = (h: number) => `${String(h).padStart(2, '0')}:00`

  return (
    <div className="page stack">
      <Link to="/" className="back">‹ {t('navHome')}</Link>
      <h1>{t('weather')}</h1>

      <section className="card">
        <h2>{t('hourly')}</h2>
        <div className="hour-strip">
          {next48.map((h, i) => (
            <div key={h.time} className={`hour-col ${goodForSpraying(next48, i) ? 'spray-ok' : ''}`}>
              <span className="tiny muted">{h.hour === 0 || i === 0 ? dayName(h.date, lang, t, today) : ' '}</span>
              <span className="small"><strong>{fmtHour(h.hour)}</strong></span>
              <SkyIcon symbol={h.symbol} size={30} />
              <span><strong>{Math.round(h.temp)}°</strong></span>
              <span className="rain-bar small-bar"><span style={{ height: `${((h.rainMm ?? 0) / maxRain) * 100}%` }} /></span>
              <span className="tiny">{h.rainMm ? `${h.rainMm}` : '–'}</span>
              <span className="tiny">{h.rainChance != null ? `${Math.round(h.rainChance)}%` : ''}</span>
              <span className="wind-arrow" style={{ transform: `rotate(${h.windDir + 180}deg)` }}>↑</span>
              <span className="tiny">{h.windKmh}</span>
            </div>
          ))}
        </div>
        <p className="tiny muted">{t('hourlyLegend')}</p>
      </section>

      <section className="card">
        <h2>{t('sprayWindows')}</h2>
        {sprayWindows.length === 0 ? <p className="muted">{t('sprayNone')}</p> : (
          <ul className="list">
            {sprayWindows.map((w) => (
              <li key={w.start} className="row">
                <span className="spray-dot good" />
                <div className="grow"><strong>{dayName(w.date, lang, t, today)}</strong></div>
                <div>{fmtHour(w.fromHour)} – {fmtHour(w.toHour)}</div>
              </li>
            ))}
          </ul>
        )}
        <p className="advice">{t('sprayAdvice')}</p>
      </section>

      <section className="card">
        <h2>{t('forecastDays')}</h2>
        <ul className="list">
          {days.map((d) => (
            <li key={d.date} className="row day-row">
              <span className="day-row-name">{dayName(d.date, lang, t, today)}</span>
              <SkyIcon symbol={d.symbol} size={34} />
              <div className="grow">
                <div className="temp-range">
                  <span className="muted">{d.min}°</span>
                  <span className="range-track">
                    <span className="range-fill" style={{ left: `${((d.min - tMin) / Math.max(1, tMax - tMin)) * 100}%`, right: `${100 - ((d.max - tMin) / Math.max(1, tMax - tMin)) * 100}%` }} />
                  </span>
                  <strong>{d.max}°</strong>
                </div>
                <div className="tiny muted">
                  {t(`sky_${skyFromSymbol(d.symbol)}` as DictKey)} · 💧 {d.rainMm} mm{d.rainChance != null ? ` (${Math.round(d.rainChance)}%)` : ''} · {t('wind')} {d.windMaxKmh} km/h{d.windDir != null ? ` ${compass(d.windDir, lang)}` : ''}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <p className="tiny muted center">
        {t('weatherSource')}{weather.data.updatedAt ? ` · ${t('updatedAt')} ${formatDateTime(weather.data.updatedAt, lang)}` : ''}
        <br />{location.lat.toFixed(3)}, {location.lng.toFixed(3)}{location.source === 'default' ? ` · ${t('weatherLocationDefault')}` : ''}
      </p>
    </div>
  )
}
