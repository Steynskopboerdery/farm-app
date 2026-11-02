// Farm alerts worked out from the rain gauge, the forecast, plantings and prices.
// Used by the app and (as a copy in supabase/functions/notify/alerts.ts) by the phone notifications.

const DAY = 86_400_000
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10)

/** Planting rain is watched from March to June. */
export const PLANTING_MONTHS = [3, 4, 5, 6]
export const PLANTING_MM = 25
export const PLANTING_DAYS = 3

/** Rain in the gauge over the last few days and in the forecast for the next few, against what is needed to plant. */
export function plantingRain(gaugeByDay: Map<string, number>, forecast: { date: string; rainMm: number }[], today: string, mm = PLANTING_MM, days = PLANTING_DAYS) {
  let fell = 0
  for (let i = 0; i < days; i++) fell += gaugeByDay.get(addDays(today, -i)) ?? 0
  const coming = forecast.filter((d) => d.date > today && d.date <= addDays(today, days)).reduce((a, d) => a + d.rainMm, 0)
  const month = Number(today.slice(5, 7))
  return { fell: Math.round(fell * 10) / 10, coming: Math.round(coming * 10) / 10, enoughFell: fell >= mm, enoughComing: coming >= mm, season: PLANTING_MONTHS.includes(month), mm, days }
}

/** Days after planting when each crop usually flowers (rule of thumb for Western Cape winter crops). */
export const FLOWERING: Record<string, [number, number]> = {
  canola: [70, 120],
  wheat: [95, 135],
  barley: [90, 130],
  oats: [90, 130],
  lupins: [80, 120],
}
export const FROST_C = 1
export const HEAT_C = 30

export interface PlantingLite { crop: string; planting_date: string | null; field?: string }

/** When each planting is likely to be flowering. */
export function floweringWindows(plantings: PlantingLite[]) {
  return plantings.flatMap((p) => {
    const f = FLOWERING[p.crop]
    if (!f || !p.planting_date) return []
    return [{ crop: p.crop, field: p.field ?? null, from: addDays(p.planting_date, f[0]), to: addDays(p.planting_date, f[1]) }]
  })
}

/** Forecast frost or heat on days when a crop is flowering. */
export function floweringRisks(windows: ReturnType<typeof floweringWindows>, forecast: { date: string; min: number; max: number }[]) {
  const out: { date: string; kind: 'frost' | 'heat'; value: number; crops: string[]; fields: string[] }[] = []
  for (const d of forecast) {
    const open = windows.filter((w) => d.date >= w.from && d.date <= w.to)
    if (!open.length) continue
    const crops = [...new Set(open.map((w) => w.crop))]
    const fields = [...new Set(open.map((w) => w.field).filter((x): x is string => !!x))]
    if (d.min <= FROST_C) out.push({ date: d.date, kind: 'frost', value: d.min, crops, fields })
    if (d.max >= HEAT_C) out.push({ date: d.date, kind: 'heat', value: d.max, crops, fields })
  }
  return out
}

/** Price targets that have been reached by the latest price. */
export function priceHits(alerts: { id: string; series: string; direction: string; target: number; active: boolean }[], latest: Map<string, number>) {
  return alerts.filter((a) => {
    const v = latest.get(a.series)
    if (!a.active || v == null) return false
    return a.direction === 'above' ? v >= a.target : v <= a.target
  }).map((a) => ({ ...a, price: latest.get(a.series)! }))
}

/**
 * Where today's price sits among the last 5 years of monthly prices: 0 = the cheapest month, 100 = the dearest.
 * Below 25 is unusually cheap, above 75 unusually dear.
 */
export function priceRank(points: [string, number][]): { rank: number; cheap: boolean; dear: boolean } | null {
  const recent = points.slice(-60)
  if (recent.length < 24) return null
  const last = recent[recent.length - 1][1]
  const below = recent.filter(([, v]) => v < last).length
  const rank = Math.round((below / (recent.length - 1)) * 100)
  return { rank, cheap: rank <= 25, dear: rank >= 75 }
}
