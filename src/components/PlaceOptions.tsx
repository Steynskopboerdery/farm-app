import { useI18n } from '../lib/i18n'
import type { Place } from '../lib/places'

/** <option>s for where animals can go, grouped: camps, grazing fields, planted fields (stubble or a failed crop). */
export function PlaceOptions({ places, skip }: { places: Place[]; skip?: string }) {
  const { t } = useI18n()
  const list = places.filter((p) => p.key !== skip)
  const group = (label: string, ps: Place[]) => ps.length > 0 && <optgroup label={label}>{ps.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}</optgroup>
  return (
    <>
      {group(t('camps'), list.filter((p) => p.kind === 'camp'))}
      {group(t('grazingFields'), list.filter((p) => p.kind === 'field' && !p.planted))}
      {group(t('plantedFields'), list.filter((p) => p.planted))}
    </>
  )
}
