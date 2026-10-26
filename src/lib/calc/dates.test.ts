import { describe, expect, it } from 'vitest'
import { addDays, birthWindow, daysBetween } from './dates'

describe('birthWindow', () => {
  it('sheep: joining 15 Nov – 20 Dec 2026 + 147 days → lambing 11 Apr – 16 May 2027', () => {
    expect(birthWindow('2026-11-15', '2026-12-20', 147)).toEqual({ start: '2027-04-11', end: '2027-05-16' })
  })

  it('cattle: joining 1 Dec 2026 – 28 Feb 2027 + 283 days → calving 10 Sep – 8 Dec 2027', () => {
    expect(birthWindow('2026-12-01', '2027-02-28', 283)).toEqual({ start: '2027-09-10', end: '2027-12-08' })
  })

  it('uses the start date for both ends when there is no end date', () => {
    expect(birthWindow('2026-11-15', null, 147)).toEqual({ start: '2027-04-11', end: '2027-04-11' })
  })

  it('counts 29 February in a leap year', () => {
    expect(addDays('2027-12-01', 147)).toBe('2028-04-26')
  })
})

describe('daysBetween', () => {
  it('counts whole days', () => {
    expect(daysBetween('2026-10-26', '2026-11-15')).toBe(20)
    expect(daysBetween('2026-11-15', '2026-10-26')).toBe(-20)
  })
})
