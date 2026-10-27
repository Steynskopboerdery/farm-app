import { describe, expect, it } from 'vitest'
import { averageUnitCost, birthRates, costsByCategory, countsByMonth, cropBudget, fieldProfit, inputUse, stockOnHand, yieldTable } from './reports'

describe('store', () => {
  it('stock on hand: received 10 000 kg MAP, used 7 500 + 1 200 → 1 300 kg', () => {
    const s = stockOnHand([{ item_id: 'map', quantity: 10_000 }, { item_id: 'map', quantity: -7_500 }, { item_id: 'map', quantity: -1_200 }, { item_id: 'lan', quantity: 500 }])
    expect(s.get('map')).toBe(1_300)
    expect(s.get('lan')).toBe(500)
  })
  it('average price from deliveries only', () => {
    expect(averageUnitCost([{ quantity: 1000, unit_cost: 13 }, { quantity: 1000, unit_cost: 14 }, { quantity: -500, unit_cost: null }])).toBe(13.5)
  })
})

const fields = [{ id: 'f1', name: 'Field 1', hectares: 50 }, { id: 'f4', name: 'Field 4', hectares: 50 }]
const plantings = [
  { field_id: 'f1', season_id: 's26', crop: 'wheat', seed_cost: 45_000 },
  { field_id: 'f4', season_id: 's26', crop: 'canola', seed_cost: 31_500 },
  { field_id: 'f1', season_id: 's25', crop: 'canola', seed_cost: 29_750 },
]
const harvests = [{ field_id: 'f1', season_id: 's26', tons: 80 }, { field_id: 'f1', season_id: 's26', tons: 50 }, { field_id: 'f1', season_id: 's25', tons: 89.3 }]
const ops = [
  { field_id: 'f1', season_id: 's26', type: 'fertiliser', product: 'MAP', total_amount: 7500, unit: 'kg', cost: 101_250 },
  { field_id: 'f4', season_id: 's26', type: 'fertiliser', product: 'MAP', total_amount: 6000, unit: 'kg', cost: 81_000 },
  { field_id: 'f1', season_id: 's26', type: 'spray', product: 'Herbicide', total_amount: 100, unit: 'L', cost: 25_000 },
  { field_id: 'f1', season_id: 's26', type: 'other', product: 'Contract baling', total_amount: null, unit: null, cost: 5_000 },
]
const costs = [{ field_id: 'f1', season_id: 's26', category: 'fuel', amount: 12_000 }, { field_id: null, season_id: 's26', category: 'labour', amount: 60_000 }]

describe('yieldTable', () => {
  it('adds loads per field and season and divides by field size', () => {
    const t = yieldTable(fields, ['s26', 's25'], plantings, harvests)
    expect(t[0].seasons.s26).toEqual({ crop: 'wheat', tons: 130, tPerHa: 2.6 })
    expect(t[0].seasons.s25).toEqual({ crop: 'canola', tons: 89.3, tPerHa: 1.786 })
    expect(t[1].seasons.s26).toEqual({ crop: 'canola', tons: 0, tPerHa: null })
  })
})

describe('inputUse', () => {
  it('totals each product for the season', () => {
    expect(inputUse(ops, 's26')).toEqual([
      { product: 'MAP', unit: 'kg', type: 'fertiliser', total: 13_500, cost: 182_250 },
      { product: 'Herbicide', unit: 'L', type: 'spray', total: 100, cost: 25_000 },
    ])
  })
})

describe('fieldProfit', () => {
  it('Field 1 wheat: 130 t × R5 500 = R715 000 less seed, inputs and fuel', () => {
    const [f1] = fieldProfit({ fields, seasonId: 's26', plantings, ops, harvests, costs, pricePerT: (c) => (c === 'wheat' ? 5500 : 8200) })
    // 45 000 seed + 101 250 + 25 000 + 5 000 field work + 12 000 fuel = 188 250
    expect(f1).toMatchObject({ tons: 130, income: 715_000, cost: 188_250, margin: 526_750, costPerHa: 3_765, marginPerHa: 10_535 })
  })
})

describe('costsByCategory', () => {
  it('splits a season into seed, fertiliser, sprays, field work and the cost categories', () => {
    expect(costsByCategory('s26', plantings, ops, costs)).toEqual({
      seed: 76_500, fertiliser: 182_250, spray: 25_000, fieldwork: 5_000, fuel: 12_000, labour: 60_000, machinery: 0, other: 0,
    })
  })
})

describe('countsByMonth', () => {
  it('rebuilds month-end totals from the count history', () => {
    const entries = [
      { record_id: 'ewes', changed_at: '2026-01-10T08:00:00Z', quantity: 600, species: 'sheep', deleted: false },
      { record_id: 'cows', changed_at: '2026-01-10T08:00:00Z', quantity: 100, species: 'cattle', deleted: false },
      { record_id: 'ewes', changed_at: '2026-03-05T08:00:00Z', quantity: 575, species: 'sheep', deleted: false },
      { record_id: 'lambs', changed_at: '2026-04-20T08:00:00Z', quantity: 640, species: 'sheep', deleted: false },
      { record_id: 'cows', changed_at: '2026-04-28T08:00:00Z', quantity: 100, species: 'cattle', deleted: true },
    ]
    expect(countsByMonth(entries, ['2025-12', '2026-02', '2026-03', '2026-04'])).toEqual([
      { month: '2025-12', sheep: 0, cattle: 0 },
      { month: '2026-02', sheep: 600, cattle: 100 },
      { month: '2026-03', sheep: 575, cattle: 100 },
      { month: '2026-04', sheep: 1215, cattle: 0 },
    ])
  })
})

describe('birthRates', () => {
  it('600 ewes, 690 lambs born in the window → 115%', () => {
    const r = birthRates(
      [{ id: 'b1', group_id: 'ewes', expected_birth_start: '2027-04-11', expected_birth_end: '2027-05-16' }],
      [{ group_id: 'ewes', date: '2027-04-15', quantity: 400 }, { group_id: 'ewes', date: '2027-05-20', quantity: 290 }, { group_id: 'ewes', date: '2026-04-15', quantity: 999 }],
      () => 600,
    )
    expect(r[0]).toMatchObject({ born: 690, females: 600, percent: 115 })
  })
})

describe('cropBudget', () => {
  it('sample wheat 150 ha × 2.6 t/ha × R5 500 − R8 500/ha', () => {
    const [w] = cropBudget(new Map([['wheat', 150]]), [{ name: 'wheat', yield_t_per_ha: 2.6, price_per_t: 5500, input_cost_per_ha: 8500 }])
    expect(w).toEqual({ crop: 'wheat', hectares: 150, tons: 390, income: 2_145_000, cost: 1_275_000, margin: 870_000 })
  })
})
