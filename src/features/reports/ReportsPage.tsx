import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorText, Loading, numOrNull } from '../../components/ui'
import { todayIso } from '../../lib/calc/dates'
import { birthRates, costsByCategory, countsByMonth, cropBudget, fieldProfit, inputUse, yieldTable } from '../../lib/calc/reports'
import { defaultSeasonId } from '../../lib/fieldRecords'
import { formatNumber, formatZar } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { useAllBirths, useAllCropRecords, useCosts, useGroupCountHistory, usePlanningEstimates } from '../../lib/inventory'
import { useBreedingPlans, useCurrentPlantings, useFields, useGroups, useSeasons } from '../../lib/queries'
import { supabase } from '../../lib/supabase'
import { BarsChart, LinesChart, ReportCard } from './Chart'

const rands = (lang: 'en' | 'af') => (n: number) => {
  const a = Math.abs(n)
  const s = a >= 1_000_000 ? `R${formatNumber(n / 1_000_000, 1, lang)}m` : a >= 1000 ? `R${formatNumber(n / 1000, 0, lang)}k` : `R${formatNumber(n, 0, lang)}`
  return s
}

export function ReportsPage() {
  const { t, w, lang } = useI18n()
  const seasons = useSeasons()
  const fields = useFields()
  const records = useAllCropRecords()
  const costs = useCosts()
  const estimates = usePlanningEstimates()
  const history = useGroupCountHistory()
  const births = useAllBirths()
  const breeding = useBreedingPlans()
  const groups = useGroups()
  const current = useCurrentPlantings()
  const [seasonPick, setSeasonPick] = useState<string | null>(null)

  if (seasons.isLoading || fields.isLoading || records.isLoading) return <Loading />
  const seasonList = [...(seasons.data ?? [])].sort((a, b) => a.year - b.year)
  const seasonId = seasonPick ?? defaultSeasonId(seasons.data) ?? ''
  const fieldList = fields.data ?? []
  const { plantings = [], operations = [], harvests = [] } = records.data ?? {}
  const costList = costs.data ?? []
  const est = estimates.data ?? []
  const priceOf = (crop: string) => est.find((e) => e.kind === 'crop' && e.name === crop)?.price_per_t ?? null
  const R = formatZar
  const short = rands(lang)

  // 1. Yield by field, all seasons
  const yields = yieldTable(fieldList, seasonList.map((s) => s.id), plantings, harvests)
  const yieldChart = fieldList.map((f, i) => ({
    name: f.name,
    ...Object.fromEntries(seasonList.map((s) => [String(s.year), yields[i].seasons[s.id]?.tPerHa ?? 0])),
  }))

  // 2. Inputs, 3. profit, 6. costs — for the chosen season
  const inputs = inputUse(operations, seasonId)
  const profit = fieldProfit({ fields: fieldList, seasonId, plantings, ops: operations, harvests, costs: costList, pricePerT: priceOf })
  const cats = costsByCategory(seasonId, plantings, operations, costList)
  const catKeys: { key: string; label: string }[] = [
    { key: 'seed', label: t('seedWord') }, { key: 'fertiliser', label: t('fertiliser') }, { key: 'spray', label: t('sprayWord') },
    { key: 'fieldwork', label: t('fieldwork') }, { key: 'fuel', label: t('costCat_fuel') }, { key: 'labour', label: t('costCat_labour') },
    { key: 'machinery', label: t('costCat_machinery') }, { key: 'other', label: t('costCat_other') },
  ]
  const catTotal = Object.values(cats).reduce((a, b) => a + b, 0)
  const costsBySeason = seasonList.map((s) => ({ name: String(s.year), ...costsByCategory(s.id, plantings, operations, costList) }))
  const usedCats = catKeys.filter((c) => costsBySeason.some((r) => (r as unknown as Record<string, number>)[c.key] > 0))

  // Suppliers
  const bySupplier = new Map<string, number>()
  for (const c of costList) if (c.season_id === seasonId) bySupplier.set(c.supplier || '–', (bySupplier.get(c.supplier || '–') ?? 0) + Number(c.amount))
  const suppliers = [...bySupplier.entries()].sort((a, b) => b[1] - a[1])

  // 4. Animal numbers, last 24 months
  const now = todayIso()
  const months: string[] = []
  for (let i = 23; i >= 0; i--) {
    const d = new Date(Date.UTC(Number(now.slice(0, 4)), Number(now.slice(5, 7)) - 1 - i, 1))
    months.push(d.toISOString().slice(0, 7))
  }
  const counts = countsByMonth(history.data ?? [], months).filter((r, i, all) => i === all.length - 1 || r.sheep + r.cattle > 0 || all.slice(0, i).some((x) => x.sheep + x.cattle > 0))
  const monthLabel = (m: string) => new Intl.DateTimeFormat(lang === 'af' ? 'af-ZA' : 'en-ZA', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(new Date(`${m}-15T12:00:00Z`))

  // 5. Lambing / calving %
  const groupById = new Map((groups.data ?? []).map((g) => [g.id, g]))
  const rates = birthRates(breeding.data ?? [], births.data ?? [], (gid) => groupById.get(gid)?.quantity ?? 0)
    .filter((r) => r.from <= now)

  // 7. Budget for this season's planted hectares
  const haByCrop = new Map<string, number>()
  for (const f of fieldList) {
    const p = current.data?.get(f.id)
    if (p) haByCrop.set(p.crop, (haByCrop.get(p.crop) ?? 0) + (f.hectares ?? 0))
  }
  const budget = cropBudget(haByCrop, est.filter((e) => e.kind === 'crop'))
  const animalsBudget = est.filter((e) => e.kind === 'livestock').map((e) => {
    const head = (groups.data ?? []).filter((g) => g.species === e.name && ['ewes', 'cows'].includes(g.class)).reduce((s, g) => s + g.quantity, 0)
    return { name: e.name, head, perHead: Number(e.cost_per_head_per_year ?? 0), total: head * Number(e.cost_per_head_per_year ?? 0) }
  })

  return (
    <div className="page stack">
      <Link to="/menu" className="back">‹ {t('menu')}</Link>
      <h1>{t('reportsTitle')}</h1>
      <div className="chips" role="tablist" aria-label={t('season')}>
        {[...seasonList].reverse().map((s) => (
          <button key={s.id} className={`chip ${s.id === seasonId ? 'on' : ''}`} onClick={() => setSeasonPick(s.id)}>{s.year}</button>
        ))}
      </div>
      <ErrorText error={records.error ?? costs.error} />

      <ReportCard title={t('rep_yield')}
        table={<table className="table"><thead><tr><th>{t('field')}</th>{seasonList.map((s) => <th key={s.id} className="num">{s.year}</th>)}</tr></thead>
          <tbody>{yields.map((y) => (
            <tr key={y.field.id}><td>{y.field.name}</td>{seasonList.map((s) => {
              const c = y.seasons[s.id]
              return <td key={s.id} className="num">{c?.tPerHa != null ? formatNumber(c.tPerHa, 2, lang) : '–'}<div className="tiny muted">{c?.crop ? w(c.crop) : ''}</div></td>
            })}</tr>
          ))}</tbody></table>}
        chart={<BarsChart data={yieldChart} x="name" series={seasonList.map((s) => ({ key: String(s.year), label: String(s.year) }))} format={(n) => `${formatNumber(n, 1, lang)} t`} />}
      />

      <ReportCard title={t('rep_profit')} note={t('rep_profitNote')}
        table={<table className="table"><thead><tr><th>{t('field')}</th><th className="num">t</th><th className="num">{t('income')}</th><th className="num">{t('costWord')}</th><th className="num">{t('margin')}</th><th className="num">R/ha</th></tr></thead>
          <tbody>{profit.map((p) => (
            <tr key={p.field.id}><td>{p.field.name}<div className="tiny muted">{p.crop ? w(p.crop) : ''}</div></td>
              <td className="num">{formatNumber(p.tons, 1, lang)}</td><td className="num">{p.income != null ? R(p.income, lang) : '–'}</td>
              <td className="num">{R(p.cost, lang)}</td><td className={`num ${p.margin != null && p.margin < 0 ? 'warn-text' : ''}`}>{p.margin != null ? R(p.margin, lang) : '–'}</td>
              <td className="num">{p.marginPerHa != null ? formatNumber(p.marginPerHa, 0, lang) : '–'}</td></tr>
          ))}</tbody></table>}
        chart={<BarsChart data={profit.map((p) => ({ name: p.field.name, income: p.income ?? 0, cost: p.cost }))} x="name"
          series={[{ key: 'income', label: t('income') }, { key: 'cost', label: t('costWord') }]} format={short} />}
      />

      <ReportCard title={t('rep_inputs')}
        table={inputs.length === 0 ? <p className="muted">{t('noData')}</p> : <table className="table"><thead><tr><th>{t('product')}</th><th className="num">{t('totalDue')}</th><th className="num">{t('costWord')}</th></tr></thead>
          <tbody>{inputs.map((i) => (
            <tr key={`${i.type}${i.product}${i.unit}`}><td>{i.product}<div className="tiny muted">{i.type === 'spray' ? t('sprayWord') : t('fertiliser')}</div></td>
              <td className="num">{formatNumber(i.total, 1, lang)} {i.unit}</td><td className="num">{R(i.cost, lang)}</td></tr>
          ))}</tbody></table>}
        chart={inputs.length ? <BarsChart data={inputs.map((i) => ({ name: i.product, cost: i.cost }))} x="name" series={[{ key: 'cost', label: t('costWord') }]} format={short} /> : undefined}
      />

      <ReportCard title={t('rep_costs')}
        table={<table className="table"><tbody>
          {catKeys.filter((c) => cats[c.key] > 0).map((c) => (
            <tr key={c.key}><td>{c.label}</td><td className="num">{R(cats[c.key], lang)}</td><td className="num muted">{catTotal ? `${Math.round((cats[c.key] / catTotal) * 100)}%` : ''}</td></tr>
          ))}
          <tr><td><strong>{t('totalDue')}</strong></td><td className="num"><strong>{R(catTotal, lang)}</strong></td><td /></tr>
        </tbody></table>}
        chart={usedCats.length ? <BarsChart data={costsBySeason} x="name" series={usedCats} stacked format={short} /> : undefined}
      />

      {suppliers.length > 0 && (
        <ReportCard title={t('rep_suppliers')}
          table={<table className="table"><tbody>{suppliers.map(([name, amt]) => <tr key={name}><td>{name}</td><td className="num">{R(amt, lang)}</td></tr>)}</tbody></table>}
          chart={<BarsChart data={suppliers.slice(0, 8).map(([name, amt]) => ({ name, amount: amt }))} x="name" series={[{ key: 'amount', label: t('costWord') }]} format={short} />}
        />
      )}

      <ReportCard title={t('rep_animals')} note={t('rep_animalsNote')}
        table={counts.length === 0 ? <p className="muted">{t('noData')}</p> : <table className="table"><thead><tr><th>{t('date')}</th><th className="num">{t('sheep')}</th><th className="num">{t('cattle')}</th></tr></thead>
          <tbody>{[...counts].reverse().slice(0, 12).map((c) => <tr key={c.month}><td>{monthLabel(c.month)}</td><td className="num">{formatNumber(c.sheep, 0, lang)}</td><td className="num">{formatNumber(c.cattle, 0, lang)}</td></tr>)}</tbody></table>}
        chart={counts.length ? <LinesChart data={counts.map((c) => ({ ...c, name: monthLabel(c.month) }))} x="name" series={[{ key: 'sheep', label: t('sheep') }, { key: 'cattle', label: t('cattle') }]} format={(n) => formatNumber(n, 0, lang)} /> : undefined}
      />

      <ReportCard title={t('rep_births')} note={t('rep_birthsNote')}
        table={rates.length === 0 ? <p className="muted">{t('noData')}</p> : <table className="table"><thead><tr><th>{t('groups')}</th><th className="num">{t('females')}</th><th className="num">{t('born')}</th><th className="num">%</th></tr></thead>
          <tbody>{rates.map((r) => <tr key={r.planId}><td>{groupById.get(r.groupId)?.name}<div className="tiny muted">{r.from.slice(0, 4)}</div></td><td className="num">{r.females}</td><td className="num">{r.born}</td><td className="num"><strong>{r.percent != null ? `${formatNumber(r.percent, 1, lang)}%` : '–'}</strong></td></tr>)}</tbody></table>}
        chart={rates.length ? <BarsChart data={rates.map((r) => ({ name: `${groupById.get(r.groupId)?.name ?? ''} ${r.from.slice(0, 4)}`, percent: r.percent ?? 0 }))} x="name" series={[{ key: 'percent', label: '%' }]} format={(n) => `${formatNumber(n, 0, lang)}%`} /> : undefined}
      />

      <ReportCard title={t('rep_budget')} note={t('rep_budgetNote')}
        table={<table className="table"><thead><tr><th>{t('crop')}</th><th className="num">ha</th><th className="num">{t('income')}</th><th className="num">{t('costWord')}</th><th className="num">{t('margin')}</th></tr></thead>
          <tbody>
            {budget.map((b) => <tr key={b.crop}><td>{w(b.crop)}</td><td className="num">{formatNumber(b.hectares, 0, lang)}</td><td className="num">{R(b.income, lang)}</td><td className="num">{R(b.cost, lang)}</td><td className="num"><strong>{R(b.margin, lang)}</strong></td></tr>)}
            {animalsBudget.map((a) => <tr key={a.name}><td>{w(a.name)}</td><td className="num">{a.head}</td><td className="num">–</td><td className="num">{R(a.total, lang)}</td><td className="num">–</td></tr>)}
          </tbody></table>}
        chart={budget.length ? <BarsChart data={budget.map((b) => ({ name: w(b.crop), income: b.income, cost: b.cost }))} x="name" series={[{ key: 'income', label: t('income') }, { key: 'cost', label: t('costWord') }]} format={short} /> : undefined}
      />
      <EstimatesEditor />
    </div>
  )
}

/** Planning figures (yield, price, input cost per crop; cost per animal) that drive the budget and profit estimates. */
function EstimatesEditor() {
  const { t, w } = useI18n()
  const qc = useQueryClient()
  const estimates = usePlanningEstimates()
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({})
  const save = useMutation({
    mutationFn: async () => {
      for (const [id, e] of Object.entries(edits)) {
        const patch: { yield_t_per_ha?: number | null; price_per_t?: number | null; input_cost_per_ha?: number | null; cost_per_head_per_year?: number | null } = {}
        for (const [k, v] of Object.entries(e)) (patch as Record<string, number | null>)[k] = numOrNull(v)
        const { error } = await supabase.from('planning_estimates').update(patch).eq('id', id)
        if (error) throw error
      }
    },
    onSuccess: () => { setEdits({}); qc.invalidateQueries({ queryKey: ['planning_estimates'] }) },
  })
  const list = estimates.data ?? []
  if (!list.length) return null
  const cell = (id: string, key: string, value: number | null) => (
    <input inputMode="decimal" className="cell-input" value={edits[id]?.[key] ?? (value ?? '').toString()}
      onChange={(e) => setEdits({ ...edits, [id]: { ...edits[id], [key]: e.target.value } })} />
  )
  return (
    <section className="card">
      <h2>{t('estimates')}</h2>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>{t('crop')}</th><th>{t('yieldEst')}</th><th>{t('pricePerT')}</th><th>{t('costPerHaEst')}</th></tr></thead>
          <tbody>{list.filter((e) => e.kind === 'crop').map((e) => (
            <tr key={e.id}><td>{w(e.name)}</td><td>{cell(e.id, 'yield_t_per_ha', e.yield_t_per_ha)}</td><td>{cell(e.id, 'price_per_t', e.price_per_t)}</td><td>{cell(e.id, 'input_cost_per_ha', e.input_cost_per_ha)}</td></tr>
          ))}</tbody>
        </table>
        <table className="table">
          <thead><tr><th>{t('animalsBudget')}</th><th>{t('costPerHead')}</th></tr></thead>
          <tbody>{list.filter((e) => e.kind === 'livestock').map((e) => (
            <tr key={e.id}><td>{w(e.name)}</td><td>{cell(e.id, 'cost_per_head_per_year', e.cost_per_head_per_year)}</td></tr>
          ))}</tbody>
        </table>
      </div>
      {Object.keys(edits).length > 0 && <button className="btn primary" disabled={save.isPending} onClick={() => save.mutate()}>{t('save')}</button>}
      <ErrorText error={save.error} />
    </section>
  )
}
