import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { ErrorText, Loading, numOrNull, textOrNull } from '../../components/ui'
import { useFarm, useFarmId } from '../../farm/FarmProvider'
import { addDays, todayIso } from '../../lib/calc/dates'
import { monthlyByYear, rainBetween, yearToDate } from '../../lib/calc/rain'
import { useRain } from '../../lib/farmRecords'
import { formatDateShort, formatNumber } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { supabase } from '../../lib/supabase'
import { saveRow } from '../../lib/outbox'
import { QueuedNote } from '../../components/OutboxBar'
import { BarsChart, ReportCard } from '../reports/Chart'

const mm = (n: number | null | undefined, lang: 'en' | 'af') => (n == null ? '–' : `${formatNumber(n, 1, lang)} mm`)

/** Rain gauge: record readings, see this year against earlier years. */
export function RainPage() {
  const { t, lang } = useI18n()
  const { isOwner } = useFarm()
  const { session } = useAuth()
  const farmId = useFarmId()
  const qc = useQueryClient()
  const rain = useRain()
  const [f, setF] = useState({ date: todayIso(), mm: '', gauge: '', notes: '' })

  const add = useMutation({
    networkMode: 'always',  // kept on the phone without signal (see outbox)
    mutationFn: async () => {
      const value = numOrNull(f.mm)
      if (value == null || value < 0) throw new Error(t('rainMm'))
      return saveRow('rain_readings', { farm_id: farmId, date: f.date, mm: value, gauge: textOrNull(f.gauge), notes: textOrNull(f.notes) })
    },
    onSuccess: () => { setF({ ...f, mm: '', notes: '' }); qc.invalidateQueries({ queryKey: ['rain_readings'] }) },
  })
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('rain_readings').update({ deleted_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rain_readings'] }),
  })

  if (rain.isLoading) return <Loading />
  const list = rain.data ?? []
  const today = todayIso()
  const ytd = yearToDate(list, today)
  const last7 = rainBetween(list, addDays(today, -6), today)
  const thisMonth = rainBetween(list, `${today.slice(0, 7)}-01`, today)
  const byYear = monthlyByYear(list)
  const years = [...byYear.keys()].sort().slice(-4)
  const monthNames = Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat(lang === 'af' ? 'af-ZA' : 'en-ZA', { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, i, 15))))
  const chart = monthNames.map((name, i) => ({ name, ...Object.fromEntries(years.map((y) => [String(y), byYear.get(y)![i]])) }))
  const gauges = [...new Set(list.map((r) => r.gauge).filter(Boolean))] as string[]

  return (
    <div className="page stack">
      <Link to="/menu" className="back">‹ {t('menu')}</Link>
      <h1>🌧️ {t('rainTitle')}</h1>

      <div className="stats three">
        <div className="stat"><span className="stat-n">{mm(last7, lang)}</span><span className="stat-l">{t('rainLast7')}</span></div>
        <div className="stat"><span className="stat-n">{mm(thisMonth, lang)}</span><span className="stat-l">{t('rainThisMonth')}</span></div>
        <div className="stat"><span className="stat-n">{mm(ytd.thisYear, lang)}</span><span className="stat-l">{t('rainThisYear')}</span></div>
      </div>
      {ytd.average != null && (
        <p className="pill-info">
          {t('rainVsAverage', { avg: mm(ytd.average, lang) })}{' '}
          <strong>{ytd.average > 0 ? `${formatNumber(Math.round((ytd.thisYear / ytd.average) * 100), 0, lang)}%` : '–'}</strong>
        </p>
      )}

      <form className="card stack" onSubmit={(e) => { e.preventDefault(); add.mutate() }}>
        <h2>{t('rainAdd')}</h2>
        <div className="grid2">
          <label>{t('date')}<input type="date" value={f.date} max={today} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
          <label>{t('rainMm')}<input inputMode="decimal" required autoFocus value={f.mm} onChange={(e) => setF({ ...f, mm: e.target.value })} /></label>
        </div>
        <label>{t('rainGauge')}<input list="gauges" value={f.gauge} placeholder={t('rainGaugeHint')} onChange={(e) => setF({ ...f, gauge: e.target.value })} /></label>
        <datalist id="gauges">{gauges.map((g) => <option key={g} value={g} />)}</datalist>
        <label>{t('notes')}<input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
        <button className="btn primary" disabled={add.isPending}>{add.isPending ? t('saving') : t('save')}</button>
        <QueuedNote show={!!add.data?.queued} />
        <ErrorText error={add.error} />
      </form>

      {years.length > 0 && (
        <ReportCard title={t('rainByMonth')} note={gauges.length > 1 ? t('rainGaugesNote') : undefined}
          table={<table className="table"><thead><tr><th />{years.map((y) => <th key={y} className="num">{y}</th>)}</tr></thead>
            <tbody>
              {monthNames.map((name, i) => <tr key={name}><td>{name}</td>{years.map((y) => <td key={y} className="num">{byYear.get(y)![i] ? formatNumber(byYear.get(y)![i], 1, lang) : '–'}</td>)}</tr>)}
              <tr><td><strong>{t('totalDue')}</strong></td>{years.map((y) => <td key={y} className="num"><strong>{formatNumber(byYear.get(y)!.reduce((a, b) => a + b, 0), 1, lang)}</strong></td>)}</tr>
            </tbody></table>}
          chart={<BarsChart data={chart} x="name" series={years.map((y) => ({ key: String(y), label: String(y) }))} format={(n) => `${formatNumber(n, 0, lang)} mm`} />}
        />
      )}

      <section className="card">
        <h2>{t('rainReadings')}</h2>
        {list.length === 0 ? <p className="muted">{t('rainNone')}</p> : (
          <ul className="list">
            {list.slice(0, 40).map((r) => (
              <li key={r.id} className="row">
                <div className="grow">
                  <strong>{formatDateShort(r.date, lang)}</strong>
                  <div className="small muted">{[r.gauge, r.notes].filter(Boolean).join(' · ')}</div>
                </div>
                <strong>{mm(r.mm, lang)}</strong>
                {(isOwner || r.created_by === session?.user.id) && (
                  <button className="btn small ghost" aria-label={t('delete')} onClick={() => confirm(`${t('delete')}?`) && remove.mutate(r.id)}>✕</button>
                )}
              </li>
            ))}
          </ul>
        )}
        <ErrorText error={rain.error ?? remove.error} />
      </section>
    </div>
  )
}
