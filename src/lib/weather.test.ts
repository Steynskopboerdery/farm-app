import { describe, expect, it } from 'vitest'
import { compass, conditionsAt, sprayWarnings, daily, hourly, localParts, meanDirection, skyFromSymbol, sprayWindows, weatherAlerts, type MetEntry, type MetForecast } from './weather'

// Builds a MET-style entry. Wind in m/s like the real feed.
function entry(time: string, o: { t?: number; w?: number; g?: number; dir?: number; rain?: number; chance?: number; sym?: string; six?: { rain: number; max: number; min: number; chance?: number } } = {}): MetEntry {
  return {
    time,
    data: {
      instant: { details: { air_temperature: o.t ?? 20, wind_speed: o.w ?? 2, wind_speed_of_gust: o.g, wind_from_direction: o.dir ?? 180, relative_humidity: 60 } },
      ...(o.six
        ? { next_6_hours: { summary: { symbol_code: o.sym ?? 'rain' }, details: { precipitation_amount: o.six.rain, air_temperature_max: o.six.max, air_temperature_min: o.six.min, probability_of_precipitation: o.six.chance } } }
        : { next_1_hours: { summary: { symbol_code: o.sym ?? 'clearsky_day' }, details: { precipitation_amount: o.rain ?? 0, probability_of_precipitation: o.chance ?? 0 } } }),
    },
  }
}
const forecast = (ts: MetEntry[]): MetForecast => ({ properties: { timeseries: ts } })
const hourISO = (h: number) => new Date(Date.UTC(2026, 9, 28, h)).toISOString().replace('.000', '')

describe('localParts', () => {
  it('shows South African time (UTC+2)', () => {
    expect(localParts('2026-10-27T22:30:00Z')).toEqual({ date: '2026-10-28', hour: 0 })
  })
})

describe('hourly', () => {
  it('turns m/s into km/h', () => {
    const [h] = hourly(forecast([entry('2026-10-28T06:00:00Z', { w: 5, g: 10 })]))
    expect(h.windKmh).toBe(18)
    expect(h.gustKmh).toBe(36)
    expect(h.hour).toBe(8)
  })
})

describe('daily', () => {
  it('adds hourly rain, then 6-hour blocks, without counting twice', () => {
    const ts = [
      entry('2026-10-28T04:00:00Z', { rain: 1, t: 12 }),
      entry('2026-10-28T05:00:00Z', { rain: 2, t: 15 }),
      // From here MET only gives 6-hour blocks.
      entry('2026-10-28T06:00:00Z', { t: 18, six: { rain: 4, max: 24, min: 17, chance: 70 } }),
      entry('2026-10-28T12:00:00Z', { t: 22, six: { rain: 0.5, max: 23, min: 16, chance: 20 } }),
    ]
    const [d] = daily(forecast(ts))
    expect(d.date).toBe('2026-10-28')
    expect(d.rainMm).toBe(7.5)
    expect(d.max).toBe(24)
    expect(d.min).toBe(12)
    expect(d.rainChance).toBe(70)
  })

  it('splits days at local midnight', () => {
    const ts = [entry('2026-10-28T21:00:00Z', { rain: 1 }), entry('2026-10-28T22:00:00Z', { rain: 3 })]
    expect(daily(forecast(ts)).map((d) => [d.date, d.rainMm])).toEqual([['2026-10-28', 1], ['2026-10-29', 3]])
  })
})

describe('wind direction', () => {
  it('averages across north properly', () => {
    expect(meanDirection([350, 10])).toBe(0)
    expect(meanDirection([170, 190])).toBe(180)
  })
  it('names the compass point, in English and Afrikaans', () => {
    expect(compass(135)).toBe('SE')
    expect(compass(135, 'af')).toBe('SO')
    expect(compass(355)).toBe('N')
  })
})

describe('sprayWindows', () => {
  it('finds calm, dry daylight hours and skips windy or rainy ones', () => {
    // Local 06:00–12:00 (UTC 04–10). Wind m/s: 2 = 7 km/h (good), 6 = 22 km/h (too windy).
    const ts = [
      entry(hourISO(4), { w: 2 }), entry(hourISO(5), { w: 2 }), entry(hourISO(6), { w: 2 }),
      entry(hourISO(7), { w: 6 }),
      entry(hourISO(8), { w: 2 }), entry(hourISO(9), { w: 2 }), entry(hourISO(10), { w: 2, rain: 1.5 }),
    ]
    const w = sprayWindows(hourly(forecast(ts)))
    // 06:00–09:00 is good. 10:00 has rain at 12:00 within 3 hours, so 10:00–12:00 is not.
    expect(w.map((x) => [x.fromHour, x.toHour])).toEqual([[6, 9]])
  })
})

describe('weatherAlerts', () => {
  it('warns about frost, heavy rain, strong wind and heat', () => {
    const a = weatherAlerts([
      { date: '2026-07-01', min: 1, max: 14, rainMm: 25, rainChance: 90, windMaxKmh: 30, gustMaxKmh: 60, windDir: 300, symbol: 'rain' },
      { date: '2026-12-01', min: 18, max: 37, rainMm: 0, rainChance: 0, windMaxKmh: 10, gustMaxKmh: 20, windDir: 120, symbol: 'clearsky_day' },
    ])
    expect(a.map((x) => x.kind)).toEqual(['frost', 'heavyRain', 'wind', 'heat'])
  })
})

describe('skyFromSymbol', () => {
  it('groups MET symbols', () => {
    expect(skyFromSymbol('lightrainshowers_day')).toBe('showers')
    expect(skyFromSymbol('heavyrainandthunder')).toBe('thunder')
    expect(skyFromSymbol('partlycloudy_night')).toBe('moon')
    expect(skyFromSymbol('clearsky_day')).toBe('sun')
    expect(skyFromSymbol('cloudy')).toBe('cloud')
  })
})

describe('spraying conditions on the record', () => {
  const hour = (time: string, windKmh: number) => ({ time, date: time.slice(0, 10), hour: 0, temp: 20, windKmh, gustKmh: null, windDir: 180, humidity: 60, rainMm: 0, rainChance: 0, symbol: null })
  const hours = [hour('2026-10-29T06:00:00Z', 5), hour('2026-10-29T07:00:00Z', 8), hour('2026-10-29T08:00:00Z', 12)]
  it('takes the nearest forecast hour', () => {
    expect(conditionsAt(hours, new Date('2026-10-29T07:20:00Z'))?.windKmh).toBe(8)
  })
  it('nothing when the time is outside the forecast', () => {
    expect(conditionsAt(hours, new Date('2026-10-28T07:00:00Z'))).toBeNull()
  })
  it('flags wind, gusts, heat and dry air', () => {
    expect(sprayWarnings({ windKmh: 18, gustKmh: 30, temp: 32, humidity: 30 })).toEqual(['windy', 'gusty', 'hot', 'dry'])
    expect(sprayWarnings({ windKmh: 8, gustKmh: 14, temp: 18, humidity: 65 })).toEqual([])
  })
})
