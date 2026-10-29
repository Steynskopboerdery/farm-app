import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ErrorText, Section, textOrNull } from '../../components/ui'
import { useFarm, useFarmId } from '../../farm/FarmProvider'
import { todayIso } from '../../lib/calc/dates'
import { countDifference } from '../../lib/calc/headcount'
import { useHeadCounts } from '../../lib/farmRecords'
import { formatDateShort, formatNumber } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { supabase, type Tables } from '../../lib/supabase'

/** Count the animals in the camp and compare with the records. */
export function HeadCountSection({ group }: { group: Tables<'livestock_groups'> }) {
  const { t, lang } = useI18n()
  const { can } = useFarm()
  const farmId = useFarmId()
  const qc = useQueryClient()
  const counts = useHeadCounts(group.id)
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ date: todayIso(), counted: '', notes: '' })
  const counted = f.counted.trim() === '' ? null : Math.round(Number(f.counted))
  const preview = counted != null && Number.isFinite(counted) ? countDifference({ counted, expected: group.quantity }) : null

  const add = useMutation({
    mutationFn: async () => {
      if (counted == null || counted < 0) throw new Error(t('hcCounted'))
      const { error } = await supabase.from('head_counts').insert({
        farm_id: farmId, group_id: group.id, camp_id: group.camp_id, date: f.date, counted, expected: group.quantity, notes: textOrNull(f.notes),
      })
      if (error) throw error
    },
    onSuccess: () => { setOpen(false); setF({ date: todayIso(), counted: '', notes: '' }); qc.invalidateQueries({ queryKey: ['head_counts'] }) },
  })

  const list = counts.data ?? []
  return (
    <Section title={`🔢 ${t('hcTitle')}`} action={can('animal_records') && !open ? <button className="btn small" onClick={() => setOpen(true)}>+ {t('hcAdd')}</button> : undefined}>
      {open && (
        <form className="stack" onSubmit={(e) => { e.preventDefault(); add.mutate() }}>
          <div className="grid2">
            <label>{t('date')}<input type="date" value={f.date} max={todayIso()} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
            <label>{t('hcCounted')}<input inputMode="numeric" required autoFocus value={f.counted} onChange={(e) => setF({ ...f, counted: e.target.value })} /></label>
          </div>
          <p className="small muted">{t('hcExpected', { n: formatNumber(group.quantity, 0, lang) })}</p>
          {preview && preview.missing > 0 && <p className="warning">⚠ {t('hcMissing', { n: preview.missing })}</p>}
          {preview && preview.extra > 0 && <p className="pill-info">{t('hcExtra', { n: preview.extra })}</p>}
          {preview && preview.diff === 0 && <p className="pill-info">✓ {t('hcAllThere')}</p>}
          <label>{t('notes')}<input value={f.notes} placeholder={t('hcNotesHint')} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => setOpen(false)}>{t('cancel')}</button>
            <button className="btn primary" disabled={add.isPending}>{t('save')}</button>
          </div>
          <p className="tiny muted">{t('hcHelp')}</p>
          <ErrorText error={add.error} />
        </form>
      )}
      {list.length === 0 ? <p className="muted">{t('hcNone')}</p> : (
        <ul className="list">
          {list.slice(0, 12).map((c) => {
            const d = countDifference(c)
            return (
              <li key={c.id} className="row">
                <div className="grow">
                  <strong>{formatNumber(c.counted, 0, lang)}</strong> <span className="small muted">/ {formatNumber(c.expected, 0, lang)}</span>
                  <div className="small muted">{formatDateShort(c.date, lang)}{c.notes ? ` · ${c.notes}` : ''}</div>
                </div>
                {d.missing > 0 ? <span className="badge st-dead">−{d.missing}</span> : d.extra > 0 ? <span className="badge st-sold">+{d.extra}</span> : <span className="badge owner">✓</span>}
              </li>
            )
          })}
        </ul>
      )}
      <ErrorText error={counts.error} />
    </Section>
  )
}
