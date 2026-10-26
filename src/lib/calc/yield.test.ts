import { describe, expect, it } from 'vitest'
import { cropMargin, yieldPerHa } from './yield'

describe('yieldPerHa', () => {
  it('130 t off 50 ha is 2.6 t/ha', () => {
    expect(yieldPerHa(130, 50)).toBe(2.6)
  })
  it('rounds to 3 decimals', () => {
    expect(yieldPerHa(100, 30)).toBe(3.333)
  })
  it('is unknown when the area is missing or zero', () => {
    expect(yieldPerHa(10, 0)).toBeNull()
    expect(yieldPerHa(10, null)).toBeNull()
  })
})

describe('cropMargin', () => {
  it('sample wheat, Field 1: 50 ha × 2.6 t/ha × R5 500 less R8 500/ha', () => {
    expect(cropMargin({ hectares: 50, yieldTPerHa: 2.6, pricePerT: 5500, inputCostPerHa: 8500 })).toEqual({
      tons: 130, income: 715_000, cost: 425_000, margin: 290_000,
    })
  })
  it('sample canola, Field 4: 50 ha × 1.7 t/ha × R8 200 less R8 200/ha', () => {
    expect(cropMargin({ hectares: 50, yieldTPerHa: 1.7, pricePerT: 8200, inputCostPerHa: 8200 })).toEqual({
      tons: 85, income: 697_000, cost: 410_000, margin: 287_000,
    })
  })
})
