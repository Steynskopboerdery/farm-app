import { describe as group, expect, it } from 'vitest'
import { activityByDay, describe } from './activity'

group('describe', () => {
  it('ticking off a task', () => {
    expect(describe({ table_name: 'tasks', action: 'update', changed_at: '2026-10-29T08:00:00Z', old_data: { status: 'open', title: 'Fix fence' }, new_data: { status: 'done', title: 'Fix fence' } }))
      .toEqual({ kind: 'task_done', at: '2026-10-29T08:00:00Z', label: 'Fix fence' })
  })
  it('a spray record', () => {
    expect(describe({ table_name: 'field_operations', action: 'insert', changed_at: 'x', old_data: null, new_data: { type: 'spray', product: 'Roundup' } })?.kind).toBe('spray')
  })
  it('leaves out automatic store movements and edits that are not count changes', () => {
    expect(describe({ table_name: 'inventory_movements', action: 'insert', changed_at: 'x', old_data: null, new_data: {} })).toBeNull()
    expect(describe({ table_name: 'livestock_groups', action: 'update', changed_at: 'x', old_data: { quantity: 5, name: 'a' }, new_data: { quantity: 5, name: 'b' } })).toBeNull()
  })
})

group('activityByDay', () => {
  it('groups by South African day (22:30 UTC is the next morning there)', () => {
    const days = activityByDay([
      { table_name: 'rain_readings', action: 'insert', changed_at: '2026-10-28T22:30:00Z', old_data: null, new_data: { mm: 6 } },
      { table_name: 'rain_readings', action: 'insert', changed_at: '2026-10-28T10:00:00Z', old_data: null, new_data: { mm: 2 } },
    ])
    expect(days.map((d) => [d.date, d.items.length])).toEqual([['2026-10-29', 1], ['2026-10-28', 1]])
  })
})
