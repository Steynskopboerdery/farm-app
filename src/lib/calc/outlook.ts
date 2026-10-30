// Predictions for the coming seasons, from the area's weather history, the El Niño / La Niña outlook,
// world prices and the farm's own records. Everything here is a range or an estimate, never a promise.

const r0 = (n: number) => Math.round(n)
const r1 = (n: number) => Math.round(n * 10) / 10
const r2 = (n: number) => Math.round(n * 100) / 100

export interface YearClimate { rain: (number | null)[]; tmin: (number | null)[]; tmax: (number | null)[]; frost: (number | null)[]; breakDate: string | null }

/** Growing season for winter crops in the Western Cape: April to October (month indexes 3–9). */
export const GROWING = [3, 4, 5, 6, 7, 8, 9]

/** Value at fraction q (0–1) of a list, with linear interpolation. */
export function quantile(values: number[], q: number): number {
  const s = [...values].sort((a, b) => a - b)
  if (!s.length) return NaN
  const pos = (s.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return s[lo] + (s[hi] - s[lo]) * (pos - lo)
}

/** Least-squares slope of y against x. */
export function slope(xs: number[], ys: number[]): number {
  const n = xs.length
  if (n < 3) return 0
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2 }
  return den ? num / den : 0
}

/** Rain over a set of months for each complete year (years with a missing month are left out). */
export function rainByYear(years: Record<string, YearClimate>, months: number[] = GROWING): { year: number; mm: number }[] {
  return Object.entries(years)
    .map(([y, c]) => ({ year: Number(y), vals: months.map((m) => c.rain[m]) }))
    .filter((r) => r.vals.every((v) => v != null))
    .map((r) => ({ year: r.year, mm: r1((r.vals as number[]).reduce((a, b) => a + b, 0)) }))
    .sort((a, b) => a.year - b.year)
}

/** Dry (1 in 5 driest), normal (median) and wet (1 in 5 wettest) amounts, and the long-term trend. */
export function rainStats(rows: { year: number; mm: number }[]) {
  const mm = rows.map((r) => r.mm)
  const recent = rows.filter((r) => r.year > (rows[rows.length - 1]?.year ?? 0) - 10)
  const earlier = rows.filter((r) => !recent.includes(r))
  const avg = (xs: { mm: number }[]) => (xs.length ? xs.reduce((a, b) => a + b.mm, 0) / xs.length : NaN)
  return {
    dry: r0(quantile(mm, 0.2)),
    normal: r0(quantile(mm, 0.5)),
    wet: r0(quantile(mm, 0.8)),
    mean: r0(avg(rows)),
    perDecade: r0(slope(rows.map((r) => r.year), mm) * 10),
    recentVsEarlier: earlier.length && recent.length ? r0((avg(recent) / avg(earlier) - 1) * 100) : null,
    driest: [...rows].sort((a, b) => a.mm - b.mm).slice(0, 3),
    wettest: [...rows].sort((a, b) => b.mm - a.mm).slice(0, 3),
    years: rows.length,
  }
}

/** Typical month: median rain, average min / max temperature, chance of at least one frost-risk night. */
export function monthNormals(years: Record<string, YearClimate>) {
  const list = Object.values(years)
  return Array.from({ length: 12 }, (_, m) => {
    const rain = list.map((y) => y.rain[m]).filter((v): v is number => v != null)
    const tmin = list.map((y) => y.tmin[m]).filter((v): v is number => v != null)
    const tmax = list.map((y) => y.tmax[m]).filter((v): v is number => v != null)
    const frost = list.map((y) => y.frost[m]).filter((v): v is number => v != null)
    const mean = (xs: number[]) => (xs.length ? r1(xs.reduce((a, b) => a + b, 0) / xs.length) : null)
    return {
      month: m,
      rain: rain.length ? r0(quantile(rain, 0.5)) : null,
      rainDry: rain.length ? r0(quantile(rain, 0.2)) : null,
      rainWet: rain.length ? r0(quantile(rain, 0.8)) : null,
      tmin: mean(tmin),
      tmax: mean(tmax),
      frostChance: frost.length ? r0((frost.filter((f) => f > 0).length / frost.length) * 100) : null,
    }
  })
}

/** Day of the year for a 'MM-DD' date (non-leap year). */
const dayOfYear = (md: string) => {
  const [m, d] = md.split('-').map(Number)
  return Math.round((Date.UTC(2001, m - 1, d) - Date.UTC(2001, 0, 1)) / 86_400_000) + 1
}
const fromDayOfYear = (n: number) => new Date(Date.UTC(2001, 0, Math.round(n))).toISOString().slice(5, 10)

/** When the autumn break (first planting rain) usually comes: early (1 in 5 years), usual and late. */
export function autumnBreak(years: Record<string, YearClimate>) {
  const days = Object.values(years).map((y) => y.breakDate).filter((d): d is string => !!d).map(dayOfYear)
  if (!days.length) return null
  return { early: fromDayOfYear(quantile(days, 0.2)), usual: fromDayOfYear(quantile(days, 0.5)), late: fromDayOfYear(quantile(days, 0.8)), years: days.length }
}

export type EnsoPhase = 'elNino' | 'neutral' | 'laNina'
export const ensoPhase = (anom: number): EnsoPhase => (anom >= 0.5 ? 'elNino' : anom <= -0.5 ? 'laNina' : 'neutral')

/**
 * How this area's growing-season rain behaved in El Niño, neutral and La Niña winters (May–July index),
 * as % of the overall median. Small samples are reported so the reader can judge.
 */
export function ensoAnalogs(rows: { year: number; mm: number }[], oni: { season: string; year: number; anom: number }[]) {
  const winter = new Map(oni.filter((o) => o.season === 'MJJ').map((o) => [o.year, o.anom]))
  const median = quantile(rows.map((r) => r.mm), 0.5)
  const groups: Record<EnsoPhase, number[]> = { elNino: [], neutral: [], laNina: [] }
  for (const r of rows) {
    const a = winter.get(r.year)
    if (a != null) groups[ensoPhase(a)].push(r.mm)
  }
  const pct = (xs: number[]) => (xs.length ? r0((quantile(xs, 0.5) / median) * 100) : null)
  return {
    elNino: { years: groups.elNino.length, percentOfNormal: pct(groups.elNino) },
    neutral: { years: groups.neutral.length, percentOfNormal: pct(groups.neutral) },
    laNina: { years: groups.laNina.length, percentOfNormal: pct(groups.laNina) },
  }
}

/** Expected growing-season rain as % of normal, weighting each phase's history by the forecast chances. */
export function ensoTilt(analogs: ReturnType<typeof ensoAnalogs>, probs: { laNina: number; neutral: number; elNino: number } | null): number | null {
  if (!probs) return null
  const parts: [number, number | null][] = [[probs.elNino, analogs.elNino.percentOfNormal], [probs.neutral, analogs.neutral.percentOfNormal], [probs.laNina, analogs.laNina.percentOfNormal]]
  const used = parts.filter(([, p]) => p != null) as [number, number][]
  const w = used.reduce((a, [x]) => a + x, 0)
  return w ? r0(used.reduce((a, [x, p]) => a + x * p, 0) / w) : null
}

// Yields --------------------------------------------------------------------------------------------

/**
 * Water-limited yield (French & Schultz style): kg grain per mm of growing-season rain above what evaporates
 * from the soil. Figures are widely used rules of thumb for Mediterranean winter cropping.
 */
export const WATER_USE: Record<string, { kgPerMm: number; evaporation: number }> = {
  wheat: { kgPerMm: 20, evaporation: 110 },
  barley: { kgPerMm: 20, evaporation: 110 },
  oats: { kgPerMm: 18, evaporation: 110 },
  canola: { kgPerMm: 15, evaporation: 110 },
  lupins: { kgPerMm: 10, evaporation: 110 },
}
/** Farms typically reach about 55–65% of the water-limited potential; used until the farm's own harvests say otherwise. */
export const DEFAULT_ACHIEVED = 0.6

export function potentialYield(crop: string, seasonRainMm: number): number | null {
  const w = WATER_USE[crop]
  if (!w) return null
  return Math.max(0, ((seasonRainMm - w.evaporation) * w.kgPerMm) / 1000)
}

/** How much of the potential this farm actually reaches, from its own harvests and that year's rain. */
export function achievedShare(records: { crop: string; tPerHa: number; seasonRainMm: number }[]): { share: number; from: number } {
  const ratios = records.map((r) => {
    const p = potentialYield(r.crop, r.seasonRainMm)
    return p && p > 0.3 ? r.tPerHa / p : null
  }).filter((x): x is number => x != null && Number.isFinite(x))
  if (!ratios.length) return { share: DEFAULT_ACHIEVED, from: 0 }
  return { share: r2(Math.min(1, Math.max(0.3, quantile(ratios, 0.5)))), from: ratios.length }
}

export function yieldScenarios(crop: string, rain: { dry: number; normal: number; wet: number }, share: number) {
  const y = (mm: number) => {
    const p = potentialYield(crop, mm)
    return p == null ? null : r2(p * share)
  }
  return { dry: y(rain.dry), normal: y(rain.normal), wet: y(rain.wet) }
}

/** This season: rain so far plus what usually falls in the months still to come (dry / normal / wet). */
export function seasonSoFar(currentRain: number[], lastMonth: number, normals: ReturnType<typeof monthNormals>) {
  let soFar = 0
  const rest = { dry: 0, normal: 0, wet: 0 }
  for (const m of GROWING) {
    if (m < lastMonth) soFar += currentRain[m] ?? 0
    else if (m === lastMonth) {
      // Part month: count what fell, plus nothing more (conservative).
      soFar += currentRain[m] ?? 0
    } else {
      rest.dry += normals[m].rainDry ?? 0
      rest.normal += normals[m].rain ?? 0
      rest.wet += normals[m].rainWet ?? 0
    }
  }
  return { soFar: r0(soFar), dry: r0(soFar + rest.dry), normal: r0(soFar + rest.normal), wet: r0(soFar + rest.wet), finished: lastMonth > GROWING[GROWING.length - 1] }
}

// Prices --------------------------------------------------------------------------------------------

/** Monthly price in Rand: US$ price × Rand per dollar for the same month. */
export function inRand(points: [string, number][], fx: [string, number][]): [string, number][] {
  const rate = new Map(fx)
  return points.filter(([m]) => rate.has(m)).map(([m, v]) => [m, v * rate.get(m)!])
}

/**
 * Where a price may be in `months` months: trend of the last 5 years (halved, because prices tend to swing back),
 * and a band of one typical yearly move either side (about 2 years in 3 fall inside it).
 */
export function priceOutlook(points: [string, number][], months = 12) {
  const pts = points.filter(([, v]) => v > 0)
  if (pts.length < 24) return null
  const last = pts[pts.length - 1]
  const recent = pts.slice(-60)
  const t = recent.map((_, i) => i / 12)
  const trendPerYear = slope(t, recent.map(([, v]) => Math.log(v)))
  const yearly: number[] = []
  for (let i = 12; i < pts.length; i++) yearly.push(Math.log(pts[i][1] / pts[i - 12][1]))
  const mean = yearly.reduce((a, b) => a + b, 0) / yearly.length
  const vol = Math.sqrt(yearly.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, yearly.length - 1))
  const h = months / 12
  const likely = Math.exp(0.5 * trendPerYear * h)
  const spread = Math.exp(vol * Math.sqrt(h))
  const yearAgo = pts[pts.length - 13]
  return {
    lastMonth: last[0],
    last: last[1],
    changeLastYear: yearAgo ? r0((last[1] / yearAgo[1] - 1) * 100) : null,
    trendPerYear: r0((Math.exp(trendPerYear) - 1) * 100),
    low: r2(likely / spread),    // factors relative to the last price
    likely: r2(likely),
    high: r2(likely * spread),
  }
}

/** Profit per hectare and in total for every mix of dry / normal / wet year and low / likely / high price. */
export function marginGrid(hectares: number, yields: { dry: number | null; normal: number | null; wet: number | null }, prices: { low: number; likely: number; high: number }, costPerHa: number) {
  const out: Record<string, Record<string, number | null>> = {}
  for (const y of ['dry', 'normal', 'wet'] as const) {
    out[y] = {}
    for (const p of ['low', 'likely', 'high'] as const) {
      const t = yields[y]
      out[y][p] = t == null ? null : r0(hectares * (t * prices[p] - costPerHa))
    }
  }
  return out
}

/**
 * Satellite rain is an average over a ~50 km square; a farm's own gauge can differ. Where both have whole
 * months, scale the satellite figures to the gauge (needs at least 2 months; kept between 0.5× and 1.5×).
 */
export function gaugeFactor(months: { month: string; gauge: number; satellite: number }[]): { factor: number; months: number } {
  const usable = months.filter((m) => m.satellite > 5)
  if (usable.length < 2) return { factor: 1, months: usable.length }
  const f = usable.reduce((a, m) => a + m.gauge, 0) / usable.reduce((a, m) => a + m.satellite, 0)
  return { factor: r2(Math.min(1.5, Math.max(0.5, f))), months: usable.length }
}

/** Multiply every rain figure by a factor (for the gauge correction). */
export function scaleRain(years: Record<string, YearClimate>, factor: number): Record<string, YearClimate> {
  if (factor === 1) return years
  return Object.fromEntries(Object.entries(years).map(([y, c]) => [y, { ...c, rain: c.rain.map((v) => (v == null ? null : r1(v * factor))) }]))
}
