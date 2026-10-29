import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ErrorText, Loading, Section, textOrNull } from '../../components/ui'
import { useFarm, useFarmId } from '../../farm/FarmProvider'
import { useAuth } from '../../auth/AuthProvider'
import { addDays, todayIso } from '../../lib/calc/dates'
import { leaveBalances, onLeave } from '../../lib/calc/leave'
import { formatDateShort } from '../../lib/format'
import { useI18n, type DictKey } from '../../lib/i18n'
import { useCamps, useFields, useMembers } from '../../lib/queries'
import { supabase } from '../../lib/supabase'
import { LEAVE_EMOJI, useLeave, useMyStaff, useShifts, useStaff, useStaffDirectory, type Shift } from '../../lib/team'
import { DiarySection, DocsSection, LeaveRow, LeaveSection } from './TeamParts'

/** Monday of the week containing `day`. */
export function weekStart(day: string): string {
  const dow = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7
  return addDays(day, -dow)
}
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : '')

export function TeamPage() {
  const { t } = useI18n()
  const { isOwner } = useFarm()
  const [params, setParams] = useSearchParams()
  const tabs = isOwner ? (['schedule', 'staff', 'leave'] as const) : (['mine', 'schedule'] as const)
  const tab = (tabs as readonly string[]).includes(params.get('tab') ?? '') ? params.get('tab')! : tabs[0]
  const pending = useLeave().data?.filter((l) => l.status === 'pending').length ?? 0
  return (
    <div className="page stack">
      <Link to="/menu" className="back">‹ {t('menu')}</Link>
      <div className="card-head"><h1>👷 {t('teamTitle')}</h1><Link className="btn small" to="/chat">💬 {t('chatTitle')}</Link></div>
      <div className="segmented">
        {tabs.map((k) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setParams({ tab: k })}>
            {t(`team_${k}` as DictKey)}{k === 'leave' && pending > 0 ? ` (${pending})` : ''}
          </button>
        ))}
      </div>
      {tab === 'schedule' && <ScheduleWeek />}
      {tab === 'staff' && <StaffList />}
      {tab === 'leave' && <LeaveInbox />}
      {tab === 'mine' && <MyWork />}
    </div>
  )
}

function ScheduleWeek() {
  const { t, lang } = useI18n()
  const { isOwner } = useFarm()
  const farmId = useFarmId()
  const qc = useQueryClient()
  const today = todayIso()
  const [start, setStart] = useState(weekStart(today))
  const end = addDays(start, 6)
  const shifts = useShifts(addDays(start, -7), end)
  const people = useStaffDirectory()
  const leave = useLeave()
  const fields = useFields()
  const camps = useCamps()
  const [adding, setAdding] = useState<string | null>(null)
  const name = new Map((people.data ?? []).map((p) => [p.id, p.full_name]))
  const place = new Map([...(fields.data ?? []).map((f) => [f.id, f.name] as const), ...(camps.data ?? []).map((c) => [c.id, c.name] as const)])
  const list = shifts.data ?? []
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const fmtDay = (d: string) => new Intl.DateTimeFormat(lang === 'af' ? 'af-ZA' : 'en-ZA', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`))

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('shifts').update({ deleted_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shifts'] }),
  })
  // Copy last week's shifts to this week (same weekday), skipping people on approved leave.
  const copy = useMutation({
    mutationFn: async () => {
      const last = list.filter((s) => s.date < start)
      const rows = last.map((s) => ({ farm_id: farmId, staff_id: s.staff_id, date: addDays(s.date, 7), start_time: s.start_time, end_time: s.end_time, work: s.work, field_id: s.field_id, camp_id: s.camp_id }))
        .filter((r) => !onLeave((leave.data ?? []).filter((l) => l.staff_id === r.staff_id), r.date))
      if (!rows.length) throw new Error(t('schedNothingToCopy'))
      const { error } = await supabase.from('shifts').insert(rows)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shifts'] }),
  })

  if (shifts.isLoading || people.isLoading) return <Loading />
  const thisWeek = list.filter((s) => s.date >= start)
  return (
    <>
      <div className="row week-nav">
        <button className="btn small" onClick={() => setStart(addDays(start, -7))} aria-label={t('back')}>‹</button>
        <strong className="grow center">{formatDateShort(start, lang)} – {formatDateShort(end, lang)}</strong>
        <button className="btn small" onClick={() => setStart(addDays(start, 7))} aria-label={t('add')}>›</button>
      </div>
      {start !== weekStart(today) && <button className="btn small ghost" onClick={() => setStart(weekStart(today))}>{t('schedThisWeek')}</button>}
      {(people.data ?? []).length === 0 && <p className="muted">{isOwner ? t('staffNoneOwner') : t('staffNone')}</p>}
      {isOwner && thisWeek.length === 0 && list.some((s) => s.date < start) && (
        <button className="btn" disabled={copy.isPending} onClick={() => copy.mutate()}>⧉ {t('schedCopy')}</button>
      )}
      {days.map((d) => {
        const dayShifts = thisWeek.filter((s) => s.date === d)
        const away = isOwner ? (leave.data ?? []).filter((l) => l.status === 'approved' && l.start_date <= d && l.end_date >= d) : []
        return (
          <section key={d} className={`card ${d === today ? 'today' : ''}`}>
            <div className="card-head">
              <h2 className="h3">{fmtDay(d)}{d === today ? ` · ${t('today')}` : ''}</h2>
              {isOwner && adding !== d && <button className="btn small" onClick={() => setAdding(d)}>+ {t('add')}</button>}
            </div>
            {dayShifts.length === 0 && away.length === 0 && adding !== d && <p className="small muted">{t('schedNobody')}</p>}
            <ul className="list">
              {dayShifts.map((s) => (
                <li key={s.id} className="row">
                  <div className="grow">
                    <strong>{name.get(s.staff_id) ?? '–'}</strong>
                    {(s.start_time || s.end_time) && <span className="small muted"> · {hhmm(s.start_time)}–{hhmm(s.end_time)}</span>}
                    {(s.work || s.field_id || s.camp_id) && <div className="small">{[s.work, place.get(s.field_id ?? '') ?? place.get(s.camp_id ?? '')].filter(Boolean).join(' · ')}</div>}
                  </div>
                  {isOwner && <button className="btn small ghost" aria-label={t('delete')} onClick={() => remove.mutate(s.id)}>✕</button>}
                </li>
              ))}
              {away.map((l) => <li key={l.id} className="row small muted">{LEAVE_EMOJI[l.type]} {name.get(l.staff_id)} · {t(`lv_${l.type}` as DictKey)}</li>)}
            </ul>
            {adding === d && <ShiftForm date={d} onDone={() => setAdding(null)} />}
          </section>
        )
      })}
      <ErrorText error={shifts.error ?? remove.error ?? copy.error} />
    </>
  )
}

function ShiftForm({ date, onDone }: { date: string; onDone: () => void }) {
  const { t } = useI18n()
  const farmId = useFarmId()
  const qc = useQueryClient()
  const people = useStaffDirectory()
  const fields = useFields()
  const camps = useCamps()
  const active = (people.data ?? []).filter((p) => p.active)
  const [f, setF] = useState({ who: [] as string[], start: '07:00', end: '17:00', work: '', place: '' })
  const save = useMutation({
    mutationFn: async () => {
      if (!f.who.length) throw new Error(t('schedPickPeople'))
      const [kind, id] = f.place.split(':')
      const rows: Partial<Shift>[] = f.who.map((staff_id) => ({
        farm_id: farmId, staff_id, date, start_time: f.start || null, end_time: f.end || null, work: textOrNull(f.work),
        field_id: kind === 'f' ? id : null, camp_id: kind === 'c' ? id : null,
      }))
      const { error } = await supabase.from('shifts').insert(rows as never)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shifts'] }); onDone() },
  })
  return (
    <form className="subcard stack" onSubmit={(e) => { e.preventDefault(); save.mutate() }}>
      <div className="chips">
        {active.map((p) => (
          <button type="button" key={p.id} className={`chip ${f.who.includes(p.id) ? 'on' : ''}`}
            onClick={() => setF({ ...f, who: f.who.includes(p.id) ? f.who.filter((x) => x !== p.id) : [...f.who, p.id] })}>{p.full_name}</button>
        ))}
      </div>
      <div className="grid2">
        <label>{t('schedFrom')}<input type="time" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></label>
        <label>{t('schedTo')}<input type="time" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></label>
      </div>
      <label>{t('schedWork')}<input value={f.work} placeholder={t('schedWorkHint')} onChange={(e) => setF({ ...f, work: e.target.value })} /></label>
      <label>{t('schedWhere')}
        <select value={f.place} onChange={(e) => setF({ ...f, place: e.target.value })}>
          <option value="">–</option>
          {(fields.data ?? []).map((x) => <option key={x.id} value={`f:${x.id}`}>{x.name}</option>)}
          {(camps.data ?? []).map((x) => <option key={x.id} value={`c:${x.id}`}>{x.name}</option>)}
        </select>
      </label>
      <div className="btn-row">
        <button type="button" className="btn" onClick={onDone}>{t('cancel')}</button>
        <button className="btn primary" disabled={save.isPending}>{t('save')}</button>
      </div>
      <ErrorText error={save.error} />
    </form>
  )
}

function StaffList() {
  const { t, lang } = useI18n()
  const farmId = useFarmId()
  const qc = useQueryClient()
  const staff = useStaff()
  const leave = useLeave()
  const members = useMembers()
  const [adding, setAdding] = useState(false)
  const [f, setF] = useState({ name: '', job: '', phone: '', user: '' })
  const linked = new Set((staff.data ?? []).map((s) => s.user_id).filter(Boolean))
  const free = (members.data ?? []).filter((m) => m.role === 'worker' && !linked.has(m.user_id))
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('staff').insert({ farm_id: farmId, full_name: f.name.trim(), job_title: textOrNull(f.job), phone: textOrNull(f.phone), user_id: f.user || null })
      if (error) throw error
    },
    onSuccess: () => { setAdding(false); setF({ name: '', job: '', phone: '', user: '' }); qc.invalidateQueries({ queryKey: ['staff'] }) },
  })
  if (staff.isLoading) return <Loading />
  const today = todayIso()
  return (
    <>
      {(staff.data ?? []).length === 0 && <p className="muted">{t('staffNoneOwner')}</p>}
      <ul className="list card">
        {(staff.data ?? []).map((s) => {
          const mine = (leave.data ?? []).filter((l) => l.staff_id === s.id)
          const b = leaveBalances(s, mine, today)
          const away = onLeave(mine, today)
          return (
            <li key={s.id}>
              <Link className="row link-row" to={`/team/staff/${s.id}`}>
                <span className="avatar" aria-hidden="true">{s.full_name.slice(0, 1).toUpperCase()}</span>
                <div className="grow">
                  <strong>{s.full_name}</strong>{!s.active && <span className="badge st-sold"> {t('staffInactive')}</span>}
                  {away && <span className="badge lv-approved"> {LEAVE_EMOJI[away.type]} {t('onLeaveToday')}</span>}
                  {b.pending > 0 && <span className="badge lv-pending"> {t('leavePendingN', { n: b.pending })}</span>}
                  <div className="small muted">{[s.job_title, s.user_id ? `📱 ${t('hasLogin')}` : null, `${t('lv_annual')}: ${b.annual.left.toLocaleString(lang === 'af' ? 'af-ZA' : 'en-ZA')} ${t('daysLeft')}`].filter(Boolean).join(' · ')}</div>
                </div>
                <span className="chev">›</span>
              </Link>
            </li>
          )
        })}
      </ul>
      {!adding ? <button className="btn" onClick={() => setAdding(true)}>+ {t('staffAdd')}</button> : (
        <form className="card stack" onSubmit={(e) => { e.preventDefault(); add.mutate() }}>
          <h2>{t('staffAdd')}</h2>
          <label>{t('staffName')}<input required autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <label>{t('staffJob')}<input value={f.job} placeholder={t('staffJobHint')} onChange={(e) => setF({ ...f, job: e.target.value })} /></label>
          <label>{t('phone')}<input type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
          <label>{t('staffLogin')}
            <select value={f.user} onChange={(e) => setF({ ...f, user: e.target.value })}>
              <option value="">{t('staffNoLogin')}</option>
              {free.map((m) => <option key={m.user_id} value={m.user_id}>{m.display_name || m.email}</option>)}
            </select>
            <span className="hint">{t('staffLoginHint')}</span>
          </label>
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => setAdding(false)}>{t('cancel')}</button>
            <button className="btn primary" disabled={add.isPending}>{t('save')}</button>
          </div>
          <ErrorText error={add.error} />
        </form>
      )}
      <ErrorText error={staff.error} />
    </>
  )
}

function LeaveInbox() {
  const { t } = useI18n()
  const { session } = useAuth()
  const qc = useQueryClient()
  const leave = useLeave()
  const staff = useStaff()
  const [notes, setNotes] = useState<Record<string, string>>({})
  const name = new Map((staff.data ?? []).map((s) => [s.id, s.full_name]))
  const decide = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'approved' | 'declined' }) => {
      const { error } = await supabase.from('leave_requests').update({ status, owner_note: textOrNull(notes[id] ?? ''), decided_by: session?.user.id ?? null, decided_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leave_requests'] }),
  })
  if (leave.isLoading) return <Loading />
  const all = leave.data ?? []
  const pending = all.filter((l) => l.status === 'pending')
  const recent = all.filter((l) => l.status !== 'pending').slice(0, 30)
  return (
    <>
      <Section title={t('leaveWaiting')}>
        {pending.length === 0 ? <p className="muted">{t('leaveNoneWaiting')}</p> : (
          <div className="stack">
            {pending.map((l) => (
              <div key={l.id} className="subcard stack">
                <ul className="list"><LeaveRow l={l} name={name.get(l.staff_id)} /></ul>
                <input placeholder={t('leaveNoteHint')} value={notes[l.id] ?? ''} onChange={(e) => setNotes({ ...notes, [l.id]: e.target.value })} />
                <div className="btn-row">
                  <button className="btn" disabled={decide.isPending} onClick={() => decide.mutate({ id: l.id, status: 'declined' })}>✕ {t('leaveDecline')}</button>
                  <button className="btn primary" disabled={decide.isPending} onClick={() => decide.mutate({ id: l.id, status: 'approved' })}>✓ {t('leaveApprove')}</button>
                </div>
                <Link className="small" to={`/team/staff/${l.staff_id}`}>{t('leaveSeeBalance')} ›</Link>
              </div>
            ))}
          </div>
        )}
        <ErrorText error={decide.error} />
      </Section>
      <Section title={t('leaveRecent')}>
        {recent.length === 0 ? <p className="muted">{t('leaveNone')}</p> : <ul className="list">{recent.map((l) => <LeaveRow key={l.id} l={l} name={name.get(l.staff_id)} />)}</ul>}
      </Section>
    </>
  )
}

/** What a worker sees: their shifts, leave, diary and documents. */
function MyWork() {
  const { t, lang } = useI18n()
  const me = useMyStaff()
  const today = todayIso()
  const shifts = useShifts(today, addDays(today, 13))
  const fields = useFields()
  const camps = useCamps()
  if (me.isLoading) return <Loading />
  if (!me.data) return <p className="pill-info">{t('myNoRecord')}</p>
  const place = new Map([...(fields.data ?? []).map((f) => [f.id, f.name] as const), ...(camps.data ?? []).map((c) => [c.id, c.name] as const)])
  const mine = (shifts.data ?? []).filter((s) => s.staff_id === me.data!.id)
  return (
    <>
      <Section title={`📅 ${t('myShifts')}`}>
        {mine.length === 0 ? <p className="muted">{t('myNoShifts')}</p> : (
          <ul className="list">
            {mine.map((s) => (
              <li key={s.id} className="row">
                <div className="grow">
                  <strong>{s.date === today ? t('today') : formatDateShort(s.date, lang)}</strong>
                  {(s.start_time || s.end_time) && <span className="small muted"> · {hhmm(s.start_time)}–{hhmm(s.end_time)}</span>}
                  <div className="small">{[s.work, place.get(s.field_id ?? '') ?? place.get(s.camp_id ?? '')].filter(Boolean).join(' · ')}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <DiarySection staff={me.data} canWrite />
      <LeaveSection staff={me.data} />
      <DocsSection staff={me.data} />
    </>
  )
}
