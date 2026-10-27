import { useQuery } from '@tanstack/react-query'
import { useFarmId } from '../farm/FarmProvider'
import { addDays, todayIso } from './calc/dates'
import { supabase, type Tables } from './supabase'

export type Planting = Tables<'plantings'>
export type Operation = Tables<'field_operations'>
export type Harvest = Tables<'harvests'>
export type Season = Tables<'seasons'>

async function rows<T>(p: PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const { data, error } = await p
  if (error) throw new Error(error.message)
  return data ?? []
}

/** Everything recorded on one field, all seasons. Volumes per field are small, so one fetch each. */
export function useFieldRecords(fieldId: string | undefined) {
  const farmId = useFarmId()
  return useQuery({
    queryKey: ['field-records', farmId, fieldId],
    enabled: !!fieldId,
    queryFn: async () => {
      const [plantings, operations, harvests] = await Promise.all([
        rows(supabase.from('plantings').select('*').eq('farm_id', farmId).eq('field_id', fieldId!).is('deleted_at', null).order('planting_date')),
        rows(supabase.from('field_operations').select('*').eq('farm_id', farmId).eq('field_id', fieldId!).is('deleted_at', null).order('date')),
        rows(supabase.from('harvests').select('*').eq('farm_id', farmId).eq('field_id', fieldId!).is('deleted_at', null).order('date')),
      ])
      return { plantings, operations, harvests }
    },
  })
}

export function useFieldTasks(fieldId: string | undefined) {
  const farmId = useFarmId()
  return useQuery({
    queryKey: ['tasks', farmId, 'field', fieldId],
    enabled: !!fieldId,
    queryFn: () => rows(supabase.from('tasks').select('*').eq('farm_id', farmId).eq('field_id', fieldId!)
      .eq('status', 'open').is('deleted_at', null).order('due_date')),
  })
}

/** Sprays from roughly the last season that still have a withholding period. */
export function useRecentSprays() {
  const farmId = useFarmId()
  return useQuery({
    queryKey: ['field-records', farmId, 'recent-sprays'],
    queryFn: () => rows(supabase.from('field_operations').select('*').eq('farm_id', farmId).eq('type', 'spray')
      .gt('withholding_period_days', 0).gte('date', addDays(todayIso(), -240)).is('deleted_at', null)),
  })
}

/** The season to show first: this year's if it exists, otherwise the newest one. */
export function defaultSeasonId(seasons: Season[] | undefined): string | null {
  if (!seasons?.length) return null
  const year = Number(todayIso().slice(0, 4))
  return (seasons.find((s) => s.year === year) ?? [...seasons].sort((a, b) => b.year - a.year)[0]).id
}

/** Makes sure a season exists for this year and returns its id. */
export async function ensureSeason(farmId: string, seasons: Season[], year: number): Promise<string> {
  const found = seasons.find((s) => s.year === year)
  if (found) return found.id
  const { data, error } = await supabase.from('seasons').insert({ farm_id: farmId, year, label: String(year) }).select('id').single()
  if (error) throw error
  return data.id
}

export const UNIT_FOR_RATE: Record<string, string> = { 'kg/ha': 'kg', 'L/ha': 'L', 'mL/ha': 'mL', 'g/ha': 'g', 't/ha': 't' }
