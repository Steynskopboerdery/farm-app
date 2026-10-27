import { Link } from 'react-router-dom'
import { Section } from '../../components/ui'
import { addDays, todayIso } from '../../lib/calc/dates'
import { daysUntil } from '../../lib/calc/livestock'
import { formatDateShort } from '../../lib/format'
import { useI18n, type DictKey } from '../../lib/i18n'
import { useGroupTasks } from '../../lib/livestock'
import { useBreedingPlans, useGroups, useShearingPlans } from '../../lib/queries'

export interface CalItem {
  key: string
  kind: 'joining' | 'lambing' | 'calving' | 'shearing' | 'task'
  start: string
  end: string | null
  title: string
  groupId: string | null
}

/** Joining, lambing / calving windows, shearing and animal reminders from today to a year ahead. */
export function useLivestockCalendar(): CalItem[] {
  const breeding = useBreedingPlans()
  const shearing = useShearingPlans()
  const tasks = useGroupTasks()
  const groups = useGroups()
  const today = todayIso()
  const horizon = addDays(today, 366)
  const groupName = new Map((groups.data ?? []).map((g) => [g.id, g.name]))

  const items: CalItem[] = []
  for (const b of breeding.data ?? []) {
    const name = b.group?.name ?? ''
    items.push({ key: `${b.id}-j`, kind: 'joining', start: b.joining_start_date, end: b.joining_end_date, title: name, groupId: b.group_id })
    if (b.expected_birth_start) {
      items.push({ key: `${b.id}-b`, kind: b.group?.species === 'cattle' ? 'calving' : 'lambing', start: b.expected_birth_start, end: b.expected_birth_end, title: name, groupId: b.group_id })
    }
  }
  for (const s of shearing.data ?? []) {
    items.push({ key: s.id, kind: 'shearing', start: s.planned_date, end: null, title: s.group?.name ?? '', groupId: s.group_id })
  }
  for (const task of tasks.data ?? []) {
    if (task.due_date) items.push({ key: task.id, kind: 'task', start: task.due_date, end: null, title: `${task.title}${task.group_id && groupName.get(task.group_id) ? ` · ${groupName.get(task.group_id)}` : ''}`, groupId: task.group_id })
  }
  return items
    .filter((i) => (i.end ?? i.start) >= today && i.start <= horizon)
    .sort((a, b) => a.start.localeCompare(b.start))
}

/** "in 12 days" / "now" / "today" for a window or a single date. */
export function countdown(t: (k: DictKey, v?: Record<string, string | number>) => string, today: string, start: string, end: string | null) {
  const n = daysUntil(today, start)
  if (n === 1) return t('tomorrow').toLowerCase()
  if (n > 0) return t('inDays', { n })
  if (n === 0) return t('isToday')
  return end && end >= today ? t('nowRunning') : t('daysAgo', { n: -n })
}

export function LivestockCalendar() {
  const { t, lang } = useI18n()
  const items = useLivestockCalendar()
  const today = todayIso()
  const monthFmt = new Intl.DateTimeFormat(lang === 'af' ? 'af-ZA' : 'en-ZA', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const byMonth = new Map<string, CalItem[]>()
  for (const i of items) {
    const m = (i.start < today ? today : i.start).slice(0, 7)
    byMonth.set(m, [...(byMonth.get(m) ?? []), i])
  }

  return (
    <Section title={t('calendarTitle')}>
      {items.length === 0 ? <p className="muted">{t('nothingPlanned')}</p> : (
        <div className="calendar">
          {[...byMonth.entries()].map(([month, list]) => (
            <div key={month} className="cal-month">
              <h3 className="cal-month-name">{monthFmt.format(new Date(`${month}-15T12:00:00Z`))}</h3>
              <ul className="list">
                {list.map((i) => (
                  <li key={i.key}>
                    <Link className="row link-row" to={i.groupId ? `/livestock/group/${i.groupId}` : '/livestock'}>
                      <span className={`cal-dot cal-${i.kind}`} aria-hidden="true" />
                      <div className="grow">
                        <div><strong>{t(`cal_${i.kind}` as DictKey)}</strong> · {i.title}</div>
                        <div className="small muted">{formatDateShort(i.start, lang)}{i.end && i.end !== i.start ? ` – ${formatDateShort(i.end, lang)}` : ''}</div>
                      </div>
                      <span className="small countdown">{countdown(t, today, i.start, i.end)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}
