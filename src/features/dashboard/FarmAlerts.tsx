import { Link } from 'react-router-dom'
import { addDays, todayIso } from '../../lib/calc/dates'
import { latestCounts } from '../../lib/calc/headcount'
import { rainBetween } from '../../lib/calc/rain'
import { useHeadCounts, usePins, useRain, useVehicles } from '../../lib/farmRecords'
import { formatNumber } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { useGroups } from '../../lib/queries'
import { vehicleSummary } from '../vehicles/VehiclesPage'
import { useLeave, useUnread } from '../../lib/team'
import { useFarm } from '../../farm/FarmProvider'

/** Home screen: rain so far, animals missing at the last count, services due, open map pins. */
export function FarmAlerts() {
  const { t, lang } = useI18n()
  const rain = useRain()
  const counts = useHeadCounts()
  const groups = useGroups()
  const vehicles = useVehicles()
  const pins = usePins()
  const today = todayIso()
  const groupName = new Map((groups.data ?? []).map((g) => [g.id, g.name]))
  const missing = latestCounts(counts.data ?? []).filter((c) => c.missing > 0 && groupName.has(c.group_id))
  const due = (vehicles.data?.vehicles ?? []).map((v) => ({ v, s: vehicleSummary(v, vehicles.data?.logs ?? []).service })).filter((x) => x.s?.due || x.s?.soon)
  const openPins = pins.data?.length ?? 0
  const readings = rain.data ?? []
  const unread = useUnread()
  const { isOwner } = useFarm()
  const leave = useLeave()
  const pendingLeave = isOwner ? (leave.data ?? []).filter((l) => l.status === 'pending').length : 0

  return (
    <>
      {unread.total > 0 && (
        <Link to="/chat" className="card alert-link unread-card">
          <span className="kind-emoji" aria-hidden="true">💬</span>
          <div className="grow"><strong>{t('chatUnread', { n: unread.total })}</strong></div>
          <span className="chev">›</span>
        </Link>
      )}
      {pendingLeave > 0 && (
        <Link to="/team?tab=leave" className="card alert-link">
          <span className="kind-emoji" aria-hidden="true">🏖️</span>
          <div className="grow"><strong>{t('leavePendingN', { n: pendingLeave })}</strong></div>
          <span className="chev">›</span>
        </Link>
      )}
      {readings.length > 0 && (
        <Link to="/rain" className="card alert-link">
          <span className="kind-emoji" aria-hidden="true">🌧️</span>
          <div className="grow">
            <strong>{formatNumber(rainBetween(readings, `${today.slice(0, 4)}-01-01`, today), 0, lang)} mm</strong> <span className="small muted">{t('rainThisYear')}</span>
            <div className="small muted">{t('rainLast7')}: {formatNumber(rainBetween(readings, addDays(today, -6), today), 1, lang)} mm</div>
          </div>
          <span className="chev">›</span>
        </Link>
      )}
      {missing.length > 0 && (
        <div className="warning">
          <strong>⚠ {t('hcDashTitle')}</strong>
          {missing.map((c) => <p key={c.group_id}><Link to={`/livestock/group/${c.group_id}`}>{groupName.get(c.group_id)}</Link>: {t('hcMissing', { n: c.missing })}</p>)}
        </div>
      )}
      {due.length > 0 && (
        <div className="warning">
          <strong>🔧 {t('serviceTitle')}</strong>
          {due.map(({ v, s }) => <p key={v.id}><Link to={`/vehicles/${v.id}`}>{v.name}</Link>: {s!.due ? t('serviceDue') : t('serviceSoon')}</p>)}
        </div>
      )}
      {openPins > 0 && (
        <Link to="/pins" className="card alert-link">
          <span className="kind-emoji" aria-hidden="true">📍</span>
          <div className="grow"><strong>{t('pinsOpen', { n: openPins })}</strong></div>
          <span className="chev">›</span>
        </Link>
      )}
    </>
  )
}
