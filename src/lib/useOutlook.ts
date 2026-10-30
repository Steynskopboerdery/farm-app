import { useQuery } from '@tanstack/react-query'
import type { YearClimate } from './calc/outlook'
import { supabase } from './supabase'
import { useFarmLocation } from './useWeather'

type Part<T> = { data: T; fetchedAt: string; stale?: boolean } | { error: string }

export interface OutlookData {
  climate: Part<{ lat: number; lon: number; lastDate: string; years: Record<string, YearClimate>; currentYear: number; currentYearRain: number[] }>
  enso: Part<{ oni: { season: string; year: number; anom: number }[]; probs: { season: string; laNina: number; neutral: number; elNino: number }[]; issued: string | null }>
  markets: Part<{ updated: string | null; series: Record<string, { name: string; unit: string; points: [string, number][] }>; fx: [string, number][] }>
}

export const ok = <T,>(p: Part<T> | undefined): T | null => (p && 'data' in p ? p.data : null)

/** Weather history, El Niño outlook and world prices for the farm's location (from the `outlook` function, cached there). */
export function useOutlook() {
  const { lat, lng } = useFarmLocation()
  return useQuery({
    queryKey: ['outlook', lat.toFixed(2), lng.toFixed(2)],
    staleTime: 6 * 60 * 60_000,
    gcTime: 7 * 24 * 60 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<OutlookData>('outlook', { body: { lat, lon: lng } })
      if (error) throw new Error(error.message)
      if (!data) throw new Error('No outlook received')
      return data
    },
  })
}
