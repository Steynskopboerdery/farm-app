import turfArea from '@turf/area'
import type { Feature, MultiPolygon, Polygon } from 'geojson'

export type Boundary = Polygon | MultiPolygon

/** Area of a drawn outline in hectares (2 decimals). Uses the curved-earth formula from Turf. */
export function hectaresFromBoundary(boundary: Boundary | Feature<Boundary> | null | undefined): number {
  if (!boundary) return 0
  const geom = 'geometry' in boundary ? boundary.geometry : boundary
  if (!geom || (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon')) return 0
  const squareMetres = turfArea(geom)
  return Math.round((squareMetres / 10_000) * 100) / 100
}
