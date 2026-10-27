import { yieldPerHa } from './yield'

/** Total product used: rate per hectare × hectares (3 decimals). */
export function totalFromRate(rate: number | null | undefined, hectares: number | null | undefined): number | null {
  if (rate == null || !hectares) return null
  return Math.round(rate * hectares * 1000) / 1000
}

/** Rate per hectare from a total (3 decimals). */
export function rateFromTotal(total: number | null | undefined, hectares: number | null | undefined): number | null {
  if (total == null || !hectares) return null
  return Math.round((total / hectares) * 1000) / 1000
}

export interface SeasonInput {
  fieldHectares: number | null
  plantings: { crop: string; seed_kg: number | null; seed_cost: number | null }[]
  operations: { type: string; product: string | null; total_amount: number | null; unit: string | null; cost: number | null }[]
  harvests: { tons: number }[]
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Totals for one field in one season: inputs used, costs, tons and yield. */
export function seasonSummary({ fieldHectares, plantings, operations, harvests }: SeasonInput) {
  const seedKg = plantings.reduce((s, p) => s + (p.seed_kg ?? 0), 0)
  const seedCost = plantings.reduce((s, p) => s + (p.seed_cost ?? 0), 0)
  const costByType = { fertiliser: 0, spray: 0, other: 0 } as Record<string, number>
  // Product totals, keyed by "product|unit" so kg and L never get added together.
  const products = new Map<string, { product: string; unit: string; type: string; total: number }>()
  for (const o of operations) {
    costByType[o.type] = (costByType[o.type] ?? 0) + (o.cost ?? 0)
    if (o.total_amount != null) {
      const product = o.product ?? '–'
      const unit = o.unit ?? ''
      const key = `${product}|${unit}`
      const p = products.get(key) ?? { product, unit, type: o.type, total: 0 }
      p.total += o.total_amount
      products.set(key, p)
    }
  }
  const tons = harvests.reduce((s, h) => s + h.tons, 0)
  const totalCost = round2(seedCost + costByType.fertiliser + costByType.spray + costByType.other)
  return {
    crop: plantings[0]?.crop ?? null,
    seedKg: round2(seedKg),
    seedCost: round2(seedCost),
    fertiliserCost: round2(costByType.fertiliser),
    sprayCost: round2(costByType.spray),
    otherCost: round2(costByType.other),
    totalCost,
    costPerHa: fieldHectares ? round2(totalCost / fieldHectares) : null,
    products: [...products.values()].map((p) => ({ ...p, total: Math.round(p.total * 1000) / 1000 })),
    sprayCount: operations.filter((o) => o.type === 'spray').length,
    tons: Math.round(tons * 1000) / 1000,
    yieldPerHa: tons > 0 ? yieldPerHa(tons, fieldHectares) : null,
  }
}
