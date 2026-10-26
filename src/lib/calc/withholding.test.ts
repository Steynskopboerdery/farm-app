import { describe, expect, it } from 'vitest'
import { safeHarvestDate, withholdingConflicts } from './withholding'

describe('withholding period', () => {
  const sprays = [
    { product: 'Product A', date: '2026-10-01', withholdingPeriodDays: 28 }, // safe from 29 Oct
    { product: 'Product B', date: '2026-09-01', withholdingPeriodDays: 14 }, // safe from 15 Sep
    { product: 'Product C', date: '2026-10-20', withholdingPeriodDays: null },
  ]

  it('safe date is spray date + withholding days', () => {
    expect(safeHarvestDate(sprays[0])).toBe('2026-10-29')
  })

  it('warns when harvest is planned before the safe date', () => {
    const c = withholdingConflicts(sprays, '2026-10-25')
    expect(c.map((s) => s.product)).toEqual(['Product A'])
    expect(c[0].safeFrom).toBe('2026-10-29')
  })

  it('no warning on or after the safe date', () => {
    expect(withholdingConflicts(sprays, '2026-10-29')).toEqual([])
  })
})
