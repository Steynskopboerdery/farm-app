import { useQuery } from '@tanstack/react-query'
import { useFarm } from '../farm/FarmProvider'
import type { Boundary } from './calc/area'
import { centreOf } from './geo'
import { useCamps, useFields } from './queries'
import { supabase } from './supabase'
import { daily, hourly, sprayWindows, weatherAlerts, type MetForecast } from './weather'

// Between Swellendam and Bredasdorp, used until the farm has a location or field outlines.
export const DEFAULT_FARM_LOCATION: [number, number] = [-34.25, 20.25]

/** Where to get weather for: the location saved in Settings, else the middle of the drawn fields, else the default. */
export function useFarmLocation(): { lat: number; lng: number; source: 'saved' | 'fields' | 'default' } {
  const { farm } = useFarm()
  const fields = useFields()
  const camps = useCamps()
  if (farm?.map_center_lat != null && farm.map_center_lng != null) {
    return { lat: farm.map_center_lat, lng: farm.map_center_lng, source: 'saved' }
  }
  const centre = centreOf([
    ...(fields.data ?? []).map((f) => f.boundary_geojson as unknown as Boundary | null),
    ...(camps.data ?? []).map((c) => c.boundary_geojson as unknown as Boundary | null),
  ])
  if (centre) return { lat: centre[0], lng: centre[1], source: 'fields' }
  return { lat: DEFAULT_FARM_LOCATION[0], lng: DEFAULT_FARM_LOCATION[1], source: 'default' }
}

export function useWeather() {
  const { lat, lng } = useFarmLocation()
  return useQuery({
    queryKey: ['weather', lat.toFixed(2), lng.toFixed(2)],
    staleTime: 30 * 60_000,
    gcTime: 24 * 60 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<MetForecast>('weather', { body: { lat, lon: lng } })
      if (error) throw new Error(error.message)
      if (!data?.properties?.timeseries) throw new Error('No forecast received')
      const hours = hourly(data)
      const days = daily(data)
      return {
        updatedAt: data.properties.meta?.updated_at ?? null,
        hours,
        days,
        sprayWindows: sprayWindows(hours.slice(0, 48)),
        alerts: weatherAlerts(days.slice(0, 7)),
      }
    },
  })
}
