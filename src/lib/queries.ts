import { useQuery } from '@tanstack/react-query'
import { useFarmId } from '../farm/FarmProvider'
import { supabase } from './supabase'

// Each hook reads one kind of record for the current farm. Hidden (deleted) rows are left out.

async function run<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p
  if (error) throw new Error(error.message)
  return data as T
}

export function useFields() {
  const farmId = useFarmId()
  return useQuery({
    queryKey: ['fields', farmId],
    queryFn: () => run(supabase.from('fields').select('*').eq('farm_id', farmId).is('deleted_at', null).order('name')),
  })
}

export function useCamps() {
  const farmId = useFarmId()
  return useQuery({
    queryKey: ['camps', farmId],
    queryFn: () => run(supabase.from('camps').select('*').eq('farm_id', farmId).is('deleted_at', null).order('name')),
  })
}

export function useSeasons() {
  const farmId = useFarmId()
  return useQuery({
    queryKey: ['seasons', farmId],
    queryFn: () => run(supabase.from('seasons').select('*').eq('farm_id', farmId).is('deleted_at', null).order('year', { ascending: false })),
  })
}

/** Most recent planting per field (the "current crop"). */
export function useCurrentPlantings() {
  const farmId = useFarmId()
  return useQuery({
    queryKey: ['plantings', farmId, 'current'],
    queryFn: async () => {
      const rows = await run(
        supabase.from('plantings').select('*, season:seasons(year, label)')
          .eq('farm_id', farmId).is('deleted_at', null)
          .order('planting_date', { ascending: false, nullsFirst: false }),
      )
      const byField = new Map<string, (typeof rows)[number]>()
      for (const r of rows) if (!byField.has(r.field_id)) byField.set(r.field_id, r)
      return byField
    },
  })
}

export function useGroups() {
  const farmId = useFarmId()
  return useQuery({
    queryKey: ['livestock_groups', farmId],
    queryFn: () => run(supabase.from('livestock_groups').select('*').eq('farm_id', farmId).is('deleted_at', null).order('species').order('name')),
  })
}

export function useOpenTasks() {
  const farmId = useFarmId()
  return useQuery({
    queryKey: ['tasks', farmId, 'open'],
    queryFn: () => run(supabase.from('tasks').select('*').eq('farm_id', farmId).eq('status', 'open').is('deleted_at', null)
      .order('due_date', { ascending: true, nullsFirst: false })),
  })
}

export function useBreedingPlans() {
  const farmId = useFarmId()
  return useQuery({
    queryKey: ['breeding_plans', farmId],
    queryFn: () => run(supabase.from('breeding_plans').select('*, group:livestock_groups(name, species)')
      .eq('farm_id', farmId).is('deleted_at', null).order('expected_birth_start')),
  })
}

export function useShearingPlans() {
  const farmId = useFarmId()
  return useQuery({
    queryKey: ['shearing_plans', farmId],
    queryFn: () => run(supabase.from('shearing_plans').select('*, group:livestock_groups(name)')
      .eq('farm_id', farmId).is('deleted_at', null).is('done_date', null).order('planned_date')),
  })
}

export function useFarmSettings(enabled = true) {
  const farmId = useFarmId()
  return useQuery({
    queryKey: ['farm_settings', farmId],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from('farm_settings').select('*').eq('farm_id', farmId).maybeSingle()
      if (error) throw new Error(error.message)
      return data
    },
  })
}

export function useSpecies() {
  const farmId = useFarmId()
  return useQuery({
    queryKey: ['species_reference', farmId],
    queryFn: () => run(supabase.from('species_reference').select('*').eq('farm_id', farmId).order('species')),
  })
}

export function useMembers() {
  const farmId = useFarmId()
  return useQuery({
    queryKey: ['farm_members', farmId],
    queryFn: () => run(supabase.from('farm_members').select('*').eq('farm_id', farmId).is('deleted_at', null).order('created_at')),
  })
}

export function useInvites(enabled = true) {
  const farmId = useFarmId()
  return useQuery({
    queryKey: ['farm_invites', farmId],
    enabled,
    queryFn: () => run(supabase.from('farm_invites').select('*').eq('farm_id', farmId).is('accepted_at', null).is('deleted_at', null)),
  })
}

export function useAuditLog(table: string, recordId: string | undefined, enabled = true, withChildren = false, childKey = 'field_id') {
  const farmId = useFarmId()
  const children = withChildren || childKey !== 'field_id'
  return useQuery({
    queryKey: ['audit_log', farmId, table, recordId, children, childKey],
    enabled: enabled && !!recordId,
    queryFn: () => {
      let q = supabase.from('audit_log').select('*').eq('farm_id', farmId)
      // Also show changes to records that belong to this one (a field's plantings, a group's events).
      q = children
        ? q.or(`and(table_name.eq.${table},record_id.eq.${recordId}),new_data->>${childKey}.eq.${recordId},old_data->>${childKey}.eq.${recordId}`)
        : q.eq('table_name', table).eq('record_id', recordId!)
      return run(q.order('changed_at', { ascending: false }).limit(60))
    },
  })
}
