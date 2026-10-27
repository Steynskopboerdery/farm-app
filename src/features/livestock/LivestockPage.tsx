import { Link } from 'react-router-dom'
import { AnimalIcon } from '../../components/AnimalIcon'
import { ErrorText, Loading, Section } from '../../components/ui'
import { useFarm } from '../../farm/FarmProvider'
import { formatDateShort, formatNumber } from '../../lib/format'
import { useI18n, type DictKey } from '../../lib/i18n'
import { SPECIES, useRecentAnimalEvents } from '../../lib/livestock'
import { useCamps, useGroups } from '../../lib/queries'
import { LivestockCalendar } from './LivestockCalendar'

export function LivestockPage() {
  const { t, w, lang } = useI18n()
  const { isOwner } = useFarm()
  const groups = useGroups()
  const camps = useCamps()
  const losses = useRecentAnimalEvents(['sale', 'death'])
  const campName = new Map((camps.data ?? []).map((c) => [c.id, c.name]))
  const groupName = new Map((groups.data ?? []).map((g) => [g.id, g.name]))

  if (groups.isLoading) return <Loading />
  const list = groups.data ?? []

  return (
    <div className="page stack">
      <div className="card-head">
        <h1>{t('livestockTitle')}</h1>
        {isOwner && <Link className="btn small primary" to="/livestock/new">+ {t('addGroup')}</Link>}
      </div>
      <ErrorText error={groups.error} />

      <div className="stats">
        {SPECIES.map((sp) => {
          const of = list.filter((g) => g.species === sp)
          const total = of.reduce((s, g) => s + g.quantity, 0)
          const byClass = new Map<string, number>()
          for (const g of of) byClass.set(g.class, (byClass.get(g.class) ?? 0) + g.quantity)
          return (
            <div key={sp} className="stat">
              <AnimalIcon species={sp} size={42} />
              <span className="stat-n">{formatNumber(total, 0, lang)}</span>
              <span className="stat-l">{w(sp)}</span>
              <span className="tiny muted">{[...byClass.entries()].map(([c, n]) => `${formatNumber(n, 0, lang)} ${w(c).toLowerCase()}`).join(' · ')}</span>
            </div>
          )
        })}
      </div>

      {list.length === 0 ? <p className="notice">{t('noGroups')}</p> : (
        <div className="group-grid">
          {list.map((g) => (
            <Link key={g.id} to={`/livestock/group/${g.id}`} className="group-card">
              <AnimalIcon species={g.species} size={48} />
              <div className="grow">
                <div className="group-name">{g.name} {g.is_sample && <span className="badge sample">{t('sample')}</span>}</div>
                <div className="small muted">{[g.breed, w(g.class)].filter(Boolean).join(' · ')}</div>
                <div className="small">{g.camp_id ? `📍 ${campName.get(g.camp_id) ?? ''}` : t('noCamp')}</div>
              </div>
              <div className="group-count"><strong>{formatNumber(g.quantity, 0, lang)}</strong><span className="tiny muted">{t('head')}</span></div>
            </Link>
          ))}
        </div>
      )}

      <LivestockCalendar />

      <Section title={t('salesLosses')}>
        {(losses.data ?? []).length === 0 ? <p className="muted">{t('noEvents')}</p> : (
          <ul className="list">
            {losses.data!.map((e) => (
              <li key={e.id}>
                <Link className="row link-row" to={e.group_id ? `/livestock/group/${e.group_id}` : '/livestock'}>
                  <span className={`ev-dot ev-${e.type}`} aria-hidden="true" />
                  <div className="grow">
                    <div><strong>{t(`ev_${e.type}` as DictKey)}</strong>{e.quantity != null ? ` · ${e.quantity}` : ''} · {e.group_id ? groupName.get(e.group_id) : ''}</div>
                    <div className="small muted">{formatDateShort(e.date, lang)}{e.notes ? ` · ${e.notes}` : ''}</div>
                  </div>
                  <span className="chev">›</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}
