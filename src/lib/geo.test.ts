import { describe, expect, it } from 'vitest'
import { centreOf, satelliteTileUrl } from './geo'

describe('centreOf', () => {
  it('finds the middle of all outlines', () => {
    const a = { type: 'Polygon' as const, coordinates: [[[20.0, -34.0], [20.2, -34.0], [20.2, -34.2], [20.0, -34.2], [20.0, -34.0]]] }
    expect(centreOf([a, null])).toEqual([-34.1, 20.1])
  })
  it('is unknown without outlines', () => {
    expect(centreOf([null])).toBeNull()
  })
})

describe('satelliteTileUrl', () => {
  it('picks the right tile near Swellendam', () => {
    // x = (20.44 + 180) / 360 × 1024 = 570.2; y = (1 − ln(tan φ + sec φ) / π) / 2 × 1024 = 615.0 (URL order is zoom/y/x)
    expect(satelliteTileUrl(-34.02, 20.44, 10)).toMatch(/\/tile\/10\/615\/570$/)
  })
})
