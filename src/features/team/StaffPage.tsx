import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ErrorText, Loading, Section, numOrNull, textOrNull } from '../../components/ui'
import { activityByDay, type ActivityKind } from '../../lib/calc/activity'
import { addDays, todayIso } from '../../lib/calc/dates'
import { formatDate, formatDateShort } from '../../lib/format'
import { useI18n, type DictKey } from '../../lib/i18n'
import { useMembers } from '../../lib/queries'
import { supabase } from '../../lib/supabase'
import { useActivity, useShifts, useStaff, type Staff } from '../../lib/team'
import { DiarySection, DocsSection, LeaveSection } from './TeamParts'

const ACT_EMOJI: Record<ActivityKind, string> = {
  task_done: '✅', task_added: '⏰', spray: '💧', fertiliser: '🌱', fieldwork: '🛠', planting: '🚜', harvest: '🌾',
  animal_event: '🐑', animal: '🏷️', group_count: '🔢', head_count: '🔢', rain: '🌧️', fuel: '⛽', pin: '📍', pasture: '🌿',
  diary: '📓', leave: '🏖️', other: '✎',
}
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7]

/** Owner's view of one person: details, leave, documents, diary, what they did in the app, schedule. */
export function StaffPage() {
  const { id } = useParams<{ id: string }>()
  const { t, lang } = useI18n()
  const staff = useStaff()
  const s = staff.data?.find((x) => x.id === id)
  const today = todayIso()
  const shifts = useShifts(today, addDays(today, 13))
  const [editing, setEditing] = useState(false)
  if (staff.isLoading) return <Loading />
  if (!s) return <div className="page"><Link to="/team?tab=staff" className="back">‹ {t('teamTitle')}</Link><p>Not found.</p></div>
  const upcoming = (shifts.data ?? []).filter((x) => x.staff_id === s.id)
  return (
    <div className="page stack">
      <Link to="/team?tab=staff" className="back">‹ {t('teamTitle')}</Link>
      <section className="card group-hero">
        <span className="avatar big" aria-hidden="true">{s.full_name.slice(0, 1).toUpperCase()}</span>
        <div className="grow">
          <h1>{s.full_name}</h1>
          <p className="muted">{[s.job_title, t(`emp_${s.employment_type}` as DictKey), s.start_date ? `${t('staffSince')} ${formatDateShort(s.start_date, lang)}` : null].filter(Boolean).join(' · ')}</p>
          {s.phone && <p className="small"><a href={`tel:${s.phone}`}>📞 {s.phone}</a></p>}
        </div>
      </section>
      <div className="btn-row">
        {s.user_id && <Link className="btn primary" to={`/chat/${s.user_id}`}>💬 {t('chatSend')}</Link>}
        <button className="btn" onClick={() => setEditing(!editing)}>✎ {t('staffDetails')}</button>
      </div>
      {editing && <StaffForm staff={s} onDone={() => setEditing(false)} />}

      <Section title={`📅 ${t('myShifts')}`}>
        {upcoming.length === 0 ? <p className="muted">{t('myNoShifts')}</p> : (
          <ul className="list">{upcoming.map((x) => <li key={x.id} className="row small"><strong>{formatDateShort(x.date, lang)}</strong> {x.start_time?.slice(0, 5)}–{x.end_time?.slice(0, 5)} {x.work ? `· ${x.work}` : ''}</li>)}</ul>
        )}
        <Link className="small" to="/team?tab=schedule">{t('schedOpen')} ›</Link>
      </Section>
      <LeaveSection staff={s} />
      {s.user_id && <ActivitySection userId={s.user_id} />}
      <DiarySection staff={s} canWrite={!s.user_id} />
      <DocsSection staff={s} />
    </div>
  )
}

function ActivitySection({ userId }: { userId: string }) {
  const { t, w, lang } = useI18n()
  const [days, setDays] = useState(7)
  const activity = useActivity(userId, days)
  const byDay = activityByDay(activity.data ?? [])
  return (
    <Section title={`📋 ${t('actTitle')}`} action={<select className="small-select" value={days} onChange={(e) => setDays(Number(e.target.value))}>
      <option value={7}>{t('actDays', { n: 7 })}</option><option value={30}>{t('actDays', { n: 30 })}</option></select>}>
      <p className="tiny muted">{t('actHelp')}</p>
      {byDay.length === 0 ? <p className="muted">{t('actNone')}</p> : byDay.map((d) => (
        <div key={d.date} className="act-day">
          <h3 className="h4">{formatDate(d.date, lang)} <span className="small muted">· {d.items.length}</span></h3>
          <ul className="list">
            {d.items.map((a, i) => (
              <li key={i} className="row small">
                <span aria-hidden="true">{ACT_EMOJI[a.kind]}</span>
                <span className="grow">{t(`act_${a.kind}` as DictKey)}{a.label ? `: ${a.kind === 'planting' || a.kind === 'animal_event' || a.kind === 'leave' ? w(a.label) : a.label}` : ''}</span>
                <span className="muted">{new Date(a.at).toLocaleTimeString(lang === 'af' ? 'af-ZA' : 'en-ZA', { hour: '2-digit', minute: '2-digit' })}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <ErrorText error={activity.error} />
    </Section>
  )
}

function StaffForm({ staff, onDone }: { staff: Staff; onDone: () => void }) {
  const { t, lang } = useI18n()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const members = useMembers()
  const all = useStaff()
  const [f, setF] = useState({
    full_name: staff.full_name, job_title: staff.job_title ?? '', phone: staff.phone ?? '', id_number: staff.id_number ?? '', address: staff.address ?? '',
    emergency_contact: staff.emergency_contact ?? '', employment_type: staff.employment_type, start_date: staff.start_date ?? '', user_id: staff.user_id ?? '',
    work_days: staff.work_days, annual: String(staff.annual_leave_days), sick: String(staff.sick_leave_days), family: String(staff.family_leave_days),
    active: staff.active, notes: staff.notes ?? '',
  })
  const linked = new Set((all.data ?? []).filter((x) => x.id !== staff.id).map((x) => x.user_id).filter(Boolean))
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('staff').update({
        full_name: f.full_name.trim(), job_title: textOrNull(f.job_title), phone: textOrNull(f.phone), id_number: textOrNull(f.id_number), address: textOrNull(f.address),
        emergency_contact: textOrNull(f.emergency_contact), employment_type: f.employment_type, start_date: f.start_date || null, user_id: f.user_id || null,
        work_days: [...f.work_days].sort(), annual_leave_days: numOrNull(f.annual) ?? 15, sick_leave_days: numOrNull(f.sick) ?? 30, family_leave_days: numOrNull(f.family) ?? 3,
        active: f.active, notes: textOrNull(f.notes),
      }).eq('id', staff.id)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff'] }); onDone() },
  })
  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('staff').update({ deleted_at: new Date().toISOString() }).eq('id', staff.id)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff'] }); navigate('/team?tab=staff') },
  })
  const dayName = (d: number) => new Intl.DateTimeFormat(lang === 'af' ? 'af-ZA' : 'en-ZA', { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 10, 1 + d)))  // 2 Nov 2026 is a Monday
  const input = (k: keyof typeof f, label: string, type = 'text') => (
    <label>{label}<input type={type} value={String(f[k])} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>
  )
  return (
    <form className="card stack" onSubmit={(e) => { e.preventDefault(); save.mutate() }}>
      {input('full_name', t('staffName'))}
      {input('job_title', t('staffJob'))}
      <div className="grid2">
        {input('phone', t('phone'), 'tel')}
        {input('start_date', t('staffStart'), 'date')}
      </div>
      <label>{t('staffType')}
        <select value={f.employment_type} onChange={(e) => setF({ ...f, employment_type: e.target.value })}>
          {['permanent', 'seasonal', 'casual'].map((k) => <option key={k} value={k}>{t(`emp_${k}` as DictKey)}</option>)}
        </select>
      </label>
      <fieldset className="card-inset">
        <legend>{t('staffWorkDays')}</legend>
        <div className="chips">
          {WEEKDAYS.map((d) => (
            <button type="button" key={d} className={`chip ${f.work_days.includes(d) ? 'on' : ''}`}
              onClick={() => setF({ ...f, work_days: f.work_days.includes(d) ? f.work_days.filter((x) => x !== d) : [...f.work_days, d] })}>{dayName(d)}</button>
          ))}
        </div>
      </fieldset>
      <fieldset className="card-inset stack">
        <legend>{t('leaveTitle')}</legend>
        <div className="grid3">
          {input('annual', t('lv_annual'))}
          {input('sick', t('lv_sickCycle'))}
          {input('family', t('lv_family'))}
        </div>
        <span className="hint">{t('leaveDefaultsHint')}</span>
      </fieldset>
      {input('id_number', t('staffId'))}
      {input('address', t('address'))}
      {input('emergency_contact', t('staffEmergency'))}
      <label>{t('staffLogin')}
        <select value={f.user_id} onChange={(e) => setF({ ...f, user_id: e.target.value })}>
          <option value="">{t('staffNoLogin')}</option>
          {(members.data ?? []).filter((m) => !linked.has(m.user_id)).map((m) => <option key={m.user_id} value={m.user_id}>{m.display_name || m.email}</option>)}
        </select>
      </label>
      <label>{t('notes')}<textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
      <label className="check"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> {t('staffActive')}</label>
      <div className="btn-row">
        <button type="button" className="btn" onClick={onDone}>{t('cancel')}</button>
        <button className="btn primary" disabled={save.isPending}>{t('save')}</button>
      </div>
      <button type="button" className="btn danger" onClick={() => confirm(t('staffRemoveConfirm', { name: staff.full_name })) && remove.mutate()}>{t('staffRemove')}</button>
      <ErrorText error={save.error ?? remove.error} />
    </form>
  )
}
