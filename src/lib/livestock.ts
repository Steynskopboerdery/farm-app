import { useQuery } from '@tanstack/react-query'
import { useFarmId } from '../farm/FarmProvider'
import { supabase, type Tables } from './supabase'

export type Group = Tables<'livestock_groups'>
export type Animal = Tables<'animals'>
export type AnimalEvent = Tables<'animal_events'>
export type BreedingPlan = Tables<'breeding_plans'>
export type ShearingPlan = Tables<'shearing_plans'>

async function rows<T>(p: PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const { data, error } = await p
  if (error) throw new Error(error.message)
  return data ?? []
}

/** Everything recorded for one group. */
export function useGroupRecords(groupId: string | undefined) {
  const farmId = useFarmId()
  return useQuery({
    queryKey: ['livestock-records', farmId, groupId],
    enabled: !!groupId,
    queryFn: async () => {
      const [events, animals, breeding, shearing] = await Promise.all([
        rows(supabase.from('animal_events').select('*').eq('farm_id', farmId).eq('group_id', groupId!).is('deleted_at', null).order('date', { ascending: false })),
        rows(supabase.from('animals').select('*').eq('farm_id', farmId).eq('group_id', groupId!).is('deleted_at', null).order('tag')),
        rows(supabase.from('breeding_plans').select('*').eq('farm_id', farmId).eq('group_id', groupId!).is('deleted_at', null).order('joining_start_date', { ascending: false })),
        rows(supabase.from('shearing_plans').select('*').eq('farm_id', farmId).eq('group_id', groupId!).is('deleted_at', null).order('planned_date', { ascending: false })),
      ])
      return { events, animals, breeding, shearing }
    },
  })
}

/** Open tasks linked to livestock groups (vaccination reminders etc.). */
export function useGroupTasks(groupId?: string) {
  const farmId = useFarmId()
  return useQuery({
    queryKey: ['tasks', farmId, 'groups', groupId ?? 'all'],
    queryFn: () => {
      let q = supabase.from('tasks').select('*').eq('farm_id', farmId).eq('status', 'open').is('deleted_at', null)
      q = groupId ? q.eq('group_id', groupId) : q.not('group_id', 'is', null)
      return rows(q.order('due_date'))
    },
  })
}

/** Recent events across the farm, for the sales and losses list. */
export function useRecentAnimalEvents(types: string[]) {
  const farmId = useFarmId()
  return useQuery({
    queryKey: ['livestock-records', farmId, 'recent', types.join(',')],
    queryFn: () => rows(supabase.from('animal_events').select('*').eq('farm_id', farmId).in('type', types)
      .is('deleted_at', null).order('date', { ascending: false }).limit(30)),
  })
}

export const SPECIES = ['sheep', 'cattle'] as const
export const CLASSES: Record<(typeof SPECIES)[number], string[]> = {
  sheep: ['ewes', 'rams', 'lambs', 'hoggets', 'wethers'],
  cattle: ['cows', 'bulls', 'calves', 'heifers', 'oxen'],
}
export const EVENT_TYPES = ['birth', 'vaccination', 'dosing', 'weighing', 'moved', 'sale', 'death', 'other'] as const
