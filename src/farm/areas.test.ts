import { describe, expect, it } from 'vitest'
import { AREA_OF_PATH, AREAS, seesIn } from './FarmProvider'

describe('what workers can see', () => {
  it('shows everything until the owner switches a part off', () => {
    expect(AREAS.every((a) => seesIn({}, a))).toBe(true)
    expect(seesIn({ see_map: false }, 'map')).toBe(false)
    expect(seesIn({ see_map: true, field_records: true }, 'map')).toBe(true)
  })
  it('knows which part every hideable page belongs to', () => {
    expect(new Set(AREA_OF_PATH.map(([, a]) => a))).toEqual(new Set(AREAS))
  })
})
