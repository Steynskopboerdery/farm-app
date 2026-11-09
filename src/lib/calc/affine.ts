// Fitting a photo of a farm map onto the satellite map from matching points: tap the same spot (a field corner,
// a dam, a road crossing) on the photo and on the map, three or more times. An affine fit handles any scale,
// turn and stretch of the photo; with four or more points it also says how well the photo fits.

/** Maps photo pixels (x, y) to map metres (X, Y): X = a·x + b·y + c, Y = d·x + e·y + f. */
export type Affine = [number, number, number, number, number, number]

export interface PointPair { photo: [number, number]; map: [number, number] }

/** Solve a 3×3 system (Gaussian elimination with pivoting). */
function solve3(m: number[][], v: number[]): number[] | null {
  const a = m.map((row, i) => [...row, v[i]])
  for (let c = 0; c < 3; c++) {
    let p = c
    for (let r = c + 1; r < 3; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r
    if (Math.abs(a[p][c]) < 1e-9) return null
    ;[a[c], a[p]] = [a[p], a[c]]
    for (let r = 0; r < 3; r++) {
      if (r === c) continue
      const f = a[r][c] / a[c][c]
      for (let k = c; k < 4; k++) a[r][k] -= f * a[c][k]
    }
  }
  return [a[0][3] / a[0][0], a[1][3] / a[1][1], a[2][3] / a[2][2]]
}

/** Best fit through the points (least squares). Null when there are fewer than 3, or they lie on one line. */
export function fitAffine(pairs: PointPair[]): Affine | null {
  if (pairs.length < 3) return null
  // Work around the middle of the photo points so the sums stay well-sized.
  const mx = pairs.reduce((s, p) => s + p.photo[0], 0) / pairs.length
  const my = pairs.reduce((s, p) => s + p.photo[1], 0) / pairs.length
  const m = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
  const vx = [0, 0, 0]
  const vy = [0, 0, 0]
  for (const p of pairs) {
    const r = [p.photo[0] - mx, p.photo[1] - my, 1]
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) m[i][j] += r[i] * r[j]
      vx[i] += r[i] * p.map[0]
      vy[i] += r[i] * p.map[1]
    }
  }
  const sx = solve3(m, vx)
  const sy = solve3(m, vy)
  if (!sx || !sy) return null
  // Undo the centring: X = a(x − mx) + b(y − my) + c0.
  return [sx[0], sx[1], sx[2] - sx[0] * mx - sx[1] * my, sy[0], sy[1], sy[2] - sy[0] * mx - sy[1] * my]
}

export function applyAffine(t: Affine, x: number, y: number): [number, number] {
  return [t[0] * x + t[1] * y + t[2], t[3] * x + t[4] * y + t[5]]
}

/** Average distance (in map metres) between where the fit puts each photo point and where it was tapped on the map. */
export function fitError(t: Affine, pairs: PointPair[]): number {
  if (!pairs.length) return 0
  return Math.sqrt(pairs.reduce((s, p) => {
    const [X, Y] = applyAffine(t, p.photo[0], p.photo[1])
    return s + (X - p.map[0]) ** 2 + (Y - p.map[1]) ** 2
  }, 0) / pairs.length)
}

/** Is a point inside a polygon ring (lng/lat pairs)? */
export function insideRing(pt: [number, number], ring: [number, number][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
