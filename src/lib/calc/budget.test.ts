import { describe, expect, it } from 'vitest'
import { actuals, budgetFromPlan, cashFlow, lowestPoint, monthlyPlan, planByCategory, tightMonths } from './budget'

const lines = [
  { kind: 'income', category: 'crops', label: 'Canola', amount: 1_200_000, months: [12] },
  { kind: 'expense', category: 'labour', label: 'Wages', amount: 120_000, months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  { kind: 'expense', category: 'crop_inputs', label: 'Inputs', amount: 400_000, months: [4, 5] },
]

describe('budget', () => {
  it('splits each line evenly over its months', () => {
    const p = monthlyPlan(lines)
    expect(p.income[11]).toBe(1_200_000)
    expect(p.expense[0]).toBe(10_000)
    expect(p.expense[3]).toBe(210_000)
    expect(p.expense.reduce((a, b) => a + b, 0)).toBe(520_000)
  })
  it('runs the bank balance through the year and finds the tight months', () => {
    const p = monthlyPlan(lines)
    const rows = cashFlow(p.income, p.expense, 100_000)
    expect(rows[3].balance).toBe(100_000 - 40_000 - 200_000)
    expect(rows[11].balance).toBe(100_000 + 1_200_000 - 520_000)
    const tight = tightMonths(rows)
    expect(tight.map((t) => t.month)).toEqual([4, 5, 6, 7, 8, 9, 10, 11])
    expect(tight[0].belowZero).toBe(true)
    expect(lowestPoint(rows).month).toBe(11)
  })
  it('totals the plan per category', () => {
    expect(planByCategory(lines, 'expense')).toEqual({ labour: 120_000, crop_inputs: 400_000 })
  })
  it('adds up what really happened in the year', () => {
    const a = actuals(2026, {
      costs: [{ date: '2026-03-10', category: 'fuel', amount: 5000 }, { date: '2025-12-01', category: 'fuel', amount: 999 }, { date: '2026-03-20', category: 'labour', amount: 10_000 }],
      ops: [{ date: '2026-05-01', cost: 20_000 }, { date: '2026-05-02', cost: null }],
      plantings: [{ planting_date: '2026-04-25', seed_cost: 30_000 }],
      payments: [{ date: '2026-12-15', amount: 500_000 }],
    })
    expect(a.expense[2]).toBe(15_000)
    expect(a.expense[3]).toBe(30_000)
    expect(a.income[11]).toBe(500_000)
    expect(a.byCategory).toEqual({ fuel: 5000, labour: 10_000, crop_inputs: 50_000 })
  })
  it('builds a starting budget from planning figures', () => {
    const b = budgetFromPlan({
      cropHa: new Map([['canola', 100]]),
      crops: [{ name: 'canola', yield_t_per_ha: 1.8, price_per_t: 9000, input_cost_per_ha: 6500 }],
      herds: [{ name: 'sheep', females: 500, weaning_pct: 125, price_per_head: 1300, wool_kg_per_head: 4, wool_price_per_kg: 80, cost_per_head_per_year: 200 }],
    })
    expect(b.find((l) => l.category === 'crops')!.amount).toBe(1_620_000)
    expect(b.find((l) => l.category === 'livestock')!.amount).toBe(812_500)
    expect(b.find((l) => l.category === 'wool')!.amount).toBe(160_000)
    expect(b.find((l) => l.category === 'vet')!.amount).toBe(100_000)
  })
})
