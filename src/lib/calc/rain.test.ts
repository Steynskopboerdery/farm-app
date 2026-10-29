import { describe, expect, it } from 'vitest'
import { dailyRain, growingSeasonRain, monthlyByYear, rainBetween, yearToDate } from './rain'

const r = (date: string, mm: number, gauge: string | null = null) => ({ date, mm, gauge })

describe('dailyRain', () => {
  it('averages two gauges read on the same day', () => {
    expect(dailyRain([r('2026-06-01', 10, 'House'), r('2026-06-01', 14, 'Bo-kamp')]).get('2026-06-01')).toBe(12)
  })
  it('adds a morning and evening reading at the same gauge', () => {
    expect(dailyRain([r('2026-06-01', 4, 'House'), r('2026-06-01', 6, 'house ')]).get('2026-06-01')).toBe(10)
  })
})

describe('totals', () => {
  const list = [r('2025-05-10', 20), r('2025-06-02', 30), r('2026-05-03', 12.5), r('2026-06-20', 7.5), r('2026-11-01', 5)]
  it('rain between two dates includes both ends', () => {
    expect(rainBetween(list, '2026-05-03', '2026-06-20')).toBe(20)
  })
  it('monthly totals per year', () => {
    const m = monthlyByYear(list)
    expect(m.get(2025)![4]).toBe(20)
    expect(m.get(2026)![5]).toBe(7.5)
    expect(m.get(2026)![10]).toBe(5)
  })
  it('year to date compares the same days of earlier years', () => {
    expect(yearToDate(list, '2026-06-30')).toEqual({
      thisYear: 20, average: 50,
      rows: [{ year: 2025, mm: 50 }, { year: 2026, mm: 20 }],
    })
  })
  it('growing season runs from planting to harvest, or to today', () => {
    expect(growingSeasonRain(list, '2026-05-01', '2026-10-31', '2026-12-01')).toBe(20)
    expect(growingSeasonRain(list, '2026-05-01', null, '2026-12-01')).toBe(25)
    expect(growingSeasonRain(list, null, null, '2026-12-01')).toBeNull()
  })
})
