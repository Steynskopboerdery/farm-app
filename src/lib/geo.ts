import type { Position } from 'geojson'
import type { Boundary } from './calc/area'

function positions(b: Boundary): Position[] {
  return b.type === 'Polygon' ? b.coordinates.flat() : b.coordinates.flat(2)
}

/** Middle of the bounding box around one or more outlines, as [lat, lng]. */
export function centreOf(boundaries: (Boundary | null | undefined)[]): [number, number] | null {
  const pts = boundaries.filter((b): b is Boundary => !!b).flatMap(positions)
  if (pts.length === 0) return null
  const lngs = pts.map((p) => p[0])
  const lats = pts.map((p) => p[1])
  return [(Math.min(...lats) + Math.max(...lats)) / 2, (Math.min(...lngs) + Math.max(...lngs)) / 2]
}

/** One Esri satellite tile covering a point, for small field pictures. */
export function satelliteTileUrl(lat: number, lng: number, zoom = 16): string {
  const n = 2 ** zoom
  const x = Math.floor(((lng + 180) / 360) * n)
  const r = (lat * Math.PI) / 180
  const y = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n)
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${y}/${x}`
}
