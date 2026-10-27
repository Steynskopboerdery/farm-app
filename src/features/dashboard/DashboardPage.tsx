import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ErrorText, Loading, Section } from '../../components/ui'
import { useFarm } from '../../farm/FarmProvider'
import { cropColour } from '../../lib/crops'
import { addDays, todayIso } from '../../lib/calc/dates'
import { safeHarvestDate } from '../../lib/calc/withholding'
import { useRecentSprays } from '../../lib/fieldRecords'
import { formatDateShort, formatHa, formatNumber } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { useBreedingPlans, useCamps, useCurrentPlantings, useFields, useGroups, useOpenTasks, useShearingPlans } from '../../lib/queries'
import { supabase } from '../../lib/supabase'

export function DashboardPage() {
  const { t, w, lang } = useI18n()
  const { farm } = useFarm()
  const fields = useFields()
  const camps = useCamps()
  const plantings = useCurrentPlantings()
  const groups = useGroups()
  const tasks = useOpenTasks()
  const breeding = useBreedingPlans()
  const shearing = useShearingPlans()
  const sprays = useRecentSprays()
  const qc = useQueryClient()
  const today = todayIso()

  const done = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').update({ status: 'done', done_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })

  if (fields.isLoading) return <Loading />

  const cropHa = (fields.data ?? []).reduce((s, f) => s + (f.hectares ?? 0), 0)
  const campHa = (camps.data ?? []).reduce((s, c) => s + (c.hectares ?? 0), 0)
  const sheep = (groups.data ?? []).filter((g) => g.species === 'sheep').reduce((s, g) => s + g.quantity, 0)
  const cattle = (groups.data ?? []).filter((g) => g.species === 'cattle').reduce((s, g) => s + g.quantity, 0)
  const hasSample = (fields.data ?? []).some((f) => f.is_sample) || (groups.data ?? []).some((g) => g.is_sample)

  // Hectares per crop this season.
  const cropTotals = new Map<string, number>()
  for (const f of fields.data ?? []) {
    const p = plantings.data?.get(f.id)
    if (p) cropTotals.set(p.crop, (cropTotals.get(p.crop) ?? 0) + (f.hectares ?? 0))
  }

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

  const upcoming = [
    ...(breeding.data ?? []).filter((b) => b.expected_birth_end && b.expected_birth_end >= today).map((b) => ({
      key: b.id,
      label: `${b.group?.species === 'cattle' ? t('calving') : t('lambing')}: ${b.group?.name ?? ''}`,
      from: b.expected_birth_start,
      to: b.expected_birth_end,
    })),
    ...(shearing.data ?? []).map((s) => ({ key: s.id, label: `${t('shearing')}: ${s.group?.name ?? ''}`, from: s.planned_date, to: null as string | null })),
  ].sort((a, b) => (a.from ?? '').localeCompare(b.from ?? ''))

  return (
    <div className="page stack">
      <h1>{t('dashTitle')} <span className="muted small">{formatDateShort(today, lang)}</span></h1>
      {hasSample && <p className="notice">{t('sampleBanner')}</p>}
      <ErrorText error={fields.error} />

      <div className="stats">
        <Link to="/land" className="stat"><span className="stat-n">{formatHa(cropHa, lang)}</span><span>{t('cropland')} · {fields.data?.length ?? 0} {t('fieldsCount').toLowerCase()}</span></Link>
        <Link to="/land?tab=camps" className="stat"><span className="stat-n">{formatHa(campHa, lang)}</span><span>{t('grazing')} · {camps.data?.length ?? 0}</span></Link>
        <div className="stat"><span className="stat-n">{formatNumber(sheep, 0, lang)}</span><span>{t('sheep')}</span></div>
        <div className="stat"><span className="stat-n">{formatNumber(cattle, 0, lang)}</span><span>{t('cattle')}</span></div>
      </div>

      {(fields.data?.length ?? 0) === 0 && <p className="notice">{t('noFieldsYet')}</p>}

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

      {harvestsSoon.length > 0 && (
        <Section title={t('dashHarvestsSoon')}>
          <ul className="list">
            {harvestsSoon.map(({ field, p }) => (
              <li key={field.id}>
                <Link className="row link-row" to={`/land/field/${field.id}`}>
                  <span className="swatch" style={{ background: cropColour(p!.crop) }} />
                  <div className="grow">{field.name} · {w(p!.crop)}</div>
                  <div className="small right">{formatDateShort(p!.expected_harvest_date, lang)}</div>
                  <span className="chev">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title={t('upcoming')}>
        {upcoming.length === 0 ? <p className="muted">{t('nothingPlanned')}</p> : (
          <ul className="list">
            {upcoming.map((u) => (
              <li key={u.key} className="row">
                <div className="grow">{u.label}</div>
                <div className="small right">{formatDateShort(u.from, lang)}{u.to && u.to !== u.from ? ` – ${formatDateShort(u.to, lang)}` : ''}</div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t('cropOverview')}>
        {cropTotals.size === 0 ? <p className="muted">{t('nothingPlanned')}</p> : (
          <ul className="list">
            {[...cropTotals.entries()].map(([crop, ha]) => (
              <li key={crop} className="row">
                <span className="swatch" style={{ background: cropColour(crop) }} />
                <div className="grow">{w(crop)}</div>
                <div>{formatHa(ha, lang)}</div>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <p className="muted small center">{farm?.location_text}</p>
    </div>
  )
}
