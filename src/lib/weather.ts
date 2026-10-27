// Turns MET Norway's Locationforecast into simple hourly / daily numbers and farm advice.
// Times are shown in South African time (UTC+2, no daylight saving).

export interface MetEntry {
  time: string
  data: {
    instant: { details: Record<string, number | undefined> }
    next_1_hours?: { summary: { symbol_code: string }; details: Record<string, number | undefined> }
    next_6_hours?: { summary: { symbol_code: string }; details: Record<string, number | undefined> }
    next_12_hours?: { summary: { symbol_code: string }; details?: Record<string, number | undefined> }
  }
}
export interface MetForecast { properties: { meta?: { updated_at?: string }; timeseries: MetEntry[] } }

export interface Hour {
  time: string       // ISO, UTC
  date: string       // local YYYY-MM-DD
  hour: number       // local 0–23
  temp: number
  windKmh: number
  gustKmh: number | null
  windDir: number    // degrees the wind comes FROM
  humidity: number | null
  rainMm: number | null
  rainChance: number | null
  symbol: string | null
}

export interface Day {
  date: string
  min: number
  max: number
  rainMm: number
  rainChance: number | null
  windMaxKmh: number
  gustMaxKmh: number | null
  windDir: number | null
  symbol: string | null
}

const TZ = 'Africa/Johannesburg'
const localFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })

export function localParts(iso: string) {
  const p = Object.fromEntries(localFmt.formatToParts(new Date(iso)).map((x) => [x.type, x.value]))
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) }
}

const kmh = (ms: number | undefined) => (ms == null ? null : Math.round(ms * 3.6))
const round1 = (n: number) => Math.round(n * 10) / 10

/** Hour-by-hour values for the period MET gives hourly data (about 2–3 days). */
export function hourly(f: MetForecast): Hour[] {
  return f.properties.timeseries
    .filter((e) => e.data.next_1_hours)
    .map((e) => {
      const d = e.data.instant.details
      const n1 = e.data.next_1_hours!
      return {
        time: e.time,
        ...localParts(e.time),
        temp: round1(d.air_temperature ?? 0),
        windKmh: kmh(d.wind_speed) ?? 0,
        gustKmh: kmh(d.wind_speed_of_gust),
        windDir: Math.round(d.wind_from_direction ?? 0),
        humidity: d.relative_humidity == null ? null : Math.round(d.relative_humidity),
        rainMm: n1.details.precipitation_amount ?? null,
        rainChance: n1.details.probability_of_precipitation ?? null,
        symbol: n1.summary.symbol_code,
      }
    })
}

/** One line per local day. Uses hourly data while it lasts, then MET's 6-hour blocks, never counting rain twice. */
export function daily(f: MetForecast): Day[] {
  const days = new Map<string, Day & { symbolHour: number; dirs: number[] }>()
  let coveredUntil = 0
  for (const e of f.properties.timeseries) {
    const t = Date.parse(e.time)
    const { date, hour } = localParts(e.time)
    const d = e.data.instant.details
    const day = days.get(date) ?? {
      date, min: Infinity, max: -Infinity, rainMm: 0, rainChance: null, windMaxKmh: 0, gustMaxKmh: null,
      windDir: null, symbol: null, symbolHour: -99, dirs: [],
    }
    if (d.air_temperature != null) {
      day.min = Math.min(day.min, d.air_temperature)
      day.max = Math.max(day.max, d.air_temperature)
    }
    const wind = kmh(d.wind_speed) ?? 0
    if (wind >= day.windMaxKmh) day.windMaxKmh = wind
    const gust = kmh(d.wind_speed_of_gust)
    if (gust != null) day.gustMaxKmh = Math.max(day.gustMaxKmh ?? 0, gust)
    if (d.wind_from_direction != null) day.dirs.push(d.wind_from_direction)

    const block = t >= coveredUntil ? (e.data.next_1_hours ? { n: e.data.next_1_hours, hours: 1 } : e.data.next_6_hours ? { n: e.data.next_6_hours, hours: 6 } : null) : null
    if (block) {
      day.rainMm += block.n.details.precipitation_amount ?? 0
      const chance = block.n.details.probability_of_precipitation
      if (chance != null) day.rainChance = Math.max(day.rainChance ?? 0, chance)
      if (block.hours === 6) {
        const bmax = block.n.details.air_temperature_max
        const bmin = block.n.details.air_temperature_min
        if (bmax != null) day.max = Math.max(day.max, bmax)
        if (bmin != null) day.min = Math.min(day.min, bmin)
      }
      coveredUntil = t + block.hours * 3_600_000
      // The day's picture: the block closest to midday.
      if (Math.abs(hour - 12) < Math.abs(day.symbolHour - 12)) {
        day.symbol = block.n.summary.symbol_code
        day.symbolHour = hour
      }
    }
    days.set(date, day)
  }
  return [...days.values()]
    .filter((d) => Number.isFinite(d.min))
    .map(({ symbolHour: _s, dirs, ...d }) => ({
      ...d,
      min: Math.round(d.min),
      max: Math.round(d.max),
      rainMm: round1(d.rainMm),
      windDir: dirs.length ? meanDirection(dirs) : null,
    }))
}

/** Average of compass directions (so 350° and 10° average to 0°, not 180°). */
export function meanDirection(degrees: number[]): number {
  const x = degrees.reduce((s, d) => s + Math.cos((d * Math.PI) / 180), 0)
  const y = degrees.reduce((s, d) => s + Math.sin((d * Math.PI) / 180), 0)
  return Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360)
}

const POINTS = { en: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'], af: ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'] }
export function compass(deg: number, lang: 'en' | 'af' = 'en'): string {
  return POINTS[lang][Math.round(((deg % 360) + 360) % 360 / 45) % 8]
}

/** Spraying conditions for one hour: light steady wind, dry for the next 3 hours, mild temperature, daylight. */
export function goodForSpraying(hours: Hour[], i: number): boolean {
  const h = hours[i]
  if (h.hour < 5 || h.hour > 19) return false
  if (h.windKmh < 3 || h.windKmh > 15) return false
  if ((h.gustKmh ?? h.windKmh) > 25) return false
  if (h.temp < 5 || h.temp > 30) return false
  const next3 = hours.slice(i, i + 3)
  return next3.every((x) => (x.rainMm ?? 0) < 0.2 && (x.rainChance ?? 0) < 40)
}

/** Stretches of at least 2 good spraying hours in a row. */
export function sprayWindows(hours: Hour[]) {
  const windows: { start: string; end: string; date: string; fromHour: number; toHour: number }[] = []
  let run: Hour[] = []
  const flush = () => {
    if (run.length >= 2) {
      const last = run[run.length - 1]
      windows.push({ start: run[0].time, end: last.time, date: run[0].date, fromHour: run[0].hour, toHour: last.hour + 1 })
    }
    run = []
  }
  hours.forEach((h, i) => {
    const prev = run[run.length - 1]
    const consecutive = prev && Date.parse(h.time) - Date.parse(prev.time) === 3_600_000 && prev.date === h.date
    if (goodForSpraying(hours, i) && (run.length === 0 || consecutive)) run.push(h)
    else {
      flush()
      if (goodForSpraying(hours, i)) run.push(h)
    }
  })
  flush()
  return windows
}

export type AlertKind = 'frost' | 'heavyRain' | 'wind' | 'heat'
/** Days worth a warning on the home screen. */
export function weatherAlerts(days: Day[]): { date: string; kind: AlertKind; value: number }[] {
  const out: { date: string; kind: AlertKind; value: number }[] = []
  for (const d of days) {
    if (d.min <= 2) out.push({ date: d.date, kind: 'frost', value: d.min })
    if (d.rainMm >= 20) out.push({ date: d.date, kind: 'heavyRain', value: d.rainMm })
    const gust = Math.max(d.gustMaxKmh ?? 0, d.windMaxKmh)
    if (gust >= 50) out.push({ date: d.date, kind: 'wind', value: gust })
    if (d.max >= 35) out.push({ date: d.date, kind: 'heat', value: d.max })
  }
  return out
}

export type Sky = 'sun' | 'partly' | 'cloud' | 'fog' | 'rain' | 'showers' | 'thunder' | 'snow' | 'moon'
/** Groups MET's symbol codes (e.g. "lightrainshowers_day") into a few pictures. */
export function skyFromSymbol(symbol: string | null | undefined): Sky {
  const s = symbol ?? ''
  if (s.includes('thunder')) return 'thunder'
  if (s.includes('snow') || s.includes('sleet')) return 'snow'
  if (s.includes('showers')) return 'showers'
  if (s.includes('rain')) return 'rain'
  if (s.startsWith('fog')) return 'fog'
  if (s.startsWith('cloudy')) return 'cloud'
  if (s.startsWith('partlycloudy') || s.startsWith('fair')) return s.endsWith('_night') ? 'moon' : 'partly'
  if (s.startsWith('clearsky')) return s.endsWith('_night') ? 'moon' : 'sun'
  return 'cloud'
}
