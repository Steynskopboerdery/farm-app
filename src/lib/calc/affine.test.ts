import { describe, expect, it } from 'vitest'
import { applyAffine, fitAffine, fitError, insideRing, type PointPair } from './affine'

// A photo that is scaled ×2, turned 30° and shifted: the fit must find it exactly from 3 points.
const truth = (x: number, y: number): [number, number] => {
  const c = Math.cos(Math.PI / 6) * 2
  const s = Math.sin(Math.PI / 6) * 2
  return [c * x - s * y + 2_268_000, s * x + c * y - 4_070_000]
}
const pair = (x: number, y: number): PointPair => ({ photo: [x, y], map: truth(x, y) })

describe('fitting a farm map photo', () => {
  it('finds scale, turn and shift from three points', () => {
    const t = fitAffine([pair(10, 20), pair(900, 40), pair(300, 700)])!
    const [X, Y] = applyAffine(t, 500, 500)
    const [eX, eY] = truth(500, 500)
    expect(Math.abs(X - eX)).toBeLessThan(1e-6)
    expect(Math.abs(Y - eY)).toBeLessThan(1e-6)
  })
  it('averages out small tapping mistakes and reports how far off they are', () => {
    const pts = [pair(10, 20), pair(900, 40), pair(300, 700), pair(800, 800)]
    pts[3].map = [pts[3].map[0] + 6, pts[3].map[1] - 8]
    const t = fitAffine(pts)!
    expect(fitError(t, pts)).toBeGreaterThan(1)
    expect(fitError(t, pts)).toBeLessThan(10)
  })
  it('needs three points that are not in a line', () => {
    expect(fitAffine([pair(0, 0), pair(10, 10)])).toBeNull()
    expect(fitAffine([pair(0, 0), pair(10, 10), pair(20, 20)])).toBeNull()
  })
  it('knows whether a name on the map lies inside a drawn field', () => {
    const square: [number, number][] = [[20, -34], [20.01, -34], [20.01, -34.01], [20, -34.01], [20, -34]]
    expect(insideRing([20.005, -34.005], square)).toBe(true)
    expect(insideRing([20.02, -34.005], square)).toBe(false)
  })
})
