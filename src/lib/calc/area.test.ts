import { describe, expect, it } from 'vitest'
import { hectaresFromBoundary } from './area'

// A box of 0.01° x 0.01° near Swellendam (lat -34). Expected size by hand:
// 1° latitude ≈ 110 950 m, 1° longitude ≈ 111 320 m × cos(34°) ≈ 92 290 m
// → 1 109.5 m × 922.9 m ≈ 102.4 ha
const box = {
  type: 'Polygon' as const,
  coordinates: [[[20.44, -34.02], [20.45, -34.02], [20.45, -34.03], [20.44, -34.03], [20.44, -34.02]]],
}

describe('hectaresFromBoundary', () => {
  it('measures a box near Swellendam to within 1%', () => {
    const ha = hectaresFromBoundary(box)
    expect(ha).toBeGreaterThan(102.4 * 0.99)
    expect(ha).toBeLessThan(102.4 * 1.01)
  })

  it('accepts a GeoJSON Feature as well as a bare geometry', () => {
    expect(hectaresFromBoundary({ type: 'Feature', properties: {}, geometry: box })).toBe(hectaresFromBoundary(box))
  })

  it('adds up the parts of a MultiPolygon', () => {
    const multi = { type: 'MultiPolygon' as const, coordinates: [box.coordinates, box.coordinates.map((r) => r.map(([x, y]) => [x + 0.02, y]))] }
    expect(hectaresFromBoundary(multi)).toBeCloseTo(hectaresFromBoundary(box) * 2, 0)
  })

  it('returns 0 for a missing outline', () => {
    expect(hectaresFromBoundary(null)).toBe(0)
    expect(hectaresFromBoundary(undefined)).toBe(0)
  })
})
