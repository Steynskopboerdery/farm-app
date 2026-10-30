// Charts for the Prediction tab: what was recorded in blue (series 1), what is predicted in orange (series 2),
// with the likely range as error bars or a pale orange band. Every chart has a table view.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Area, Bar, CartesianGrid, ComposedChart, ErrorBar, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useI18n } from '../../lib/i18n'
import { SERIES } from '../reports/Chart'

export const RECORDED = SERIES[0]
export const PREDICTED = SERIES[1]
const GRID = '#e6ebe2'
const AXIS = { fontSize: 12, fill: '#55645a' }
const TIP = { borderRadius: 12, border: '1px solid #e1e7dc' }

/** One way of looking at a chart (e.g. "Recent" / "All years"); a minWidth makes it scroll sideways. */
export interface ChartView { label: string; chart: ReactNode; minWidth?: number }

/** A card that shows a chart first, with buttons to change the time span and to see the numbers as a table. */
export function ChartCard({ title, note, chart, table, legend = true }: { title: string; note?: ReactNode; chart: ReactNode | ChartView[]; table: ReactNode; legend?: boolean }) {
  const { t } = useI18n()
  const [asTable, setAsTable] = useState(false)
  const views = Array.isArray(chart) ? chart : [{ label: '', chart }]
  const [view, setView] = useState(0)
  const current = views[Math.min(view, views.length - 1)]
  // A wide chart opens scrolled to the newest years (on the right).
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => { if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth }, [view, asTable])
  return (
    <section className="card report">
      <div className="card-head">
        <h2>{title}</h2>
        <button className="btn small" onClick={() => setAsTable(!asTable)}>{asTable ? `📊 ${t('showGraph')}` : `▦ ${t('showTable')}`}</button>
      </div>
      {note && <p className="tiny muted">{note}</p>}
      {asTable ? <div className="table-wrap">{table}</div> : (
        <>
          {views.length > 1 && (
            <div className="chips span-chips" role="tablist">
              {views.map((v, i) => <button key={v.label} role="tab" aria-selected={i === view} className={`chip ${i === view ? 'on' : ''}`} onClick={() => setView(i)}>{v.label}</button>)}
            </div>
          )}
          {legend && <KeyRow />}
          {current.minWidth ? (
            <div className="chart-scroll" ref={scroller}><div className="chart-box" style={{ minWidth: current.minWidth }}>{current.chart}</div></div>
          ) : <div className="chart-box">{current.chart}</div>}
          {current.minWidth ? <p className="tiny muted center">{t('ol_swipe')}</p> : null}
        </>
      )}
    </section>
  )
}

/** "Recorded / Predicted" key, always shown above the chart so colour is never the only clue. */
export function KeyRow() {
  const { t } = useI18n()
  return (
    <div className="chart-key">
      <span><i style={{ background: RECORDED }} /> {t('ol_recorded')}</span>
      <span><i style={{ background: PREDICTED }} /> {t('ol_predicted')}</span>
      <span><i className="band" /> {t('ol_range')}</span>
    </div>
  )
}

export interface BarRow { name: string; recorded?: number | null; predicted?: number | null; low?: number | null; high?: number | null }

/** Bars: recorded values in blue, predicted ones in orange with a low–high whisker. */
export function RecordedPredictedBars({ data, format, axis = format, height = 260, max, hideAxis = false }: { data: BarRow[]; format: (n: number) => string; axis?: (n: number) => string; height?: number; max?: number; hideAxis?: boolean }) {
  const { t } = useI18n()
  // ErrorBar wants the distance below / above the bar.
  const rows = data.map((r) => ({ ...r, err: r.predicted != null && r.low != null && r.high != null ? [r.predicted - r.low, r.high - r.predicted] : undefined }))
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap="-100%" barCategoryGap="18%">
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="name" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} interval="preserveStartEnd" minTickGap={8} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={hideAxis ? 0 : 52} hide={hideAxis} domain={[0, max ?? 'auto']} ticks={max ? quarters(max) : undefined} tickCount={5} tickFormatter={(v: number) => axis(v)} />
        <Tooltip contentStyle={TIP} cursor={{ fill: 'rgba(20,83,45,.06)' }}
          formatter={(v, name, item) => {
            const p = item.payload as BarRow
            if (name === t('ol_predicted') && p.low != null && p.high != null) return [`${format(Number(v))} (${format(p.low)}–${format(p.high)})`, name]
            return [format(Number(v)), name]
          }} />
        <Legend wrapperStyle={{ display: 'none' }} />
        <Bar dataKey="recorded" name={t('ol_recorded')} fill={RECORDED} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
        <Bar dataKey="predicted" name={t('ol_predicted')} fill={PREDICTED} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false}>
          <ErrorBar dataKey="err" width={6} strokeWidth={2} stroke="#8a3a12" direction="y" />
        </Bar>
      </ComposedChart>
    </ResponsiveContainer>
  )
}

export interface LineRow { name: string; recorded?: number | null; predicted?: number | null; low?: number | null; high?: number | null }

/** Line: recorded history in blue; the forecast in dashed orange with a pale orange band for the likely range. */
export function RecordedPredictedLine({ data, format, axis = format, height = 240 }: { data: LineRow[]; format: (n: number) => string; axis?: (n: number) => string; height?: number }) {
  const { t } = useI18n()
  const rows = data.map((r) => ({ ...r, band: r.low != null && r.high != null ? [r.low, r.high] : undefined }))
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="name" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} interval="preserveStartEnd" minTickGap={24} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={52} domain={['auto', 'auto']} tickCount={5} tickFormatter={(v: number) => axis(v)} />
        <Tooltip contentStyle={TIP}
          formatter={(v, name) => (Array.isArray(v) ? [`${format(Number(v[0]))}–${format(Number(v[1]))}`, name] : [format(Number(v)), name])} />
        <Area dataKey="band" name={t('ol_range')} stroke="none" fill={PREDICTED} fillOpacity={0.18} isAnimationActive={false} />
        <Line dataKey="recorded" name={t('ol_recorded')} stroke={RECORDED} strokeWidth={2} dot={false} isAnimationActive={false} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} connectNulls={false} />
        <Line dataKey="predicted" name={t('ol_predicted')} stroke={PREDICTED} strokeWidth={2} strokeDasharray="6 4" isAnimationActive={false} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff', fill: PREDICTED }} connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

/** A round top for a scale of 4 equal steps (e.g. 500 = 0 / 125 / 250 / 375 / 500), at or above n. */
const niceMax = (n: number) => {
  if (!(n > 0)) return 4
  const raw = (n * 1.05) / 4
  const pow = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((x) => x >= raw)!
  return step * 4
}
const quarters = (max: number) => [0, max / 4, max / 2, (max * 3) / 4, max]

/** Many bars: the bars scroll sideways while the scale stays put on the left. Opens at the newest (right) end. */
export function ScrollingBars({ data, format, axis = format, height = 260, barWidth = 26 }: { data: BarRow[]; format: (n: number) => string; axis?: (n: number) => string; height?: number; barWidth?: number }) {
  const { t } = useI18n()
  const max = niceMax(Math.max(...data.map((r) => Math.max(r.recorded ?? 0, r.predicted ?? 0, r.high ?? 0))))
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => { if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth }, [data.length])
  return (
    <>
      <div className="scroll-chart">
        <div className="scroll-axis">
          <ResponsiveContainer width="100%" height={height}>
            <ComposedChart data={[{ name: '', v: 0 }]} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
              <YAxis tick={AXIS} tickLine={false} axisLine={false} width={52} domain={[0, max]} ticks={quarters(max)} tickFormatter={(v: number) => axis(v)} />
              <XAxis dataKey="name" tick={false} axisLine={false} tickLine={false} />
              {/* Invisible: the chart library draws a scale only when the chart has something in it. */}
              <Bar dataKey="v" fill="transparent" isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-scroll" ref={scroller}>
          <div style={{ minWidth: data.length * barWidth }}>
            <RecordedPredictedBars data={data} format={format} axis={axis} height={height} max={max} hideAxis />
          </div>
        </div>
      </div>
      <p className="tiny muted center">{t('ol_swipe')}</p>
    </>
  )
}
