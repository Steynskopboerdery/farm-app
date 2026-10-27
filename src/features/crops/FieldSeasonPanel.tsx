import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { ErrorText, Section } from '../../components/ui'
import { useFarm, useFarmId } from '../../farm/FarmProvider'
import { todayIso } from '../../lib/calc/dates'
import { seasonSummary } from '../../lib/calc/season'
import { rotationAdvice, suggestedNextCrops } from '../../lib/calc/advice'
import { safeHarvestDate, withholdingConflicts } from '../../lib/calc/withholding'
import { CropIcon } from '../../components/CropIcon'
import { defaultSeasonId, useFieldRecords, useFieldTasks, type Operation } from '../../lib/fieldRecords'
import { formatDateShort, formatHa, formatNumber, formatZar } from '../../lib/format'
import { useI18n, type DictKey } from '../../lib/i18n'
import { useSeasons } from '../../lib/queries'
import { supabase } from '../../lib/supabase'
import type { RecordType } from './RecordFormPage'

/** Crop records for one field: season picker, records by kind, totals, warnings, reminders and history. */
export function FieldSeasonPanel({ fieldId, fieldName, hectares }: { fieldId: string; fieldName: string; hectares: number | null }) {
  const { t, w, lang } = useI18n()
  const { isOwner, can } = useFarm()
  const canField = can('field_records')
  const [params, setParams] = useSearchParams()
  const seasons = useSeasons()
  const records = useFieldRecords(fieldId)
  const seasonId = params.get('season') || defaultSeasonId(seasons.data)
  const season = seasons.data?.find((s) => s.id === seasonId)

  const inSeason = <T extends { season_id: string | null }>(list: T[] | undefined) => (list ?? []).filter((r) => r.season_id === seasonId)
  const plantings = inSeason(records.data?.plantings)
  const ops = inSeason(records.data?.operations)
  const harvests = inSeason(records.data?.harvests)
  const summary = seasonSummary({ fieldHectares: hectares, plantings, operations: ops, harvests })

  const planting = plantings[plantings.length - 1]
  const sprays = ops.filter((o) => o.type === 'spray')
  const sprayRecs = sprays.map((o) => ({ product: o.product, date: o.date, withholdingPeriodDays: o.withholding_period_days }))
  const conflicts = planting?.expected_harvest_date && harvests.length === 0
    ? withholdingConflicts(sprayRecs, planting.expected_harvest_date) : []

  const addLink = (type: RecordType) => `/land/field/${fieldId}/record/${type}${seasonId ? `?season=${seasonId}` : ''}`
  const editLink = (type: RecordType, id: string) => `/land/field/${fieldId}/record/${type}/${id}`
  const AddButton = ({ type, label }: { type: RecordType; label: DictKey }) =>
    canField ? <Link className="btn small" to={addLink(type)} aria-label={t(label)}>+ {t('add')}</Link> : null

  const opRows = (list: Operation[], type: RecordType) => list.length === 0 ? <p className="muted">{t('noRecords')}</p> : (
    <ul className="list">
      {list.map((o) => (
        <li key={o.id}>
          <Link className="row link-row" to={editLink(type, o.id)}>
            <div className="grow">
              <div><strong>{o.product ?? '–'}</strong></div>
              <div className="small muted">
                {formatDateShort(o.date, lang)}
                {o.rate != null && ` · ${formatNumber(o.rate, 3, lang)} ${o.rate_unit ?? ''}`}
                {o.total_amount != null && ` · ${formatNumber(o.total_amount, 1, lang)} ${o.unit ?? ''}`}
              </div>
              {type === 'spray' && o.withholding_period_days ? (
                <div className="small">{t('safeFrom')}: <strong>{formatDateShort(safeHarvestDate({ product: o.product, date: o.date, withholdingPeriodDays: o.withholding_period_days }), lang)}</strong></div>
              ) : null}
            </div>
            {isOwner && <div className="right small">{formatZar(o.cost, lang)}</div>}
            <span className="chev">›</span>
          </Link>
        </li>
      ))}
    </ul>
  )

  return (
    <>
      <div className="chips" role="tablist" aria-label={t('season')}>
        {(seasons.data ?? []).map((s) => (
          <button key={s.id} role="tab" aria-selected={s.id === seasonId} className={`chip ${s.id === seasonId ? 'on' : ''}`}
            onClick={() => setParams({ season: s.id }, { replace: true })}>{s.year}</button>
        ))}
      </div>
      {!seasons.data?.length && <p className="muted">{t('noSeason')}</p>}
      {season?.notes && <p className="season-note">📝 {season.notes}</p>}
      {!canField && <p className="muted small">{t('viewOnly')}</p>}

      {conflicts.length > 0 && (
        <div className="warning">
          <strong>⚠ {t('whpTitle')}</strong>
          {conflicts.map((c, i) => (
            <p key={i}>{t('whpConflict', { product: c.product ?? '–', date: formatDateShort(c.date, lang), safe: formatDateShort(c.safeFrom, lang) })}</p>
          ))}
          <p>{t('tooEarly', { date: formatDateShort(planting!.expected_harvest_date, lang) })}</p>
        </div>
      )}

      <Section title={t('plantingTitle')} action={!planting ? <AddButton type="planting" label="addPlanting" /> : undefined}>
        {planting ? (
          <Link className="row link-row" to={editLink('planting', planting.id)}>
            <CropIcon crop={planting.crop} size={46} />
            <div className="grow">
              <div><strong>{w(planting.crop)}</strong>{planting.cultivar ? ` · ${planting.cultivar}` : ''}</div>
              <div className="small muted">
                {t('plantedOn')} {formatDateShort(planting.planting_date, lang)} · {t('expectedHarvest')} {formatDateShort(planting.expected_harvest_date, lang)}
              </div>
              <div className="small muted">
                {planting.seed_kg != null && `${formatNumber(planting.seed_kg, 0, lang)} kg`}
                {planting.seed_kg != null && hectares ? ` (${formatNumber(planting.seed_kg / hectares, 1, lang)} kg/ha)` : ''}
                {isOwner && planting.seed_cost != null && ` · ${formatZar(planting.seed_cost, lang)}`}
              </div>
            </div>
            <span className="chev">›</span>
          </Link>
        ) : <p className="muted">{t('noRecords')}</p>}
      </Section>

      <Section title={t('fertiliser')} action={<AddButton type="fertiliser" label="addFertiliser" />}>
        {opRows(ops.filter((o) => o.type === 'fertiliser'), 'fertiliser')}
      </Section>

      <Section title={t('sprays')} action={<AddButton type="spray" label="addSpray" />}>
        {opRows(sprays, 'spray')}
      </Section>

      <Section title={t('otherWork')} action={<AddButton type="other" label="addOther" />}>
        {opRows(ops.filter((o) => o.type === 'other'), 'other')}
      </Section>

      <Section title={t('harvestTitle')} action={<AddButton type="harvest" label="addHarvest" />}>
        {harvests.length === 0 ? <p className="muted">{t('noRecords')}</p> : (
          <ul className="list">
            {harvests.map((h) => (
              <li key={h.id}>
                <Link className="row link-row" to={editLink('harvest', h.id)}>
                  <div className="grow">
                    <div><strong>{formatNumber(h.tons, 2, lang)} t</strong>{h.yield_per_ha != null && ` · ${formatNumber(h.yield_per_ha, 2, lang)} t/ha`}</div>
                    <div className="small muted">{formatDateShort(h.date, lang)}{h.hectares_harvested != null && ` · ${formatHa(h.hectares_harvested, lang)}`}</div>
                  </div>
                  <span className="chev">›</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t('summary')}>
        <dl className="facts">
          <dt>{t('seedUsed')}</dt><dd>{formatNumber(summary.seedKg, 0, lang)} kg{isOwner ? ` · ${formatZar(summary.seedCost, lang)}` : ''}</dd>
          {summary.products.map((p) => (
            <FactRow key={`${p.product}|${p.unit}`} label={p.product} value={`${formatNumber(p.total, 1, lang)} ${p.unit}`} />
          ))}
          {/* Workers don't see money. */}
          {isOwner && (
            <>
              <dt>{t('fertiliserCost')}</dt><dd>{formatZar(summary.fertiliserCost, lang)}</dd>
              <dt>{t('sprayCost')}</dt><dd>{formatZar(summary.sprayCost, lang)} ({summary.sprayCount}×)</dd>
              <dt>{t('otherCost')}</dt><dd>{formatZar(summary.otherCost, lang)}</dd>
              <dt><strong>{t('totalCost')}</strong></dt><dd><strong>{formatZar(summary.totalCost, lang)}</strong></dd>
              <dt>{t('costPerHa')}</dt><dd>{formatZar(summary.costPerHa, lang)}</dd>
            </>
          )}
          <dt><strong>{t('tonsTotal')}</strong></dt>
          <dd><strong>{summary.tons ? `${formatNumber(summary.tons, 2, lang)} t` : '–'}</strong>{summary.yieldPerHa != null && ` · ${formatNumber(summary.yieldPerHa, 2, lang)} t/ha`}</dd>
        </dl>
      </Section>

      <RotationCard plantings={records.data?.plantings ?? []} />
      <Reminders fieldId={fieldId} fieldName={fieldName} />
      <SeasonHistory records={records.data} hectares={hectares} seasonId={seasonId} onPick={(id) => setParams({ season: id }, { replace: true })} />
      <ErrorText error={records.error} />
    </>
  )
}

function FactRow({ label, value }: { label: string; value: string }) {
  return <><dt className="indent">{label}</dt><dd>{value}</dd></>
}

function SeasonHistory({ records, hectares, seasonId, onPick }: {
  records: ReturnType<typeof useFieldRecords>['data']
  hectares: number | null
  seasonId: string | null
  onPick: (id: string) => void
}) {
  const { t, w, lang } = useI18n()
  const { isOwner } = useFarm()
  const seasons = useSeasons()
  const rows = (seasons.data ?? []).map((s) => {
    const pick = <T extends { season_id: string | null }>(l: T[] | undefined) => (l ?? []).filter((r) => r.season_id === s.id)
    return { season: s, sum: seasonSummary({ fieldHectares: hectares, plantings: pick(records?.plantings), operations: pick(records?.operations), harvests: pick(records?.harvests) }) }
  }).filter((r) => r.sum.crop || r.sum.totalCost || r.sum.tons)

  if (rows.length === 0) return null
  return (
    <Section title={t('seasonHistory')}>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>{t('year')}</th><th>{t('crop')}</th><th className="num">t/ha</th><th className="num">t</th>{isOwner && <th className="num">R/ha</th>}</tr></thead>
          <tbody>
            {rows.map(({ season, sum }) => (
              <tr key={season.id} className={season.id === seasonId ? 'on' : ''} onClick={() => onPick(season.id)}>
                <td>{season.year}</td>
                <td>{sum.crop ? w(sum.crop) : '–'}</td>
                <td className="num">{sum.yieldPerHa != null ? formatNumber(sum.yieldPerHa, 2, lang) : '–'}</td>
                <td className="num">{sum.tons ? formatNumber(sum.tons, 1, lang) : '–'}</td>
                {isOwner && <td className="num">{sum.costPerHa != null ? formatNumber(sum.costPerHa, 0, lang) : '–'}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}

const TASK_TYPES = ['spray', 'fertilise', 'plant', 'harvest', 'general'] as const

function Reminders({ fieldId, fieldName }: { fieldId: string; fieldName: string }) {
  const { t, lang } = useI18n()
  const { can } = useFarm()
  const canTasks = can('tasks')
  const farmId = useFarmId()
  const qc = useQueryClient()
  const tasks = useFieldTasks(fieldId)
  const { hash } = useLocation()
  // Coming from the quick-add button: jump straight to the reminder form.
  useEffect(() => {
    if (hash === '#reminders' && tasks.isFetched) document.getElementById('reminders')?.scrollIntoView({ behavior: 'smooth' })
  }, [hash, tasks.isFetched])
  const [type, setType] = useState<(typeof TASK_TYPES)[number]>('spray')
  const [title, setTitle] = useState('')
  const [due, setDue] = useState(todayIso())

  const add = useMutation({
    mutationFn: async () => {
      const label = title.trim() || `${t(`task_${type}` as DictKey)}: ${fieldName}`
      const { error } = await supabase.from('tasks').insert({ farm_id: farmId, field_id: fieldId, type, title: label, due_date: due || null })
      if (error) throw error
    },
    onSuccess: () => {
      setTitle('')
      qc.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  const done = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').update({ status: 'done', done_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    add.mutate()
  }

  return (
    <Section title={t('reminders')} id="reminders">
      {(tasks.data ?? []).length === 0 ? <p className="muted">{t('noTasks')}</p> : (
        <ul className="list">
          {tasks.data!.map((task) => (
            <li key={task.id} className="row">
              <div className="grow">
                <div>{task.title}</div>
                <div className={`small ${task.due_date && task.due_date < todayIso() ? 'warn-text' : 'muted'}`}>{formatDateShort(task.due_date, lang)}</div>
              </div>
              <button className="btn small" disabled={done.isPending} onClick={() => done.mutate(task.id)}>✓ {t('markDone')}</button>
            </li>
          ))}
        </ul>
      )}
      {canTasks && (
        <form className="stack subcard" onSubmit={submit}>
          <div className="grid2">
            <label>{t('taskType')}
              <select value={type} onChange={(e) => setType(e.target.value as (typeof TASK_TYPES)[number])}>
                {TASK_TYPES.map((k) => <option key={k} value={k}>{t(`task_${k}` as DictKey)}</option>)}
              </select>
            </label>
            <label>{t('dueDate')}<input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></label>
          </div>
          <label>{t('reminderWhat')}<input value={title} placeholder={`${t(`task_${type}` as DictKey)}: ${fieldName}`} onChange={(e) => setTitle(e.target.value)} /></label>
          <button className="btn">+ {t('addReminder')}</button>
          <ErrorText error={add.error ?? done.error} />
        </form>
      )}
    </Section>
  )
}

/** Rotation check from this field's crops by season. Advice only. */
function RotationCard({ plantings }: { plantings: { season_id: string; crop: string }[] }) {
  const { t, w } = useI18n()
  const seasons = useSeasons()
  const yearOf = new Map((seasons.data ?? []).map((x) => [x.id, x.year]))
  const history = plantings.filter((p) => yearOf.has(p.season_id)).map((p) => ({ year: yearOf.get(p.season_id)!, crop: p.crop }))
  if (history.length === 0) return null
  const advice = rotationAdvice(history)
  const next = suggestedNextCrops(history)
  return (
    <Section title={t('rotationTitle')}>
      <div className="chips">
        {[...history].sort((a, b) => a.year - b.year).map((h) => (
          <span key={`${h.year}-${h.crop}`} className="chip rot-chip"><CropIcon crop={h.crop} size={22} /> {h.year} · {w(h.crop)}</span>
        ))}
      </div>
      <ul className="advice-list">
        {advice.map((a, i) => (
          <li key={i} className={a.kind === 'good' ? 'ok' : ''}>
            {a.kind === 'good' ? `✓ ${t('rot_good')}`
              : a.kind === 'same-crop' ? `💡 ${t('rot_same-crop', { crop: w(a.crop), years: a.years })}`
                : a.kind === 'cereal-run' ? `💡 ${t('rot_cereal-run', { years: a.years })}`
                  : `💡 ${t(a.kind === 'canola-too-soon' ? 'rot_canola-too-soon' : 'rot_lupins-too-soon', { year: a.lastYear })}`}
          </li>
        ))}
      </ul>
      {next.length > 0 && (
        <div className="row wrap">
          <span className="small muted">{t('rotSuggest')}</span>
          {next.slice(0, 3).map((c) => <span key={c} className="chip rot-chip"><CropIcon crop={c} size={22} /> {w(c)}</span>)}
        </div>
      )}
      <p className="tiny muted">{t('rotationDisclaimer')}</p>
    </Section>
  )
}
