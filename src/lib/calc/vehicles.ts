// Fuel use and service planning per vehicle, from its fuel / service log.

export interface VehicleLogLite { kind: string; date: string; litres: number | null; reading: number | null }

const r1 = (n: number) => Math.round(n * 10) / 10

/** Highest meter reading recorded (hours or km). */
export function latestReading(logs: VehicleLogLite[]): number | null {
  const vals = logs.map((l) => l.reading).filter((x): x is number => x != null).map(Number)
  return vals.length ? Math.max(...vals) : null
}

/**
 * Average fuel use: litres per hour (or per 100 km).
 * Uses fill-ups that have a meter reading: the fuel put in after the first reading,
 * divided by the hours/km between the first and last reading.
 */
export function fuelUse(logs: VehicleLogLite[], meter: 'hours' | 'km'): number | null {
  const fills = logs.filter((l) => l.kind === 'fuel' && l.reading != null && l.litres != null)
    .sort((a, b) => Number(a.reading) - Number(b.reading))
  if (fills.length < 2) return null
  const distance = Number(fills[fills.length - 1].reading) - Number(fills[0].reading)
  if (distance <= 0) return null
  const litres = fills.slice(1).reduce((s, l) => s + Number(l.litres), 0)
  return meter === 'km' ? r1((litres / distance) * 100) : r1(litres / distance)
}

/** When the next service is due and how far away it is. */
export function serviceStatus(logs: VehicleLogLite[], interval: number | null) {
  const now = latestReading(logs)
  if (!interval || now == null) return null
  const services = logs.filter((l) => l.kind === 'service' && l.reading != null).map((l) => Number(l.reading))
  // No service recorded yet: count from the first reading in the app.
  const first = Math.min(...logs.filter((l) => l.reading != null).map((l) => Number(l.reading)))
  const last = services.length ? Math.max(...services) : first
  const dueAt = last + Number(interval)
  const left = r1(dueAt - now)
  return { lastService: services.length ? last : null, dueAt, left, due: left <= 0, soon: left > 0 && left <= Number(interval) * 0.1 }
}

/** Litres per month for the last months (YYYY-MM keys). */
export function litresByMonth(logs: VehicleLogLite[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const l of logs) {
    if (l.kind !== 'fuel' || !l.litres) continue
    const m = l.date.slice(0, 7)
    out.set(m, r1((out.get(m) ?? 0) + Number(l.litres)))
  }
  return out
}
