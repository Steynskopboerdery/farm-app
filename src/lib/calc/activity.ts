// Turns the change history into a readable "what did this person do" list per day.

export interface AuditLite { table_name: string; action: string; changed_at: string; old_data: unknown; new_data: unknown }

export type ActivityKind =
  | 'task_done' | 'task_added' | 'spray' | 'fertiliser' | 'fieldwork' | 'planting' | 'harvest'
  | 'animal_event' | 'animal' | 'group_count' | 'head_count' | 'rain' | 'fuel' | 'pin' | 'pasture'
  | 'diary' | 'leave' | 'other'

export interface Activity { kind: ActivityKind; at: string; label: string | null }

const get = (o: unknown, k: string): unknown => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined)
const str = (v: unknown) => (typeof v === 'string' && v ? v : null)

/** One readable line for one change, or null for changes not worth showing (e.g. store movements made automatically). */
export function describe(e: AuditLite): Activity | null {
  const n = e.new_data
  const o = e.old_data
  const at = e.changed_at
  const added = e.action === 'insert'
  switch (e.table_name) {
    case 'tasks':
      if (e.action === 'update' && get(n, 'status') === 'done' && get(o, 'status') !== 'done') return { kind: 'task_done', at, label: str(get(n, 'title')) }
      if (added) return { kind: 'task_added', at, label: str(get(n, 'title')) }
      return null
    case 'field_operations': {
      if (!added) return null
      const type = get(n, 'type')
      return { kind: type === 'spray' ? 'spray' : type === 'fertiliser' ? 'fertiliser' : 'fieldwork', at, label: str(get(n, 'product')) }
    }
    case 'plantings': return added ? { kind: 'planting', at, label: str(get(n, 'crop')) } : null
    case 'harvests': return added ? { kind: 'harvest', at, label: get(n, 'tons') != null ? `${get(n, 'tons')} t` : null } : null
    case 'animal_events': return added ? { kind: 'animal_event', at, label: str(get(n, 'type')) } : null
    case 'animals': return added ? { kind: 'animal', at, label: str(get(n, 'tag')) } : null
    case 'livestock_groups':
      return e.action === 'update' && get(n, 'quantity') !== get(o, 'quantity') ? { kind: 'group_count', at, label: `${get(o, 'quantity')} → ${get(n, 'quantity')}` } : null
    case 'head_counts': return added ? { kind: 'head_count', at, label: `${get(n, 'counted')}/${get(n, 'expected')}` } : null
    case 'rain_readings': return added ? { kind: 'rain', at, label: `${get(n, 'mm')} mm` } : null
    case 'vehicle_logs': return added ? { kind: 'fuel', at, label: get(n, 'litres') != null ? `${get(n, 'litres')} L` : str(get(n, 'notes')) } : null
    case 'map_pins': return added ? { kind: 'pin', at, label: str(get(n, 'title')) } : null
    case 'pasture_tests': return added ? { kind: 'pasture', at, label: null } : null
    case 'work_diary': return added ? { kind: 'diary', at, label: str(get(n, 'notes')) } : null
    case 'leave_requests': return added ? { kind: 'leave', at, label: str(get(n, 'type')) } : null
    case 'inventory_movements': case 'chat_reads': case 'staff_documents': return null
    default: return added ? { kind: 'other', at, label: e.table_name } : null
  }
}

/** Activities grouped by local (South African) day, newest day first. */
export function activityByDay(entries: AuditLite[]): { date: string; items: Activity[] }[] {
  const days = new Map<string, Activity[]>()
  for (const e of entries) {
    const a = describe(e)
    if (!a) continue
    // UTC+2, no daylight saving.
    const date = new Date(Date.parse(a.at) + 2 * 3_600_000).toISOString().slice(0, 10)
    const list = days.get(date) ?? []
    list.push(a)
    days.set(date, list)
  }
  return [...days.entries()].sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, items]) => ({ date, items: items.sort((x, y) => y.at.localeCompare(x.at)) }))
}
