import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useFarm } from '../../farm/FarmProvider'
import { useBudgets } from '../../lib/budget'
import { todayIso } from '../../lib/calc/dates'
import { useRain } from '../../lib/farmRecords'
import { useI18n, type DictKey } from '../../lib/i18n'
import { usePlanningEstimates } from '../../lib/inventory'
import { useFields, useGroups, useInvites, useMembers } from '../../lib/queries'

const hideKey = (farmId: string) => `farm.gettingStarted.hide.${farmId}`

/** For a new farm: the first things to set up, ticked off as they are done. Owners only; can be put away. */
export function GettingStarted() {
  const { t } = useI18n()
  const { farm, isOwner } = useFarm()
  const fields = useFields()
  const groups = useGroups()
  const rain = useRain()
  const estimates = usePlanningEstimates()
  const budgets = useBudgets(isOwner)
  const members = useMembers()
  const invites = useInvites(isOwner)
  const [hidden, setHidden] = useState(() => { try { return !!farm && localStorage.getItem(hideKey(farm.id)) === '1' } catch { return false } })
  if (!isOwner || !farm || hidden || fields.isLoading || groups.isLoading) return null

  const year = Number(todayIso().slice(0, 4))
  const pushOn = typeof Notification !== 'undefined' && Notification.permission === 'granted'
  const steps: { key: DictKey; to: string; done: boolean }[] = [
    { key: 'gs_location', to: '/settings', done: farm.map_center_lat != null },
    { key: 'gs_fields', to: '/map', done: (fields.data ?? []).length > 0 },
    { key: 'gs_animals', to: '/livestock/new', done: (groups.data ?? []).length > 0 },
    { key: 'gs_figures', to: '/reports', done: (estimates.data ?? []).some((e) => e.yield_t_per_ha != null || e.price_per_t != null || e.cost_per_head_per_year != null) },
    { key: 'gs_budget', to: `/budget?year=${year}`, done: (budgets.data?.lines ?? []).some((l) => l.year === year) },
    { key: 'gs_rain', to: '/rain', done: (rain.data ?? []).length > 0 },
    { key: 'gs_push', to: '/settings', done: pushOn },
    { key: 'gs_team', to: '/settings', done: (members.data ?? []).length > 1 || (invites.data ?? []).length > 0 },
  ]
  const done = steps.filter((s) => s.done).length
  if (done === steps.length) return null
  const hide = () => { try { localStorage.setItem(hideKey(farm.id), '1') } catch { /* private mode */ } setHidden(true) }

  return (
    <section className="card stack getting-started">
      <div className="card-head"><h2>🚀 {t('gs_title')}</h2><span className="small muted">{t('gs_progress', { done, total: steps.length })}</span></div>
      <div className="track"><div style={{ width: `${(done / steps.length) * 100}%` }} /></div>
      <ul className="list">
        {steps.map((s) => (
          <li key={s.key}>
            <Link to={s.to} className={`row link-row ${s.done ? 'gs-done' : ''}`}>
              <span className="gs-tick" aria-hidden>{s.done ? '✓' : ''}</span>
              <span className="grow">{t(s.key)}</span>
              {!s.done && <span className="chev">›</span>}
            </Link>
          </li>
        ))}
      </ul>
      <p className="small muted">{t('gs_sample')} <Link to="/settings">{t('gs_sampleLink')}</Link></p>
      <button className="btn small ghost" onClick={hide}>{t('gs_hide')}</button>
    </section>
  )
}
