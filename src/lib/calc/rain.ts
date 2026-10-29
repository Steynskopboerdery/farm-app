// Rain gauge totals. With several gauges, a day's rain is the average of the gauges read that day.

export interface RainLite { date: string; mm: number; gauge: string | null }

const r1 = (n: number) => Math.round(n * 10) / 10

/** Rain per day (average over the gauges read that day). */
export function dailyRain(readings: RainLite[]): Map<string, number> {
  const byDay = new Map<string, Map<string, number>>()
  for (const r of readings) {
    const g = (r.gauge ?? '').trim().toLowerCase()
    const day = byDay.get(r.date) ?? new Map<string, number>()
    day.set(g, (day.get(g) ?? 0) + Number(r.mm))   // two readings at one gauge on one day add up
    byDay.set(r.date, day)
  }
  const out = new Map<string, number>()
  for (const [date, gauges] of byDay) {
    const vals = [...gauges.values()]
    out.set(date, r1(vals.reduce((a, b) => a + b, 0) / vals.length))
  }
  return out
}

/** Rain between two dates, inclusive. */
export function rainBetween(readings: RainLite[], from: string, to: string): number {
  let sum = 0
  for (const [date, mm] of dailyRain(readings)) if (date >= from && date <= to) sum += mm
  return r1(sum)
}

/** Monthly totals (index 0 = January) for each year that has readings. */
export function monthlyByYear(readings: RainLite[]): Map<number, number[]> {
  const out = new Map<number, number[]>()
  for (const [date, mm] of dailyRain(readings)) {
    const y = Number(date.slice(0, 4))
    const m = Number(date.slice(5, 7)) - 1
    const months = out.get(y) ?? Array(12).fill(0)
    months[m] = r1(months[m] + mm)
    out.set(y, months)
  }
  return out
}

/** This year so far against the same days of earlier years (and their average). */
export function yearToDate(readings: RainLite[], today: string) {
  const years = [...monthlyByYear(readings).keys()].sort()
  const md = today.slice(5)
  const year = Number(today.slice(0, 4))
  const rows = years.map((y) => ({ year: y, mm: rainBetween(readings, `${y}-01-01`, `${y}-${md}`) }))
  const earlier = rows.filter((r) => r.year < year)
  const average = earlier.length ? r1(earlier.reduce((s, r) => s + r.mm, 0) / earlier.length) : null
  const thisYear = rows.find((r) => r.year === year)?.mm ?? 0
  return { thisYear, average, rows }
}

/** Rain during a crop's growing time: from planting to harvest (or to today while still growing). */
export function growingSeasonRain(readings: RainLite[], planted: string | null, harvested: string | null, today: string): number | null {
  if (!planted) return null
  return rainBetween(readings, planted, harvested ?? today)
}
