import { describe, expect, it } from 'vitest'
import { mineralAdvice, rotationAdvice, suggestedNextCrops, type AdviceRule } from './advice'

const rules: AdviceRule[] = [
  { id: 'p', species: 'any', nutrient: 'phosphorus_pct', comparison: 'below', threshold: 0.18, suggestion: 'P low', active: true },
  { id: 'cp', species: 'any', nutrient: 'protein_pct', comparison: 'below', threshold: 7, suggestion: 'protein low', active: true },
  { id: 'mg', species: 'cattle', nutrient: 'magnesium_pct', comparison: 'below', threshold: 0.2, suggestion: 'tetany risk', active: true },
  { id: 'off', species: 'any', nutrient: 'calcium_pct', comparison: 'below', threshold: 0.3, suggestion: 'Ca low', active: false },
]

describe('mineralAdvice', () => {
  const test = { protein_pct: 6.2, phosphorus_pct: 0.12, calcium_pct: 0.2, magnesium_pct: 0.15 }
  it('dry veld low in P and protein: both suggestions for sheep, not the cattle-only one', () => {
    expect(mineralAdvice(test, ['sheep'], rules).map((a) => a.rule.id)).toEqual(['p', 'cp'])
  })
  it('cattle on the same camp also get the magnesium (grass tetany) warning', () => {
    expect(mineralAdvice(test, ['cattle'], rules).map((a) => a.rule.id)).toEqual(['p', 'cp', 'mg'])
  })
  it('switched-off rules and missing values are skipped', () => {
    expect(mineralAdvice({ protein_pct: null, phosphorus_pct: 0.25, calcium_pct: 0.1, magnesium_pct: null }, ['sheep'], rules)).toEqual([])
  })
})

describe('rotationAdvice', () => {
  it('wheat three years running: same crop and a long cereal run', () => {
    expect(rotationAdvice([{ year: 2024, crop: 'wheat' }, { year: 2025, crop: 'wheat' }, { year: 2026, crop: 'wheat' }])).toEqual([
      { kind: 'same-crop', crop: 'wheat', years: 3 },
      { kind: 'cereal-run', years: 3 },
    ])
  })
  it('canola last season is too soon for canola again', () => {
    expect(rotationAdvice([{ year: 2025, crop: 'wheat' }, { year: 2026, crop: 'canola' }])).toEqual([{ kind: 'canola-too-soon', lastYear: 2026 }])
  })
  it('a well-spaced rotation gets no warnings (canola 2022, lupins 2024, cereals in between)', () => {
    expect(rotationAdvice([{ year: 2022, crop: 'canola' }, { year: 2023, crop: 'wheat' }, { year: 2024, crop: 'lupins' }, { year: 2025, crop: 'barley' }, { year: 2026, crop: 'wheat' }])).toEqual([{ kind: 'good' }])
  })
})

describe('suggestedNextCrops', () => {
  it('after canola 2025 and wheat 2026: a break crop, but not canola yet', () => {
    expect(suggestedNextCrops([{ year: 2025, crop: 'canola' }, { year: 2026, crop: 'wheat' }])).toEqual(['lupins', 'barley', 'oats'])
  })
  it('after canola: a cereal first', () => {
    expect(suggestedNextCrops([{ year: 2026, crop: 'canola' }])[0]).toBe('wheat')
  })
})
