import { addDays } from './dates'

export interface SprayRecord {
  product: string | null
  date: string
  withholdingPeriodDays: number | null
}

/** Earliest date the crop may be harvested after this spray. */
export function safeHarvestDate(spray: SprayRecord): string {
  return addDays(spray.date, spray.withholdingPeriodDays ?? 0)
}

/** Sprays whose withholding period has not ended by the planned harvest date. */
export function withholdingConflicts(sprays: SprayRecord[], harvestDate: string) {
  return sprays
    .filter((s) => (s.withholdingPeriodDays ?? 0) > 0)
    .map((s) => ({ ...s, safeFrom: safeHarvestDate(s) }))
    .filter((s) => s.safeFrom > harvestDate)
}
