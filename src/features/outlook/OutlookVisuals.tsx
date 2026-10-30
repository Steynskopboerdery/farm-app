// Easier-to-read prediction pictures, in the styles weather services and farm advisers use:
// big numbers with a range strip, range bars, a "chance of at least" ladder, dry / normal / wet odds,
// rain building up through the season, and price fans that widen the further ahead they look.
import type { ReactNode } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useI18n } from '../../lib/i18n'
import { PREDICTED, RECORDED, useSixMonthAxis } from './OutlookCharts'

const GRID = '#e6ebe2'
const AXIS = { fontSize: 13, fill: '#55645a' }
const TIP = { borderRadius: 12, border: '1px solid #e1e7dc', fontSize: 14 }
const NORMAL = '#7d8a80'

/** A scale with some room around the range (and around 0 when asked), as percentages along a strip. */
function scale(values: number[], withZero = false) {
  const vs = withZero ? [...values, 0] : values
  let min = Math.min(...vs)
  let max = Math.max(...vs)
  const pad = (max - min || Math.abs(max) || 1) * 0.12
  min = withZero && min >= 0 ? 0 : min - pad
  max += pad
  return (v: number) => Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100))
}

/** Key for range strips: dot = likely, pale bar = range, blue tick = a recorded value. */
export function RangeKey({ tick }: { tick?: string }) {
  const { t } = useI18n()
  return (
    <div className="chart-key">
      <span><i className="dot" style={{ background: PREDICTED }} /> {t('ol_likely')}</span>
      <span><i className="band" /> {t('ol_range')}</span>
      {tick && <span><i className="tick" style={{ background: RECORDED }} /> {tick}</span>}
    </div>
  )
}

export interface BigNumber { title: string; value: string; range: string; lo: number; mid: number; hi: number; mark?: number; markLabel?: string; done?: string }

/** One card per prediction: the likely value in large type, the range under it, and a strip to show where it sits. */
export function BigNumbers({ cards }: { cards: BigNumber[] }) {
  const { t } = useI18n()
  return (
    <div className="big-grid">
      {cards.map((c) => {
        const at = scale([c.lo, c.hi, ...(c.mark != null ? [c.mark] : [])])
        return (
          <div key={c.title} className="big">
            <span className="t">{c.title}</span>
            <span className="n">{c.value}</span>
            {c.lo === c.hi ? <span className="r">{c.done ?? ''}</span> : (
              <>
                <span className="r">{t('ol_likelyRange', { range: c.range })}</span>
                <div className="strip" aria-hidden>
                  <div className="fill" style={{ left: `${at(c.lo)}%`, width: `${at(c.hi) - at(c.lo)}%` }} />
                  {c.mark != null && <div className="mark" style={{ left: `${at(c.mark)}%` }} />}
                  <div className="dot" style={{ left: `${at(c.mid)}%` }} />
                </div>
                {c.markLabel && <span className="r"><i className="tick-i" /> {c.markLabel}</span>}
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

export interface RangeRow { label: string; sub?: string; lo: number; mid: number; hi: number; mark?: number }

/** Range bars: one row each, all on the same scale so they can be compared. Figures sit on the bar. */
export function RangeRows({ rows, format, zero = false }: { rows: RangeRow[]; format: (n: number) => string; zero?: boolean }) {
  const { t } = useI18n()
  const at = scale(rows.flatMap((r) => [r.lo, r.hi, ...(r.mark != null ? [r.mark] : [])]), zero)
  return (
    <div className="range-rows">
      {rows.map((r) => (
        <div key={r.label} className="range-row">
          <div className="range-label"><strong>{r.label}</strong>{r.sub && <span className="tiny muted"> {r.sub}</span>}<span className="range-mid">{format(r.mid)}</span></div>
          <div className="strip big-strip" aria-hidden>
            {zero && <div className="zero" style={{ left: `${at(0)}%` }} />}
            <div className="fill" style={{ left: `${at(r.lo)}%`, width: `${Math.max(1, at(r.hi) - at(r.lo))}%` }} />
            {r.mark != null && <div className="mark" style={{ left: `${at(r.mark)}%` }} />}
            <div className="dot" style={{ left: `${at(r.mid)}%` }} />
          </div>
          {r.lo !== r.hi && <div className="range-ends">{t('ol_rangeText', { range: `${format(r.lo)} – ${format(r.hi)}` })}</div>}
        </div>
      ))}
    </div>
  )
}

/** "Chance of at least": how often each amount is reached, from the safest (9 years in 10) to the best (1 in 10). */
export function ChanceLadder({ rungs, format }: { rungs: { chance: number; value: number }[]; format: (n: number) => string }) {
  const { t } = useI18n()
  return (
    <div className="ladder">
      <div className="rung head"><span>{t('ol_chance')}</span><span /><span>{t('ol_atLeast')}</span></div>
      {rungs.map((r) => (
        <div key={r.chance} className="rung">
          <span>{r.chance === 10 ? t('ol_yearIn10') : t('ol_yearsIn10', { n: r.chance / 10 })}</span>
          <div className={`bar ${r.chance === 50 ? '' : 'soft'}`} style={{ width: `${r.chance}%` }} />
          <strong>{format(r.value)}</strong>
        </div>
      ))}
    </div>
  )
}

/** One bar split into drier / normal / wetter. In an average year each part is a third. */
export function OddsBar({ drier, normal, wetter }: { drier: number; normal: number; wetter: number }) {
  const { t } = useI18n()
  const part = (k: string, p: number, label: string) => (
    <div className={k} style={{ flexGrow: Math.max(p, 4) }}><strong>{p}%</strong><span>{label}</span></div>
  )
  return (
    <>
      <div className="odds" role="img" aria-label={`${t('ol_drier')} ${drier}%, ${t('ol_normal')} ${normal}%, ${t('ol_wetter')} ${wetter}%`}>
        {part('dry', drier, t('ol_drier'))}
        {part('norm', normal, t('ol_normalShort'))}
        {part('wet', wetter, t('ol_wetter'))}
      </div>
      <div className="odds-even" aria-hidden><span /><span /></div>
      <p className="tiny muted center">{t('ol_oddsEven')}</p>
    </>
  )
}

export interface BuildUpRow { name: string; band: [number, number]; normal: number; recorded?: number | null; predicted?: number | null }

/** Rain adding up through the season, against a normal season (grey) and the usual dry–wet spread (shaded). */
export function SeasonBuildUp({ data, format, footer }: { data: BuildUpRow[]; format: (n: number) => string; footer?: ReactNode }) {
  const { t } = useI18n()
  return (
    <>
      <div className="chart-key">
        <span><i style={{ background: RECORDED }} /> {t('ol_soFarKey')}</span>
        <span><i style={{ background: PREDICTED }} /> {t('ol_predicted')}</span>
        <span><i style={{ background: NORMAL }} /> {t('ol_normalSeason')}</span>
        <span><i className="band blue" /> {t('ol_dryToWet')}</span>
      </div>
      <ResponsiveContainer width="100%" height={250}>
        <ComposedChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="name" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} interval={0} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} tickCount={5} />
          <Tooltip contentStyle={TIP} formatter={(v, name) => (Array.isArray(v) ? [`${format(Number(v[0]))}–${format(Number(v[1]))}`, name] : [format(Number(v)), name])} />
          <Area dataKey="band" name={t('ol_dryToWet')} stroke="none" fill={RECORDED} fillOpacity={0.1} isAnimationActive={false} />
          <Line dataKey="normal" name={t('ol_normalSeason')} stroke={NORMAL} strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line dataKey="recorded" name={t('ol_soFarKey')} stroke={RECORDED} strokeWidth={3} dot={false} isAnimationActive={false} connectNulls={false} />
          <Line dataKey="predicted" name={t('ol_predicted')} stroke={PREDICTED} strokeWidth={3} strokeDasharray="7 5" dot={false} isAnimationActive={false} connectNulls={false} />
        </ComposedChart>
      </ResponsiveContainer>
      {footer}
    </>
  )
}

export interface FanRow { name: string; recorded?: number | null; predicted?: number | null; inner?: [number, number]; outer?: [number, number] }

/** Price fan: history in blue, then a band that widens the further ahead it looks (dark = 2 years in 3, pale = 9 in 10). */
export function PriceFan({ data, today, format, axis = format, height = 210 }: { data: FanRow[]; today: string; format: (n: number) => string; axis?: (n: number) => string; height?: number }) {
  const { t } = useI18n()
  const time = useSixMonthAxis(data.map((r) => r.name))
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 18, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        {time.lines}
        <XAxis dataKey="name" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} {...time.xAxis} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={56} domain={['auto', 'auto']} tickCount={5} tickFormatter={(v: number) => axis(v)} />
        <Tooltip contentStyle={TIP} labelFormatter={time.tipLabel} formatter={(v, name) => (Array.isArray(v) ? [`${format(Number(v[0]))}–${format(Number(v[1]))}`, name] : [format(Number(v)), name])} />
        <Area dataKey="outer" name={t('ol_fanOuter')} stroke="none" fill={PREDICTED} fillOpacity={0.12} isAnimationActive={false} />
        <Area dataKey="inner" name={t('ol_fanInner')} stroke="none" fill={PREDICTED} fillOpacity={0.24} isAnimationActive={false} />
        <ReferenceLine x={today} stroke={NORMAL} strokeDasharray="3 3" label={{ value: t('ol_today'), position: 'top', fontSize: 13, fill: '#55645a' }} />
        <Line dataKey="recorded" name={t('ol_recorded')} stroke={RECORDED} strokeWidth={2.5} dot={false} isAnimationActive={false} connectNulls={false} />
        <Line dataKey="predicted" name={t('ol_likely')} stroke={PREDICTED} strokeWidth={2.5} strokeDasharray="7 5" dot={false} isAnimationActive={false} connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

/** Key for price fans. */
export function FanKey() {
  const { t } = useI18n()
  return (
    <div className="chart-key">
      <span><i style={{ background: RECORDED }} /> {t('ol_recorded')}</span>
      <span><i style={{ background: PREDICTED }} /> {t('ol_likely')}</span>
      <span><i className="band" /> {t('ol_fanInner')}</span>
      <span><i className="band pale" /> {t('ol_fanOuter')}</span>
    </div>
  )
}
