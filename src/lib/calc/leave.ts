// Leave days and balances, following the Basic Conditions of Employment Act defaults:
//   annual leave per calendar year, sick leave per 36-month cycle from the start date,
//   family responsibility leave per year. Public holidays are not counted as leave days.

const DAY = 86_400_000
const iso = (t: number) => new Date(t).toISOString().slice(0, 10)
const parse = (d: string) => Date.parse(`${d}T00:00:00Z`)

/** Easter Sunday (Gregorian), as YYYY-MM-DD. */
export function easterSunday(year: number): string {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** South African public holidays for a year. A holiday on a Sunday moves to the Monday. */
export function publicHolidays(year: number): Set<string> {
  const fixed = ['01-01', '03-21', '04-27', '05-01', '06-16', '08-09', '09-24', '12-16', '12-25', '12-26']
  const out = new Set<string>()
  for (const md of fixed) {
    const d = `${year}-${md}`
    out.add(d)
    if (new Date(parse(d)).getUTCDay() === 0) out.add(iso(parse(d) + DAY))
  }
  const easter = parse(easterSunday(year))
  out.add(iso(easter - 2 * DAY))   // Good Friday
  out.add(iso(easter + DAY))       // Family Day
  return out
}

/** ISO weekday: 1 = Monday ... 7 = Sunday. */
const weekday = (t: number) => ((new Date(t).getUTCDay() + 6) % 7) + 1

/** Working days from start to end (inclusive) for someone who works on `workDays`, leaving out public holidays. */
export function workingDays(start: string, end: string, workDays: number[] = [1, 2, 3, 4, 5]): number {
  if (end < start) return 0
  let n = 0
  const holidays = new Map<number, Set<string>>()
  for (let t = parse(start); t <= parse(end); t += DAY) {
    const d = iso(t)
    const y = Number(d.slice(0, 4))
    if (!holidays.has(y)) holidays.set(y, publicHolidays(y))
    if (workDays.includes(weekday(t)) && !holidays.get(y)!.has(d)) n++
  }
  return n
}

export interface LeaveLite { type: string; status: string; start_date: string; days: number }
export interface StaffLeaveRules { start_date: string | null; annual_leave_days: number; sick_leave_days: number; family_leave_days: number }

/** Start of the 36-month sick leave cycle that contains `today`. */
export function sickCycleStart(startDate: string | null, today: string): string {
  if (!startDate || startDate > today) return `${Number(today.slice(0, 4)) - 2}-01-01`
  let y = Number(startDate.slice(0, 4))
  const md = startDate.slice(5)
  while (`${y + 3}-${md}` <= today) y += 3
  return `${y}-${md}`
}

/** Leave left this year (annual, family) and in the current sick leave cycle. Approved leave only. */
export function leaveBalances(staff: StaffLeaveRules, leave: LeaveLite[], today: string) {
  const year = today.slice(0, 4)
  const approved = leave.filter((l) => l.status === 'approved')
  const used = (type: string, from: string) =>
    approved.filter((l) => l.type === type && l.start_date >= from && l.start_date <= `${year}-12-31`).reduce((s, l) => s + Number(l.days), 0)
  const cycle = sickCycleStart(staff.start_date, today)
  const annualUsed = used('annual', `${year}-01-01`)
  const sickUsed = used('sick', cycle)
  const familyUsed = used('family', `${year}-01-01`)
  return {
    annual: { entitled: Number(staff.annual_leave_days), used: annualUsed, left: Number(staff.annual_leave_days) - annualUsed },
    sick: { entitled: Number(staff.sick_leave_days), used: sickUsed, left: Number(staff.sick_leave_days) - sickUsed, cycleStart: cycle },
    family: { entitled: Number(staff.family_leave_days), used: familyUsed, left: Number(staff.family_leave_days) - familyUsed },
    pending: leave.filter((l) => l.status === 'pending').length,
  }
}

/** Is the person on approved leave on this day? */
export function onLeave<T extends { status: string; start_date: string; end_date: string }>(leave: T[], day: string): T | null {
  return leave.find((l) => l.status === 'approved' && l.start_date <= day && l.end_date >= day) ?? null
}
