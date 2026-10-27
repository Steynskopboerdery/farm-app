import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ErrorText, Loading, numOrNull, textOrNull } from '../../components/ui'
import { useFarm, useFarmId } from '../../farm/FarmProvider'
import { todayIso } from '../../lib/calc/dates'
import { rateFromTotal, totalFromRate } from '../../lib/calc/season'
import { safeHarvestDate, withholdingConflicts } from '../../lib/calc/withholding'
import { yieldPerHa } from '../../lib/calc/yield'
import { CROP_OPTIONS } from '../../lib/crops'
import { defaultSeasonId, ensureSeason, UNIT_FOR_RATE, useFieldRecords } from '../../lib/fieldRecords'
import { formatDate, formatHa, formatNumber } from '../../lib/format'
import { useI18n, type DictKey } from '../../lib/i18n'
import { useFields, useSeasons } from '../../lib/queries'
import { supabase } from '../../lib/supabase'

export type RecordType = 'planting' | 'fertiliser' | 'spray' | 'other' | 'harvest'

const TITLES: Record<RecordType, DictKey> = {
  planting: 'addPlanting', fertiliser: 'addFertiliser', spray: 'addSpray', other: 'addOther', harvest: 'addHarvest',
}
const TABLE = (type: RecordType) => (type === 'planting' ? 'plantings' : type === 'harvest' ? 'harvests' : 'field_operations')

// Form values are kept as text while typing and turned into numbers on save.
type Form = Record<string, string>

/** Add or edit one crop record. Route: /land/field/:id/record/:type/:recordId? */
export function RecordFormPage() {
  const { id: fieldId, type: typeParam, recordId } = useParams<{ id: string; type: RecordType; recordId?: string }>()
  const type = (typeParam ?? 'fertiliser') as RecordType
  const [params] = useSearchParams()
  const fields = useFields()
  const seasons = useSeasons()
  const records = useFieldRecords(fieldId)
  const field = fields.data?.find((f) => f.id === fieldId)

  if (fields.isLoading || seasons.isLoading || records.isLoading) return <Loading />
  if (!field) return <div className="page"><p>Not found.</p></div>

  const existing = recordId
    ? type === 'planting' ? records.data?.plantings.find((r) => r.id === recordId)
      : type === 'harvest' ? records.data?.harvests.find((r) => r.id === recordId)
        : records.data?.operations.find((r) => r.id === recordId)
    : undefined

  return (
    <RecordForm
      key={recordId ?? 'new'}
      type={type}
      field={{ id: field.id, name: field.name, hectares: field.hectares }}
      seasonId={existing?.season_id ?? params.get('season') ?? defaultSeasonId(seasons.data) ?? ''}
      existing={existing as Record<string, unknown> | undefined}
    />
  )
}

function initialForm(type: RecordType, existing: Record<string, unknown> | undefined, hectares: number | null): Form {
  const v = (k: string) => (existing?.[k] == null ? '' : String(existing[k]))
  if (type === 'planting') {
    const crop = v('crop')
    const known = !crop || CROP_OPTIONS.includes(crop)
    return {
      crop: known ? crop || 'wheat' : 'other', cropOther: known ? '' : crop, cultivar: v('cultivar'),
      seedRate: existing ? String(rateFromTotal(Number(existing.seed_kg), hectares) ?? '') : '',
      seedKg: v('seed_kg'), seedCost: v('seed_cost'),
      date: v('planting_date') || todayIso(), expected: v('expected_harvest_date'), notes: v('notes'), reminder: '',
    }
  }
  if (type === 'harvest') {
    return { date: v('date') || todayIso(), tons: v('tons'), ha: existing ? v('hectares_harvested') : String(hectares ?? ''), notes: v('notes') }
  }
  return {
    date: v('date') || todayIso(), product: v('product'), rate: v('rate'),
    rateUnit: v('rate_unit') || (type === 'spray' ? 'L/ha' : 'kg/ha'), total: v('total_amount'),
    cost: v('cost'), price: '', whp: v('withholding_period_days'), notes: v('notes'),
  }
}

function RecordForm({ type, field, seasonId: initialSeason, existing }: {
  type: RecordType
  field: { id: string; name: string; hectares: number | null }
  seasonId: string
  existing: Record<string, unknown> | undefined
}) {
  const { t, w, lang } = useI18n()
  const { isOwner } = useFarm()
  const farmId = useFarmId()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const seasons = useSeasons()
  const records = useFieldRecords(field.id)
  const ha = field.hectares
  const [f, setF] = useState<Form>(() => initialForm(type, existing, ha))
  const [totalTouched, setTotalTouched] = useState(!!existing)
  const [seedTouched, setSeedTouched] = useState(!!existing)
  const thisYear = Number((f.date || todayIso()).slice(0, 4))
  const [season, setSeason] = useState<string>(initialSeason || `new:${thisYear}`)

  const set = (k: string, val: string) => setF((old) => {
    const next = { ...old, [k]: val }
    // Totals follow the per-hectare rate until the total is typed in by hand.
    if (k === 'rate' && !totalTouched) next.total = String(totalFromRate(numOrNull(val), ha) ?? '')
    if (k === 'seedRate' && !seedTouched) next.seedKg = String(totalFromRate(numOrNull(val), ha) ?? '')
    if ((k === 'price' || k === 'total') && numOrNull(next.price) != null && numOrNull(next.total) != null) {
      next.cost = String(Math.round(numOrNull(next.total)! * numOrNull(next.price)! * 100) / 100)
    }
    return next
  })

  const unit = UNIT_FOR_RATE[f.rateUnit] ?? 'kg'
  const backTo = `/land/field/${field.id}?season=${season.startsWith('new:') ? '' : season}`

  // Withholding: sprays on this field in this season against the harvest date being entered.
  const seasonSprays = (records.data?.operations ?? [])
    .filter((o) => o.type === 'spray' && o.season_id === season && o.id !== existing?.id)
    .map((o) => ({ product: o.product, date: o.date, withholdingPeriodDays: o.withholding_period_days }))
  const harvestDate = type === 'harvest' ? f.date : type === 'planting' ? f.expected : ''
  const conflicts = harvestDate ? withholdingConflicts(seasonSprays, harvestDate) : []

  const save = useMutation({
    mutationFn: async () => {
      const seasonId = season.startsWith('new:')
        ? await ensureSeason(farmId, seasons.data ?? [], Number(season.slice(4)))
        : season
      const base = { farm_id: farmId, field_id: field.id, season_id: seasonId, notes: textOrNull(f.notes) }
      let error
      if (type === 'planting') {
        const row = {
          ...base, crop: f.crop === 'other' ? (f.cropOther.trim().toLowerCase() || 'other') : f.crop,
          cultivar: textOrNull(f.cultivar), seed_kg: numOrNull(f.seedKg), seed_cost: numOrNull(f.seedCost),
          planting_date: f.date || null, expected_harvest_date: f.expected || null,
        }
        ;({ error } = existing
          ? await supabase.from('plantings').update(row).eq('id', String(existing.id))
          : await supabase.from('plantings').insert(row))
        if (!error && f.reminder === 'yes' && f.expected) {
          ;({ error } = await supabase.from('tasks').insert({
            farm_id: farmId, type: 'harvest', field_id: field.id, due_date: f.expected,
            title: `${t('task_harvest')}: ${field.name} (${w(row.crop)})`,
          }))
        }
      } else if (type === 'harvest') {
        const row = { ...base, date: f.date, tons: numOrNull(f.tons) ?? 0, hectares_harvested: numOrNull(f.ha) }
        ;({ error } = existing
          ? await supabase.from('harvests').update(row).eq('id', String(existing.id))
          : await supabase.from('harvests').insert(row))
      } else {
        const row = {
          ...base, type, date: f.date, product: textOrNull(f.product),
          rate: type === 'other' ? null : numOrNull(f.rate), rate_unit: type === 'other' ? null : f.rateUnit,
          total_amount: type === 'other' ? null : numOrNull(f.total), unit: type === 'other' ? null : unit,
          cost: numOrNull(f.cost), withholding_period_days: type === 'spray' ? numOrNull(f.whp) : null,
        }
        ;({ error } = existing
          ? await supabase.from('field_operations').update(row).eq('id', String(existing.id))
          : await supabase.from('field_operations').insert(row))
      }
      if (error) throw error
      return seasonId
    },
    onSuccess: (seasonId) => {
      qc.invalidateQueries({ queryKey: ['field-records'] })
      qc.invalidateQueries({ queryKey: ['plantings'] })
      qc.invalidateQueries({ queryKey: ['seasons'] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['audit_log'] })
      navigate(`/land/field/${field.id}?season=${seasonId}`)
    },
  })

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from(TABLE(type)).update({ deleted_at: new Date().toISOString() }).eq('id', String(existing!.id))
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['field-records'] })
      qc.invalidateQueries({ queryKey: ['plantings'] })
      navigate(backTo)
    },
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    save.mutate()
  }

  const input = (k: string, label: string, opts: { mode?: 'decimal' | 'numeric'; type?: string; help?: string; onInput?: () => void } = {}) => (
    <label>{label}
      <input type={opts.type ?? 'text'} inputMode={opts.mode} value={f[k] ?? ''} disabled={!isOwner}
        onChange={(e) => { opts.onInput?.(); set(k, e.target.value) }} />
      {opts.help && <span className="hint">{opts.help}</span>}
    </label>
  )

  const seasonOptions = [...(seasons.data ?? [])].sort((a, b) => b.year - a.year)
  const hasThisYear = seasonOptions.some((s) => s.year === thisYear)

  return (
    <div className="page stack">
      <Link to={backTo} className="back">‹ {field.name}</Link>
      <h1>{existing ? `${t('editRecord')}: ${t(TITLES[type]).replace(/^\S+\s/, '')}` : t(TITLES[type])}</h1>
      <p className="muted">{field.name} · {formatHa(ha, lang)}</p>

      <form className="card stack" onSubmit={submit}>
        <label>{t('season')}
          <select value={season} disabled={!isOwner} onChange={(e) => setSeason(e.target.value)}>
            {!hasThisYear && <option value={`new:${thisYear}`}>{t('newSeason', { year: thisYear })}</option>}
            {seasonOptions.map((s) => <option key={s.id} value={s.id}>{s.label || s.year}</option>)}
          </select>
        </label>

        {type === 'planting' && (
          <>
            <label>{t('crop')}
              <select value={f.crop} disabled={!isOwner} onChange={(e) => set('crop', e.target.value)}>
                {CROP_OPTIONS.map((c) => <option key={c} value={c}>{w(c)}</option>)}
                <option value="other">{t('otherCrop')}</option>
              </select>
            </label>
            {f.crop === 'other' && input('cropOther', t('cropOtherName'))}
            {input('cultivar', t('cultivar'))}
            {input('date', t('plantingDate'), { type: 'date' })}
            {input('expected', t('expectedHarvestDate'), { type: 'date' })}
            <div className="grid2">
              {input('seedRate', t('seedRate'), { mode: 'decimal' })}
              {input('seedKg', t('seedTotal'), { mode: 'decimal', onInput: () => setSeedTouched(true) })}
            </div>
            {input('seedCost', t('seedCost'), { mode: 'decimal' })}
            {!existing && f.expected && (
              <label className="check">
                <input type="checkbox" checked={f.reminder === 'yes'} onChange={(e) => set('reminder', e.target.checked ? 'yes' : '')} />
                {t('harvestReminder')}
              </label>
            )}
          </>
        )}

        {(type === 'fertiliser' || type === 'spray' || type === 'other') && (
          <>
            {input('date', t('date'), { type: 'date' })}
            {input('product', type === 'other' ? t('whatWasDone') : t('product'))}
            {type !== 'other' && (
              <>
                <div className="grid2">
                  {input('rate', t('rate'), { mode: 'decimal' })}
                  <label>{t('rateUnit')}
                    <select value={f.rateUnit} disabled={!isOwner} onChange={(e) => set('rateUnit', e.target.value)}>
                      {Object.keys(UNIT_FOR_RATE).map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </label>
                </div>
                {input('total', t('totalUsed', { unit }), {
                  mode: 'decimal', onInput: () => setTotalTouched(true),
                  help: ha ? t('totalHelp', { ha: formatHa(ha, lang) }) : undefined,
                })}
                {input('price', t('pricePer', { unit }), { mode: 'decimal' })}
              </>
            )}
            {input('cost', t('cost'), { mode: 'decimal' })}
            {type === 'spray' && (
              <>
                {input('whp', t('withholdingDays'), { mode: 'numeric' })}
                {numOrNull(f.whp) ? (
                  <p className="pill-info">{t('safeFrom')}: <strong>{formatDate(safeHarvestDate({ product: f.product, date: f.date, withholdingPeriodDays: numOrNull(f.whp) }), lang)}</strong></p>
                ) : null}
                <p className="advice">{t('labelAdvice')}</p>
              </>
            )}
          </>
        )}

        {type === 'harvest' && (
          <>
            {input('date', t('date'), { type: 'date' })}
            <div className="grid2">
              {input('tons', t('tonsHarvested'), { mode: 'decimal' })}
              {input('ha', t('hectaresHarvested'), { mode: 'decimal' })}
            </div>
            <span className="hint">{t('hectaresHarvestedHelp')}</span>
            {numOrNull(f.tons) != null && numOrNull(f.ha) ? (
              <p className="pill-info">{t('yieldWord')}: <strong>{formatNumber(yieldPerHa(numOrNull(f.tons)!, numOrNull(f.ha)), 2, lang)} t/ha</strong></p>
            ) : null}
          </>
        )}

        {conflicts.length > 0 && (
          <div className="warning">
            <strong>⚠ {t('whpTitle')}</strong>
            {conflicts.map((c, i) => (
              <p key={i}>{t('whpConflict', { product: c.product ?? '–', date: formatDate(c.date, lang), safe: formatDate(c.safeFrom, lang) })}</p>
            ))}
          </div>
        )}

        <label>{t('notes')}<textarea rows={2} value={f.notes ?? ''} disabled={!isOwner} onChange={(e) => set('notes', e.target.value)} /></label>

        {isOwner && <button className="btn primary" disabled={save.isPending}>{save.isPending ? t('saving') : t('save')}</button>}
        <ErrorText error={save.error} />
      </form>

      {isOwner && existing && (
        <button className="btn danger" disabled={remove.isPending}
          onClick={() => confirm(t('removeRecordConfirm')) && remove.mutate()}>{t('removeRecord')}</button>
      )}
      <ErrorText error={remove.error} />
    </div>
  )
}
