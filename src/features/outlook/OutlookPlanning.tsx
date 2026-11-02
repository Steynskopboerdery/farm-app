// Planning helpers on the Predictions tab: planting rain, frost/heat at flowering, the what-if crop mix,
// the livestock outlook, the end-of-season scorecard and price alerts.
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ErrorText, numOrNull } from '../../components/ui'
import { useFarmId } from '../../farm/FarmProvider'
import { floweringRisks, floweringWindows, plantingRain, type PlantingLite } from '../../lib/calc/alerts'
import { usePriceAlerts } from '../../lib/budget'
import { formatNumber } from '../../lib/format'
import { useI18n, type DictKey } from '../../lib/i18n'
import { supabase, type Tables } from '../../lib/supabase'
import { yieldScenarios } from '../../lib/calc/outlook'
import { RangeKey, RangeRows } from './OutlookVisuals'

type Rain = { dry: number; normal: number; wet: number }
type Prices = { low: number; likely: number; high: number }

// Planting rain ------------------------------------------------------------------------------------

/** From March to June: has enough rain fallen (or is it coming) to plant? */
export function PlantingRainCard({ today, gaugeByDay, forecast, usual }: { today: string; gaugeByDay: Map<string, number>; forecast: { date: string; rainMm: number }[]; usual?: string }) {
  const { t, lang } = useI18n()
  const p = plantingRain(gaugeByDay, forecast, today)
  if (!p.season) return null
  const mm = (n: number) => `${formatNumber(n, 0, lang)} mm`
  const status = p.enoughFell ? 'ready' : p.enoughComing ? 'coming' : 'wait'
  return (
    <section className={`card stack plant-card ${status}`}>
      <h2>🌱 {t('pl_title')}</h2>
      <p className="plant-status">{t(`pl_${status}` as DictKey, { mm: mm(p.mm), days: p.days })}</p>
      <div className="stats">
        <div className="stat"><span className="stat-n">{mm(p.fell)}</span><span className="stat-l">{t('pl_fell', { days: p.days })}</span></div>
        <div className="stat"><span className="stat-n">{mm(p.coming)}</span><span className="stat-l">{t('pl_coming2', { days: p.days })}</span></div>
      </div>
      <p className="tiny muted">{t('pl_note', { mm: mm(p.mm), days: p.days })}{usual ? ` ${t('pl_usual', { date: usual })}` : ''}</p>
    </section>
  )
}

// Frost and heat at flowering ------------------------------------------------------------------------

export function FloweringCard({ plantings, forecast, today }: { plantings: PlantingLite[]; forecast: { date: string; min: number; max: number }[]; today: string }) {
  const { t, w, lang } = useI18n()
  const windows = floweringWindows(plantings)
  const soon = windows.filter((x) => x.to >= today && x.from <= addDaysIso(today, 30))
  if (!soon.length) return null
  const risks = floweringRisks(windows, forecast)
  const fmt = (d: string) => new Intl.DateTimeFormat(lang === 'af' ? 'af-ZA' : 'en-ZA', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`))
  const crops = [...new Set(soon.map((x) => x.crop))]
  return (
    <section className={`card stack ${risks.length ? 'risk-card' : ''}`}>
      <h2>🌼 {t('fl_title')}</h2>
      <ul className="list">
        {crops.map((c) => {
          const ws = soon.filter((x) => x.crop === c)
          const from = ws.map((x) => x.from).sort()[0]
          const to = ws.map((x) => x.to).sort().slice(-1)[0]
          return <li key={c} className="row"><span className="grow">{w(c)}</span><span className="small">{fmt(from)} – {fmt(to)}</span></li>
        })}
      </ul>
      {risks.length > 0 ? (
        <div className="warning">
          {risks.map((r) => (
            <span key={r.date + r.kind}>{r.kind === 'frost' ? '❄️' : '🔥'} {fmt(r.date)}: {t(r.kind === 'frost' ? 'fl_frost' : 'fl_heat', { v: formatNumber(r.value, 0, lang), crops: r.crops.map(w).join(', ') })}</span>
          ))}
        </div>
      ) : <p className="small">✓ {t('fl_ok')}</p>}
      <p className="tiny muted">{t('fl_note')}</p>
    </section>
  )
}

const addDaysIso = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)

// What-if crop mix --------------------------------------------------------------------------------

/** Rough figures for crops without planning figures, so the mix still works. Changed on the screen. */
export const DEFAULT_ECON: Record<string, { price: number; cost: number }> = {
  canola: { price: 9000, cost: 6500 },
  wheat: { price: 5500, cost: 8500 },
  barley: { price: 4800, cost: 7800 },
  oats: { price: 3800, cost: 5500 },
  lupins: { price: 6000, cost: 5000 },
}

export interface CropEcon { crop: string; price: Prices; cost: number; own: boolean }

/** Profit of a crop mix in a dry, normal and wet year, with low / likely / high prices. */
export function mixProfit(ha: Record<string, number>, econ: CropEcon[], rain: Rain, share: number) {
  const out = { dry: { low: 0, likely: 0, high: 0 }, normal: { low: 0, likely: 0, high: 0 }, wet: { low: 0, likely: 0, high: 0 } }
  for (const e of econ) {
    const h = ha[e.crop] ?? 0
    if (!h) continue
    const y = yieldScenarios(e.crop, rain, share)
    for (const k of ['dry', 'normal', 'wet'] as const) {
      for (const p of ['low', 'likely', 'high'] as const) out[k][p] += h * ((y[k] ?? 0) * e.price[p] - e.cost)
    }
  }
  return out
}

export function CropMixCard({ year, rain, share, econ: econStart, startHa }: { year: number; rain: Rain; share: number; econ: CropEcon[]; startHa: Record<string, number> }) {
  const { t, w, lang } = useI18n()
  const startLand = Math.max(10, Math.round(Object.values(startHa).reduce((a, b) => a + b, 0)) || 100)
  const [land, setLand] = useState(String(startLand))
  const [ha, setHa] = useState<Record<string, number>>(startHa)
  const [econ, setEcon] = useState(econStart)
  const total = Number(land) || 0
  const used = Object.values(ha).reduce((a, b) => a + b, 0)
  const g = mixProfit(ha, econ, rain, share)
  const R = (n: number) => `R${formatNumber(Math.round(n), 0, lang)}`
  const Rk = (n: number) => (Math.abs(n) >= 1_000_000 ? `R${formatNumber(n / 1_000_000, 2, lang)}m` : `R${formatNumber(n / 1000, 0, lang)}k`)
  const perHa = econ.map((e) => {
    const y = yieldScenarios(e.crop, rain, share)
    return { crop: e.crop, dry: (y.dry ?? 0) * e.price.likely - e.cost, normal: (y.normal ?? 0) * e.price.likely - e.cost }
  })
  const safest = [...perHa].sort((a, b) => b.dry - a.dry)[0]
  const best = [...perHa].sort((a, b) => b.normal - a.normal)[0]
  const setPrice = (crop: string, v: string) => setEcon(econ.map((e) => {
    if (e.crop !== crop) return e
    const n = numOrNull(v) ?? 0
    const f = e.price.likely ? n / e.price.likely : 1
    return { ...e, price: { low: e.price.low * f, likely: n, high: e.price.high * f } }
  }))
  return (
    <section className="card stack">
      <h2>🧮 {t('mix_title', { year })}</h2>
      <p className="tiny muted">{t('mix_note')}</p>
      <label>{t('mix_land')}<input inputMode="decimal" value={land} onChange={(e) => setLand(e.target.value)} /></label>
      <div className="mix-rows">
        {econ.map((e) => (
          <div key={e.crop} className="mix-row">
            <div className="row-between"><strong>{w(e.crop)}</strong><span>{formatNumber(ha[e.crop] ?? 0, 0, lang)} ha</span></div>
            <input type="range" min={0} max={Math.max(total, ha[e.crop] ?? 0)} step={5} value={ha[e.crop] ?? 0} aria-label={w(e.crop)}
              onChange={(ev) => setHa({ ...ha, [e.crop]: Number(ev.target.value) })} />
          </div>
        ))}
      </div>
      {used > total ? <p className="warn-text small">{t('mix_over', { n: formatNumber(used - total, 0, lang) })}</p>
        : <p className="small muted">{t('mix_left', { n: formatNumber(total - used, 0, lang) })}</p>}
      <RangeKey />
      <RangeRows zero format={Rk} rows={(['dry', 'normal', 'wet'] as const).map((k) => ({ label: t(`ol_${k}` as DictKey), lo: g[k].low, mid: g[k].likely, hi: g[k].high }))} />
      <p className="small">{t('mix_safest', { crop: w(safest.crop), v: R(safest.dry) })} {t('mix_best', { crop: w(best.crop), v: R(best.normal) })}</p>
      <details>
        <summary className="small">{t('mix_figures')}</summary>
        <table className="table"><thead><tr><th /><th className="num">{t('mix_price')}</th><th className="num">{t('mix_cost')}</th></tr></thead>
          <tbody>{econ.map((e) => (
            <tr key={e.crop}><td>{w(e.crop)}{!e.own && <div className="tiny muted">{t('mix_guess')}</div>}</td>
              <td className="num"><input className="small-input" inputMode="decimal" value={Math.round(e.price.likely)} onChange={(ev) => setPrice(e.crop, ev.target.value)} /></td>
              <td className="num"><input className="small-input" inputMode="decimal" value={Math.round(e.cost)} onChange={(ev) => setEcon(econ.map((x) => (x.crop === e.crop ? { ...x, cost: numOrNull(ev.target.value) ?? 0 } : x)))} /></td></tr>
          ))}</tbody></table>
        <p className="tiny muted">{t('mix_figuresNote')}</p>
      </details>
      <button className="btn small" onClick={() => { setHa(startHa); setEcon(econStart); setLand(String(startLand)) }}>{t('mix_reset')}</button>
    </section>
  )
}

// Livestock outlook ---------------------------------------------------------------------------------

/** Large stock units per animal (1 LSU = a 450 kg animal), rough South African figures. */
export function lsuOf(species: string, cls: string | null) {
  if (species === 'sheep') return cls === 'lambs' ? 0.07 : cls === 'rams' ? 0.2 : 0.15
  if (species === 'goats') return cls === 'kids' ? 0.07 : 0.17
  if (species === 'cattle') return cls === 'calves' ? 0.35 : cls === 'bulls' ? 1.3 : cls === 'heifers' || cls === 'oxen' ? 0.75 : 1
  return 0.5
}

export function LivestockOutlookCard({ year, groups, estimates, settings, rain, isOwner }: {
  year: number; groups: Tables<'livestock_groups'>[]; estimates: Tables<'planning_estimates'>[]; settings: Tables<'farm_settings'> | null | undefined; rain: Rain; isOwner: boolean
}) {
  const { t, lang } = useI18n()
  const farmId = useFarmId()
  const qc = useQueryClient()
  const [f, setF] = useState<{ ha: string; per: string } | null>(null)
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('farm_settings').upsert({ farm_id: farmId, grazing_ha: numOrNull(f!.ha), ha_per_lsu: numOrNull(f!.per) })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['farm_settings'] }); setF(null) },
  })
  const n = (x: number) => formatNumber(Math.round(x), 0, lang)
  const R = (x: number) => `R${formatNumber(Math.round(x), 0, lang)}`
  const herds = estimates.filter((e) => e.kind === 'livestock' && e.weaning_pct).map((e) => {
    const females = groups.filter((g) => g.species === e.name && ['ewes', 'cows', 'does'].includes(g.class ?? '')).reduce((a, g) => a + g.quantity, 0)
    const pct = Number(e.weaning_pct)
    const young = { dry: (females * Math.max(0, pct - 15)) / 100, normal: (females * pct) / 100, wet: (females * (pct + 5)) / 100 }
    const wool = e.wool_kg_per_head && e.wool_price_per_kg ? females * Number(e.wool_kg_per_head) * Number(e.wool_price_per_kg) : 0
    const price = Number(e.price_per_head ?? 0)
    return { e, females, pct, young, income: { dry: young.dry * price + wool * 0.9, normal: young.normal * price + wool, wet: young.wet * price + wool } }
  }).filter((h) => h.females > 0)
  const lsu = groups.reduce((a, g) => a + g.quantity * lsuOf(g.species, g.class), 0)
  const perLsu = Number(settings?.ha_per_lsu ?? 0)
  const grazingHa = Number(settings?.grazing_ha ?? 0)
  const cap = perLsu && grazingHa ? { dry: (grazingHa / perLsu) * (rain.dry / rain.normal), normal: grazingHa / perLsu, wet: (grazingHa / perLsu) * (rain.wet / rain.normal) } : null
  // A large stock unit eats about 10 kg of dry feed a day; the gap is counted over the 6 driest months.
  const gapT = cap && lsu > cap.dry ? ((lsu - cap.dry) * 10 * 180) / 1000 : 0
  if (!herds.length && !groups.length) return null
  return (
    <section className="card stack">
      <h2>🐑 {t('ls_title', { year })}</h2>
      {herds.length > 0 && <RangeKey />}
      {herds.map((h) => (
        <div key={h.e.id} className="stack">
          <RangeRows format={n} rows={[{ label: t(h.e.name === 'cattle' ? 'ls_calves' : 'ls_lambs'), sub: t('ls_from', { n: n(h.females), pct: formatNumber(h.pct, 0, lang) }), lo: h.young.dry, mid: h.young.normal, hi: h.young.wet }]} />
          {isOwner && h.income.normal > 0 && <RangeRows format={(x) => `R${formatNumber(x / 1000, 0, lang)}k`} rows={[{ label: t('ls_income'), lo: h.income.dry, mid: h.income.normal, hi: h.income.wet }]} />}
        </div>
      ))}
      {herds.length > 0 && <p className="tiny muted">{t('ls_note')}</p>}
      {isOwner && (
        <div className="card-inset stack">
          <h3 className="h4">🌿 {t('ls_grazing')}</h3>
          <p className="small">{t('ls_lsu', { n: n(lsu) })}</p>
          {cap && f == null && (
            <>
              <RangeKey tick={t('ls_yourAnimals')} />
              <RangeRows format={n} rows={[{ label: t('ls_capacity'), lo: cap.dry, mid: cap.normal, hi: cap.wet, mark: lsu }]} />
              <p className="small">{lsu > cap.dry ? `⚠️ ${t('ls_gap', { n: n(lsu - cap.dry), t: n(gapT) })}` : `✓ ${t('ls_enough')}`}</p>
              <p className="tiny muted">{t('ls_capNote', { ha: n(grazingHa), per: formatNumber(perLsu, 1, lang) })} <button className="link-btn" onClick={() => setF({ ha: String(grazingHa), per: String(perLsu) })}>{t('edit')}</button></p>
            </>
          )}
          {(!cap || f != null) && (
            <form className="stack" onSubmit={(e) => { e.preventDefault(); save.mutate() }}>
              {!cap && f == null && <p className="small muted">{t('ls_setup')}</p>}
              <div className="grid2">
                <label>{t('ls_grazingHa')}<input inputMode="decimal" value={f?.ha ?? (grazingHa ? String(grazingHa) : '')} onChange={(e) => setF({ ha: e.target.value, per: f?.per ?? (perLsu ? String(perLsu) : '') })} /></label>
                <label>{t('ls_haPerLsu')}<input inputMode="decimal" value={f?.per ?? (perLsu ? String(perLsu) : '')} onChange={(e) => setF({ per: e.target.value, ha: f?.ha ?? (grazingHa ? String(grazingHa) : '') })} /></label>
              </div>
              <span className="hint">{t('ls_haPerLsuHint')}</span>
              <button className="btn small primary" disabled={save.isPending || !f}>{t('save')}</button>
              <ErrorText error={save.error} />
            </form>
          )}
          {herds.some((h) => h.income.normal > 0) && <p className="tiny muted">{R(herds.reduce((a, h) => a + h.income.normal, 0))} {t('ls_incomeTotal')}</p>}
        </div>
      )}
    </section>
  )
}

// Price alerts ----------------------------------------------------------------------------------

export function PriceAlertsCard({ series }: { series: { key: string; label: string; unit: string; now: number }[] }) {
  const { t, lang } = useI18n()
  const farmId = useFarmId()
  const qc = useQueryClient()
  const alerts = usePriceAlerts()
  const [f, setF] = useState({ series: series[0]?.key ?? '', direction: 'above', target: '' })
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('price_alerts').insert({ farm_id: farmId, series: f.series, direction: f.direction, target: numOrNull(f.target) ?? 0 })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['price_alerts'] }); setF({ ...f, target: '' }) },
  })
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('price_alerts').update({ deleted_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['price_alerts'] }),
  })
  const R = (n: number) => `R${formatNumber(Math.round(n), 0, lang)}`
  const chosen = series.find((s) => s.key === f.series)
  return (
    <section className="card stack">
      <h2>🔔 {t('pa_title')}</h2>
      <p className="tiny muted">{t('pa_note')}</p>
      <ul className="list">
        {(alerts.data ?? []).map((a) => {
          const s = series.find((x) => x.key === a.series)
          return (
            <li key={a.id} className="row">
              <span className="grow">{s?.label ?? a.series} {a.direction === 'above' ? '≥' : '≤'} <strong>{R(Number(a.target))}</strong>
                {s && <div className="tiny muted">{t('pa_now', { v: R(s.now) })}{s.unit}</div>}</span>
              <button className="btn small" onClick={() => remove.mutate(a.id)} aria-label={t('delete')}>✕</button>
            </li>
          )
        })}
      </ul>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); if (numOrNull(f.target)) add.mutate() }}>
        <div className="grid2">
          <label>{t('pa_what')}<select value={f.series} onChange={(e) => setF({ ...f, series: e.target.value })}>{series.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></label>
          <label>{t('pa_when')}<select value={f.direction} onChange={(e) => setF({ ...f, direction: e.target.value })}>
            <option value="above">{t('pa_above')}</option><option value="below">{t('pa_below')}</option></select></label>
        </div>
        <label>{t('pa_target')}<input inputMode="decimal" value={f.target} placeholder={chosen ? String(Math.round(chosen.now * (f.direction === 'above' ? 1.1 : 0.9))) : ''} onChange={(e) => setF({ ...f, target: e.target.value })} />
          {chosen && <span className="hint">{t('pa_now', { v: R(chosen.now) })}{chosen.unit}</span>}</label>
        <button className="btn primary" disabled={add.isPending || !numOrNull(f.target)}>+ {t('pa_add')}</button>
        <ErrorText error={add.error ?? remove.error ?? alerts.error} />
      </form>
    </section>
  )
}

// End-of-season scorecard ------------------------------------------------------------------------

export interface ScoreYear {
  year: number
  source: 'saved' | 'worked-out'
  madeMonth?: string
  rain?: { pred: Rain; actual: number }
  crops: { crop: string; pred: Rain; actual: number }[]
  money?: { plan: number; actual: number }
}

export function ScorecardCard({ years }: { years: ScoreYear[] }) {
  const { t, w, lang } = useI18n()
  const [pick, setPick] = useState(years[years.length - 1]?.year)
  const y = years.find((x) => x.year === pick) ?? years[years.length - 1]
  if (!y) return null
  const verdict = (pred: Rain, actual: number) => (actual < pred.dry ? t('sc_below') : actual > pred.wet ? t('sc_above') : t('sc_inside'))
  const mm = (n: number) => `${formatNumber(n, 0, lang)} mm`
  const tha = (n: number) => `${formatNumber(n, 1, lang)} t/ha`
  const Rk = (n: number) => `R${formatNumber(n / 1000, 0, lang)}k`
  const made = y.madeMonth ? new Intl.DateTimeFormat(lang === 'af' ? 'af-ZA' : 'en-ZA', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${y.madeMonth}-15T12:00:00Z`)) : ''
  return (
    <section className="card stack">
      <h2>🎯 {t('sc_title')}</h2>
      {years.length > 1 && (
        <div className="chips">{years.map((x) => <button key={x.year} className={`chip ${x.year === y.year ? 'on' : ''}`} onClick={() => setPick(x.year)}>{x.year}</button>)}</div>
      )}
      <p className="tiny muted">{y.source === 'saved' ? t('sc_saved', { when: made }) : t('sc_workedOut')}</p>
      <RangeKey tick={t('sc_happened')} />
      {y.rain && (
        <div>
          <RangeRows format={mm} rows={[{ label: t('sc_rain'), lo: y.rain.pred.dry, mid: y.rain.pred.normal, hi: y.rain.pred.wet, mark: y.rain.actual }]} />
          <p className="small">{t('sc_was', { v: mm(y.rain.actual) })} {verdict(y.rain.pred, y.rain.actual)}</p>
        </div>
      )}
      {y.crops.map((c) => (
        <div key={c.crop}>
          <RangeRows format={tha} rows={[{ label: w(c.crop), lo: c.pred.dry, mid: c.pred.normal, hi: c.pred.wet, mark: c.actual }]} />
          <p className="small">{t('sc_was', { v: tha(c.actual) })} {verdict(c.pred, c.actual)}</p>
        </div>
      ))}
      {y.money && (
        <p className="small">💰 {t('sc_money', { plan: Rk(y.money.plan), actual: Rk(y.money.actual) })}</p>
      )}
      {!y.crops.length && <p className="small muted">{t('sc_noHarvest')}</p>}
      <p className="tiny muted">{t('sc_note')}</p>
    </section>
  )
}
