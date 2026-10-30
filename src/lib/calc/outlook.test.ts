import { describe, expect, it } from 'vitest'
import {
  achievedShare, autumnBreak, ensoAnalogs, ensoPhase, ensoTilt, gaugeFactor, inRand, marginGrid, monthNormals, potentialYield,
  priceOutlook, quantile, rainByYear, rainStats, seasonSoFar, slope, yieldScenarios, type YearClimate,
} from './outlook'

const year = (growingMonthMm: number, breakDate: string | null = '04-10', frostJuly = 0): YearClimate => ({
  rain: Array.from({ length: 12 }, (_, m) => (m >= 3 && m <= 9 ? growingMonthMm : 10)),
  tmin: Array(12).fill(8), tmax: Array(12).fill(22),
  frost: Array.from({ length: 12 }, (_, m) => (m === 6 ? frostJuly : 0)), breakDate,
})

describe('basics', () => {
  it('quantile and slope', () => {
    expect(quantile([1, 2, 3, 4, 5], 0.5)).toBe(3)
    expect(quantile([0, 10], 0.2)).toBe(2)
    expect(slope([0, 1, 2, 3], [1, 3, 5, 7])).toBe(2)
  })
})

describe('rain history', () => {
  const years = { 2001: year(30), 2002: year(40), 2003: year(50), 2004: year(60), 2005: year(70) }
  it('growing-season rain per year (April–October = 7 months)', () => {
    expect(rainByYear(years).map((r) => r.mm)).toEqual([210, 280, 350, 420, 490])
  })
  it('incomplete years are left out', () => {
    const y = year(50)
    y.rain[8] = null
    expect(rainByYear({ ...years, 2006: y })).toHaveLength(5)
  })
  it('dry / normal / wet, and the trend per decade', () => {
    const s = rainStats(rainByYear(years))
    expect([s.dry, s.normal, s.wet]).toEqual([266, 350, 434])
    expect(s.perDecade).toBe(700)   // +70 mm a year in this made-up series
    expect(s.driest[0]).toEqual({ year: 2001, mm: 210 })
  })
  it('month normals and frost chance', () => {
    const n = monthNormals({ 2001: year(30, null, 2), 2002: year(50, null, 0) })
    expect(n[6]).toMatchObject({ rain: 40, tmin: 8, tmax: 22, frostChance: 50 })
  })
  it('autumn break: early, usual and late dates', () => {
    const b = autumnBreak({ 1: year(1, '03-10'), 2: year(1, '04-01'), 3: year(1, '04-20'), 4: year(1, '05-15'), 5: year(1, null) })
    expect(b).toMatchObject({ usual: '04-11', years: 4 })  // midway between 1 and 20 April
  })
  it('scales satellite rain to the farm gauge where both have readings', () => {
    expect(gaugeFactor([{ month: '2026-06', gauge: 80, satellite: 100 }, { month: '2026-07', gauge: 70, satellite: 100 }])).toEqual({ factor: 0.75, months: 2 })
    expect(gaugeFactor([{ month: '2026-06', gauge: 80, satellite: 100 }])).toEqual({ factor: 1, months: 1 })
  })
})

describe('El Niño / La Niña', () => {
  it('phase from the index', () => {
    expect([ensoPhase(1.2), ensoPhase(0.2), ensoPhase(-0.7)]).toEqual(['elNino', 'neutral', 'laNina'])
  })
  it('compares rain in each phase with the overall median, and weights by the forecast', () => {
    const rows = [{ year: 1, mm: 200 }, { year: 2, mm: 300 }, { year: 3, mm: 300 }, { year: 4, mm: 400 }]
    const oni = [{ season: 'MJJ', year: 1, anom: 1 }, { season: 'MJJ', year: 2, anom: 0 }, { season: 'MJJ', year: 3, anom: 0.1 }, { season: 'MJJ', year: 4, anom: -1 }]
    const a = ensoAnalogs(rows, oni)
    expect(a).toEqual({ elNino: { years: 1, percentOfNormal: 67 }, neutral: { years: 2, percentOfNormal: 100 }, laNina: { years: 1, percentOfNormal: 133 } })
    expect(ensoTilt(a, { elNino: 17, neutral: 70, laNina: 13 })).toBe(99)
  })
})

describe('yields', () => {
  it('canola: (300 − 110 mm) × 15 kg/mm = 2.85 t/ha potential', () => {
    expect(potentialYield('canola', 300)).toBeCloseTo(2.85)
    expect(potentialYield('canola', 90)).toBe(0)
    expect(potentialYield('rooibos', 300)).toBeNull()
  })
  it('uses the farm’s own results when there are harvests, else 60%', () => {
    expect(achievedShare([])).toEqual({ share: 0.6, from: 0 })
    // 1.8 t/ha in a 300 mm year = 63% of 2.85
    expect(achievedShare([{ crop: 'canola', tPerHa: 1.8, seasonRainMm: 300 }])).toEqual({ share: 0.63, from: 1 })
  })
  it('dry / normal / wet yields', () => {
    expect(yieldScenarios('canola', { dry: 230, normal: 330, wet: 450 }, 0.6)).toEqual({ dry: 1.08, normal: 1.98, wet: 3.06 })
  })
  it('this season: rain so far plus the usual rain still to come', () => {
    const normals = monthNormals({ 1: year(40), 2: year(60) })
    const current = Array(12).fill(0).map((_, m) => (m >= 3 && m <= 6 ? 50 : 0))
    // April–July fell (200 mm); July is the current part month; Aug–Oct still to come at 44 / 50 / 56 mm a month
    expect(seasonSoFar(current, 6, normals)).toEqual({ soFar: 200, dry: 332, normal: 350, wet: 368, finished: false })
  })
})

describe('prices', () => {
  const months = (n: number, f: (i: number) => number): [string, number][] =>
    Array.from({ length: n }, (_, i) => [`${2016 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`, f(i)])
  it('converts to Rand month by month', () => {
    expect(inRand([['2026-08', 100], ['2026-09', 200]], [['2026-09', 16.5]])).toEqual([['2026-09', 3300]])
  })
  it('a steady 10% a year rise: last year +10%, trend +10%, likely about +5% (trend halved)', () => {
    const o = priceOutlook(months(72, (i) => 1000 * Math.pow(1.1, i / 12)))!
    expect(o.changeLastYear).toBe(10)
    expect(o.trendPerYear).toBe(10)
    expect(o.likely).toBe(1.05)
    expect(o.low).toBeLessThanOrEqual(o.likely)
    expect(o.high).toBeGreaterThanOrEqual(o.likely)
  })
  it('needs two years of prices', () => {
    expect(priceOutlook(months(12, () => 5))).toBeNull()
  })
  it('profit grid: 100 ha, 1.8 t/ha, R9 000/t, R6 500/ha costs = R970 000', () => {
    const g = marginGrid(100, { dry: 1.2, normal: 1.8, wet: 2.4 }, { low: 8000, likely: 9000, high: 10000 }, 6500)
    expect(g.normal.likely).toBe(970_000)
    expect(g.dry.low).toBe(310_000)
  })
})
