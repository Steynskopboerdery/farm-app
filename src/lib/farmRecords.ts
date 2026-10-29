import { useQuery } from '@tanstack/react-query'
import { useFarmId } from '../farm/FarmProvider'
import { supabase, type Tables } from './supabase'

// Rain gauge, map pins, head counts, vehicles.

export type RainReading = Tables<'rain_readings'>
export type MapPin = Tables<'map_pins'>
export type HeadCount = Tables<'head_counts'>
export type Vehicle = Tables<'vehicles'>
export type VehicleLog = Tables<'vehicle_logs'>

export const PIN_KINDS = ['fence', 'water', 'erosion', 'weeds', 'animal', 'other'] as const
export const PIN_EMOJI: Record<string, string> = { fence: '🚧', water: '💧', erosion: '🕳️', weeds: '🌿', animal: '🐾', other: '📍' }
export const VEHICLE_KINDS = ['tractor', 'bakkie', 'truck', 'harvester', 'motorbike', 'other'] as const
export const VEHICLE_EMOJI: Record<string, string> = { tractor: '🚜', bakkie: '🛻', truck: '🚚', harvester: '🌾', motorbike: '🏍️', other: '⚙️' }

async function rows<T>(p: PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const { data, error } = await p
  if (error) throw new Error(error.message)
  return data ?? []
}

export function useRain() {
  const farmId = useFarmId()
  return useQuery({
    queryKey: ['rain_readings', farmId],
    queryFn: () => rows(supabase.from('rain_readings').select('*').eq('farm_id', farmId).is('deleted_at', null).order('date', { ascending: false }).limit(5000)),
  })
}

export function usePins(includeResolved = false) {
  const farmId = useFarmId()
  return useQuery({
    queryKey: ['map_pins', farmId, includeResolved],
    queryFn: () => {
      let q = supabase.from('map_pins').select('*').eq('farm_id', farmId).is('deleted_at', null)
      if (!includeResolved) q = q.is('resolved_at', null)
      return rows(q.order('created_at', { ascending: false }))
    },
  })
}

export function useHeadCounts(groupId?: string) {
  const farmId = useFarmId()
  return useQuery({
    queryKey: ['head_counts', farmId, groupId ?? 'all'],
    queryFn: () => {
      let q = supabase.from('head_counts').select('*').eq('farm_id', farmId).is('deleted_at', null)
      if (groupId) q = q.eq('group_id', groupId)
      return rows(q.order('date', { ascending: false }).limit(1000))
    },
  })
}

export function useVehicles() {
  const farmId = useFarmId()
  return useQuery({
    queryKey: ['vehicles', farmId],
    queryFn: async () => {
      const [vehicles, logs] = await Promise.all([
        rows(supabase.from('vehicles').select('*').eq('farm_id', farmId).is('deleted_at', null).order('name')),
        rows(supabase.from('vehicle_logs').select('*').eq('farm_id', farmId).is('deleted_at', null).order('date', { ascending: false }).limit(5000)),
      ])
      return { vehicles, logs }
    },
  })
}

/** Sales lines with the season of their sale, for profit per field (owners only). */
export function useSaleLines(enabled = true) {
  const farmId = useFarmId()
  return useQuery({
    queryKey: ['sale_items', farmId, 'with-season'],
    enabled,
    queryFn: async () => {
      const data = await rows(supabase.from('sale_items').select('field_id, quantity, unit_price, sale:sales!inner(season_id, deleted_at)')
        .eq('farm_id', farmId).is('deleted_at', null))
      return data.filter((x) => !x.sale?.deleted_at).map((x) => ({ field_id: x.field_id, quantity: x.quantity, unit_price: x.unit_price, season_id: x.sale?.season_id ?? null }))
    },
  })
}

/** Signed link to a private photo, valid for an hour. */
export async function signedUrl(bucket: string, path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600)
  return error ? null : data.signedUrl
}

export function useSignedUrl(bucket: string, path: string | null | undefined) {
  return useQuery({
    queryKey: ['signed-url', bucket, path],
    enabled: !!path,
    staleTime: 50 * 60_000,
    queryFn: () => signedUrl(bucket, path!),
  })
}
