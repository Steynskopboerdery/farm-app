import { describe, expect, it } from 'vitest'
import { ageInMonths, birthPercentage, breedingDates, countAfter, countChange, daysUntil } from './livestock'

describe('head count after events', () => {
  it('births add, sales and deaths take away, other events leave it', () => {
    expect(countChange('birth', 12)).toBe(12)
    expect(countChange('sale', 30)).toBe(-30)
    expect(countChange('death', 2)).toBe(-2)
    expect(countChange('vaccination', 600)).toBe(0)
    expect(countChange('moved', 600)).toBe(0)
  })
  it('600 ewes, 25 sold → 575', () => {
    expect(countAfter(600, 'sale', 25)).toBe(575)
  })
  it('never goes below zero', () => {
    expect(countAfter(3, 'death', 5)).toBe(0)
  })
})

describe('breedingDates', () => {
  it('ewes joined 15 Nov – 20 Dec 2026 (147 days): lambing 11 Apr – 16 May 2027, prepare by 28 Mar', () => {
    expect(breedingDates({ joiningStart: '2026-11-15', joiningEnd: '2026-12-20', gestationDays: 147 })).toEqual({
      birthStart: '2027-04-11', birthEnd: '2027-05-16', prepareBy: '2027-03-28',
    })
  })
  it('cows joined 1 Dec 2026 – 28 Feb 2027 (283 days): calving 10 Sep – 8 Dec 2027', () => {
    const d = breedingDates({ joiningStart: '2026-12-01', joiningEnd: '2027-02-28', gestationDays: 283 })
    expect([d.birthStart, d.birthEnd]).toEqual(['2027-09-10', '2027-12-08'])
  })
})

describe('birthPercentage', () => {
  it('690 lambs from 600 ewes is 115%', () => {
    expect(birthPercentage(690, 600)).toBe(115)
  })
  it('88 calves from 100 cows is 88%', () => {
    expect(birthPercentage(88, 100)).toBe(88)
  })
  it('unknown without females joined', () => {
    expect(birthPercentage(10, 0)).toBeNull()
  })
})

describe('daysUntil and age', () => {
  it('counts days to lambing', () => {
    expect(daysUntil('2026-10-27', '2027-04-11')).toBe(166)
  })
  it('young bull born 1 Sep 2025 is 13 months on 27 Oct 2026', () => {
    expect(ageInMonths('2025-09-01', '2026-10-27')).toBe(13)
    expect(ageInMonths('2025-10-28', '2026-10-27')).toBe(11)
  })
})
