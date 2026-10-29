import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { ErrorText, textOrNull } from '../../components/ui'
import { useFarm, useFarmId } from '../../farm/FarmProvider'
import { addDays, todayIso } from '../../lib/calc/dates'
import { PIN_EMOJI, PIN_KINDS, useSignedUrl, type MapPin } from '../../lib/farmRecords'
import { formatDateShort } from '../../lib/format'
import { useI18n, type DictKey } from '../../lib/i18n'
import { useMembers } from '../../lib/queries'
import { supabase } from '../../lib/supabase'
import { shrink } from '../dashboard/HeroPhoto'
import { saveRow } from '../../lib/outbox'

/** New pin: what it is, a note and a photo. */
export function PinForm({ at, onDone, onCancel }: { at: { lat: number; lng: number }; onDone: (id: string) => void; onCancel: () => void }) {
  const { t } = useI18n()
  const farmId = useFarmId()
  const qc = useQueryClient()
  const [f, setF] = useState({ kind: 'fence', title: '', notes: '' })
  const [photo, setPhoto] = useState<File | null>(null)
  const save = useMutation({
    networkMode: 'always',  // without signal the pin (not the photo) is kept on the phone
    mutationFn: async () => {
      const id = crypto.randomUUID()
      const row = { id, farm_id: farmId, kind: f.kind, title: f.title.trim() || t(`pin_${f.kind}` as DictKey), notes: textOrNull(f.notes), lat: at.lat, lng: at.lng }
      if (!photo || !navigator.onLine) {
        if (photo && !confirm(t('pinPhotoOffline'))) throw new Error(t('needsSignalForFile'))
        await saveRow('map_pins', row)
        return id
      }
      const { data, error } = await supabase.from('map_pins').insert(row).select('id').single()
      if (error) throw error
      if (photo) {
        const path = `${farmId}/${data.id}.jpg`
        const up = await supabase.storage.from('pin-photos').upload(path, await shrink(photo), { contentType: 'image/jpeg', upsert: true })
        if (up.error) throw up.error
        const { error: e2 } = await supabase.from('map_pins').update({ photo_path: path }).eq('id', data.id)
        if (e2) throw e2
      }
      return data.id
    },
    onSuccess: (id) => { qc.invalidateQueries({ queryKey: ['map_pins'] }); onDone(id) },
  })
  return (
    <form className="map-sheet stack" onSubmit={(e) => { e.preventDefault(); save.mutate() }}>
      <h2>📍 {t('pinNew')}</h2>
      <div className="chips">
        {PIN_KINDS.map((k) => (
          <button type="button" key={k} className={`chip ${f.kind === k ? 'on' : ''}`} onClick={() => setF({ ...f, kind: k })}>{PIN_EMOJI[k]} {t(`pin_${k}` as DictKey)}</button>
        ))}
      </div>
      <label>{t('pinTitle')}<input value={f.title} placeholder={t(`pin_${f.kind}` as DictKey)} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
      <label>{t('notes')}<textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
      <label className="receipt-pick">
        <span>📷 {photo ? photo.name : t('pinPhoto')}</span>
        <input type="file" accept="image/*" capture="environment" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
      </label>
      <div className="btn-row">
        <button type="button" className="btn" onClick={onCancel}>{t('cancel')}</button>
        <button className="btn primary" disabled={save.isPending}>{save.isPending ? t('saving') : t('save')}</button>
      </div>
      <ErrorText error={save.error} />
    </form>
  )
}

/** A pin that was tapped: details, photo, make it a task, mark it dealt with. */
export function PinDetails({ pin, onClose }: { pin: MapPin; onClose: () => void }) {
  const { t, lang } = useI18n()
  const { isOwner, can } = useFarm()
  const { session } = useAuth()
  const farmId = useFarmId()
  const qc = useQueryClient()
  const photo = useSignedUrl('pin-photos', pin.photo_path)
  const members = useMembers()
  const [tasking, setTasking] = useState(false)
  const [task, setTask] = useState({ due: addDays(todayIso(), 2), assignee: '' })
  const mine = pin.created_by === session?.user.id

  const resolve = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('map_pins').update({ resolved_at: pin.resolved_at ? null : new Date().toISOString() }).eq('id', pin.id)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['map_pins'] }); onClose() },
  })
  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('map_pins').update({ deleted_at: new Date().toISOString() }).eq('id', pin.id)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['map_pins'] }); onClose() },
  })
  const makeTask = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('tasks').insert({
        farm_id: farmId, type: 'general', title: `${PIN_EMOJI[pin.kind]} ${pin.title}`, notes: pin.notes, due_date: task.due || null,
        assigned_to: task.assignee || null, pin_id: pin.id,
      })
      if (error) throw error
    },
    onSuccess: () => { setTasking(false); qc.invalidateQueries({ queryKey: ['tasks'] }) },
  })

  return (
    <div className="map-sheet stack">
      <div className="row">
        <div className="grow">
          <h2>{PIN_EMOJI[pin.kind]} {pin.title}</h2>
          <div className="small muted">{t(`pin_${pin.kind}` as DictKey)} · {formatDateShort(pin.created_at, lang)}{pin.resolved_at ? ` · ✓ ${t('pinResolved')}` : ''}</div>
        </div>
        <button className="btn small" onClick={onClose} aria-label={t('close')}>✕</button>
      </div>
      {pin.notes && <p>{pin.notes}</p>}
      {photo.data && <a href={photo.data} target="_blank" rel="noopener"><img className="pin-photo" src={photo.data} alt={pin.title} /></a>}
      {makeTask.isSuccess && <p className="pill-info">✓ {t('pinTaskMade')}</p>}
      {tasking && (
        <div className="subcard stack">
          <div className="grid2">
            <label>{t('dueDate')}<input type="date" value={task.due} onChange={(e) => setTask({ ...task, due: e.target.value })} /></label>
            <label>{t('assignTo')}
              <select value={task.assignee} onChange={(e) => setTask({ ...task, assignee: e.target.value })}>
                <option value="">{t('anyone')}</option>
                {(members.data ?? []).map((m) => <option key={m.user_id} value={m.user_id}>{m.display_name || m.email}</option>)}
              </select>
            </label>
          </div>
          <button className="btn primary" disabled={makeTask.isPending} onClick={() => makeTask.mutate()}>{t('save')}</button>
        </div>
      )}
      <div className="btn-row">
        {can('tasks') && !tasking && !makeTask.isSuccess && <button className="btn" onClick={() => setTasking(true)}>⏰ {t('pinMakeTask')}</button>}
        {(isOwner || mine) && <button className="btn primary" disabled={resolve.isPending} onClick={() => resolve.mutate()}>{pin.resolved_at ? t('pinReopen') : `✓ ${t('pinResolve')}`}</button>}
        {isOwner && <button className="btn danger" onClick={() => confirm(`${t('delete')}?`) && remove.mutate()}>{t('delete')}</button>}
      </div>
      <a className="small" href={`https://www.google.com/maps/dir/?api=1&destination=${pin.lat},${pin.lng}`} target="_blank" rel="noopener">🧭 {t('pinDirections')}</a>
      <ErrorText error={resolve.error ?? remove.error ?? makeTask.error} />
    </div>
  )
}
