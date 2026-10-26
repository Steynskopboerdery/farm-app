/** Tons per hectare (3 decimals), or null when the area is unknown. */
export function yieldPerHa(tons: number, hectares: number | null | undefined): number | null {
  if (!hectares || hectares <= 0) return null
  return Math.round((tons / hectares) * 1000) / 1000
}

export interface CropEstimate {
  hectares: number
  yieldTPerHa: number
  pricePerT: number
  inputCostPerHa: number
}

/** Planned income, cost and margin for a field, in Rand. */
export function cropMargin(e: CropEstimate) {
  const tons = e.hectares * e.yieldTPerHa
  const income = Math.round(tons * e.pricePerT * 100) / 100
  const cost = Math.round(e.hectares * e.inputCostPerHa * 100) / 100
  return { tons: Math.round(tons * 1000) / 1000, income, cost, margin: Math.round((income - cost) * 100) / 100 }
}
