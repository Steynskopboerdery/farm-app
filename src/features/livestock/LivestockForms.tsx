import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AnimalIcon } from '../../components/AnimalIcon'
import { ErrorText, Loading, numOrNull, textOrNull } from '../../components/ui'
import { useFarm, useFarmId } from '../../farm/FarmProvider'
import { todayIso } from '../../lib/calc/dates'
import { breedingDates, countAfter, countChange, type EventType } from '../../lib/calc/livestock'
import { formatDate } from '../../lib/format'
import { useI18n, type DictKey } from '../../lib/i18n'
import { CLASSES, EVENT_TYPES, SPECIES, useGroupRecords, type Group } from '../../lib/livestock'
import { useCamps, useGroups, useSpecies } from '../../lib/queries'
import { supabase } from '../../lib/supabase'

const EVENT_EMOJI: Record<EventType, string> = {
  birth: '🐣', vaccination: '💉', dosing: '💊', weighing: '⚖️', moved: '🚚', sale: '💰', death: '✝', other: '📝',
}

function useInvalidate() {
  const qc = useQueryClient()
  return () => {
    for (const k of ['livestock-records', 'livestock_groups', 'breeding_plans', 'shearing_plans', 'tasks', 'audit_log']) qc.invalidateQueries({ queryKey: [k] })
  }
}

function FormShell({ back, title, subtitle, children }: { back: string; title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <div className="page stack">
      <Link to={back} className="back">‹ {subtitle ?? ''}</Link>
      <h1>{title}</h1>
      {children}
    </div>
  )
}

/** Route: /livestock/group/:id/:kind/:recordId? and /livestock/new */
export function LivestockFormPage({ kind: fixedKind }: { kind?: string }) {
  const params = useParams<{ id?: string; kind?: string; recordId?: string }>()
  const kind = fixedKind ?? params.kind
  const groups = useGroups()
  const records = useGroupRecords(params.id)
  if (groups.isLoading || (params.id && records.isLoading)) return <Loading />
  const group = groups.data?.find((g) => g.id === params.id)
  if (kind === 'new') return <GroupForm />
  if (!group) return <div className="page"><p>Not found.</p></div>
  if (kind === 'edit') return <GroupForm group={group} />
  if (kind === 'event') return <EventForm key={params.recordId ?? 'new'} group={group} recordId={params.recordId} />
  if (kind === 'breeding') return <BreedingForm key={params.recordId ?? 'new'} group={group} recordId={params.recordId} />
  if (kind === 'shearing') return <ShearingForm key={params.recordId ?? 'new'} group={group} recordId={params.recordId} />
  if (kind === 'animal') return <AnimalForm key={params.recordId ?? 'new'} group={group} recordId={params.recordId} />
  return null
}

function GroupForm({ group }: { group?: Group }) {
  const { t, w } = useI18n()
  const farmId = useFarmId()
  const navigate = useNavigate()
  const invalidate = useInvalidate()
  const camps = useCamps()
  const [f, setF] = useState({
    name: group?.name ?? '', species: group?.species ?? 'sheep', cls: group?.class ?? 'ewes', breed: group?.breed ?? '',
    quantity: String(group?.quantity ?? ''), camp: group?.camp_id ?? '', notes: group?.notes ?? '',
  })
  const save = useMutation({
    mutationFn: async () => {
      const row = {
        name: f.name.trim(), species: f.species, class: f.cls, breed: textOrNull(f.breed),
        quantity: Math.max(0, Math.round(numOrNull(f.quantity) ?? 0)), camp_id: f.camp || null, notes: textOrNull(f.notes),
      }
      if (group) {
        const { error } = await supabase.from('livestock_groups').update(row).eq('id', group.id)
        if (error) throw error
        return group.id
      }
      const { data, error } = await supabase.from('livestock_groups').insert({ ...row, farm_id: farmId }).select('id').single()
      if (error) throw error
      return data.id
    },
    onSuccess: (id) => { invalidate(); navigate(`/livestock/group/${id}`) },
  })
  const classes = CLASSES[f.species as 'sheep' | 'cattle'] ?? []
  return (
    <FormShell back={group ? `/livestock/group/${group.id}` : '/livestock'} subtitle={group?.name ?? t('livestockTitle')} title={group ? t('groupDetails') : t('addGroup')}>
      <form className="card stack" onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate() }}>
        <fieldset className="crop-picker two">
          <legend>{t('species')}</legend>
          {SPECIES.map((sp) => (
            <button key={sp} type="button" className={`crop-tile ${f.species === sp ? 'on' : ''}`} aria-pressed={f.species === sp}
              onClick={() => setF({ ...f, species: sp, cls: CLASSES[sp].includes(f.cls) ? f.cls : CLASSES[sp][0] })}>
              <AnimalIcon species={sp} size={44} /><span>{w(sp)}</span>
            </button>
          ))}
        </fieldset>
        <label>{t('groupName')}<input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <div className="grid2">
          <label>{t('animalClass')}
            <select value={f.cls} onChange={(e) => setF({ ...f, cls: e.target.value })}>
              {classes.map((c) => <option key={c} value={c}>{w(c)}</option>)}
            </select>
          </label>
          <label>{t('quantity')}<input inputMode="numeric" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} /></label>
        </div>
        <label>{t('breed')}<input value={f.breed} onChange={(e) => setF({ ...f, breed: e.target.value })} /></label>
        <label>{t('camp')}
          <select value={f.camp} onChange={(e) => setF({ ...f, camp: e.target.value })}>
            <option value="">{t('noCamp')}</option>
            {(camps.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>{t('notes')}<textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
        <button className="btn primary" disabled={save.isPending}>{save.isPending ? t('saving') : t('save')}</button>
        <ErrorText error={save.error} />
      </form>
    </FormShell>
  )
}

function EventForm({ group, recordId }: { group: Group; recordId?: string }) {
  const { t, lang } = useI18n()
  const { isOwner } = useFarm()
  const farmId = useFarmId()
  const navigate = useNavigate()
  const invalidate = useInvalidate()
  const camps = useCamps()
  const records = useGroupRecords(group.id)
  const existing = recordId ? records.data?.events.find((e) => e.id === recordId) : undefined
  const animals = (records.data?.animals ?? []).filter((a) => a.status === 'alive' || a.id === existing?.animal_id)
  const [type, setType] = useState<EventType>((existing?.type as EventType) ?? 'vaccination')
  const [f, setF] = useState({
    date: existing?.date ?? todayIso(), quantity: existing?.quantity != null ? String(existing.quantity) : '',
    weight: existing?.weight_kg != null ? String(existing.weight_kg) : '', product: existing?.product ?? '',
    toCamp: existing?.to_camp_id ?? '', animal: existing?.animal_id ?? '', notes: existing?.notes ?? '', nextDue: '',
  })
  const [adjust, setAdjust] = useState(true)
  const [moveGroup, setMoveGroup] = useState(true)
  const back = `/livestock/group/${group.id}`
  const changesCount = !existing && countChange(type, 1) !== 0
  // For one tagged animal the count changes by one.
  const qty = f.animal ? 1 : numOrNull(f.quantity)
  const newCount = countAfter(group.quantity, type, qty)

  const save = useMutation({
    mutationFn: async () => {
      const row = {
        farm_id: farmId, group_id: group.id, type, date: f.date,
        animal_id: f.animal || null,
        quantity: f.animal ? 1 : numOrNull(f.quantity) == null ? null : Math.round(numOrNull(f.quantity)!),
        weight_kg: type === 'weighing' ? numOrNull(f.weight) : null,
        product: type === 'vaccination' || type === 'dosing' || type === 'other' ? textOrNull(f.product) : null,
        from_camp_id: type === 'moved' ? (existing?.from_camp_id ?? group.camp_id) : null,
        to_camp_id: type === 'moved' ? f.toCamp || null : null,
        notes: textOrNull(f.notes),
      }
      const { error } = existing
        ? await supabase.from('animal_events').update(row).eq('id', existing.id)
        : await supabase.from('animal_events').insert(row)
      if (error) throw error
      if (existing) return
      // Follow-on changes, only when the event is first recorded.
      if (changesCount && adjust) {
        const { error } = await supabase.from('livestock_groups').update({ quantity: newCount }).eq('id', group.id)
        if (error) throw error
      }
      if (f.animal && (type === 'sale' || type === 'death')) {
        const { error } = await supabase.from('animals').update({ status: type === 'sale' ? 'sold' : 'dead' }).eq('id', f.animal)
        if (error) throw error
      }
      if (type === 'moved' && moveGroup && f.toCamp) {
        const { error } = await supabase.from('livestock_groups').update({ camp_id: f.toCamp }).eq('id', group.id)
        if (error) throw error
      }
      if ((type === 'vaccination' || type === 'dosing') && f.nextDue) {
        const { error } = await supabase.from('tasks').insert({
          farm_id: farmId, group_id: group.id, type, due_date: f.nextDue,
          title: `${t(`ev_${type}` as DictKey)}: ${group.name}${f.product ? ` (${f.product})` : ''}`,
        })
        if (error) throw error
      }
    },
    onSuccess: () => { invalidate(); navigate(back) },
  })

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('animal_events').update({ deleted_at: new Date().toISOString() }).eq('id', existing!.id)
      if (error) throw error
    },
    onSuccess: () => { invalidate(); navigate(back) },
  })

  return (
    <FormShell back={back} subtitle={group.name} title={existing ? `${t('editRecord')}: ${t(`ev_${type}` as DictKey)}` : t('addEvent')}>
      <p className="muted">{group.name} · {group.quantity} {t('head')}</p>
      <form className="card stack" onSubmit={(e) => { e.preventDefault(); save.mutate() }}>
        <fieldset className="crop-picker four" disabled={!isOwner}>
          <legend>{t('eventType')}</legend>
          {EVENT_TYPES.map((k) => (
            <button key={k} type="button" className={`crop-tile ${type === k ? 'on' : ''}`} aria-pressed={type === k} onClick={() => setType(k)}>
              <span className="kind-emoji" aria-hidden="true">{EVENT_EMOJI[k]}</span><span>{t(`ev_${k}` as DictKey)}</span>
            </button>
          ))}
        </fieldset>
        <label>{t('date')}<input type="date" value={f.date} disabled={!isOwner} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
        {animals.length > 0 && (
          <label>{t('tag')}
            <select value={f.animal} disabled={!isOwner} onChange={(e) => setF({ ...f, animal: e.target.value })}>
              <option value="">{t('groups')}: {group.name}</option>
              {animals.map((a) => <option key={a.id} value={a.id}>{a.tag}</option>)}
            </select>
          </label>
        )}
        {!f.animal && (
          <label>{t('howMany')}
            <input inputMode="numeric" value={f.quantity} disabled={!isOwner} placeholder={countChange(type, 1) === 0 ? String(group.quantity) : ''}
              onChange={(e) => setF({ ...f, quantity: e.target.value })} />
          </label>
        )}
        {type === 'weighing' && <label>{t('weightKg')}<input inputMode="decimal" value={f.weight} disabled={!isOwner} onChange={(e) => setF({ ...f, weight: e.target.value })} /></label>}
        {(type === 'vaccination' || type === 'dosing' || type === 'other') && (
          <label>{type === 'other' ? t('whatWasDone') : t('productUsed')}<input value={f.product} disabled={!isOwner} onChange={(e) => setF({ ...f, product: e.target.value })} /></label>
        )}
        {type === 'moved' && (
          <>
            <label>{t('toCamp')}
              <select value={f.toCamp} disabled={!isOwner} onChange={(e) => setF({ ...f, toCamp: e.target.value })}>
                <option value="">–</option>
                {(camps.data ?? []).filter((c) => c.id !== group.camp_id || c.id === f.toCamp).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            {!existing && <label className="check"><input type="checkbox" checked={moveGroup} onChange={(e) => setMoveGroup(e.target.checked)} /> {t('groupDetails')}: {t('camp').toLowerCase()} → {camps.data?.find((c) => c.id === f.toCamp)?.name ?? '…'}</label>}
          </>
        )}
        {changesCount && (
          <label className="check"><input type="checkbox" checked={adjust} onChange={(e) => setAdjust(e.target.checked)} /> {t('adjustCount', { from: group.quantity, to: newCount })}</label>
        )}
        {!existing && (type === 'vaccination' || type === 'dosing') && (
          <label>{t('nextDue')}<input type="date" value={f.nextDue} onChange={(e) => setF({ ...f, nextDue: e.target.value })} /></label>
        )}
        {(type === 'vaccination' || type === 'dosing') && <p className="advice">{t('vetAdvice')}</p>}
        <label>{t('notes')}<textarea rows={2} value={f.notes} disabled={!isOwner} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
        {existing && <p className="tiny muted">{formatDate(existing.date, lang)} · {t('editNoRecount')}</p>}
        {isOwner && <button className="btn primary" disabled={save.isPending || (type === 'moved' && !f.toCamp)}>{save.isPending ? t('saving') : t('save')}</button>}
        <ErrorText error={save.error} />
      </form>
      {isOwner && existing && (
        <button className="btn danger" disabled={remove.isPending} onClick={() => confirm(t('removeRecordConfirm')) && remove.mutate()}>{t('removeRecord')}</button>
      )}
    </FormShell>
  )
}

function BreedingForm({ group, recordId }: { group: Group; recordId?: string }) {
  const { t, lang } = useI18n()
  const { isOwner } = useFarm()
  const farmId = useFarmId()
  const navigate = useNavigate()
  const invalidate = useInvalidate()
  const species = useSpecies()
  const records = useGroupRecords(group.id)
  const existing = recordId ? records.data?.breeding.find((b) => b.id === recordId) : undefined
  const defaultDays = species.data?.find((s) => s.species === group.species)?.gestation_days ?? (group.species === 'cattle' ? 283 : 147)
  const [f, setF] = useState({
    start: existing?.joining_start_date ?? todayIso(), end: existing?.joining_end_date ?? '',
    days: String(existing?.gestation_days ?? defaultDays), birthStart: existing?.expected_birth_start ?? '',
    birthEnd: existing?.expected_birth_end ?? '', males: existing?.males_used != null ? String(existing.males_used) : '', notes: existing?.notes ?? '',
  })
  const [touched, setTouched] = useState(!!existing)
  const [reminder, setReminder] = useState(true)
  const back = `/livestock/group/${group.id}`
  const calc = numOrNull(f.days) && f.start ? breedingDates({ joiningStart: f.start, joiningEnd: f.end || null, gestationDays: numOrNull(f.days)! }) : null
  // Dates follow the joining dates until they are changed by hand.
  const birthStart = touched ? f.birthStart : calc?.birthStart ?? ''
  const birthEnd = touched ? f.birthEnd : calc?.birthEnd ?? ''
  const what = group.species === 'cattle' ? t('cal_calving').toLowerCase() : t('cal_lambing').toLowerCase()

  const save = useMutation({
    mutationFn: async () => {
      const row = {
        farm_id: farmId, group_id: group.id, joining_start_date: f.start, joining_end_date: f.end || null,
        gestation_days: Math.round(numOrNull(f.days) ?? defaultDays), expected_birth_start: birthStart || null,
        expected_birth_end: birthEnd || null, males_used: numOrNull(f.males), notes: textOrNull(f.notes),
      }
      const { error } = existing
        ? await supabase.from('breeding_plans').update(row).eq('id', existing.id)
        : await supabase.from('breeding_plans').insert(row)
      if (error) throw error
      if (!existing && reminder && calc) {
        const { error } = await supabase.from('tasks').insert({
          farm_id: farmId, group_id: group.id, type: group.species === 'cattle' ? 'calving' : 'lambing',
          due_date: calc.prepareBy, title: `${t('prepareFor', { what })}: ${group.name}`,
        })
        if (error) throw error
      }
    },
    onSuccess: () => { invalidate(); navigate(back) },
  })
  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('breeding_plans').update({ deleted_at: new Date().toISOString() }).eq('id', existing!.id)
      if (error) throw error
    },
    onSuccess: () => { invalidate(); navigate(back) },
  })

  return (
    <FormShell back={back} subtitle={group.name} title={existing ? `${t('editPlan')}: ${t('cal_joining')}` : t('addBreeding')}>
      <form className="card stack" onSubmit={(e) => { e.preventDefault(); save.mutate() }}>
        <div className="grid2">
          <label>{t('joiningStart')}<input type="date" required value={f.start} disabled={!isOwner} onChange={(e) => setF({ ...f, start: e.target.value })} /></label>
          <label>{t('joiningEnd')}<input type="date" value={f.end} disabled={!isOwner} onChange={(e) => setF({ ...f, end: e.target.value })} /></label>
        </div>
        <div className="grid2">
          <label>{t('gestationLabel')}<input inputMode="numeric" value={f.days} disabled={!isOwner} onChange={(e) => setF({ ...f, days: e.target.value })} /></label>
          <label>{t('males')}<input inputMode="numeric" value={f.males} disabled={!isOwner} onChange={(e) => setF({ ...f, males: e.target.value })} /></label>
        </div>
        <div className="grid2">
          <label>{t('birthFrom', { what })}<input type="date" value={birthStart} disabled={!isOwner}
            onChange={(e) => { setTouched(true); setF({ ...f, birthStart: e.target.value, birthEnd: birthEnd }) }} /></label>
          <label>{t('birthTo', { what })}<input type="date" value={birthEnd} disabled={!isOwner}
            onChange={(e) => { setTouched(true); setF({ ...f, birthEnd: e.target.value, birthStart: birthStart }) }} /></label>
        </div>
        <span className="hint">{t('breedingCalcNote')}</span>
        {!existing && calc && (
          <label className="check"><input type="checkbox" checked={reminder} onChange={(e) => setReminder(e.target.checked)} /> {t('prepareReminder', { what, date: formatDate(calc.prepareBy, lang) })}</label>
        )}
        <label>{t('notes')}<textarea rows={2} value={f.notes} disabled={!isOwner} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
        {isOwner && <button className="btn primary" disabled={save.isPending}>{save.isPending ? t('saving') : t('save')}</button>}
        <ErrorText error={save.error} />
      </form>
      {isOwner && existing && <button className="btn danger" onClick={() => confirm(t('removeRecordConfirm')) && remove.mutate()}>{t('removeRecord')}</button>}
    </FormShell>
  )
}

function ShearingForm({ group, recordId }: { group: Group; recordId?: string }) {
  const { t } = useI18n()
  const { isOwner } = useFarm()
  const farmId = useFarmId()
  const navigate = useNavigate()
  const invalidate = useInvalidate()
  const records = useGroupRecords(group.id)
  const existing = recordId ? records.data?.shearing.find((s) => s.id === recordId) : undefined
  const [f, setF] = useState({
    planned: existing?.planned_date ?? todayIso(), done: existing?.done_date ?? '',
    kg: existing?.kg_wool != null ? String(existing.kg_wool) : '', notes: existing?.notes ?? '',
  })
  const back = `/livestock/group/${group.id}`
  const save = useMutation({
    mutationFn: async () => {
      const row = { farm_id: farmId, group_id: group.id, planned_date: f.planned, done_date: f.done || null, kg_wool: numOrNull(f.kg), notes: textOrNull(f.notes) }
      const { error } = existing
        ? await supabase.from('shearing_plans').update(row).eq('id', existing.id)
        : await supabase.from('shearing_plans').insert(row)
      if (error) throw error
    },
    onSuccess: () => { invalidate(); navigate(back) },
  })
  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('shearing_plans').update({ deleted_at: new Date().toISOString() }).eq('id', existing!.id)
      if (error) throw error
    },
    onSuccess: () => { invalidate(); navigate(back) },
  })
  return (
    <FormShell back={back} subtitle={group.name} title={existing ? `${t('editPlan')}: ${t('cal_shearing')}` : t('addShearing')}>
      <form className="card stack" onSubmit={(e) => { e.preventDefault(); save.mutate() }}>
        <label>{t('plannedDate')}<input type="date" required value={f.planned} disabled={!isOwner} onChange={(e) => setF({ ...f, planned: e.target.value })} /></label>
        <div className="grid2">
          <label>{t('doneDate')}<input type="date" value={f.done} disabled={!isOwner} onChange={(e) => setF({ ...f, done: e.target.value })} /></label>
          <label>{t('kgWool')}<input inputMode="decimal" value={f.kg} disabled={!isOwner} onChange={(e) => setF({ ...f, kg: e.target.value })} /></label>
        </div>
        {!f.done && isOwner && <button type="button" className="btn" onClick={() => setF({ ...f, done: todayIso() })}>✓ {t('shorn')} ({t('isToday')})</button>}
        <label>{t('notes')}<textarea rows={2} value={f.notes} disabled={!isOwner} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
        {isOwner && <button className="btn primary" disabled={save.isPending}>{save.isPending ? t('saving') : t('save')}</button>}
        <ErrorText error={save.error} />
      </form>
      {isOwner && existing && <button className="btn danger" onClick={() => confirm(t('removeRecordConfirm')) && remove.mutate()}>{t('removeRecord')}</button>}
    </FormShell>
  )
}

function AnimalForm({ group, recordId }: { group: Group; recordId?: string }) {
  const { t } = useI18n()
  const { isOwner } = useFarm()
  const farmId = useFarmId()
  const navigate = useNavigate()
  const invalidate = useInvalidate()
  const records = useGroupRecords(group.id)
  const existing = recordId ? records.data?.animals.find((a) => a.id === recordId) : undefined
  const [f, setF] = useState({
    tag: existing?.tag ?? '', sex: existing?.sex ?? (['cows', 'ewes', 'heifers'].includes(group.class) ? 'female' : 'male'),
    birth: existing?.birth_date ?? '', status: existing?.status ?? 'alive', notes: existing?.notes ?? '',
  })
  const [adjust, setAdjust] = useState(true)
  const back = `/livestock/group/${group.id}`
  // Adding an animal or taking one off the farm changes the group's count by one.
  const delta = !existing ? 1 : existing.status === 'alive' && f.status !== 'alive' ? -1 : existing.status !== 'alive' && f.status === 'alive' ? 1 : 0

  const save = useMutation({
    mutationFn: async () => {
      const row = { farm_id: farmId, group_id: group.id, species: group.species, tag: f.tag.trim(), sex: f.sex || null, birth_date: f.birth || null, status: f.status, notes: textOrNull(f.notes) }
      const { error } = existing
        ? await supabase.from('animals').update(row).eq('id', existing.id)
        : await supabase.from('animals').insert(row)
      if (error) throw error
      if (delta && adjust) {
        const { error } = await supabase.from('livestock_groups').update({ quantity: Math.max(0, group.quantity + delta) }).eq('id', group.id)
        if (error) throw error
      }
    },
    onSuccess: () => { invalidate(); navigate(back) },
  })
  return (
    <FormShell back={back} subtitle={group.name} title={existing ? `${t('tag')} ${existing.tag}` : t('addAnimal')}>
      <form className="card stack" onSubmit={(e) => { e.preventDefault(); save.mutate() }}>
        <label>{t('tag')}<input required value={f.tag} disabled={!isOwner} onChange={(e) => setF({ ...f, tag: e.target.value })} /></label>
        <div className="grid2">
          <label>{t('sex')}
            <select value={f.sex} disabled={!isOwner} onChange={(e) => setF({ ...f, sex: e.target.value })}>
              <option value="female">{t('female')}</option><option value="male">{t('male')}</option>
            </select>
          </label>
          <label>{t('birthDate')}<input type="date" value={f.birth} disabled={!isOwner} onChange={(e) => setF({ ...f, birth: e.target.value })} /></label>
        </div>
        <label>{t('status')}
          <select value={f.status} disabled={!isOwner} onChange={(e) => setF({ ...f, status: e.target.value })}>
            {['alive', 'sold', 'dead'].map((s) => <option key={s} value={s}>{t(`st_${s}` as DictKey)}</option>)}
          </select>
        </label>
        {delta !== 0 && <label className="check"><input type="checkbox" checked={adjust} onChange={(e) => setAdjust(e.target.checked)} /> {t('adjustCount', { from: group.quantity, to: Math.max(0, group.quantity + delta) })}</label>}
        <label>{t('notes')}<textarea rows={2} value={f.notes} disabled={!isOwner} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
        {isOwner && <button className="btn primary" disabled={save.isPending}>{save.isPending ? t('saving') : t('save')}</button>}
        <ErrorText error={save.error} />
      </form>
    </FormShell>
  )
}
