import { Link } from 'react-router-dom'
import { todayIso } from '../../lib/calc/dates'
import { useI18n, type DictKey } from '../../lib/i18n'
import { useFarmLocation, useWeather } from '../../lib/useWeather'
import { skyFromSymbol } from '../../lib/weather'
import { dayName, DayStrip, Ring, SkyIcon, WindDial } from './WeatherBits'

/** Current conditions for the home-screen header. */
export function WeatherNow() {
  const { t } = useI18n()
  const weather = useWeather()
  const now = weather.data?.hours[0]
  if (!now) return <p className="hero-weather muted-light">{weather.isError ? t('weatherError') : t('loading')}</p>
  return (
    <div className="hero-weather">
      <SkyIcon symbol={now.symbol} size={44} />
      <div className="hero-temp">{Math.round(now.temp)}°</div>
      <div className="hero-sky">{t(`sky_${skyFromSymbol(now.symbol)}` as DictKey)}</div>
    </div>
  )
}

/** Rain, wind and humidity dials, the week ahead, spray window and warnings. */
export function WeatherCard() {
  const { t, lang } = useI18n()
  const weather = useWeather()
  const location = useFarmLocation()
  const today = todayIso()

  if (weather.isLoading) return <section className="card"><h2>{t('weather')}</h2><p className="muted">{t('loading')}</p></section>
  if (!weather.data) return <section className="card"><h2>{t('weather')}</h2><p className="muted">{t('weatherError')}</p></section>

  const { hours, days, sprayWindows, alerts } = weather.data
  const now = hours[0]
  const d0 = days.find((d) => d.date === today) ?? days[0]
  const next = sprayWindows[0]
  const fmtHour = (h: number) => `${String(h).padStart(2, '0')}:00`

  return (
    <section className="card">
      <div className="card-head">
        <h2>{t('weather')}</h2>
        <Link to="/weather" className="link-more">{t('fullForecast')} ›</Link>
      </div>

      {alerts.length > 0 && (
        <div className="alerts">
          {alerts.slice(0, 3).map((a) => (
            <div key={`${a.date}-${a.kind}`} className={`alert alert-${a.kind}`}>
              {t(`alert_${a.kind}` as DictKey, { day: dayName(a.date, lang, t, today), value: Math.round(a.value) })}
            </div>
          ))}
        </div>
      )}

      <div className="dials">
        {d0.rainChance != null
          ? <Ring value={d0.rainChance} centre={`${Math.round(d0.rainChance)}%`} label={t('chanceOfRain')} colour="#2F80ED" />
          : <Ring value={Math.min(100, d0.rainMm * 5)} centre={`${d0.rainMm}`} label={t('rainTodayMm')} colour="#2F80ED" />}
        <WindDial kmh={now.windKmh} from={now.windDir} label={t('wind')} />
        <Ring value={now.humidity ?? 0} centre={`${now.humidity ?? '–'}%`} label={t('humidity')} colour="#14B8A6" />
      </div>

      <div className={`spray-badge ${next && next.date === today && next.fromHour <= Number(new Date().getHours()) ? 'good' : next ? 'ok' : 'bad'}`}>
        <span className="spray-dot" />
        <span>
          {next
            ? t('sprayNext', { day: dayName(next.date, lang, t, today), from: fmtHour(next.fromHour), to: fmtHour(next.toHour) })
            : t('sprayNone')}
        </span>
      </div>

      <DayStrip days={days.slice(0, 7)} today={today} />
      <p className="tiny muted">
        {t('weatherSource')}{location.source === 'default' ? ` · ${t('weatherLocationDefault')}` : ''}
      </p>
    </section>
  )
}
