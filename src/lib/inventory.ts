import { useQuery } from '@tanstack/react-query'
import { useFarmId } from '../farm/FarmProvider'
import { supabase, type Tables } from './supabase'

export type InventoryItem = Tables<'inventory_items'>
export type Movement = Tables<'inventory_movements'>
export type Cost = Tables<'costs'>

async function rows<T>(p: PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const { data, error } = await p
  if (error) throw new Error(error.message)
  return data ?? []
}

export const STORE_CATEGORIES = ['seed', 'fertiliser', 'chemical', 'feed', 'other'] as const
export const COST_CATEGORIES = ['fuel', 'labour', 'machinery', 'other'] as const

export function useInventory() {
  const farmId = useFarmId()
  return useQuery({
    queryKey: ['inventory', farmId],
    queryFn: async () => {
      const [items, movements] = await Promise.all([
        rows(supabase.from('inventory_items').select('*').eq('farm_id', farmId).is('deleted_at', null).order('category').order('name')),
        rows(supabase.from('inventory_movements').select('*').eq('farm_id', farmId).is('deleted_at', null).order('date', { ascending: false })),
      ])
      return { items, movements }
    },
  })
}

export function useCosts(enabled = true) {
  const farmId = useFarmId()
  return useQuery({
    queryKey: ['costs', farmId],
    enabled,
    queryFn: () => rows(supabase.from('costs').select('*').eq('farm_id', farmId).is('deleted_at', null).order('date', { ascending: false })),
  })
}

/** Every crop record on the farm, for reports. */
export function useAllCropRecords() {
  const farmId = useFarmId()
  return useQuery({
    queryKey: ['field-records', farmId, 'all'],
    queryFn: async () => {
      const [plantings, operations, harvests] = await Promise.all([
        rows(supabase.from('plantings').select('*').eq('farm_id', farmId).is('deleted_at', null)),
        rows(supabase.from('field_operations').select('*').eq('farm_id', farmId).is('deleted_at', null)),
        rows(supabase.from('harvests').select('*').eq('farm_id', farmId).is('deleted_at', null)),
      ])
      return { plantings, operations, harvests }
    },
  })
}

export function usePlanningEstimates() {
  const farmId = useFarmId()
  return useQuery({
    queryKey: ['planning_estimates', farmId],
    queryFn: () => rows(supabase.from('planning_estimates').select('*').eq('farm_id', farmId).is('deleted_at', null).order('kind').order('name')),
  })
}

/** Every change to group head counts (from the change history), for the animal numbers report. */
export function useGroupCountHistory(enabled = true) {
  const farmId = useFarmId()
  return useQuery({
    queryKey: ['audit_log', farmId, 'group-counts'],
    enabled,
    queryFn: async () => {
      const data = await rows(supabase.from('audit_log').select('record_id, changed_at, action, new_data, old_data')
        .eq('farm_id', farmId).eq('table_name', 'livestock_groups').order('changed_at').limit(5000))
      return data.filter((e) => e.record_id).map((e) => {
        const n = (e.new_data ?? e.old_data ?? {}) as { quantity?: number; species?: string; deleted_at?: string | null }
        return { record_id: e.record_id!, changed_at: e.changed_at, quantity: n.quantity ?? 0, species: n.species ?? 'sheep', deleted: e.action === 'delete' || !!n.deleted_at }
      })
    },
  })
}

export function useAllBirths() {
  const farmId = useFarmId()
  return useQuery({
    queryKey: ['livestock-records', farmId, 'births'],
    queryFn: () => rows(supabase.from('animal_events').select('group_id, date, quantity').eq('farm_id', farmId).eq('type', 'birth').is('deleted_at', null)),
  })
}
