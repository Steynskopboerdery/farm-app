// Charts for the Prediction tab: what was recorded in blue (series 1), what is predicted in orange (series 2),
// with the likely range as error bars or a pale orange band. Every chart has a table view.
import { useState, type ReactNode } from 'react'
import { Area, Bar, CartesianGrid, ComposedChart, ErrorBar, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useI18n } from '../../lib/i18n'
import { SERIES } from '../reports/Chart'

export const RECORDED = SERIES[0]
export const PREDICTED = SERIES[1]
const GRID = '#e6ebe2'
const AXIS = { fontSize: 12, fill: '#55645a' }
const TIP = { borderRadius: 12, border: '1px solid #e1e7dc' }

/** A card that shows a chart first, with a button to see the same numbers as a table. */
export function ChartCard({ title, note, chart, table, legend = true }: { title: string; note?: ReactNode; chart: ReactNode; table: ReactNode; legend?: boolean }) {
  const { t } = useI18n()
  const [asTable, setAsTable] = useState(false)
  return (
    <section className="card report">
      <div className="card-head">
        <h2>{title}</h2>
        <button className="btn small" onClick={() => setAsTable(!asTable)}>{asTable ? `📊 ${t('showGraph')}` : `▦ ${t('showTable')}`}</button>
      </div>
      {note && <p className="tiny muted">{note}</p>}
      {asTable ? <div className="table-wrap">{table}</div> : (
        <>
          {legend && <KeyRow />}
          <div className="chart-box">{chart}</div>
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
export function RecordedPredictedBars({ data, format, height = 260 }: { data: BarRow[]; format: (n: number) => string; height?: number }) {
  const { t } = useI18n()
  // ErrorBar wants the distance below / above the bar.
  const rows = data.map((r) => ({ ...r, err: r.predicted != null && r.low != null && r.high != null ? [r.predicted - r.low, r.high - r.predicted] : undefined }))
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap="-100%" barCategoryGap="18%">
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="name" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} interval="preserveStartEnd" minTickGap={8} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={60} domain={[0, 'auto']} tickFormatter={(v: number) => format(v)} />
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
export function RecordedPredictedLine({ data, format, height = 240 }: { data: LineRow[]; format: (n: number) => string; height?: number }) {
  const { t } = useI18n()
  const rows = data.map((r) => ({ ...r, band: r.low != null && r.high != null ? [r.low, r.high] : undefined }))
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="name" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} interval="preserveStartEnd" minTickGap={24} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={64} domain={['auto', 'auto']} tickFormatter={(v: number) => format(v)} />
        <Tooltip contentStyle={TIP}
          formatter={(v, name) => (Array.isArray(v) ? [`${format(Number(v[0]))}–${format(Number(v[1]))}`, name] : [format(Number(v)), name])} />
        <Area dataKey="band" name={t('ol_range')} stroke="none" fill={PREDICTED} fillOpacity={0.18} isAnimationActive={false} />
        <Line dataKey="recorded" name={t('ol_recorded')} stroke={RECORDED} strokeWidth={2} dot={false} isAnimationActive={false} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} connectNulls={false} />
        <Line dataKey="predicted" name={t('ol_predicted')} stroke={PREDICTED} strokeWidth={2} strokeDasharray="6 4" isAnimationActive={false} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff', fill: PREDICTED }} connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
