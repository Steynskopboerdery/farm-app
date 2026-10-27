import { addDays, birthWindow, daysBetween } from './dates'

export type EventType = 'birth' | 'vaccination' | 'dosing' | 'weighing' | 'sale' | 'death' | 'moved' | 'other'

/** How an event changes a group's head count: births add, sales and deaths take away. */
export function countChange(type: EventType, quantity: number | null | undefined): number {
  const n = Math.max(0, Math.round(quantity ?? 0))
  if (type === 'birth') return n
  if (type === 'sale' || type === 'death') return -n
  return 0
}

/** New head count after an event, never below zero. */
export function countAfter(current: number, type: EventType, quantity: number | null | undefined): number {
  return Math.max(0, current + countChange(type, quantity))
}

export interface BreedingInput {
  joiningStart: string
  joiningEnd?: string | null
  gestationDays: number
}

/** Lambing / calving window from joining dates, plus a reminder date to prepare (two weeks before). */
export function breedingDates({ joiningStart, joiningEnd, gestationDays }: BreedingInput) {
  const w = birthWindow(joiningStart, joiningEnd, gestationDays)
  return { birthStart: w.start, birthEnd: w.end, prepareBy: addDays(w.start, -14) }
}

/** Lambing or calving percentage: young born (or weaned) per 100 females joined. */
export function birthPercentage(young: number, femalesJoined: number): number | null {
  if (!femalesJoined) return null
  return Math.round((young / femalesJoined) * 1000) / 10
}

/** "in 12 days", "today", "3 days ago": the number for the countdown. */
export function daysUntil(today: string, date: string): number {
  return daysBetween(today, date)
}

/** Age in whole months from birth date to today. */
export function ageInMonths(birthDate: string, today: string): number {
  const [by, bm, bd] = birthDate.split('-').map(Number)
  const [ty, tm, td] = today.split('-').map(Number)
  return Math.max(0, (ty - by) * 12 + (tm - bm) - (td < bd ? 1 : 0))
}
