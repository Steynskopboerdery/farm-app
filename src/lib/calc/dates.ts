// Dates are handled as plain 'YYYY-MM-DD' strings (how Postgres sends them),
// calculated in UTC so a day is always a whole day.

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function daysBetween(fromIso: string, toIso: string): number {
  const ms = Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)
  return Math.round(ms / 86_400_000)
}

/** Expected lambing / calving window: joining dates + gestation days. */
export function birthWindow(joiningStart: string, joiningEnd: string | null | undefined, gestationDays: number) {
  return {
    start: addDays(joiningStart, gestationDays),
    end: addDays(joiningEnd || joiningStart, gestationDays),
  }
}

export function todayIso(): string {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}
