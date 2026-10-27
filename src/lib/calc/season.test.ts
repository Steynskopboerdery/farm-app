import { describe, expect, it } from 'vitest'
import { rateFromTotal, seasonSummary, totalFromRate } from './season'

describe('totalFromRate', () => {
  it('150 kg/ha MAP on 50 ha is 7 500 kg', () => {
    expect(totalFromRate(150, 50)).toBe(7500)
  })
  it('0.3 L/ha on 45.5 ha is 13.65 L', () => {
    expect(totalFromRate(0.3, 45.5)).toBe(13.65)
  })
  it('is unknown without a rate or area', () => {
    expect(totalFromRate(null, 50)).toBeNull()
    expect(totalFromRate(2, 0)).toBeNull()
  })
})

describe('rateFromTotal', () => {
  it('5 000 kg seed on 50 ha is 100 kg/ha', () => {
    expect(rateFromTotal(5000, 50)).toBe(100)
  })
})

describe('seasonSummary', () => {
  const summary = seasonSummary({
    fieldHectares: 50,
    plantings: [{ crop: 'wheat', seed_kg: 5000, seed_cost: 45_000 }],
    operations: [
      { type: 'fertiliser', product: 'MAP', total_amount: 7500, unit: 'kg', cost: 101_250 },
      { type: 'fertiliser', product: 'MAP', total_amount: 1000, unit: 'kg', cost: 13_500 },
      { type: 'spray', product: 'Herbicide', total_amount: 100, unit: 'L', cost: 25_000 },
      { type: 'other', product: 'Contract baling', total_amount: null, unit: null, cost: 5_000 },
    ],
    harvests: [{ tons: 80 }, { tons: 50 }],
  })

  it('adds up loads to tons and yield per hectare', () => {
    expect(summary.tons).toBe(130)
    expect(summary.yieldPerHa).toBe(2.6)
  })

  it('adds up costs by kind and per hectare', () => {
    expect(summary.fertiliserCost).toBe(114_750)
    expect(summary.sprayCost).toBe(25_000)
    expect(summary.otherCost).toBe(5_000)
    expect(summary.totalCost).toBe(189_750)
    expect(summary.costPerHa).toBe(3_795)
  })

  it('totals each product separately and keeps units apart', () => {
    expect(summary.products).toEqual([
      { product: 'MAP', unit: 'kg', type: 'fertiliser', total: 8500 },
      { product: 'Herbicide', unit: 'L', type: 'spray', total: 100 },
    ])
    expect(summary.sprayCount).toBe(1)
  })

  it('has no yield before harvest', () => {
    const s = seasonSummary({ fieldHectares: 50, plantings: [], operations: [], harvests: [] })
    expect(s.yieldPerHa).toBeNull()
    expect(s.crop).toBeNull()
  })
})
