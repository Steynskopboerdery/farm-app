import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { ErrorText, Loading, numOrNull, textOrNull } from '../../components/ui'
import { useFarm, useFarmId } from '../../farm/FarmProvider'
import { todayIso } from '../../lib/calc/dates'
import { stockOnHand } from '../../lib/calc/reports'
import { fuelUse, latestReading, litresByMonth, serviceStatus } from '../../lib/calc/vehicles'
import { useVehicles, VEHICLE_EMOJI, VEHICLE_KINDS, type Vehicle, type VehicleLog } from '../../lib/farmRecords'
import { formatDateShort, formatNumber } from '../../lib/format'
import { useI18n, type DictKey } from '../../lib/i18n'
import { useInventory } from '../../lib/inventory'
import { supabase } from '../../lib/supabase'

export function vehicleSummary(v: Vehicle, logs: VehicleLog[]) {
  const own = logs.filter((l) => l.vehicle_id === v.id)
  const meter = v.meter === 'km' ? 'km' : 'hours'
  return { logs: own, reading: latestReading(own), use: fuelUse(own, meter), service: serviceStatus(own, v.service_interval), meter }
}

/** Tractors and bakkies: fuel, hours and service due. */
export function VehiclesPage() {
  const { t, lang } = useI18n()
  const { isOwner } = useFarm()
  const data = useVehicles()
  const [adding, setAdding] = useState(false)
  if (data.isLoading) return <Loading />
  const { vehicles = [], logs = [] } = data.data ?? {}
  const month = todayIso().slice(0, 7)
  return (
    <div className="page stack">
      <Link to="/menu" className="back">‹ {t('menu')}</Link>
      <h1>🚜 {t('vehiclesTitle')}</h1>
      {vehicles.length === 0 && <p className="muted">{t('vehiclesNone')}</p>}
      <ul className="list card">
        {vehicles.map((v) => {
          const s = vehicleSummary(v, logs)
          const unit = v.meter === 'km' ? 'km' : t('hoursShort')
          return (
            <li key={v.id}>
              <Link className="row link-row" to={`/vehicles/${v.id}`}>
                <span className="kind-emoji" aria-hidden="true">{VEHICLE_EMOJI[v.kind]}</span>
                <div className="grow">
                  <strong>{v.name}</strong>
                  {s.service?.due && <span className="badge st-dead"> {t('serviceDue')}</span>}
                  {s.service?.soon && <span className="badge st-sold"> {t('serviceSoon')}</span>}
                  <div className="small muted">
                    {s.reading != null ? `${formatNumber(s.reading, 1, lang)} ${unit}` : '–'}
                    {' · '}{t('litresThisMonth', { n: formatNumber(litresByMonth(s.logs).get(month) ?? 0, 0, lang) })}
                  </div>
                </div>
                <span className="chev">›</span>
              </Link>
            </li>
          )
        })}
      </ul>
      {isOwner && !adding && <button className="btn" onClick={() => setAdding(true)}>+ {t('vehicleAdd')}</button>}
      {adding && <VehicleForm onDone={() => setAdding(false)} />}
      <ErrorText error={data.error} />
    </div>
  )
}

function VehicleForm({ vehicle, onDone }: { vehicle?: Vehicle; onDone: () => void }) {
  const { t, lang } = useI18n()
  const farmId = useFarmId()
  const qc = useQueryClient()
  const inv = useInventory()
  const stock = stockOnHand(inv.data?.movements ?? [])
  const [f, setF] = useState({
    name: vehicle?.name ?? '', kind: vehicle?.kind ?? 'tractor', registration: vehicle?.registration ?? '',
    meter: vehicle?.meter ?? 'hours', interval: vehicle?.service_interval?.toString() ?? '', fuel: vehicle?.fuel_item_id ?? '', notes: vehicle?.notes ?? '',
  })
  const save = useMutation({
    mutationFn: async () => {
      const row = { name: f.name.trim(), kind: f.kind, registration: textOrNull(f.registration), meter: f.meter, service_interval: numOrNull(f.interval), fuel_item_id: f.fuel || null, notes: textOrNull(f.notes) }
      const { error } = vehicle
        ? await supabase.from('vehicles').update(row).eq('id', vehicle.id)
        : await supabase.from('vehicles').insert({ ...row, farm_id: farmId })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vehicles'] }); onDone() },
  })
  const tanks = (inv.data?.items ?? []).filter((i) => i.unit === 'L')
  return (
    <form className="card stack" onSubmit={(e) => { e.preventDefault(); save.mutate() }}>
      <h2>{vehicle ? t('edit') : t('vehicleAdd')}</h2>
      <label>{t('name')}<input required value={f.name} placeholder="John Deere 6120M" onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <div className="chips">
        {VEHICLE_KINDS.map((k) => (
          <button type="button" key={k} className={`chip ${f.kind === k ? 'on' : ''}`}
            onClick={() => setF({ ...f, kind: k, meter: ['bakkie', 'truck', 'motorbike'].includes(k) ? 'km' : 'hours' })}>
            {VEHICLE_EMOJI[k]} {t(`veh_${k}` as DictKey)}
          </button>
        ))}
      </div>
      <div className="grid2">
        <label>{t('vehicleMeter')}
          <select value={f.meter} onChange={(e) => setF({ ...f, meter: e.target.value })}>
            <option value="hours">{t('hourMeter')}</option><option value="km">{t('odometer')}</option>
          </select>
        </label>
        <label>{t('serviceEvery', { unit: f.meter === 'km' ? 'km' : t('hoursShort') })}<input inputMode="decimal" value={f.interval} placeholder={f.meter === 'km' ? '15000' : '250'} onChange={(e) => setF({ ...f, interval: e.target.value })} /></label>
      </div>
      <label>{t('registration')}<input value={f.registration} onChange={(e) => setF({ ...f, registration: e.target.value })} /></label>
      <label>{t('fuelFromStore')}
        <select value={f.fuel} onChange={(e) => setF({ ...f, fuel: e.target.value })}>
          <option value="">–</option>
          {tanks.map((i) => <option key={i.id} value={i.id}>{i.name} ({formatNumber(stock.get(i.id) ?? 0, 0, lang)} L)</option>)}
        </select>
        <span className="hint">{t('fuelFromStoreHint')}</span>
      </label>
      <label>{t('notes')}<input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
      <div className="btn-row">
        <button type="button" className="btn" onClick={onDone}>{t('cancel')}</button>
        <button className="btn primary" disabled={save.isPending}>{t('save')}</button>
      </div>
      <ErrorText error={save.error} />
    </form>
  )
}

/** One vehicle: log fuel, services and repairs. */
export function VehiclePage() {
  const { id } = useParams<{ id: string }>()
  const { t, lang } = useI18n()
  const { isOwner } = useFarm()
  const { session } = useAuth()
  const farmId = useFarmId()
  const qc = useQueryClient()
  const data = useVehicles()
  const [editing, setEditing] = useState(false)
  const [f, setF] = useState({ kind: 'fuel', date: todayIso(), litres: '', reading: '', fromStore: true, notes: '' })
  const vehicle = data.data?.vehicles.find((v) => v.id === id)

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('vehicle_logs').insert({
        farm_id: farmId, vehicle_id: id!, kind: f.kind, date: f.date, litres: f.kind === 'fuel' ? numOrNull(f.litres) : null,
        reading: numOrNull(f.reading), from_store: f.fromStore, notes: textOrNull(f.notes),
      })
      if (error) throw error
    },
    onSuccess: () => { setF({ ...f, litres: '', reading: '', notes: '' }); qc.invalidateQueries({ queryKey: ['vehicles'] }); qc.invalidateQueries({ queryKey: ['inventory'] }) },
  })
  const remove = useMutation({
    mutationFn: async (logId: string) => {
      const { error } = await supabase.from('vehicle_logs').update({ deleted_at: new Date().toISOString() }).eq('id', logId)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vehicles'] }); qc.invalidateQueries({ queryKey: ['inventory'] }) },
  })

  if (data.isLoading) return <Loading />
  if (!vehicle) return <div className="page"><Link to="/vehicles" className="back">‹ {t('vehiclesTitle')}</Link><p>Not found.</p></div>
  const s = vehicleSummary(vehicle, data.data?.logs ?? [])
  const unit = vehicle.meter === 'km' ? 'km' : t('hoursShort')

  return (
    <div className="page stack">
      <Link to="/vehicles" className="back">‹ {t('vehiclesTitle')}</Link>
      <h1>{VEHICLE_EMOJI[vehicle.kind]} {vehicle.name}</h1>
      {vehicle.registration && <p className="muted">{vehicle.registration}</p>}

      <div className="stats three">
        <div className="stat"><span className="stat-n">{s.reading != null ? formatNumber(s.reading, 0, lang) : '–'}</span><span className="stat-l">{vehicle.meter === 'km' ? t('odometer') : t('hourMeter')}</span></div>
        <div className="stat"><span className="stat-n">{s.use != null ? formatNumber(s.use, 1, lang) : '–'}</span><span className="stat-l">{vehicle.meter === 'km' ? t('litresPer100') : t('litresPerHour')}</span></div>
        <div className="stat"><span className="stat-n">{s.service ? formatNumber(s.service.left, 0, lang) : '–'}</span><span className="stat-l">{t('untilService', { unit })}</span></div>
      </div>
      {s.service?.due && <div className="warning"><strong>⚠ {t('serviceDue')}</strong><p>{t('serviceDueText', { at: formatNumber(s.service.dueAt, 0, lang), unit })}</p></div>}

      <form className="card stack" onSubmit={(e) => { e.preventDefault(); add.mutate() }}>
        <div className="segmented">
          {(['fuel', 'service', 'repair'] as const).map((k) => (
            <button type="button" key={k} className={f.kind === k ? 'on' : ''} onClick={() => setF({ ...f, kind: k })}>{t(`vlog_${k}` as DictKey)}</button>
          ))}
        </div>
        <div className="grid2">
          <label>{t('date')}<input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
          {f.kind === 'fuel' && <label>{t('litres')}<input inputMode="decimal" required value={f.litres} onChange={(e) => setF({ ...f, litres: e.target.value })} /></label>}
        </div>
        <label>{vehicle.meter === 'km' ? t('odometer') : t('hourMeter')} ({unit})<input inputMode="decimal" value={f.reading} onChange={(e) => setF({ ...f, reading: e.target.value })} />
          <span className="hint">{t('readingHint')}</span>
        </label>
        {f.kind === 'fuel' && vehicle.fuel_item_id && (
          <label className="check"><input type="checkbox" checked={f.fromStore} onChange={(e) => setF({ ...f, fromStore: e.target.checked })} /> {t('fuelTakenFromStore')}</label>
        )}
        <label>{f.kind === 'fuel' ? t('notes') : t('whatWasDone')}<input value={f.notes} required={f.kind !== 'fuel'} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
        <button className="btn primary" disabled={add.isPending}>{add.isPending ? t('saving') : t('save')}</button>
        <ErrorText error={add.error} />
      </form>

      <section className="card">
        <h2>{t('vehicleLog')}</h2>
        {s.logs.length === 0 ? <p className="muted">{t('noData')}</p> : (
          <ul className="list">
            {s.logs.slice(0, 60).map((l) => (
              <li key={l.id} className="row">
                <div className="grow">
                  <strong>{t(`vlog_${l.kind}` as DictKey)}</strong>{l.litres ? ` · ${formatNumber(l.litres, 1, lang)} L` : ''}
                  <div className="small muted">{formatDateShort(l.date, lang)}{l.reading != null ? ` · ${formatNumber(l.reading, 1, lang)} ${unit}` : ''}{l.notes ? ` · ${l.notes}` : ''}</div>
                </div>
                {(isOwner || l.created_by === session?.user.id) && (
                  <button className="btn small ghost" aria-label={t('delete')} onClick={() => confirm(`${t('delete')}?`) && remove.mutate(l.id)}>✕</button>
                )}
              </li>
            ))}
          </ul>
        )}
        <ErrorText error={remove.error} />
      </section>

      {isOwner && (editing ? <VehicleForm vehicle={vehicle} onDone={() => setEditing(false)} /> : <button className="btn" onClick={() => setEditing(true)}>✎ {t('edit')}</button>)}
    </div>
  )
}
