import { describe, expect, it } from 'vitest'
import { fuelUse, latestReading, litresByMonth, serviceStatus } from './vehicles'

const fuel = (date: string, litres: number, reading: number | null) => ({ kind: 'fuel', date, litres, reading })
const service = (date: string, reading: number) => ({ kind: 'service', date, litres: null, reading })

describe('fuel use', () => {
  it('tractor: 300 L over 25 hours is 12 L per hour (first fill only sets the start)', () => {
    const logs = [fuel('2026-09-01', 200, 1000), fuel('2026-09-05', 150, 1012), fuel('2026-09-10', 150, 1025)]
    expect(fuelUse(logs, 'hours')).toBe(12)
  })
  it('bakkie: 60 L over 500 km is 12 L/100 km', () => {
    expect(fuelUse([fuel('2026-09-01', 70, 50_000), fuel('2026-09-10', 60, 50_500)], 'km')).toBe(12)
  })
  it('needs two readings', () => {
    expect(fuelUse([fuel('2026-09-01', 70, 50_000), fuel('2026-09-10', 60, null)], 'km')).toBeNull()
  })
})

describe('service', () => {
  it('next service 250 hours after the last one', () => {
    const logs = [service('2026-06-01', 1000), fuel('2026-09-10', 150, 1230)]
    expect(serviceStatus(logs, 250)).toEqual({ lastService: 1000, dueAt: 1250, left: 20, due: false, soon: true })
  })
  it('overdue when past the interval', () => {
    expect(serviceStatus([service('2026-06-01', 1000), fuel('2026-09-10', 1, 1300)], 250)?.due).toBe(true)
  })
  it('without a recorded service, counts from the first reading', () => {
    expect(serviceStatus([fuel('2026-10-02', 70, 50_000), fuel('2026-10-22', 60, 50_500)], 15_000)).toMatchObject({ lastService: null, dueAt: 65_000, due: false })
  })
  it('no interval, no status', () => {
    expect(serviceStatus([fuel('2026-09-10', 1, 1300)], null)).toBeNull()
  })
  it('latest reading and monthly litres', () => {
    const logs = [fuel('2026-09-01', 200, 1000), fuel('2026-09-20', 50.5, 1010), fuel('2026-10-02', 100, 1020)]
    expect(latestReading(logs)).toBe(1020)
    expect(litresByMonth(logs).get('2026-09')).toBe(250.5)
  })
})
