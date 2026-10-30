import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorText, Loading } from '../../components/ui'
import { useFarm } from '../../farm/FarmProvider'
import { suggestedNextCrops } from '../../lib/calc/advice'
import { todayIso } from '../../lib/calc/dates'
import {
  achievedShare, autumnBreak, ensoAnalogs, ensoPhase, ensoTilt, gaugeFactor, GROWING, inRand, marginGrid, monthNormals,
  priceOutlook, rainByYear, rainStats, scaleRain, seasonSoFar, WATER_USE, yieldScenarios,
} from '../../lib/calc/outlook'
import { dailyRain } from '../../lib/calc/rain'
import { useRain } from '../../lib/farmRecords'
import { formatDateShort, formatNumber } from '../../lib/format'
import { useI18n, type DictKey } from '../../lib/i18n'
import { useAllCropRecords, usePlanningEstimates } from '../../lib/inventory'
import { useOpenTasks, useSeasons, useFields } from '../../lib/queries'
import { ok, useOutlook } from '../../lib/useOutlook'
import { useLivestockCalendar } from '../livestock/LivestockCalendar'
import { ChartCard, RecordedPredictedBars, RecordedPredictedLine, type BarRow, type LineRow } from './OutlookCharts'

// World price series shown, with what they tell the farm.
const MARKETS: { key: string; label: DictKey; crop?: string; per: 't' | 'kg' }[] = [
  { key: 'rapeseedOil', label: 'ol_mkt_canola', crop: 'canola', per: 't' },
  { key: 'wheat', label: 'ol_mkt_wheat', crop: 'wheat', per: 't' },
  { key: 'maize', label: 'ol_mkt_maize', per: 't' },
  { key: 'lamb', label: 'ol_mkt_lamb', per: 'kg' },
  { key: 'beef', label: 'ol_mkt_beef', per: 'kg' },
  { key: 'dap', label: 'ol_mkt_dap', per: 't' },
  { key: 'urea', label: 'ol_mkt_urea', per: 't' },
  { key: 'potash', label: 'ol_mkt_potash', per: 't' },
  { key: 'crude', label: 'ol_mkt_crude', per: 't' },
]

export function OutlookPage() {
  const { t, w, lang } = useI18n()
  const { isOwner } = useFarm()
  const today = todayIso()
  const thisYear = Number(today.slice(0, 4))
  const [year, setYear] = useState(thisYear)
  const outlook = useOutlook()
  const rainLog = useRain()
  const records = useAllCropRecords()
  const seasons = useSeasons()
  const fields = useFields()
  const estimates = usePlanningEstimates()
  const calendar = useLivestockCalendar()
  const tasks = useOpenTasks()

  if (outlook.isLoading) return <div className="page stack"><h1>🔮 {t('ol_title')}</h1><p className="muted">{t('ol_loading')}</p><Loading /></div>
  const climate = ok(outlook.data?.climate)
  const enso = ok(outlook.data?.enso)
  const markets = ok(outlook.data?.markets)
  const R = (n: number) => `R${formatNumber(Math.round(n), 0, lang)}`
  const mm = (n: number) => `${formatNumber(n, 0, lang)} mm`
  const pct = (n: number) => `${n > 0 ? '+' : ''}${formatNumber(n, 0, lang)}%`
  const monthName = (m: number) => new Intl.DateTimeFormat(lang === 'af' ? 'af-ZA' : 'en-ZA', { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, m, 15)))
  const md = (s: string) => new Intl.DateTimeFormat(lang === 'af' ? 'af-ZA' : 'en-ZA', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`2026-${s}T12:00:00Z`))

  // Weather history, scaled to the farm's own rain gauge where it has readings.
  let years = climate?.years ?? {}
  const gauge = (() => {
    if (!climate || !rainLog.data?.length) return { factor: 1, months: 0 }
    const byMonth = new Map<string, number>()
    for (const [d, v] of dailyRain(rainLog.data)) byMonth.set(d.slice(0, 7), (byMonth.get(d.slice(0, 7)) ?? 0) + v)
    const pairs = [...byMonth.entries()].map(([m, g]) => ({ month: m, gauge: g, satellite: years[m.slice(0, 4)]?.rain[Number(m.slice(5, 7)) - 1] ?? -1 })).filter((p) => p.satellite >= 0)
    return gaugeFactor(pairs)
  })()
  years = scaleRain(years, gauge.factor)
  const seasonRows = rainByYear(years)
  const stats = seasonRows.length ? rainStats(seasonRows) : null
  const normals = monthNormals(years)
  const breakDates = autumnBreak(years)
  const lastMonth = climate ? Number(climate.lastDate.slice(5, 7)) - 1 : 0
  const current = climate ? seasonSoFar((climate.currentYearRain ?? []).map((v) => v * gauge.factor), lastMonth, normals) : null

  // El Niño / La Niña: how this area did in each phase, and the forecast for the coming winter (May–July).
  const analogs = enso && seasonRows.length ? ensoAnalogs(seasonRows, enso.oni) : null
  const winterProb = enso?.probs.find((p) => p.season === 'MJJ') ?? enso?.probs[enso.probs.length - 1] ?? null
  const tilt = analogs && year > thisYear ? ensoTilt(analogs, winterProb) : null
  const lastOni = enso?.oni[enso.oni.length - 1]

  // Rain for the chosen year: this year = what fell plus the usual for the rest; next year = history, tilted by the outlook.
  const tiltF = (tilt ?? 100) / 100
  const yearRain = year === thisYear && current
    ? { dry: current.dry, normal: current.normal, wet: current.wet }
    : stats ? { dry: Math.round(stats.dry * tiltF), normal: Math.round(stats.normal * tiltF), wet: Math.round(stats.wet * tiltF) } : null

  // Crops: this year's plantings, or for next year the rotation suggestion per field.
  const { plantings = [], harvests = [] } = records.data ?? {}
  const seasonYear = new Map((seasons.data ?? []).map((s) => [s.id, s.year]))
  const ownResults = harvests.map((h) => {
    const p = plantings.find((x) => x.field_id === h.field_id && x.season_id === h.season_id)
    const y = h.season_id ? seasonYear.get(h.season_id) : undefined
    const gsr = y ? seasonRows.find((r) => r.year === y)?.mm : undefined
    return p && gsr && h.yield_per_ha ? { crop: p.crop, tPerHa: Number(h.yield_per_ha), seasonRainMm: gsr, year: y! } : null
  }).filter((x): x is { crop: string; tPerHa: number; seasonRainMm: number; year: number } => !!x)
  const share = achievedShare(ownResults)
  const fieldPlan: { field: string; crop: string; ha: number | null; planned: boolean }[] = []
  for (const f of fields.data ?? []) {
    const hist = plantings.filter((p) => p.field_id === f.id).map((p) => ({ year: seasonYear.get(p.season_id) ?? 0, crop: p.crop }))
    const now = hist.find((h) => h.year === year)
    if (now) fieldPlan.push({ field: f.name, crop: now.crop, ha: f.hectares, planned: true })
    else if (year > thisYear && hist.length) {
      const next = suggestedNextCrops(hist)[0]
      if (next) fieldPlan.push({ field: f.name, crop: next, ha: f.hectares, planned: false })
    }
  }
  const est = estimates.data ?? []
  const cropList = [...new Set([...fieldPlan.map((p) => p.crop), ...est.filter((e) => e.kind === 'crop').map((e) => e.name)])].filter((c) => WATER_USE[c])

  // Prices in Rand, and where they may go by harvest (December of the chosen year).
  const fx = markets?.fx ?? []
  const horizon = Math.max(1, (year - thisYear) * 12 + (11 - Number(today.slice(5, 7)) + 1))
  const priceRows = MARKETS.map((m) => {
    const s = markets?.series[m.key]
    if (!s || !s.points.length || s.points[s.points.length - 1][0] < `${thisYear - 1}`) return null
    const rand = inRand(s.points, fx)
    const o = priceOutlook(rand, horizon)
    return o ? { ...m, unit: s.unit.replace('$', 'R'), rand, o } : null
  }).filter((x): x is NonNullable<typeof x> => !!x)
  const priceFor = (crop: string) => {
    const e = est.find((x) => x.kind === 'crop' && x.name === crop)
    const m = priceRows.find((p) => p.crop === crop)
    const base = e?.price_per_t ? Number(e.price_per_t) : m ? m.o.last : null
    if (!base) return null
    const f = m?.o ?? { low: 0.85, likely: 1, high: 1.15 }
    return { low: base * f.low, likely: base * f.likely, high: base * f.high, own: !!e?.price_per_t }
  }

  const err = (p: unknown) => (p && typeof p === 'object' && 'error' in p ? String((p as { error: string }).error) : null)
  const sourceErrors = [err(outlook.data?.climate), err(outlook.data?.enso), err(outlook.data?.markets)].filter(Boolean)

  // Calendar for the chosen year.
  const cal = calendar.filter((c) => c.start.startsWith(String(year)))
  const yearTasks = (tasks.data ?? []).filter((x) => x.due_date?.startsWith(String(year)) && !x.group_id)

  return (
    <div className="page stack">
      <Link to="/menu" className="back">‹ {t('menu')}</Link>
      <h1>🔮 {t('ol_title')}</h1>
      <div className="segmented">
        {[thisYear, thisYear + 1].map((y) => <button key={y} className={year === y ? 'on' : ''} onClick={() => setYear(y)}>{y}</button>)}
      </div>
      <ErrorText error={outlook.error} />
      {sourceErrors.length > 0 && <p className="warning small">{t('ol_someMissing')} {sourceErrors.join(' · ')}</p>}

      {/* In short */}
      <section className="card stack">
        <h2>{t('ol_inShort', { year })}</h2>
        <ul className="bullets">
          {year === thisYear && current && stats && (
            <li>🌧️ {t('ol_sumRainNow', { soFar: mm(current.soFar), pct: Math.round((current.soFar / stats.normal) * 100), normal: mm(stats.normal) })}</li>
          )}
          {year > thisYear && yearRain && (
            <li>🌧️ {t('ol_sumRainNext', { dry: mm(yearRain.dry), normal: mm(yearRain.normal), wet: mm(yearRain.wet) })}{tilt != null && tilt !== 100 ? ` ${t('ol_sumTilt', { pct: tilt })}` : ''}</li>
          )}
          {lastOni && <li>🌊 {t(`ol_enso_${ensoPhase(lastOni.anom)}` as DictKey)} {winterProb ? t('ol_ensoWinter', { el: winterProb.elNino, neu: winterProb.neutral, la: winterProb.laNina }) : ''}</li>}
          {yearRain && cropList.slice(0, 3).map((c) => {
            const y = yieldScenarios(c, yearRain, share.share)
            const settled = y.dry === y.wet
            return <li key={c}>🌾 {settled
              ? t('ol_sumYieldDone', { crop: w(c), normal: formatNumber(y.normal, 2, lang) })
              : t('ol_sumYield', { crop: w(c), normal: formatNumber(y.normal, 2, lang), dry: formatNumber(y.dry, 2, lang), wet: formatNumber(y.wet, 2, lang) })}</li>
          })}
          {isOwner && priceRows.filter((p) => p.crop).map((p) => (
            <li key={p.key}>💰 {t('ol_sumPrice', { what: t(p.label), trend: pct(p.o.trendPerYear), last: pct(p.o.changeLastYear ?? 0) })}</li>
          ))}
          {year > thisYear && breakDates && <li>🌱 {t('ol_sumBreak', { usual: md(breakDates.usual), early: md(breakDates.early), late: md(breakDates.late) })}</li>}
          {stats && <li>📈 {stats.perDecade >= 0 ? t('ol_sumTrendUp', { n: mm(Math.abs(stats.perDecade)) }) : t('ol_sumTrendDown', { n: mm(Math.abs(stats.perDecade)) })}</li>}
        </ul>
        <p className="tiny muted">{t('ol_disclaimer')}</p>
      </section>

      {/* Growing-season rain, every year since 1981, with this / next year predicted */}
      {stats && yearRain && (
        <ChartCard title={t('ol_seasonRain')} note={t('ol_seasonRainNote', { years: stats.years })}
          chart={<RecordedPredictedBars format={(n) => formatNumber(n, 0, lang)} data={[
            ...seasonRows.filter((r) => r.year < year && !(year === thisYear + 1 && r.year === thisYear)).map((r): BarRow => ({ name: String(r.year), recorded: r.mm })),
            ...(year > thisYear && current ? [{ name: String(thisYear), predicted: current.normal, low: current.dry, high: current.wet }] : []),
            { name: String(year), predicted: yearRain.normal, low: yearRain.dry, high: yearRain.wet },
          ]} />}
          table={<table className="table"><tbody>
            <tr><td>{t('ol_dryYear')}</td><td className="num">{mm(stats.dry)}</td></tr>
            <tr><td>{t('ol_normalYear')}</td><td className="num">{mm(stats.normal)}</td></tr>
            <tr><td>{t('ol_wetYear')}</td><td className="num">{mm(stats.wet)}</td></tr>
            <tr><td>{t('ol_trend')}</td><td className="num">{pct(Math.round((stats.perDecade / stats.normal) * 100))} / 10 {t('ol_yearsWord')}</td></tr>
            {stats.recentVsEarlier != null && <tr><td>{t('ol_recentVsEarlier')}</td><td className="num">{pct(stats.recentVsEarlier)}</td></tr>}
            <tr><td>{t('ol_driest')}</td><td className="num">{stats.driest.map((d) => `${d.year} (${formatNumber(d.mm, 0, lang)})`).join(', ')}</td></tr>
            <tr><td>{t('ol_wettest')}</td><td className="num">{stats.wettest.map((d) => `${d.year} (${formatNumber(d.mm, 0, lang)})`).join(', ')}</td></tr>
            <tr><td><strong>{year} ({t('ol_predicted').toLowerCase()})</strong></td><td className="num"><strong>{mm(yearRain.normal)}</strong> ({formatNumber(yearRain.dry, 0, lang)}–{formatNumber(yearRain.wet, 0, lang)})</td></tr>
          </tbody></table>}
        />
      )}

      {/* Month by month for the chosen year */}
      {climate && (
        <ChartCard title={t('ol_monthRain', { year })} note={year === thisYear ? t('ol_monthRainNowNote') : t('ol_monthRainNextNote')}
          chart={<RecordedPredictedBars format={(n) => formatNumber(n, 0, lang)} data={normals.map((n, m): BarRow => {
            const done = year === thisYear && m < lastMonth
            const fell = (climate.currentYearRain?.[m] ?? 0) * gauge.factor
            return done
              ? { name: monthName(m), recorded: Math.round(fell) }
              : { name: monthName(m), predicted: n.rain != null ? Math.round(n.rain * (GROWING.includes(m) ? tiltF : 1)) : null, low: n.rainDry, high: n.rainWet }
          })} />}
          table={<table className="table"><thead><tr><th /><th className="num">{t('ol_rainUsual')}</th><th className="num">{t('ol_tmax')}</th><th className="num">{t('ol_tmin')}</th><th className="num">{t('ol_frost')}</th></tr></thead>
            <tbody>{normals.map((n) => (
              <tr key={n.month}><td>{monthName(n.month)}</td><td className="num">{n.rain ?? '–'} <span className="tiny muted">({n.rainDry}–{n.rainWet})</span></td>
                <td className="num">{n.tmax ?? '–'}°</td><td className="num">{n.tmin ?? '–'}°</td><td className="num">{n.frostChance ? `${n.frostChance}%` : '–'}</td></tr>
            ))}</tbody></table>}
        />
      )}

      {/* El Niño / La Niña */}
      {enso && analogs && (
        <ChartCard title={t('ol_ensoTitle')} legend={false}
          note={<>{t('ol_ensoNote')} {enso.issued ? `NOAA, ${enso.issued}.` : ''}</>}
          chart={<RecordedPredictedLine format={(n) => formatNumber(n, 1, lang)} data={[
            ...enso.oni.filter((o) => o.year >= thisYear - 4).map((o): LineRow => ({ name: `${o.season} ${String(o.year).slice(2)}`, recorded: o.anom })),
          ]} />}
          table={<>
            <table className="table"><thead><tr><th>{t('ol_season3')}</th><th className="num">{t('ol_laNina')}</th><th className="num">{t('ol_neutral')}</th><th className="num">{t('ol_elNino')}</th></tr></thead>
              <tbody>{enso.probs.map((p) => <tr key={p.season}><td>{p.season}</td><td className="num">{p.laNina}%</td><td className="num">{p.neutral}%</td><td className="num">{p.elNino}%</td></tr>)}</tbody></table>
            <table className="table"><thead><tr><th>{t('ol_inPastWinters')}</th><th className="num">{t('ol_years')}</th><th className="num">{t('ol_rainVsNormal')}</th></tr></thead>
              <tbody>{(['elNino', 'neutral', 'laNina'] as const).map((k) => <tr key={k}><td>{t(k === 'elNino' ? 'ol_elNino' : k === 'laNina' ? 'ol_laNina' : 'ol_neutral')}</td><td className="num">{analogs[k].years}</td><td className="num">{analogs[k].percentOfNormal != null ? `${analogs[k].percentOfNormal}%` : '–'}</td></tr>)}</tbody></table>
          </>}
        />
      )}
      {analogs && <p className="small muted">{t('ol_ensoLocal', { el: analogs.elNino.percentOfNormal ?? '–', la: analogs.laNina.percentOfNormal ?? '–' })}</p>}

      {/* Yields */}
      {yearRain && cropList.length > 0 && (
        <ChartCard title={t('ol_yieldTitle', { year })}
          note={share.from ? t('ol_yieldOwn', { n: share.from, pct: Math.round(share.share * 100) }) : t('ol_yieldDefault', { pct: Math.round(share.share * 100) })}
          chart={<RecordedPredictedBars format={(n) => formatNumber(n, 1, lang)} data={cropList.flatMap((c) => {
            const y = yieldScenarios(c, yearRain, share.share)
            const own = ownResults.filter((r) => r.crop === c).slice(-3).map((r): BarRow => ({ name: `${w(c)} ${r.year}`, recorded: r.tPerHa }))
            return [...own, { name: `${w(c)} ${year}`, predicted: y.normal, low: y.dry, high: y.wet }]
          })} />}
          table={<table className="table"><thead><tr><th>{t('crop')}</th><th className="num">{t('ol_dry')}</th><th className="num">{t('ol_normal')}</th><th className="num">{t('ol_wet')}</th></tr></thead>
            <tbody>{cropList.map((c) => {
              const y = yieldScenarios(c, yearRain, share.share)
              return <tr key={c}><td>{w(c)}</td><td className="num">{formatNumber(y.dry, 2, lang)} t/ha</td><td className="num"><strong>{formatNumber(y.normal, 2, lang)} t/ha</strong></td><td className="num">{formatNumber(y.wet, 2, lang)} t/ha</td></tr>
            })}</tbody></table>}
        />
      )}
      {year > thisYear && fieldPlan.length > 0 && (
        <section className="card">
          <h2>🔄 {t('ol_rotationTitle', { year })}</h2>
          <ul className="list">{fieldPlan.map((p) => <li key={p.field} className="row"><span className="grow">{p.field}</span><strong>{w(p.crop)}</strong>{!p.planned && <span className="tiny muted"> {t('ol_suggested')}</span>}</li>)}</ul>
          <p className="tiny muted">{t('rotationDisclaimer')}</p>
        </section>
      )}

      {/* Markets (owners) */}
      {isOwner && priceRows.length > 0 && (
        <ChartCard title={t('ol_marketsTitle')}
          note={<>{t('ol_marketsNote')} {markets?.updated ? `World Bank, ${markets.updated}.` : ''}</>}
          chart={<div className="stack">{priceRows.filter((p) => ['rapeseedOil', 'wheat', 'lamb', 'dap'].includes(p.key)).map((p) => {
            const hist = p.rand.slice(-60)
            const last = hist[hist.length - 1]
            const [yy, mm2] = last[0].split('-').map(Number)
            // Month by month to harvest, so the forecast takes as much room on the chart as the time it covers.
            const ahead = Array.from({ length: horizon }, (_, i): LineRow => {
              const f = (i + 1) / horizon
              const at = (x: number) => last[1] * Math.pow(x, f)
              return { name: new Date(Date.UTC(yy, mm2 - 1 + i + 1, 1)).toISOString().slice(0, 7), predicted: at(p.o.likely), low: at(p.o.low), high: at(p.o.high) }
            })
            return (
              <div key={p.key}>
                <h3 className="h4">{t(p.label)} <span className="tiny muted">({p.unit})</span></h3>
                <RecordedPredictedLine height={180} format={(n) => R(n)} data={[
                  ...hist.slice(0, -1).map(([m, v]): LineRow => ({ name: m, recorded: v })),
                  { name: last[0], recorded: last[1], predicted: last[1], low: last[1], high: last[1] },
                  ...ahead,
                ]} />
              </div>
            )
          })}</div>}
          table={<table className="table"><thead><tr><th /><th className="num">{t('ol_now')}</th><th className="num">{t('ol_lastYear')}</th><th className="num">{t('ol_trend5')}</th><th className="num">{t('ol_byHarvest', { year })}</th></tr></thead>
            <tbody>{priceRows.map((p) => (
              <tr key={p.key}><td>{t(p.label)}<div className="tiny muted">{p.unit}</div></td><td className="num">{R(p.o.last)}</td><td className="num">{p.o.changeLastYear != null ? pct(p.o.changeLastYear) : '–'}</td>
                <td className="num">{pct(p.o.trendPerYear)} {t('ol_perYear')}</td><td className="num">{R(p.o.last * p.o.likely)}<div className="tiny muted">{R(p.o.last * p.o.low)}–{R(p.o.last * p.o.high)}</div></td></tr>
            ))}</tbody></table>}
        />
      )}

      {/* Profit (owners) */}
      {isOwner && yearRain && cropList.map((c) => {
        const price = priceFor(c)
        const e = est.find((x) => x.kind === 'crop' && x.name === c)
        if (!price || !e?.input_cost_per_ha) return null
        const ha = fieldPlan.filter((p) => p.crop === c).reduce((s, p) => s + Number(p.ha ?? 0), 0) || 1
        const y = yieldScenarios(c, yearRain, share.share)
        const g = marginGrid(ha, y, price, Number(e.input_cost_per_ha))
        return (
          <ChartCard key={c} title={t('ol_profitTitle', { crop: w(c), year })}
            note={ha > 1 ? t('ol_profitNoteHa', { ha: formatNumber(ha, 0, lang), cost: R(Number(e.input_cost_per_ha)), price: price.own ? t('ol_yourPrice') : t('ol_worldPrice') }) : t('ol_profitNotePerHa', { cost: R(Number(e.input_cost_per_ha)) })}
            chart={<RecordedPredictedBars format={(n) => R(n)} data={(['dry', 'normal', 'wet'] as const).map((k): BarRow => ({ name: t(`ol_${k}` as DictKey), predicted: g[k].likely, low: g[k].low, high: g[k].high }))} />}
            table={<table className="table"><thead><tr><th /><th className="num">{t('ol_priceLow')}<div className="tiny muted">{R(price.low)}/t</div></th><th className="num">{t('ol_priceLikely')}<div className="tiny muted">{R(price.likely)}/t</div></th><th className="num">{t('ol_priceHigh')}<div className="tiny muted">{R(price.high)}/t</div></th></tr></thead>
              <tbody>{(['dry', 'normal', 'wet'] as const).map((k) => (
                <tr key={k}><td>{t(`ol_${k}` as DictKey)}<div className="tiny muted">{formatNumber(y[k], 2, lang)} t/ha</div></td>
                  {(['low', 'likely', 'high'] as const).map((p) => <td key={p} className={`num ${(g[k][p] ?? 0) < 0 ? 'warn-text' : ''}`}>{g[k][p] != null ? R(g[k][p]!) : '–'}</td>)}</tr>
              ))}</tbody></table>}
          />
        )
      })}

      {/* Calendar */}
      {(cal.length > 0 || yearTasks.length > 0 || (year > thisYear && breakDates)) && (
        <section className="card">
          <h2>📅 {t('ol_calendarTitle', { year })}</h2>
          <ul className="list">
            {year > thisYear && breakDates && <li className="row"><span className="grow">🌱 {t('ol_breakWindow')}</span><span className="small">{md(breakDates.early)} – {md(breakDates.late)}</span></li>}
            {year > thisYear && normals.some((n) => (n.frostChance ?? 0) >= 20) && (
              <li className="row"><span className="grow">❄️ {t('ol_frostMonths')}</span><span className="small">{normals.filter((n) => (n.frostChance ?? 0) >= 20).map((n) => monthName(n.month)).join(', ')}</span></li>
            )}
            {[...cal.map((c) => ({ key: c.key, date: c.start, text: `${t(`cal_${c.kind}` as DictKey)}: ${c.title}` })), ...yearTasks.map((x) => ({ key: x.id, date: x.due_date!, text: x.title }))]
              .sort((a, b) => a.date.localeCompare(b.date)).map((c) => (
                <li key={c.key} className="row"><span className="grow small">{c.text}</span><span className="small muted">{formatDateShort(c.date, lang)}</span></li>
              ))}
          </ul>
        </section>
      )}

      {gauge.months >= 2 && <p className="tiny muted">{t('ol_gaugeScaled', { n: gauge.months, pct: Math.round(gauge.factor * 100) })}</p>}
      {gauge.months < 2 && <p className="tiny muted">{t('ol_gaugeTip')}</p>}
      <p className="tiny muted">{t('ol_sources')}</p>
    </div>
  )
}
