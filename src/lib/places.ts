// Where animals can be: a camp, or a field used for grazing. Stored on a group as camp_id or field_id
// (never both); in forms as one value, "camp:<id>" or "field:<id>".
import { useCamps, useFields } from './queries'

export type PlaceKind = 'camp' | 'field'
export interface Place { kind: PlaceKind; id: string; key: string; name: string; hectares: number | null; pasture: string | null; planted?: boolean }

/** What grows where animals graze. Free text is kept too (older entries). */
export const PASTURES = ['lucerne', 'medics', 'clover', 'ryegrass', 'oats_grazing', 'stubble', 'natural_veld', 'fallow', 'other'] as const

export const placeKey = (g: { camp_id: string | null; field_id?: string | null }) => (g.field_id ? `field:${g.field_id}` : g.camp_id ? `camp:${g.camp_id}` : '')

/** A form value back to the two columns. */
export function placeColumns(key: string): { camp_id: string | null; field_id: string | null } {
  const [kind, id] = key.split(':')
  return { camp_id: kind === 'camp' ? id : null, field_id: kind === 'field' ? id : null }
}

/** Every camp and field animals can be on: camps, grazing fields, then planted fields. */
export function usePlaces() {
  const camps = useCamps()
  const fields = useFields()
  const places: Place[] = [
    ...(camps.data ?? []).map((c): Place => ({ kind: 'camp', id: c.id, key: `camp:${c.id}`, name: c.name, hectares: c.hectares, pasture: c.pasture_type })),
    ...(fields.data ?? []).filter((f) => f.use === 'grazing').map((f): Place => ({ kind: 'field', id: f.id, key: `field:${f.id}`, name: f.name, hectares: f.hectares, pasture: f.pasture_type, planted: false })),
    // Planted fields can be grazed too (stubble after harvest, or a failed crop).
    ...(fields.data ?? []).filter((f) => f.use !== 'grazing').map((f): Place => ({ kind: 'field', id: f.id, key: `field:${f.id}`, name: f.name, hectares: f.hectares, pasture: f.pasture_type, planted: true })),
  ]
  const byKey = new Map(places.map((p) => [p.key, p]))
  return { places, byKey, isLoading: camps.isLoading || fields.isLoading }
}

/** What grows there, in words (a known kind is translated; anything typed is shown as typed). */
export function pastureLabel(t: (k: never) => string, v: string | null | undefined): string {
  if (!v) return ''
  return (PASTURES as readonly string[]).includes(v) ? t(`past_${v}` as never) : v
}
