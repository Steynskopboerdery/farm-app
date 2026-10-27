import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimalIcon } from '../../components/AnimalIcon'
import { ErrorText, Loading, numOrNull, textOrNull } from '../../components/ui'
import { useFarm, useFarmId } from '../../farm/FarmProvider'
import { mineralAdvice, type AdviceRule, type Nutrient } from '../../lib/calc/advice'
import { todayIso } from '../../lib/calc/dates'
import { formatDateShort, formatHa, formatNumber } from '../../lib/format'
import { useI18n, type DictKey } from '../../lib/i18n'
import { useCamps, useGroups } from '../../lib/queries'
import { supabase, type Tables } from '../../lib/supabase'

const NUTRIENTS: Nutrient[] = ['protein_pct', 'phosphorus_pct', 'calcium_pct', 'magnesium_pct']

function usePastureData() {
  const farmId = useFarmId()
  return useQuery({
    queryKey: ['pasture', farmId],
    queryFn: async () => {
      const [tests, rules] = await Promise.all([
        supabase.from('pasture_tests').select('*').eq('farm_id', farmId).is('deleted_at', null).order('date', { ascending: false }),
        supabase.from('mineral_advice_rules').select('*').eq('farm_id', farmId).is('deleted_at', null).order('nutrient'),
      ])
      if (tests.error) throw tests.error
      if (rules.error) throw rules.error
      return { tests: tests.data ?? [], rules: (rules.data ?? []) as unknown as (AdviceRule & Tables<'mineral_advice_rules'>)[] }
    },
  })
}

export function GrazingPage() {
  const { t, w, lang } = useI18n()
  const { isOwner, can } = useFarm()
  const camps = useCamps()
  const groups = useGroups()
  const data = usePastureData()
  const [adding, setAdding] = useState<string | null>(null)

  if (camps.isLoading || data.isLoading) return <Loading />
  const tests = data.data?.tests ?? []
  const rules = data.data?.rules ?? []

  return (
    <div className="page stack">
      <Link to="/menu" className="back">‹ {t('menu')}</Link>
      <h1>{t('menuGrazing')}</h1>
      <p className="advice">⚠ {t('mineralDisclaimer')}</p>
      <ErrorText error={data.error} />
      {(camps.data ?? []).length === 0 && <p className="muted">{t('noCamps')}</p>}

      {(camps.data ?? []).map((c) => {
        const here = (groups.data ?? []).filter((g) => g.camp_id === c.id)
        const species = [...new Set(here.map((g) => g.species))]
        const campTests = tests.filter((x) => x.camp_id === c.id)
        const latest = campTests[0]
        const advice = latest ? mineralAdvice(latest, species.length ? species : ['sheep', 'cattle'], rules) : []
        return (
          <section key={c.id} className="card">
            <div className="card-head">
              <div>
                <h2>{c.name}</h2>
                <p className="small muted">{[formatHa(c.hectares, lang), c.pasture_type].filter(Boolean).join(' · ')}</p>
              </div>
              {can('pasture') && adding !== c.id && <button className="btn small" onClick={() => setAdding(c.id)}>+ {t('pastureTest')}</button>}
            </div>
            {here.length > 0 && (
              <div className="chips">
                {here.map((g) => (
                  <Link key={g.id} to={`/livestock/group/${g.id}`} className="chip graze-chip"><AnimalIcon species={g.species} size={24} /> {g.name} · {g.quantity}</Link>
                ))}
              </div>
            )}
            {adding === c.id && <TestForm campId={c.id} onDone={() => setAdding(null)} />}
            {latest ? (
              <>
                <div className="nutrients">
                  {NUTRIENTS.map((n) => (
                    <div key={n} className={`nutrient ${advice.some((a) => a.rule.nutrient === n) ? 'low' : ''}`}>
                      <span className="tiny muted">{t(`nut_${n}` as DictKey)}</span>
                      <strong>{latest[n] != null ? `${formatNumber(Number(latest[n]), 2, lang)}%` : '–'}</strong>
                    </div>
                  ))}
                </div>
                <p className="tiny muted">{t('latestTest')}: {formatDateShort(latest.date, lang)}{latest.notes ? ` · ${latest.notes}` : ''}</p>
                {advice.length === 0 ? <p className="pill-info small">✓ {t('noMineralFlags')}</p> : (
                  <ul className="advice-list">
                    {advice.map((a) => (
                      <li key={a.rule.id}>
                        <strong>💡 {t(`nut_${a.rule.nutrient}` as DictKey)} {formatNumber(a.value, 2, lang)}%</strong>
                        {a.rule.species !== 'any' && <span className="tiny muted"> · {w(a.rule.species)}</span>}
                        <p className="small">{a.rule.suggestion}</p>
                      </li>
                    ))}
                  </ul>
                )}
                {campTests.length > 1 && (
                  <details className="small">
                    <summary>{t('earlierTests')} ({campTests.length - 1})</summary>
                    <div className="table-wrap">
                      <table className="table">
                        <thead><tr><th>{t('date')}</th>{NUTRIENTS.map((n) => <th key={n} className="num">{t(`nutShort_${n}` as DictKey)}</th>)}</tr></thead>
                        <tbody>{campTests.slice(1).map((x) => (
                          <tr key={x.id}><td>{formatDateShort(x.date, lang)}</td>{NUTRIENTS.map((n) => <td key={n} className="num">{x[n] != null ? formatNumber(Number(x[n]), 2, lang) : '–'}</td>)}</tr>
                        ))}</tbody>
                      </table>
                    </div>
                  </details>
                )}
              </>
            ) : <p className="muted small">{t('noTestYet')}</p>}
          </section>
        )
      })}

      {isOwner && <RulesEditor rules={rules} />}
    </div>
  )
}

function TestForm({ campId, onDone }: { campId: string; onDone: () => void }) {
  const { t } = useI18n()
  const farmId = useFarmId()
  const qc = useQueryClient()
  const [f, setF] = useState<Record<string, string>>({ date: todayIso(), notes: '' })
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('pasture_tests').insert({
        farm_id: farmId, camp_id: campId, date: f.date, notes: textOrNull(f.notes ?? ''),
        protein_pct: numOrNull(f.protein_pct ?? ''), phosphorus_pct: numOrNull(f.phosphorus_pct ?? ''),
        calcium_pct: numOrNull(f.calcium_pct ?? ''), magnesium_pct: numOrNull(f.magnesium_pct ?? ''),
      })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pasture'] }); onDone() },
  })
  return (
    <form className="subcard stack" onSubmit={(e) => { e.preventDefault(); save.mutate() }}>
      <label>{t('date')}<input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
      <div className="grid2">
        {NUTRIENTS.map((n) => (
          <label key={n}>{t(`nut_${n}` as DictKey)} (%)<input inputMode="decimal" value={f[n] ?? ''} onChange={(e) => setF({ ...f, [n]: e.target.value })} /></label>
        ))}
      </div>
      <span className="hint">{t('pastureHint')}</span>
      <label>{t('notes')}<input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
      <div className="btn-row">
        <button type="button" className="btn" onClick={onDone}>{t('cancel')}</button>
        <button className="btn primary" disabled={save.isPending}>{t('save')}</button>
      </div>
      <ErrorText error={save.error} />
    </form>
  )
}

function RulesEditor({ rules }: { rules: (AdviceRule & Tables<'mineral_advice_rules'>)[] }) {
  const { t, w } = useI18n()
  const farmId = useFarmId()
  const qc = useQueryClient()
  const [edit, setEdit] = useState<Record<string, { threshold: string; suggestion: string }>>({})
  const [adding, setAdding] = useState(false)
  const [n, setN] = useState({ species: 'any', nutrient: 'phosphorus_pct', comparison: 'below', threshold: '', suggestion: '' })
  const refresh = () => qc.invalidateQueries({ queryKey: ['pasture'] })

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Tables<'mineral_advice_rules'>> }) => {
      const { error } = await supabase.from('mineral_advice_rules').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: refresh,
  })
  const add = useMutation({
    mutationFn: async () => {
      const threshold = numOrNull(n.threshold)
      if (threshold == null || !n.suggestion.trim()) throw new Error(t('ruleIncomplete'))
      const { error } = await supabase.from('mineral_advice_rules').insert({ farm_id: farmId, ...n, threshold, suggestion: n.suggestion.trim() })
      if (error) throw error
    },
    onSuccess: () => { setAdding(false); setN({ ...n, threshold: '', suggestion: '' }); refresh() },
  })

  return (
    <section className="card stack">
      <h2>{t('adviceRules')}</h2>
      <p className="small muted">{t('adviceRulesHelp')}</p>
      {rules.map((r) => {
        const e = edit[r.id]
        return (
          <div key={r.id} className={`subcard stack ${r.active ? '' : 'off'}`}>
            <div className="row">
              <strong className="grow">{t(`nut_${r.nutrient}` as DictKey)} {r.comparison === 'below' ? '<' : '>'} {r.threshold}% · {r.species === 'any' ? t('allAnimals') : w(r.species)}</strong>
              <label className="check small"><input type="checkbox" checked={r.active} onChange={(ev) => update.mutate({ id: r.id, patch: { active: ev.target.checked } })} /> {t('ruleOn')}</label>
            </div>
            {e ? (
              <>
                <label>{t('threshold')} (%)<input inputMode="decimal" value={e.threshold} onChange={(ev) => setEdit({ ...edit, [r.id]: { ...e, threshold: ev.target.value } })} /></label>
                <label>{t('suggestionText')}<textarea rows={3} value={e.suggestion} onChange={(ev) => setEdit({ ...edit, [r.id]: { ...e, suggestion: ev.target.value } })} /></label>
                <button className="btn primary small" onClick={() => {
                  update.mutate({ id: r.id, patch: { threshold: numOrNull(e.threshold) ?? r.threshold, suggestion: e.suggestion.trim() || r.suggestion } })
                  const rest = { ...edit }; delete rest[r.id]; setEdit(rest)
                }}>{t('save')}</button>
              </>
            ) : (
              <>
                <p className="small">{r.suggestion}</p>
                <button className="btn small ghost" onClick={() => setEdit({ ...edit, [r.id]: { threshold: String(r.threshold), suggestion: r.suggestion } })}>{t('edit')}</button>
              </>
            )}
          </div>
        )
      })}
      {adding ? (
        <form className="subcard stack" onSubmit={(e) => { e.preventDefault(); add.mutate() }}>
          <div className="grid2">
            <label>{t('species')}
              <select value={n.species} onChange={(e) => setN({ ...n, species: e.target.value })}>
                <option value="any">{t('allAnimals')}</option><option value="sheep">{w('sheep')}</option><option value="cattle">{w('cattle')}</option>
              </select>
            </label>
            <label>{t('nutrient')}
              <select value={n.nutrient} onChange={(e) => setN({ ...n, nutrient: e.target.value })}>
                {NUTRIENTS.map((x) => <option key={x} value={x}>{t(`nut_${x}` as DictKey)}</option>)}
              </select>
            </label>
          </div>
          <div className="grid2">
            <label>{t('when')}
              <select value={n.comparison} onChange={(e) => setN({ ...n, comparison: e.target.value })}>
                <option value="below">{t('below')}</option><option value="above">{t('above')}</option>
              </select>
            </label>
            <label>{t('threshold')} (%)<input inputMode="decimal" value={n.threshold} onChange={(e) => setN({ ...n, threshold: e.target.value })} /></label>
          </div>
          <label>{t('suggestionText')}<textarea rows={3} value={n.suggestion} onChange={(e) => setN({ ...n, suggestion: e.target.value })} /></label>
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => setAdding(false)}>{t('cancel')}</button>
            <button className="btn primary" disabled={add.isPending}>{t('save')}</button>
          </div>
        </form>
      ) : <button className="btn" onClick={() => setAdding(true)}>+ {t('addRule')}</button>}
      <ErrorText error={update.error ?? add.error} />
    </section>
  )
}
