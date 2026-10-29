import { birthPercentage } from './livestock'
import { cropMargin } from './yield'

const r2 = (n: number) => Math.round(n * 100) / 100
const r3 = (n: number) => Math.round(n * 1000) / 1000

/** Stock on hand per store item: received (+) minus used (−). */
export function stockOnHand(movements: { item_id: string; quantity: number }[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const mv of movements) m.set(mv.item_id, r3((m.get(mv.item_id) ?? 0) + Number(mv.quantity)))
  return m
}

/** Average price paid per unit, from deliveries that had a price. */
export function averageUnitCost(movements: { quantity: number; unit_cost: number | null }[]): number | null {
  const bought = movements.filter((m) => m.quantity > 0 && m.unit_cost != null)
  const qty = bought.reduce((s, m) => s + m.quantity, 0)
  if (!qty) return null
  return r2(bought.reduce((s, m) => s + m.quantity * (m.unit_cost ?? 0), 0) / qty)
}

interface FieldLite { id: string; name: string; hectares: number | null }
interface PlantingLite { field_id: string; season_id: string; crop: string; seed_cost: number | null }
interface HarvestLite { field_id: string; season_id: string | null; tons: number }
interface OpLite { field_id: string; season_id: string | null; type: string; product: string | null; total_amount: number | null; unit: string | null; cost: number | null }
/** A sales line with the season of its sale. */
interface SaleLite { field_id: string | null; season_id: string | null; quantity: number; unit_price: number }
interface CostLite { field_id: string | null; season_id: string | null; category: string; amount: number }

/** Yield per field for each season: crop, tons and t/ha (whole-field area). */
export function yieldTable(fields: FieldLite[], seasonIds: string[], plantings: PlantingLite[], harvests: HarvestLite[]) {
  return fields.map((f) => ({
    field: f,
    seasons: Object.fromEntries(seasonIds.map((sid) => {
      const crop = plantings.find((p) => p.field_id === f.id && p.season_id === sid)?.crop ?? null
      const tons = r3(harvests.filter((h) => h.field_id === f.id && h.season_id === sid).reduce((s, h) => s + Number(h.tons), 0))
      return [sid, { crop, tons, tPerHa: tons && f.hectares ? r3(tons / f.hectares) : null }]
    })),
  }))
}

/** Fertiliser and chemicals used in a season, per product and unit. */
export function inputUse(ops: OpLite[], seasonId: string) {
  const m = new Map<string, { product: string; unit: string; type: string; total: number; cost: number }>()
  for (const o of ops) {
    if (o.season_id !== seasonId || o.type === 'other') continue
    const key = `${o.type}|${o.product ?? '–'}|${o.unit ?? ''}`
    const row = m.get(key) ?? { product: o.product ?? '–', unit: o.unit ?? '', type: o.type, total: 0, cost: 0 }
    row.total = r3(row.total + Number(o.total_amount ?? 0))
    row.cost = r2(row.cost + Number(o.cost ?? 0))
    m.set(key, row)
  }
  return [...m.values()].sort((a, b) => a.type.localeCompare(b.type) || b.cost - a.cost)
}

/**
 * Cost and profit per field for one season.
 * Income = sales lines linked to the field in that season (excluding VAT); for fields without linked
 * sales it is harvested tons × the planning price for that crop (an estimate).
 */
export function fieldProfit(args: {
  fields: FieldLite[]; seasonId: string; plantings: PlantingLite[]; ops: OpLite[]; harvests: HarvestLite[]; costs: CostLite[]
  pricePerT: (crop: string) => number | null
  sales?: SaleLite[]
}) {
  const { fields, seasonId, plantings, ops, harvests, costs, pricePerT, sales = [] } = args
  return fields.map((f) => {
    const p = plantings.find((x) => x.field_id === f.id && x.season_id === seasonId)
    const tons = harvests.filter((h) => h.field_id === f.id && h.season_id === seasonId).reduce((s, h) => s + Number(h.tons), 0)
    const seed = Number(p?.seed_cost ?? 0)
    const inputs = ops.filter((o) => o.field_id === f.id && o.season_id === seasonId).reduce((s, o) => s + Number(o.cost ?? 0), 0)
    const other = costs.filter((c) => c.field_id === f.id && c.season_id === seasonId).reduce((s, c) => s + Number(c.amount), 0)
    const cost = r2(seed + inputs + other)
    const sold = sales.filter((x) => x.field_id === f.id && x.season_id === seasonId)
    const price = p ? pricePerT(p.crop) : null
    const income = sold.length ? r2(sold.reduce((s, x) => s + Number(x.quantity) * Number(x.unit_price), 0))
      : price != null ? r2(tons * price) : null
    const margin = income != null ? r2(income - cost) : null
    return {
      field: f, crop: p?.crop ?? null, tons: r3(tons), cost, income, margin,
      incomeSource: sold.length ? 'sales' as const : income != null ? 'estimate' as const : null,
      costPerHa: f.hectares ? r2(cost / f.hectares) : null,
      marginPerHa: margin != null && f.hectares ? r2(margin / f.hectares) : null,
    }
  })
}

/** Costs of a season split by kind: seed, fertiliser, sprays, other field work, and the cost categories. */
export function costsByCategory(seasonId: string, plantings: PlantingLite[], ops: OpLite[], costs: CostLite[]) {
  const out: Record<string, number> = { seed: 0, fertiliser: 0, spray: 0, fieldwork: 0, fuel: 0, labour: 0, machinery: 0, other: 0 }
  for (const p of plantings) if (p.season_id === seasonId) out.seed += Number(p.seed_cost ?? 0)
  for (const o of ops) if (o.season_id === seasonId) out[o.type === 'other' ? 'fieldwork' : o.type] += Number(o.cost ?? 0)
  for (const c of costs) if (c.season_id === seasonId) out[c.category] = (out[c.category] ?? 0) + Number(c.amount)
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, r2(v)]))
}

/**
 * Animal numbers at the end of each month, rebuilt from the change history of the group counts.
 * entries: every recorded change of a group (insert / update / delete) with its new count.
 */
export function countsByMonth(
  entries: { record_id: string; changed_at: string; quantity: number | null; species: string; deleted: boolean }[],
  months: string[], // 'YYYY-MM', oldest first
) {
  const sorted = [...entries].sort((a, b) => a.changed_at.localeCompare(b.changed_at))
  return months.map((month) => {
    const end = `${month}-31T23:59:59Z`
    const last = new Map<string, { quantity: number; species: string; deleted: boolean }>()
    for (const e of sorted) {
      if (e.changed_at > end) break
      last.set(e.record_id, { quantity: e.quantity ?? 0, species: e.species, deleted: e.deleted })
    }
    let sheep = 0
    let cattle = 0
    for (const g of last.values()) {
      if (g.deleted) continue
      if (g.species === 'cattle') cattle += g.quantity
      else sheep += g.quantity
    }
    return { month, sheep, cattle }
  })
}

/** Lambing / calving %: births recorded around the expected birth window, per joining. */
export function birthRates(
  plans: { id: string; group_id: string; expected_birth_start: string | null; expected_birth_end: string | null }[],
  births: { group_id: string | null; date: string; quantity: number | null }[],
  femalesJoined: (groupId: string) => number,
) {
  return plans.filter((p) => p.expected_birth_start).map((p) => {
    const from = p.expected_birth_start!
    const to = p.expected_birth_end ?? from
    // Allow a month either side of the expected window.
    const shift = (d: string, days: number) => new Date(Date.parse(`${d}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)
    const born = births.filter((b) => b.group_id === p.group_id && b.date >= shift(from, -30) && b.date <= shift(to, 30))
      .reduce((s, b) => s + (b.quantity ?? 0), 0)
    const females = femalesJoined(p.group_id)
    return { planId: p.id, groupId: p.group_id, from, born, females, percent: birthPercentage(born, females) }
  })
}

/** Budget per crop from planning estimates: hectares planted × yield × price − input cost. */
export function cropBudget(hectaresByCrop: Map<string, number>, estimates: { name: string; yield_t_per_ha: number | null; price_per_t: number | null; input_cost_per_ha: number | null }[]) {
  return estimates.filter((e) => e.yield_t_per_ha != null).map((e) => {
    const ha = hectaresByCrop.get(e.name) ?? 0
    return { crop: e.name, hectares: ha, ...cropMargin({ hectares: ha, yieldTPerHa: Number(e.yield_t_per_ha), pricePerT: Number(e.price_per_t ?? 0), inputCostPerHa: Number(e.input_cost_per_ha ?? 0) }) }
  })
}
