import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ErrorText, Loading, numOrNull, textOrNull } from '../../components/ui'
import { useFarm, useFarmId } from '../../farm/FarmProvider'
import { todayIso } from '../../lib/calc/dates'
import { rateFromTotal, totalFromRate } from '../../lib/calc/season'
import { safeHarvestDate, withholdingConflicts } from '../../lib/calc/withholding'
import { yieldPerHa } from '../../lib/calc/yield'
import { CropIcon } from '../../components/CropIcon'
import { CROP_OPTIONS } from '../../lib/crops'
import { defaultSeasonId, ensureSeason, UNIT_FOR_RATE, useFieldRecords } from '../../lib/fieldRecords'
import { formatDate, formatHa, formatNumber } from '../../lib/format'
import { useI18n, type DictKey } from '../../lib/i18n'
import { useFields, useSeasons } from '../../lib/queries'
import { useInventory } from '../../lib/inventory'
import { stockOnHand } from '../../lib/calc/reports'
import { supabase } from '../../lib/supabase'
import { useWeather } from '../../lib/useWeather'
import { compass, conditionsAt, sprayWarnings } from '../../lib/weather'

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
    sprayTime: v('spray_time').slice(0, 5) || (existing ? '' : new Date().toTimeString().slice(0, 5)),
    wind: v('wind_kmh'), gust: v('gust_kmh'), dir: v('wind_dir'), temp: v('temp_c'), hum: v('humidity'), wsource: v('weather_source'),
  }
}

function RecordForm({ type, field, seasonId: initialSeason, existing }: {
  type: RecordType
  field: { id: string; name: string; hectares: number | null }
  seasonId: string
  existing: Record<string, unknown> | undefined
}) {
  const { t, w, lang } = useI18n()
  const { isOwner, can } = useFarm()
  const canEdit = can('field_records')
  const farmId = useFarmId()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const seasons = useSeasons()
  const records = useFieldRecords(field.id)
  const ha = field.hectares
  const [f, setF] = useState<Form>(() => initialForm(type, existing, ha))
  const [totalTouched, setTotalTouched] = useState(!!existing)
  const inventory = useInventory()
  const [storeItem, setStoreItem] = useState<string>(String(existing?.inventory_item_id ?? ''))
  const storeItems = (inventory.data?.items ?? []).filter((i) => (type === 'spray' ? ['chemical', 'other'] : ['fertiliser', 'other']).includes(i.category))
  const stock = stockOnHand(inventory.data?.movements ?? [])
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

  // Spraying conditions: taken from the forecast for the spraying hour (works for today), or typed in.
  const weather = useWeather()
  const sprayMoment = type === 'spray' && f.date && f.sprayTime ? new Date(`${f.date}T${f.sprayTime}:00+02:00`) : null
  const forecastHour = sprayMoment && weather.data ? conditionsAt(weather.data.hours, sprayMoment) : null
  const fillWeather = () => {
    if (!forecastHour) return
    setF((old) => ({
      ...old, wind: String(forecastHour.windKmh), gust: forecastHour.gustKmh != null ? String(forecastHour.gustKmh) : '',
      dir: String(forecastHour.windDir), temp: String(forecastHour.temp), hum: forecastHour.humidity != null ? String(forecastHour.humidity) : '', wsource: 'forecast',
    }))
  }
  const autoFill = !existing && type === 'spray' && !!forecastHour && !f.wind && !f.wsource
  useEffect(() => { if (autoFill) fillWeather() })  // eslint-disable-line react-hooks/exhaustive-deps
  const setManual = (k: string, val: string) => setF((old) => ({ ...old, [k]: val, wsource: 'manual' }))
  const warnings = type === 'spray' ? sprayWarnings({ windKmh: numOrNull(f.wind), gustKmh: numOrNull(f.gust), temp: numOrNull(f.temp), humidity: numOrNull(f.hum) }) : []
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
          ...(type === 'spray' ? {
            spray_time: f.sprayTime || null, wind_kmh: numOrNull(f.wind), gust_kmh: numOrNull(f.gust), wind_dir: numOrNull(f.dir),
            temp_c: numOrNull(f.temp), humidity: numOrNull(f.hum), weather_source: f.wsource || null,
          } : {}),
        }
        const withItem = { ...row, inventory_item_id: type === 'other' ? null : storeItem || null }
        let opId = existing ? String(existing.id) : ''
        if (existing) {
          ;({ error } = await supabase.from('field_operations').update(withItem).eq('id', opId))
        } else {
          const res = await supabase.from('field_operations').insert(withItem).select('id').single()
          error = res.error
          opId = res.data?.id ?? ''
        }
        if (error) throw error
        // Keep the store in step: one "used" movement per field record, replaced when the record changes.
        ;({ error } = await supabase.from('inventory_movements').update({ deleted_at: new Date().toISOString() }).eq('field_operation_id', opId).is('deleted_at', null))
        if (error) throw error
        const used = numOrNull(f.total)
        if (storeItem && used && type !== 'other') {
          ;({ error } = await supabase.from('inventory_movements').insert({
            farm_id: farmId, item_id: storeItem, date: f.date, quantity: -Math.abs(used), field_operation_id: opId,
            notes: `${field.name}${f.product ? ` · ${f.product}` : ''}`,
          }))
        }
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
      qc.invalidateQueries({ queryKey: ['inventory'] })
      navigate(`/land/field/${field.id}?season=${seasonId}`)
    },
  })

  const remove = useMutation({
    mutationFn: async () => {
      const now = new Date().toISOString()
      const { error } = await supabase.from(TABLE(type)).update({ deleted_at: now }).eq('id', String(existing!.id))
      if (error) throw error
      if (TABLE(type) === 'field_operations') {
        const { error: e2 } = await supabase.from('inventory_movements').update({ deleted_at: now }).eq('field_operation_id', String(existing!.id)).is('deleted_at', null)
        if (e2) throw e2
      }
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
      <input type={opts.type ?? 'text'} inputMode={opts.mode} value={f[k] ?? ''} disabled={!canEdit}
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
          <select value={season} disabled={!canEdit} onChange={(e) => setSeason(e.target.value)}>
            {!hasThisYear && <option value={`new:${thisYear}`}>{t('newSeason', { year: thisYear })}</option>}
            {seasonOptions.map((s) => <option key={s.id} value={s.id}>{s.label || s.year}</option>)}
          </select>
        </label>

        {type === 'planting' && (
          <>
            <fieldset className="crop-picker" disabled={!canEdit}>
              <legend>{t('crop')}</legend>
              {[...CROP_OPTIONS, 'other'].map((c) => (
                <button key={c} type="button" className={`crop-tile ${f.crop === c ? 'on' : ''}`} aria-pressed={f.crop === c} onClick={() => set('crop', c)}>
                  <CropIcon crop={c} size={44} />
                  <span>{c === 'other' ? t('otherCrop') : w(c)}</span>
                </button>
              ))}
            </fieldset>
            {f.crop === 'other' && input('cropOther', t('cropOtherName'))}
            {input('cultivar', t('cultivar'))}
            {input('date', t('plantingDate'), { type: 'date' })}
            {input('expected', t('expectedHarvestDate'), { type: 'date' })}
            <div className="grid2">
              {input('seedRate', t('seedRate'), { mode: 'decimal' })}
              {input('seedKg', t('seedTotal'), { mode: 'decimal', onInput: () => setSeedTouched(true) })}
            </div>
            {isOwner && input('seedCost', t('seedCost'), { mode: 'decimal' })}
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
            {type !== 'other' && storeItems.length > 0 && canEdit && (
              <label>{t('fromStore')}
                <select value={storeItem} onChange={(e) => {
                  const it = storeItems.find((i) => i.id === e.target.value)
                  setStoreItem(e.target.value)
                  if (it) setF((old) => ({ ...old, product: it.name, rateUnit: `${it.unit}/ha` in UNIT_FOR_RATE ? `${it.unit}/ha` : old.rateUnit }))
                }}>
                  <option value="">{t('notFromStore')}</option>
                  {storeItems.map((i) => <option key={i.id} value={i.id}>{i.name} ({formatNumber(stock.get(i.id) ?? 0, 1, lang)} {i.unit})</option>)}
                </select>
                {storeItem && <span className="hint">{t('storeHint')}</span>}
              </label>
            )}
            {input('product', type === 'other' ? t('whatWasDone') : t('product'))}
            {type !== 'other' && (
              <>
                <div className="grid2">
                  {input('rate', t('rate'), { mode: 'decimal' })}
                  <label>{t('rateUnit')}
                    <select value={f.rateUnit} disabled={!canEdit} onChange={(e) => set('rateUnit', e.target.value)}>
                      {Object.keys(UNIT_FOR_RATE).map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </label>
                </div>
                {input('total', t('totalUsed', { unit }), {
                  mode: 'decimal', onInput: () => setTotalTouched(true),
                  help: ha ? t('totalHelp', { ha: formatHa(ha, lang) }) : undefined,
                })}
                {isOwner && input('price', t('pricePer', { unit }), { mode: 'decimal' })}
              </>
            )}
            {isOwner && input('cost', t('cost'), { mode: 'decimal' })}
            {type === 'spray' && (
              <>
                {input('whp', t('withholdingDays'), { mode: 'numeric' })}
                {numOrNull(f.whp) ? (
                  <p className="pill-info">{t('safeFrom')}: <strong>{formatDate(safeHarvestDate({ product: f.product, date: f.date, withholdingPeriodDays: numOrNull(f.whp) }), lang)}</strong></p>
                ) : null}
                <p className="advice">{t('labelAdvice')}</p>
                <fieldset className="card-inset stack" disabled={!canEdit}>
                  <legend>🌬️ {t('sprayConditions')}</legend>
                  <label>{t('sprayTime')}<input type="time" value={f.sprayTime} onChange={(e) => set('sprayTime', e.target.value)} /></label>
                  <div className="grid2">
                    <label>{t('windKmh')}<input inputMode="decimal" value={f.wind} onChange={(e) => setManual('wind', e.target.value)} /></label>
                    <label>{t('gustKmh')}<input inputMode="decimal" value={f.gust} onChange={(e) => setManual('gust', e.target.value)} /></label>
                    <label>{t('windFrom')}
                      <select value={f.dir} onChange={(e) => setManual('dir', e.target.value)}>
                        <option value="">–</option>
                        {[0, 45, 90, 135, 180, 225, 270, 315].map((d) => <option key={d} value={d}>{compass(d, lang)}</option>)}
                        {f.dir && ![0, 45, 90, 135, 180, 225, 270, 315].includes(Number(f.dir)) && <option value={f.dir}>{compass(Number(f.dir), lang)} ({f.dir}°)</option>}
                      </select>
                    </label>
                    <label>{t('tempC')}<input inputMode="decimal" value={f.temp} onChange={(e) => setManual('temp', e.target.value)} /></label>
                  </div>
                  <label>{t('humidityPct')}<input inputMode="numeric" value={f.hum} onChange={(e) => setManual('hum', e.target.value)} /></label>
                  {forecastHour && f.wsource !== 'forecast' && <button type="button" className="btn small" onClick={fillWeather}>⛅ {t('fillFromWeather')}</button>}
                  {f.wsource === 'forecast' && <p className="tiny muted">{t('weatherFromForecast')}</p>}
                  {!forecastHour && !f.wind && <p className="tiny muted">{t('weatherTypeIn')}</p>}
                  {warnings.length > 0 && (
                    <div className="warning"><strong>⚠ {t('sprayNotIdeal')}</strong>{warnings.map((w2) => <p key={w2}>{t(`sw_${w2}` as DictKey)}</p>)}</div>
                  )}
                </fieldset>
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

        <label>{t('notes')}<textarea rows={2} value={f.notes ?? ''} disabled={!canEdit} onChange={(e) => set('notes', e.target.value)} /></label>

        {canEdit && <button className="btn primary" disabled={save.isPending}>{save.isPending ? t('saving') : t('save')}</button>}
        <ErrorText error={save.error} />
      </form>

      {canEdit && existing && (
        <button className="btn danger" disabled={remove.isPending}
          onClick={() => confirm(t('removeRecordConfirm')) && remove.mutate()}>{t('removeRecord')}</button>
      )}
      <ErrorText error={remove.error} />
    </div>
  )
}
