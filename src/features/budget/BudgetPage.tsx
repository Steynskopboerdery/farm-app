import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ErrorText, Loading, numOrNull, textOrNull } from '../../components/ui'
import { useFarm, useFarmId } from '../../farm/FarmProvider'
import {
  actuals, budgetFromPlan, cashFlow, EXPENSE_CATEGORIES, INCOME_CATEGORIES, lowestPoint, monthlyPlan, planByCategory, tightMonths, type BudgetLineLite,
} from '../../lib/calc/budget'
import { todayIso } from '../../lib/calc/dates'
import { useBudgets, usePaymentsReceived, type BudgetLine } from '../../lib/budget'
import { formatNumber, formatZar } from '../../lib/format'
import { useI18n, type DictKey } from '../../lib/i18n'
import { useAllCropRecords, useCosts, usePlanningEstimates } from '../../lib/inventory'
import { useFields, useGroups, useSeasons } from '../../lib/queries'
import { supabase } from '../../lib/supabase'
import { ChartCard, PREDICTED, RECORDED } from '../outlook/OutlookCharts'

const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

/** Months next to each other joined up: [1, 2, 4, 5, 6] → [[1, 2], [4, 6]]. */
const runs = (months: number[]) => months.reduce<[number, number][]>((out, m) => {
  const last = out[out.length - 1]
  if (last && last[1] === m - 1) last[1] = m
  else out.push([m, m])
  return out
}, [])
const BALANCE = '#14532d'

/** Year budget and month-by-month cash flow (owners only). */
export function BudgetPage() {
  const { t, lang, w } = useI18n()
  const { isOwner } = useFarm()
  const farmId = useFarmId()
  const qc = useQueryClient()
  const thisYear = Number(todayIso().slice(0, 4))
  const [params, setParams] = useSearchParams()
  const year = Number(params.get('year')) || thisYear
  const budgets = useBudgets(isOwner)
  const costs = useCosts(isOwner)
  const records = useAllCropRecords()
  const payments = usePaymentsReceived(isOwner)
  const estimates = usePlanningEstimates()
  const fields = useFields()
  const seasons = useSeasons()
  const groups = useGroups()
  const [editing, setEditing] = useState<BudgetLine | 'income' | 'expense' | null>(null)
  const [opening, setOpening] = useState<string | null>(null)

  const all = budgets.data?.lines ?? []
  const lines = all.filter((l) => l.year === year)
  const yearRow = budgets.data?.years.find((y) => y.year === year)
  const openingBalance = Number(yearRow?.opening_balance ?? 0)

  const saveOpening = useMutation({
    mutationFn: async (v: number) => {
      const { error } = await supabase.from('budget_years').upsert({ farm_id: farmId, year, opening_balance: v })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['budget'] }); setOpening(null) },
  })
  const addLines = useMutation({
    mutationFn: async (rows: BudgetLineLite[]) => {
      const { error } = await supabase.from('budget_lines').insert(rows.map((r, i) => ({ ...r, farm_id: farmId, year, sort: i })))
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budget'] }),
  })

  if (!isOwner) return <Navigate to="/menu" replace />
  if (budgets.isLoading) return <Loading />

  const R = (n: number) => formatZar(Math.round(n), lang).replace(/[.,]00$/, '')
  const Rk = (n: number) => (Math.abs(n) >= 1_000_000 ? `R${formatNumber(n / 1_000_000, 1, lang)}m` : Math.abs(n) >= 1000 ? `R${formatNumber(n / 1000, 0, lang)}k` : `R${formatNumber(n, 0, lang)}`)
  const monthName = (m: number) => new Intl.DateTimeFormat(lang === 'af' ? 'af-ZA' : 'en-ZA', { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, m - 1, 15)))
  const monthsText = (ms: number[]) => (ms.length === 12 ? t('bud_everyMonth') : ms.length === 1 ? monthName(ms[0]) : ms.slice().sort((a, b) => a - b).map(monthName).join(', '))

  const plan = monthlyPlan(lines)
  const flow = cashFlow(plan.income, plan.expense, openingBalance)
  const tight = tightMonths(flow)
  const low = lines.length ? lowestPoint(flow) : null
  const income = lines.filter((l) => l.kind === 'income').reduce((a, l) => a + Number(l.amount), 0)
  const expense = lines.filter((l) => l.kind === 'expense').reduce((a, l) => a + Number(l.amount), 0)
  const act = actuals(year, {
    costs: (costs.data ?? []).map((c) => ({ date: c.date, category: c.category, amount: Number(c.amount) })),
    ops: (records.data?.operations ?? []).map((o) => ({ date: o.date, cost: o.cost })),
    plantings: records.data?.plantings ?? [],
    payments: (payments.data ?? []).map((p) => ({ date: p.date, amount: Number(p.amount) })),
  })
  const actIn = act.income.reduce((a, b) => a + b, 0)
  const actOut = act.expense.reduce((a, b) => a + b, 0)
  const nowMonth = year === thisYear ? Number(todayIso().slice(5, 7)) : year < thisYear ? 12 : 0
  const planSoFar = { in: plan.income.slice(0, nowMonth).reduce((a, b) => a + b, 0), out: plan.expense.slice(0, nowMonth).reduce((a, b) => a + b, 0) }
  const planCat = planByCategory(lines, 'expense')
  const cats = [...new Set([...Object.keys(planCat), ...Object.keys(act.byCategory)])]
  const previous = all.filter((l) => l.year === year - 1)

  // A starting budget from the planning figures, for a year with nothing in it yet.
  const fromPlan = () => {
    const seasonYear = new Map((seasons.data ?? []).map((s) => [s.id, s.year]))
    const cropHa = new Map<string, number>()
    for (const p of records.data?.plantings ?? []) {
      if (seasonYear.get(p.season_id) !== year) continue
      const ha = Number(fields.data?.find((f) => f.id === p.field_id)?.hectares ?? 0)
      cropHa.set(p.crop, (cropHa.get(p.crop) ?? 0) + ha)
    }
    const est = estimates.data ?? []
    const females = (species: string) => (groups.data ?? []).filter((g) => g.species === species && ['ewes', 'cows'].includes(g.class ?? '')).reduce((a, g) => a + g.quantity, 0)
    return budgetFromPlan({
      cropHa,
      crops: est.filter((e) => e.kind === 'crop'),
      herds: est.filter((e) => e.kind === 'livestock').map((e) => ({ ...e, females: females(e.name) })),
    }).map((l) => ({ ...l, label: `${w(l.label)} (${t(`bud_cat_${l.category}` as DictKey)})` }))
  }

  return (
    <div className="page stack">
      <Link to="/menu" className="back">‹ {t('menu')}</Link>
      <h1>📒 {t('bud_title')}</h1>
      <div className="year-step">
        <button className="btn small" onClick={() => setParams({ year: String(year - 1) })} aria-label={t('bud_prevYear')}>‹ {year - 1}</button>
        <strong>{year}</strong>
        <button className="btn small" onClick={() => setParams({ year: String(year + 1) })} aria-label={t('bud_nextYear')}>{year + 1} ›</button>
      </div>
      <ErrorText error={budgets.error} />

      {lines.length === 0 ? (
        <section className="card stack">
          <h2>{t('bud_emptyTitle', { year })}</h2>
          <p className="muted">{t('bud_emptyText')}</p>
          <div className="btn-row">
            {previous.length > 0 && (
              <button className="btn primary" disabled={addLines.isPending}
                onClick={() => addLines.mutate(previous.map((l) => ({ kind: l.kind, category: l.category, label: l.label, amount: Number(l.amount), months: l.months, notes: t('bud_copiedNote', { year: year - 1 }) } as BudgetLineLite)))}>
                {t('bud_copy', { year: year - 1 })}
              </button>
            )}
            <button className="btn" disabled={addLines.isPending} onClick={() => { const l = fromPlan(); if (l.length) addLines.mutate(l); else setEditing('income') }}>{t('bud_fromPlan')}</button>
            <button className="btn" onClick={() => setEditing('income')}>{t('bud_startEmpty')}</button>
          </div>
          <ErrorText error={addLines.error} />
        </section>
      ) : (
        <>
          <div className="stats three">
            <div className="stat"><span className="stat-n">{Rk(income)}</span><span className="stat-l">{t('bud_in')}</span></div>
            <div className="stat"><span className="stat-n">{Rk(expense)}</span><span className="stat-l">{t('bud_out')}</span></div>
            <div className="stat"><span className={`stat-n ${income - expense < 0 ? 'warn-text' : ''}`}>{Rk(income - expense)}</span><span className="stat-l">{t('bud_profit')}</span></div>
          </div>
          {income > 0 && <p className="small muted center">{t('bud_margin', { pct: formatNumber(((income - expense) / income) * 100, 1, lang) })}</p>}

          {/* Month by month */}
          <ChartCard title={t('bud_flowTitle')} note={t('bud_flowNote')}
            legend={(
              <div className="chart-key">
                <span><i style={{ background: RECORDED }} /> {t('bud_in')}</span>
                <span><i style={{ background: PREDICTED }} /> {t('bud_out')}</span>
                <span><i style={{ background: BALANCE }} /> {t('bud_balance')}</span>
              </div>
            )}
            chart={(
              <ResponsiveContainer width="100%" height={270}>
                <ComposedChart data={flow.map((r) => ({ name: monthName(r.month), in: r.income, out: r.expense, balance: r.balance }))} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#e6ebe2" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#55645a' }} tickLine={false} interval={0} />
                  <YAxis tick={{ fontSize: 13, fill: '#55645a' }} tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => Rk(v)} />
                  <Tooltip contentStyle={{ borderRadius: 12, fontSize: 14 }} formatter={(v, name) => [R(Number(v)), name]} />
                  <ReferenceLine y={0} stroke="#55645a" />
                  <Bar dataKey="in" name={t('bud_in')} fill={RECORDED} radius={[3, 3, 0, 0]} maxBarSize={14} isAnimationActive={false} />
                  <Bar dataKey="out" name={t('bud_out')} fill={PREDICTED} radius={[3, 3, 0, 0]} maxBarSize={14} isAnimationActive={false} />
                  <Line dataKey="balance" name={t('bud_balance')} stroke={BALANCE} strokeWidth={2.5} dot={{ r: 2.5 }} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
            table={(
              <table className="table"><thead><tr><th /><th className="num">{t('bud_in')}</th><th className="num">{t('bud_out')}</th><th className="num">{t('bud_balance')}</th>{nowMonth > 0 && <th className="num">{t('bud_actualNet')}</th>}</tr></thead>
                <tbody>{flow.map((r) => (
                  <tr key={r.month}><td>{monthName(r.month)}</td><td className="num">{Rk(r.income)}</td><td className="num">{Rk(r.expense)}</td>
                    <td className={`num ${r.balance < 0 ? 'warn-text' : ''}`}><strong>{Rk(r.balance)}</strong></td>
                    {nowMonth > 0 && <td className="num">{r.month <= nowMonth ? Rk(act.income[r.month - 1] - act.expense[r.month - 1]) : '–'}</td>}</tr>
                ))}</tbody></table>
            )}
          />
          <div className="card"><div className="row">
            {opening == null ? (
              <>
                <span className="grow">{t('bud_opening', { year })}<div className="small muted">{t('bud_openingHint')}</div></span>
                <strong>{R(openingBalance)}</strong>
                <button className="btn small" onClick={() => setOpening(String(openingBalance))}>{t('edit')}</button>
              </>
            ) : (
              <form className="row grow" onSubmit={(e) => { e.preventDefault(); saveOpening.mutate(numOrNull(opening) ?? 0) }}>
                <label className="grow">{t('bud_opening', { year })}<input inputMode="decimal" autoFocus value={opening} onChange={(e) => setOpening(e.target.value)} /></label>
                <button className="btn small primary" disabled={saveOpening.isPending}>{t('save')}</button>
              </form>
            )}
          </div></div>

          {/* Tight months */}
          {tight.length > 0 ? (
            <section className="warning">
              <strong>⚠️ {t('bud_tightTitle')}</strong>
              {runs(tight.filter((m) => m.belowZero).map((m) => m.month)).length > 0 && (
                <span>{t('bud_belowZeroIn', { months: runs(tight.filter((m) => m.belowZero).map((m) => m.month)).map(([a, b]) => (a === b ? monthName(a) : `${monthName(a)}–${monthName(b)}`)).join(', ') })}</span>
              )}
              {tight.filter((m) => !m.belowZero).map((m) => (
                <span key={m.month}>{monthName(m.month)}: {t('bud_bigOut', { v: R(-m.net) })}</span>
              ))}
              {low && low.balance < 0 && <span className="small">{t('bud_lowest', { month: monthName(low.month), v: R(low.balance) })}</span>}
            </section>
          ) : <p className="small muted">✓ {t('bud_noTight')}</p>}

          {/* Plan against what really happened */}
          {nowMonth > 0 && (
            <section className="card stack">
              <h2>{t('bud_vsTitle')}</h2>
              <p className="tiny muted">{t('bud_vsNote')}</p>
              <table className="table"><thead><tr><th /><th className="num">{t('bud_planSoFar')}</th><th className="num">{t('bud_actual')}</th></tr></thead>
                <tbody>
                  <tr><td>{t('bud_in')}</td><td className="num">{Rk(planSoFar.in)}</td><td className="num">{Rk(actIn)}</td></tr>
                  <tr><td>{t('bud_out')}</td><td className="num">{Rk(planSoFar.out)}</td><td className={`num ${actOut > planSoFar.out * 1.1 ? 'warn-text' : ''}`}>{Rk(actOut)}</td></tr>
                </tbody></table>
              <h3 className="h4">{t('bud_spendByCat')}</h3>
              <div className="budget-bars">
                {cats.map((c) => {
                  const p = planCat[c] ?? 0
                  const a = act.byCategory[c] ?? 0
                  const pct = p > 0 ? Math.min(100, (a / p) * 100) : 100
                  return (
                    <div key={c} className="budget-bar">
                      <div className="row-between"><span>{t(`bud_cat_${c}` as DictKey)}</span><span className="small"><strong className={a > p ? 'warn-text' : ''}>{Rk(a)}</strong> / {Rk(p)}</span></div>
                      <div className="track"><div className={a > p ? 'over' : ''} style={{ width: `${pct}%` }} /></div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </>
      )}

      {/* The lines */}
      {(['income', 'expense'] as const).map((kind) => (lines.length > 0 || editing) && (
        <section key={kind} className="card stack">
          <div className="card-head"><h2>{kind === 'income' ? `💰 ${t('bud_in')}` : `💸 ${t('bud_out')}`}</h2>
            <button className="btn small" onClick={() => setEditing(kind)}>+ {t('add')}</button></div>
          <ul className="list">
            {lines.filter((l) => l.kind === kind).map((l) => (
              <li key={l.id}>
                <button className="row link-row plain-btn" onClick={() => setEditing(l)}>
                  <div className="grow">
                    <strong>{l.label}</strong>
                    <div className="small muted">{t(`bud_cat_${l.category}` as DictKey)} · {monthsText(l.months)}</div>
                  </div>
                  <strong>{R(Number(l.amount))}</strong>
                </button>
              </li>
            ))}
          </ul>
          {editing && (editing === kind || (typeof editing === 'object' && editing.kind === kind)) && (
            <LineForm year={year} kind={kind} line={typeof editing === 'object' ? editing : undefined} monthName={monthName} onDone={() => setEditing(null)} />
          )}
        </section>
      ))}
      {lines.some((l) => l.notes) && <p className="tiny muted">{[...new Set(lines.map((l) => l.notes).filter(Boolean))].join(' · ')}</p>}
    </div>
  )
}

function LineForm({ year, kind, line, monthName, onDone }: { year: number; kind: 'income' | 'expense'; line?: BudgetLine; monthName: (m: number) => string; onDone: () => void }) {
  const { t } = useI18n()
  const farmId = useFarmId()
  const qc = useQueryClient()
  const cats = kind === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  const [f, setF] = useState({ label: line?.label ?? '', category: line?.category ?? cats[0], amount: line ? String(line.amount) : '', months: line?.months ?? ALL_MONTHS, notes: line?.notes ?? '' })
  const save = useMutation({
    mutationFn: async () => {
      const row = { label: f.label.trim(), category: f.category, amount: numOrNull(f.amount) ?? 0, months: f.months.slice().sort((a, b) => a - b), notes: textOrNull(f.notes) }
      const { error } = line
        ? await supabase.from('budget_lines').update(row).eq('id', line.id)
        : await supabase.from('budget_lines').insert({ ...row, kind, year, farm_id: farmId, sort: 100 })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['budget'] }); onDone() },
  })
  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('budget_lines').update({ deleted_at: new Date().toISOString() }).eq('id', line!.id)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['budget'] }); onDone() },
  })
  const toggle = (m: number) => setF({ ...f, months: f.months.includes(m) ? f.months.filter((x) => x !== m) : [...f.months, m] })
  return (
    <form className="card-inset stack" onSubmit={(e) => { e.preventDefault(); if (f.months.length) save.mutate() }}>
      <h3 className="h4">{line ? t('edit') : kind === 'income' ? t('bud_addIn') : t('bud_addOut')}</h3>
      <label>{t('bud_what')}<input required value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} /></label>
      <div className="grid2">
        <label>{t('bud_amountYear')}<input required inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></label>
        <label>{t('bud_category')}
          <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            {cats.map((c) => <option key={c} value={c}>{t(`bud_cat_${c}` as DictKey)}</option>)}
          </select>
        </label>
      </div>
      <div>
        <span className="label-text">{t('bud_whichMonths')}</span>
        <div className="month-grid">
          {ALL_MONTHS.map((m) => <button type="button" key={m} className={`chip ${f.months.includes(m) ? 'on' : ''}`} onClick={() => toggle(m)}>{monthName(m)}</button>)}
        </div>
        <div className="btn-row">
          <button type="button" className="btn small" onClick={() => setF({ ...f, months: ALL_MONTHS })}>{t('bud_everyMonth')}</button>
          <button type="button" className="btn small" onClick={() => setF({ ...f, months: [] })}>{t('bud_clearMonths')}</button>
        </div>
        <span className="hint">{f.months.length ? t('bud_splitHint', { n: f.months.length }) : t('bud_pickMonth')}</span>
      </div>
      <label>{t('notes')}<input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
      <div className="btn-row">
        {line && <button type="button" className="btn danger" disabled={remove.isPending} onClick={() => { if (confirm(t('bud_deleteAsk'))) remove.mutate() }}>{t('delete')}</button>}
        <button type="button" className="btn" onClick={onDone}>{t('cancel')}</button>
        <button className="btn primary" disabled={save.isPending || !f.months.length}>{t('save')}</button>
      </div>
      <ErrorText error={save.error ?? remove.error} />
    </form>
  )
}
