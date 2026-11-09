import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimalIcon } from '../../components/AnimalIcon'
import { ErrorText, Section } from '../../components/ui'
import { useFarm, useFarmId } from '../../farm/FarmProvider'
import { todayIso } from '../../lib/calc/dates'
import { lsuOf } from '../outlook/OutlookPlanning'
import { formatNumber } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { placeColumns, placeKey, usePlaces } from '../../lib/places'
import { useGroups } from '../../lib/queries'
import { supabase } from '../../lib/supabase'

/**
 * The animals on a camp or grazing field, with a way to put a flock or herd here (all of it, or only some:
 * then the group is split and the rest stays where it was). Moves are kept in the animals' records.
 */
export function PlaceAnimals({ placeKind, placeId, hectares, note }: { placeKind: 'camp' | 'field'; placeId: string; hectares: number | null; note?: string }) {
  const { t, w, lang } = useI18n()
  const { can } = useFarm()
  const farmId = useFarmId()
  const qc = useQueryClient()
  const groups = useGroups()
  const { byKey } = usePlaces()
  const key = `${placeKind}:${placeId}`
  const here = (groups.data ?? []).filter((g) => placeKey(g) === key)
  const elsewhere = (groups.data ?? []).filter((g) => placeKey(g) !== key && g.quantity > 0)
  const [adding, setAdding] = useState(false)
  const [pick, setPick] = useState('')
  const [count, setCount] = useState('')
  const chosen = elsewhere.find((g) => g.id === pick)
  const total = here.reduce((a, g) => a + g.quantity, 0)
  const lsu = here.reduce((a, g) => a + g.quantity * lsuOf(g.species, g.class), 0)

  const move = useMutation({
    mutationFn: async () => {
      if (!chosen) return
      const n = Math.min(chosen.quantity, Math.max(1, Math.round(Number(count) || chosen.quantity)))
      const to = placeColumns(key)
      let groupId = chosen.id
      if (n < chosen.quantity) {
        // Only some go: they become their own group here; the rest stay.
        const { data, error } = await supabase.from('livestock_groups').insert({
          farm_id: farmId, name: `${chosen.name} (${byKey.get(key)?.name ?? ''})`, species: chosen.species, class: chosen.class,
          breed: chosen.breed, quantity: n, ...to,
        }).select('id').single()
        if (error) throw error
        groupId = data.id
        const { error: e2 } = await supabase.from('livestock_groups').update({ quantity: chosen.quantity - n }).eq('id', chosen.id)
        if (e2) throw e2
      } else {
        const { error } = await supabase.from('livestock_groups').update(to).eq('id', chosen.id)
        if (error) throw error
      }
      const { error } = await supabase.from('animal_events').insert({
        farm_id: farmId, group_id: groupId, type: 'moved', date: todayIso(), quantity: n,
        from_camp_id: chosen.camp_id, from_field_id: chosen.field_id, to_camp_id: to.camp_id, to_field_id: to.field_id,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['livestock_groups'] })
      qc.invalidateQueries({ queryKey: ['livestock-records'] })
      setAdding(false); setPick(''); setCount('')
    },
  })

  return (
    <Section title={`🐑 ${t('animalsHere')}`}>
      {note && <p className="small muted">{note}</p>}
      {here.length === 0 ? <p className="muted">{t('noAnimalsHere')}</p> : (
        <>
          <ul className="list">
            {here.map((g) => (
              <li key={g.id}>
                <Link className="row link-row" to={`/livestock/group/${g.id}`}>
                  <AnimalIcon species={g.species} size={36} />
                  <div className="grow">{g.name}<span className="small muted"> · {w(g.class)}</span></div>
                  <strong>{g.quantity}</strong>
                  <span className="chev">›</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="small muted">{t('placeTotals', { n: total, lsu: formatNumber(lsu, 1, lang) })}{hectares ? ` · ${t('placePerHa', { v: formatNumber(lsu / hectares, 2, lang) })}` : ''}</p>
        </>
      )}
      {can('animal_records') && !adding && (
        <div className="btn-row">
          {elsewhere.length > 0 && <button className="btn primary" onClick={() => setAdding(true)}>➜ {t('putAnimalsHere')}</button>}
          <Link className="btn" to={`/livestock/new?place=${key}`}>+ {t('addNewGroupHere')}</Link>
        </div>
      )}
      {adding && (
        <form className="card-inset stack" onSubmit={(e) => { e.preventDefault(); move.mutate() }}>
          <label>{t('whichAnimals')}
            <select required value={pick} onChange={(e) => { setPick(e.target.value); setCount('') }}>
              <option value="">–</option>
              {elsewhere.map((g) => <option key={g.id} value={g.id}>{g.name} · {w(g.class)} ({g.quantity}){byKey.get(placeKey(g)) ? ` · ${byKey.get(placeKey(g))!.name}` : ''}</option>)}
            </select>
          </label>
          {chosen && (
            <label>{t('howMany')}<input inputMode="numeric" value={count} placeholder={String(chosen.quantity)} onChange={(e) => setCount(e.target.value)} />
              <span className="hint">{t('howManyHint', { n: chosen.quantity })}</span></label>
          )}
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => setAdding(false)}>{t('cancel')}</button>
            <button className="btn primary" disabled={!chosen || move.isPending}>{move.isPending ? t('saving') : t('moveHere')}</button>
          </div>
          <ErrorText error={move.error} />
        </form>
      )}
    </Section>
  )
}
