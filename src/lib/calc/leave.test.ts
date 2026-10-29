import { describe, expect, it } from 'vitest'
import { easterSunday, leaveBalances, onLeave, publicHolidays, sickCycleStart, workingDays } from './leave'

describe('public holidays', () => {
  it('Easter dates', () => {
    expect(easterSunday(2026)).toBe('2026-04-05')
    expect(easterSunday(2027)).toBe('2027-03-28')
  })
  it('2026 has Good Friday, Family Day, and Youth Day; Heritage Day on a Thursday stays put', () => {
    const h = publicHolidays(2026)
    expect(h.has('2026-04-03')).toBe(true)
    expect(h.has('2026-04-06')).toBe(true)
    expect(h.has('2026-06-16')).toBe(true)
    expect(h.has('2026-09-24')).toBe(true)
  })
  it('a holiday on a Sunday moves to the Monday (Freedom Day 2025 was a Sunday)', () => {
    expect(publicHolidays(2025).has('2025-04-28')).toBe(true)
  })
})

describe('working days', () => {
  it('Mon 2 Nov to Fri 13 Nov 2026 is 10 days', () => {
    expect(workingDays('2026-11-02', '2026-11-13')).toBe(10)
  })
  it('leaves out public holidays: 14–18 Dec 2026 has the Day of Reconciliation (Wed 16th)', () => {
    expect(workingDays('2026-12-14', '2026-12-18')).toBe(4)
  })
  it('counts Saturdays for a 6-day worker', () => {
    expect(workingDays('2026-11-02', '2026-11-08', [1, 2, 3, 4, 5, 6])).toBe(6)
  })
  it('end before start is 0', () => {
    expect(workingDays('2026-11-08', '2026-11-02')).toBe(0)
  })
})

describe('balances', () => {
  const staff = { start_date: '2021-03-01', annual_leave_days: 15, sick_leave_days: 30, family_leave_days: 3 }
  const leave = [
    { type: 'annual', status: 'approved', start_date: '2026-04-07', days: 5 },
    { type: 'annual', status: 'approved', start_date: '2025-12-20', days: 8 },  // last year
    { type: 'annual', status: 'pending', start_date: '2026-12-21', days: 4 },
    { type: 'sick', status: 'approved', start_date: '2024-05-01', days: 2 },   // this cycle (from 1 Mar 2024)
    { type: 'sick', status: 'approved', start_date: '2023-05-01', days: 6 },   // previous cycle
    { type: 'family', status: 'declined', start_date: '2026-02-01', days: 1 },
  ]
  it('annual left this year, sick left this cycle, pending counted separately', () => {
    const b = leaveBalances(staff, leave, '2026-10-29')
    expect(b.annual).toEqual({ entitled: 15, used: 5, left: 10 })
    expect(b.sick).toEqual({ entitled: 30, used: 2, left: 28, cycleStart: '2024-03-01' })
    expect(b.family.left).toBe(3)
    expect(b.pending).toBe(1)
  })
  it('sick cycle restarts every 36 months from the start date', () => {
    expect(sickCycleStart('2021-03-01', '2024-02-29')).toBe('2021-03-01')
    expect(sickCycleStart('2021-03-01', '2024-03-01')).toBe('2024-03-01')
  })
  it('on leave on a day', () => {
    expect(onLeave([{ status: 'approved', start_date: '2026-11-02', end_date: '2026-11-06' }], '2026-11-04')).not.toBeNull()
    expect(onLeave([{ status: 'pending', start_date: '2026-11-02', end_date: '2026-11-06' }], '2026-11-04')).toBeNull()
  })
})
