// Advice-only suggestions. The app always shows these with a note to confirm with a professional.

export type Nutrient = 'protein_pct' | 'phosphorus_pct' | 'calcium_pct' | 'magnesium_pct'

export interface PastureTest { protein_pct: number | null; phosphorus_pct: number | null; calcium_pct: number | null; magnesium_pct: number | null }
export interface AdviceRule { id: string; species: string; nutrient: Nutrient; comparison: string; threshold: number; suggestion: string; active: boolean }

/** Rules that apply to a pasture test for the species grazing on it. */
export function mineralAdvice(test: PastureTest, speciesGrazing: string[], rules: AdviceRule[]) {
  const out: { rule: AdviceRule; value: number }[] = []
  for (const r of rules) {
    if (!r.active) continue
    if (r.species !== 'any' && !speciesGrazing.includes(r.species)) continue
    const value = test[r.nutrient]
    if (value == null) continue
    const hit = r.comparison === 'below' ? value < Number(r.threshold) : value > Number(r.threshold)
    if (hit) out.push({ rule: r, value })
  }
  return out
}

const CEREALS = ['wheat', 'barley', 'oats']
const BREAK_CROPS = ['canola', 'lupins']

export type RotationAdvice =
  | { kind: 'same-crop'; crop: string; years: number }
  | { kind: 'cereal-run'; years: number }
  | { kind: 'canola-too-soon'; lastYear: number }
  | { kind: 'lupins-too-soon'; lastYear: number }
  | { kind: 'good' }

/**
 * Simple rotation checks for Western Cape winter cropping, from a field's crops by year (oldest first).
 * Cereals back-to-back build up diseases like take-all and grass weeds; canola and lupins need a few years between plantings.
 */
export function rotationAdvice(history: { year: number; crop: string }[]): RotationAdvice[] {
  const h = [...history].sort((a, b) => a.year - b.year)
  if (h.length === 0) return []
  const out: RotationAdvice[] = []
  const last = h[h.length - 1]
  let same = 1
  for (let i = h.length - 2; i >= 0 && h[i].crop === last.crop; i--) same++
  if (same >= 2) out.push({ kind: 'same-crop', crop: last.crop, years: same })
  let cereal = 0
  for (let i = h.length - 1; i >= 0 && CEREALS.includes(h[i].crop); i--) cereal++
  if (cereal >= 3) out.push({ kind: 'cereal-run', years: cereal })
  const nextYear = last.year + 1
  const lastCanola = [...h].reverse().find((x) => x.crop === 'canola')
  if (lastCanola && nextYear - lastCanola.year < 3) out.push({ kind: 'canola-too-soon', lastYear: lastCanola.year })
  const lastLupins = [...h].reverse().find((x) => x.crop === 'lupins')
  if (lastLupins && nextYear - lastLupins.year < 3) out.push({ kind: 'lupins-too-soon', lastYear: lastLupins.year })
  if (out.length === 0) out.push({ kind: 'good' })
  return out
}

/** Crops that would fit next season, best first. */
export function suggestedNextCrops(history: { year: number; crop: string }[]): string[] {
  const advice = rotationAdvice(history)
  const avoid = new Set<string>()
  for (const a of advice) {
    if (a.kind === 'same-crop') avoid.add(a.crop)
    if (a.kind === 'canola-too-soon') avoid.add('canola')
    if (a.kind === 'lupins-too-soon') avoid.add('lupins')
    if (a.kind === 'cereal-run') CEREALS.forEach((c) => avoid.add(c))
  }
  const last = [...history].sort((a, b) => b.year - a.year)[0]?.crop
  // After a cereal, a break crop first; after a break crop, a cereal.
  const order = last && CEREALS.includes(last) ? [...BREAK_CROPS, ...CEREALS] : ['wheat', 'barley', ...BREAK_CROPS, 'oats']
  return order.filter((c) => !avoid.has(c) && c !== last)
}
