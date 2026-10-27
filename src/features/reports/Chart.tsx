// Shared chart look, following the app's chart rules: thin bars with 4px rounded tops, 2px lines,
// hairline grid, one axis, legend for 2+ series, a tooltip on hover/tap, and a table next to every chart.
import type { ReactNode } from 'react'
import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useI18n } from '../../lib/i18n'

// Validated categorical order (colour-blind safe as neighbours); always used in this order, never cycled.
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948']
const GRID = '#e6ebe2'
const AXIS = { fontSize: 12, fill: '#55645a' }
// Long names are shortened under the bars; the tooltip shows them in full.
const shortTick = (v: string) => (String(v).length > 11 ? `${String(v).slice(0, 10)}…` : String(v))

export interface SeriesDef { key: string; label: string }

export function ReportCard({ title, note, table, chart }: { title: string; note?: string; table: ReactNode; chart?: ReactNode }) {
  const { t } = useI18n()
  const [graph, setGraph] = useState(false)
  return (
    <section className="card report">
      <div className="card-head">
        <h2>{title}</h2>
        {chart && <button className="btn small" onClick={() => setGraph(!graph)}>{graph ? `▦ ${t('showTable')}` : `📊 ${t('showGraph')}`}</button>}
      </div>
      {note && <p className="tiny muted">{note}</p>}
      {graph && chart ? <div className="chart-box">{chart}</div> : <div className="table-wrap">{table}</div>}
    </section>
  )
}

export function BarsChart({ data, x, series, stacked = false, format, height = 260 }: {
  data: Record<string, unknown>[]; x: string; series: SeriesDef[]; stacked?: boolean; format: (n: number) => string; height?: number
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="22%">
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey={x} tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} interval={0} tickFormatter={shortTick} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={64} domain={[0, 'auto']} tickFormatter={(v: number) => format(v)} />
        <Tooltip formatter={(v) => format(Number(v))} cursor={{ fill: 'rgba(20,83,45,.06)' }} contentStyle={{ borderRadius: 12, border: '1px solid #e1e7dc' }} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 13 }} iconType="circle" />}
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={SERIES[i]} maxBarSize={24}
            stackId={stacked ? 'a' : undefined}
            radius={stacked ? (i === series.length - 1 ? [4, 4, 0, 0] : 0) : [4, 4, 0, 0]}
            stroke={stacked ? '#fff' : undefined} strokeWidth={stacked ? 2 : 0} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

export function LinesChart({ data, x, series, format, height = 260 }: {
  data: Record<string, unknown>[]; x: string; series: SeriesDef[]; format: (n: number) => string; height?: number
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey={x} tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={56} domain={[0, 'auto']} tickFormatter={(v: number) => format(v)} />
        <Tooltip formatter={(v) => format(Number(v))} contentStyle={{ borderRadius: 12, border: '1px solid #e1e7dc' }} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 13 }} iconType="circle" />}
        {series.map((s, i) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={SERIES[i]} strokeWidth={2}
            dot={{ r: 4, strokeWidth: 2, stroke: '#fff', fill: SERIES[i] }} activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
