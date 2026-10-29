import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ErrorText, Loading, Section } from '../../components/ui'
import { useFarm } from '../../farm/FarmProvider'
import type { Boundary } from '../../lib/calc/area'
import { addDays, todayIso } from '../../lib/calc/dates'
import { safeHarvestDate } from '../../lib/calc/withholding'
import { cropColour } from '../../lib/crops'
import { useRecentSprays } from '../../lib/fieldRecords'
import { formatDate, formatDateShort, formatHa, formatNumber } from '../../lib/format'
import { centreOf, satelliteTileUrl } from '../../lib/geo'
import { useI18n, type DictKey } from '../../lib/i18n'
import { useCamps, useCurrentPlantings, useFields, useGroups, useOpenTasks } from '../../lib/queries'
import { countdown, useLivestockCalendar } from '../livestock/LivestockCalendar'
import { updateRow } from '../../lib/outbox'
import { WeatherCard, WeatherNow } from '../weather/WeatherCard'
import { FarmAlerts } from './FarmAlerts'
import { HeroPhoto } from './HeroPhoto'
import { debtorsByCustomer } from '../../lib/calc/debtors'
import { useInvoices } from '../../lib/sales'
import { formatZar } from '../../lib/format'
import { CropIcon } from '../../components/CropIcon'

function greeting(hour: number) {
  return hour < 12 ? 'greetMorning' : hour < 18 ? 'greetAfternoon' : 'greetEvening'
}

const STAT_ICONS = {
  crop: 'M4 20c3-6 13-6 16 0M6 15c3-4 9-4 12 0M8 10c2-2.5 6-2.5 8 0M12 4v4',
  camp: 'M3 20h18M5 20l4-9 3 5 3-7 4 11',
  sheep: 'M7 14a5 4 0 0 0 10 0 5 4 0 0 0-10 0zM5 12a2 2 0 1 1 0-4M9 18v2M15 18v2',
  cattle: 'M6 10l-3-3M18 10l3-3M7 9h10v6a5 5 0 0 1-10 0zM10 14h.01M14 14h.01',
}

function StatIcon({ d }: { d: string }) {
  return <span className="stat-icon"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg></span>
}

export function DashboardPage() {
  const { t, w, lang } = useI18n()
  const { farm, isOwner } = useFarm()
  const fields = useFields()
  const camps = useCamps()
  const plantings = useCurrentPlantings()
  const groups = useGroups()
  const tasks = useOpenTasks()
  const calendar = useLivestockCalendar()
  const sprays = useRecentSprays()
  const qc = useQueryClient()
  const today = todayIso()

  const done = useMutation({
    networkMode: 'always',  // kept on the phone without signal (see outbox)
    mutationFn: (id: string) => updateRow('tasks', id, { status: 'done', done_at: new Date().toISOString() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })

  if (fields.isLoading) return <Loading />

  const cropHa = (fields.data ?? []).reduce((s, f) => s + (f.hectares ?? 0), 0)
  const campHa = (camps.data ?? []).reduce((s, c) => s + (c.hectares ?? 0), 0)
  const sheep = (groups.data ?? []).filter((g) => g.species === 'sheep').reduce((s, g) => s + g.quantity, 0)
  const cattle = (groups.data ?? []).filter((g) => g.species === 'cattle').reduce((s, g) => s + g.quantity, 0)
  const hasSample = (fields.data ?? []).some((f) => f.is_sample) || (groups.data ?? []).some((g) => g.is_sample)

  const cropTotals = new Map<string, number>()
  for (const f of fields.data ?? []) {
    const p = plantings.data?.get(f.id)
    if (p) cropTotals.set(p.crop, (cropTotals.get(p.crop) ?? 0) + (f.hectares ?? 0))
  }
  const plantedHa = [...cropTotals.values()].reduce((a, b) => a + b, 0)

  // Sprays whose withholding period hasn't ended, worst first (harvest planned too early).
  const fieldName = new Map((fields.data ?? []).map((f) => [f.id, f.name]))
  const withholding = (sprays.data ?? [])
    .map((o) => {
      const safe = safeHarvestDate({ product: o.product, date: o.date, withholdingPeriodDays: o.withholding_period_days })
      const p = plantings.data?.get(o.field_id)
      const expected = p && p.season_id === o.season_id ? p.expected_harvest_date : null
      return { id: o.id, fieldId: o.field_id, product: o.product, safe, expected, tooEarly: !!expected && expected < safe }
    })
    .filter((x) => x.safe > today && fieldName.has(x.fieldId))
    .sort((a, b) => Number(b.tooEarly) - Number(a.tooEarly) || a.safe.localeCompare(b.safe))

  const harvestsSoon = (fields.data ?? [])
    .map((f) => ({ field: f, p: plantings.data?.get(f.id) }))
    .filter(({ p }) => p?.expected_harvest_date && p.expected_harvest_date >= addDays(today, -14) && p.expected_harvest_date <= addDays(today, 45))
    .sort((a, b) => a.p!.expected_harvest_date!.localeCompare(b.p!.expected_harvest_date!))

  const upcoming = calendar.filter((i) => i.kind !== 'task').slice(0, 5)

  return (
    <div className="page stack home">
      <HeroPhoto>
        <div className="hero-top">
          <div>
            <p className="hero-greet">{t(greeting(new Date().getHours()))}</p>
            <Link to="/farms" className="hero-farm-link" aria-label={t('switchFarm')} onPointerDown={(e) => e.stopPropagation()}>
              <h1 className="hero-farm">{farm?.name} <span className="switch-caret">▾</span></h1>
            </Link>
            <p className="muted-light">{formatDate(today, lang)}</p>
          </div>
          <WeatherNow />
        </div>
      </HeroPhoto>

      {hasSample && <p className="notice">{t('sampleBanner')}</p>}
      <ErrorText error={fields.error} />

      <div className="stats">
        <Link to="/land" className="stat"><StatIcon d={STAT_ICONS.crop} /><span className="stat-n">{formatHa(cropHa, lang)}</span><span className="stat-l">{t('cropland')} · {fields.data?.length ?? 0}</span></Link>
        <Link to="/land?tab=camps" className="stat"><StatIcon d={STAT_ICONS.camp} /><span className="stat-n">{formatHa(campHa, lang)}</span><span className="stat-l">{t('grazing')} · {camps.data?.length ?? 0}</span></Link>
        <Link to="/livestock" className="stat"><StatIcon d={STAT_ICONS.sheep} /><span className="stat-n">{formatNumber(sheep, 0, lang)}</span><span className="stat-l">{t('sheep')}</span></Link>
        <Link to="/livestock" className="stat"><StatIcon d={STAT_ICONS.cattle} /><span className="stat-n">{formatNumber(cattle, 0, lang)}</span><span className="stat-l">{t('cattle')}</span></Link>
      </div>

      {withholding.length > 0 && (
        <Section title={`⚠ ${t('dashWithholding')}`}>
          <ul className="list">
            {withholding.map((x) => (
              <li key={x.id}>
                <Link className="row link-row" to={`/land/field/${x.fieldId}`}>
                  <div className="grow">
                    <div><strong>{fieldName.get(x.fieldId)}</strong></div>
                    <div className="small">{t('whpActive', { product: x.product ?? '–', safe: formatDateShort(x.safe, lang) })}</div>
                    {x.tooEarly && <div className="small warn-text">{t('tooEarly', { date: formatDateShort(x.expected, lang) })}</div>}
                  </div>
                  <span className="chev">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <FarmAlerts />

      {isOwner && <UnpaidInvoicesCard />}

      <WeatherCard />

      {(fields.data?.length ?? 0) === 0 ? <p className="notice">{t('noFieldsYet')}</p> : (
        <section className="stack-tight">
          <div className="card-head section-head">
            <h2>{t('myFields')}</h2>
            <Link to="/land" className="link-more">{t('seeAll')} ›</Link>
          </div>
          <div className="field-cards">
            {fields.data!.map((f) => {
              const p = plantings.data?.get(f.id)
              const centre = centreOf([f.boundary_geojson as unknown as Boundary | null])
              const colour = cropColour(p?.crop)
              return (
                <Link key={f.id} to={`/land/field/${f.id}`} className="field-card"
                  style={centre
                    ? { backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(5,30,15,.85)), url(${satelliteTileUrl(centre[0], centre[1])})` }
                    : { backgroundImage: `linear-gradient(160deg, ${colour}cc, #1d5b33 75%)` }}>
                  <span className="field-card-ha">{formatHa(f.hectares, lang)}</span>
                  <span className="field-card-body">
                    <strong>{f.name}</strong>
                    <span className="chip-mini" style={{ background: colour }}><CropIcon crop={p?.crop} size={22} />{p ? w(p.crop) : t('noCrop')}</span>
                  </span>
                  {centre && <span className="field-card-credit">{t('imageryCredit')}</span>}
                </Link>
              )
            })}
          </div>
        </section>
      )}

      <Section title={t('tasksDue')}>
        {(tasks.data ?? []).length === 0 ? <p className="muted">{t('noTasks')}</p> : (
          <ul className="list">
            {tasks.data!.map((task) => (
              <li key={task.id} className="row">
                <div className="grow">
                  <div>{task.title}</div>
                  <div className={`small ${task.due_date && task.due_date < today ? 'warn-text' : 'muted'}`}>
                    {task.due_date && task.due_date < today ? `${t('overdue')} · ` : ''}{formatDateShort(task.due_date, lang)}
                  </div>
                </div>
                <button className="btn small" disabled={done.isPending} onClick={() => done.mutate(task.id)}>✓ {t('markDone')}</button>
              </li>
            ))}
          </ul>
        )}
        <ErrorText error={done.error} />
      </Section>

      {harvestsSoon.length > 0 && (
        <Section title={t('dashHarvestsSoon')}>
          <ul className="list">
            {harvestsSoon.map(({ field, p }) => (
              <li key={field.id}>
                <Link className="row link-row" to={`/land/field/${field.id}`}>
                  <CropIcon crop={p!.crop} size={34} />
                  <div className="grow">{field.name} · {w(p!.crop)}</div>
                  <div className="small right">{formatDateShort(p!.expected_harvest_date, lang)}</div>
                  <span className="chev">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title={t('upcoming')} action={<Link to="/livestock" className="link-more">{t('seeAll')} ›</Link>}>
        {upcoming.length === 0 ? <p className="muted">{t('nothingPlanned')}</p> : (
          <ul className="list">
            {upcoming.map((u) => (
              <li key={u.key}>
                <Link className="row link-row" to={u.groupId ? `/livestock/group/${u.groupId}` : '/livestock'}>
                  <span className={`cal-dot cal-${u.kind}`} aria-hidden="true" />
                  <div className="grow">
                    <div><strong>{t(`cal_${u.kind}` as DictKey)}</strong> · {u.title}</div>
                    <div className="small muted">{formatDateShort(u.start, lang)}{u.end && u.end !== u.start ? ` – ${formatDateShort(u.end, lang)}` : ''}</div>
                  </div>
                  <span className="small countdown">{countdown(t, today, u.start, u.end)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t('cropOverview')}>
        {cropTotals.size === 0 ? <p className="muted">{t('nothingPlanned')}</p> : (
          <>
            <div className="crop-bar" aria-hidden="true">
              {[...cropTotals.entries()].map(([crop, ha]) => (
                <span key={crop} style={{ flex: ha, background: cropColour(crop) }} />
              ))}
            </div>
            <ul className="list">
              {[...cropTotals.entries()].map(([crop, ha]) => (
                <li key={crop} className="row">
                  <CropIcon crop={crop} size={34} />
                  <div className="grow">{w(crop)}</div>
                  <div className="small muted">{plantedHa ? `${Math.round((ha / plantedHa) * 100)}%` : ''}</div>
                  <div><strong>{formatHa(ha, lang)}</strong></div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>
    </div>
  )
}

function UnpaidInvoicesCard() {
  const { t, lang } = useI18n()
  const invoices = useInvoices()
  const today = todayIso()
  const debtors = debtorsByCustomer(invoices.data ?? [], today)
  const owed = debtors.reduce((s, d) => s + d.owed, 0)
  const overdue = debtors.reduce((s, d) => s + d.overdue, 0)
  const count = debtors.reduce((s, d) => s + d.invoices, 0)
  const drafts = (invoices.data ?? []).filter((i) => i.status === 'draft').length
  if (!invoices.data || (count === 0 && drafts === 0)) return null
  return (
    <Link to="/sales?tab=debtors" className="card money-card">
      <div className="card-head"><h2>🧾 {t('unpaidInvoices')}</h2><span className="link-more">{t('seeAll')} ›</span></div>
      <div className="money-row">
        <div><div className="stat-n">{formatZar(owed, lang)}</div><div className="stat-l">{t('invoicesCount', { n: count })}</div></div>
        {overdue > 0 && <div className="right"><div className="stat-n warn-text">{formatZar(overdue, lang)}</div><div className="stat-l">{t('overdueTotal')}</div></div>}
      </div>
      {drafts > 0 && <div className="small muted">{drafts} × {t('status_draft').toLowerCase()}</div>}
    </Link>
  )
}
