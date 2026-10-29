import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { ErrorText, Section, numOrNull, textOrNull } from '../../components/ui'
import { useFarm, useFarmId } from '../../farm/FarmProvider'
import { todayIso } from '../../lib/calc/dates'
import { leaveBalances, workingDays } from '../../lib/calc/leave'
import { signedUrl } from '../../lib/farmRecords'
import { formatDateShort, formatNumber } from '../../lib/format'
import { useI18n, type DictKey } from '../../lib/i18n'
import { supabase } from '../../lib/supabase'
import { saveRow } from '../../lib/outbox'
import { QueuedNote } from '../../components/OutboxBar'
import { DOC_KINDS, LEAVE_EMOJI, LEAVE_TYPES, uploadStaffDoc, useDiary, useLeave, useStaffDocs, type Leave, type Staff } from '../../lib/team'

export function Balances({ staff, leave }: { staff: Staff; leave: Leave[] }) {
  const { t, lang } = useI18n()
  const b = leaveBalances(staff, leave, todayIso())
  const tile = (emoji: string, label: string, left: number, entitled: number) => (
    <div className="stat"><span className="stat-n">{emoji} {formatNumber(left, 1, lang)}</span><span className="stat-l">{label}</span><span className="tiny muted">{t('ofDays', { n: formatNumber(entitled, 1, lang) })}</span></div>
  )
  return (
    <>
      <div className="stats three">
        {tile('🏖️', t('lv_annual'), b.annual.left, b.annual.entitled)}
        {tile('🤒', t('lv_sick'), b.sick.left, b.sick.entitled)}
        {tile('👪', t('lv_family'), b.family.left, b.family.entitled)}
      </div>
      <p className="tiny muted">{t('leaveRules', { cycle: formatDateShort(b.sick.cycleStart, lang) })}</p>
    </>
  )
}

/** Ask for leave (worker) or record it (owner, approved straight away). A sick note or form can be attached. */
export function LeaveForm({ staff, onDone }: { staff: Staff; onDone: () => void }) {
  const { t } = useI18n()
  const { isOwner } = useFarm()
  const farmId = useFarmId()
  const qc = useQueryClient()
  const [f, setF] = useState({ type: 'annual', start: todayIso(), end: todayIso(), days: '', reason: '' })
  const [file, setFile] = useState<File | null>(null)
  const counted = workingDays(f.start, f.end, staff.work_days)
  const save = useMutation({
    networkMode: 'always',  // without an attachment it is kept on the phone when there is no signal
    mutationFn: async () => {
      const days = numOrNull(f.days) ?? counted
      const id = crypto.randomUUID()
      const row = {
        id, farm_id: farmId, staff_id: staff.id, type: f.type, start_date: f.start, end_date: f.end < f.start ? f.start : f.end, days, reason: textOrNull(f.reason),
        ...(isOwner ? { status: 'approved', decided_at: new Date().toISOString() } : {}),
      }
      if (!file) return saveRow('leave_requests', row)
      if (!navigator.onLine) throw new Error(t('needsSignalForFile'))
      const { error } = await supabase.from('leave_requests').insert(row)
      if (error) throw error
      await uploadStaffDoc(farmId, staff.id, file, f.type === 'sick' ? 'sick_note' : 'leave_form', null, id)
      return { queued: false }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave_requests'] }); qc.invalidateQueries({ queryKey: ['staff_documents'] }); onDone() },
  })
  return (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); save.mutate() }}>
      <div className="chips">
        {LEAVE_TYPES.map((k) => <button type="button" key={k} className={`chip ${f.type === k ? 'on' : ''}`} onClick={() => setF({ ...f, type: k })}>{LEAVE_EMOJI[k]} {t(`lv_${k}` as DictKey)}</button>)}
      </div>
      <div className="grid2">
        <label>{t('exp_from')}<input type="date" required value={f.start} onChange={(e) => setF({ ...f, start: e.target.value, end: e.target.value > f.end ? e.target.value : f.end })} /></label>
        <label>{t('exp_to')}<input type="date" required value={f.end} min={f.start} onChange={(e) => setF({ ...f, end: e.target.value })} /></label>
      </div>
      <label>{t('leaveDays')}<input inputMode="decimal" value={f.days} placeholder={String(counted)} onChange={(e) => setF({ ...f, days: e.target.value })} />
        <span className="hint">{t('leaveDaysHint', { n: counted })}</span>
      </label>
      <label>{t('leaveReason')}<input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></label>
      <label className="receipt-pick">
        <span>📎 {file ? file.name : f.type === 'sick' ? t('attachSickNote') : t('attachForm')}</span>
        <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        {f.type === 'sick' && <span className="hint">{t('sickNoteRule')}</span>}
      </label>
      <div className="btn-row">
        <button type="button" className="btn" onClick={onDone}>{t('cancel')}</button>
        <button className="btn primary" disabled={save.isPending}>{save.isPending ? t('saving') : isOwner ? t('save') : t('leaveSend')}</button>
      </div>
      <ErrorText error={save.error} />
    </form>
  )
}

export function LeaveRow({ l, name, actions }: { l: Leave; name?: string; actions?: ReactNode }) {
  const { t, lang } = useI18n()
  return (
    <li className="row">
      <span className="kind-emoji" aria-hidden="true">{LEAVE_EMOJI[l.type]}</span>
      <div className="grow">
        <strong>{name ? `${name} · ` : ''}{t(`lv_${l.type}` as DictKey)}</strong> <span className={`badge lv-${l.status}`}>{t(`lvs_${l.status}` as DictKey)}</span>
        <div className="small muted">{formatDateShort(l.start_date, lang)}{l.end_date !== l.start_date ? ` – ${formatDateShort(l.end_date, lang)}` : ''} · {t('nDays', { n: formatNumber(l.days, 1, lang) })}{l.reason ? ` · ${l.reason}` : ''}</div>
        {l.owner_note && <div className="small">💬 {l.owner_note}</div>}
      </div>
      {actions}
    </li>
  )
}

export function LeaveSection({ staff }: { staff: Staff }) {
  const { t } = useI18n()
  const { isOwner } = useFarm()
  const qc = useQueryClient()
  const leave = useLeave(staff.id)
  const [open, setOpen] = useState(false)
  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('leave_requests').update({ status: 'cancelled' }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leave_requests'] }),
  })
  const list = leave.data ?? []
  return (
    <Section title={`🏖️ ${t('leaveTitle')}`} action={!open ? <button className="btn small" onClick={() => setOpen(true)}>+ {isOwner ? t('leaveRecord') : t('leaveAsk')}</button> : undefined}>
      <Balances staff={staff} leave={list} />
      {open && <div className="subcard"><LeaveForm staff={staff} onDone={() => setOpen(false)} /></div>}
      {list.length === 0 ? <p className="muted">{t('leaveNone')}</p> : (
        <ul className="list">
          {list.slice(0, 30).map((l) => (
            <LeaveRow key={l.id} l={l} actions={l.status === 'pending' && !isOwner
              ? <button className="btn small ghost" onClick={() => confirm(`${t('leaveCancel')}?`) && cancel.mutate(l.id)}>{t('leaveCancel')}</button> : undefined} />
          ))}
        </ul>
      )}
      <ErrorText error={leave.error ?? cancel.error} />
    </Section>
  )
}

export function DocsSection({ staff }: { staff: Staff }) {
  const { t, lang } = useI18n()
  const { isOwner } = useFarm()
  const farmId = useFarmId()
  const qc = useQueryClient()
  const docs = useStaffDocs(staff.id)
  const [kind, setKind] = useState('cv')
  const [file, setFile] = useState<File | null>(null)
  const add = useMutation({
    mutationFn: async () => { if (file) await uploadStaffDoc(farmId, staff.id, file, kind, null) },
    onSuccess: () => { setFile(null); qc.invalidateQueries({ queryKey: ['staff_documents'] }) },
  })
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('staff_documents').update({ deleted_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff_documents'] }),
  })
  async function open(path: string) {
    const url = await signedUrl('staff-docs', path)
    if (url) window.open(url, '_blank', 'noopener')
  }
  return (
    <Section title={`📁 ${t('docsTitle')}`}>
      {(docs.data ?? []).length === 0 ? <p className="muted">{t('docsNone')}</p> : (
        <ul className="list">
          {(docs.data ?? []).map((d) => (
            <li key={d.id} className="row">
              <button className="row link-row plain grow" onClick={() => open(d.path)}>
                <span className="kind-emoji" aria-hidden="true">{d.path.endsWith('.pdf') ? '📄' : '🖼️'}</span>
                <span className="grow left"><strong>{t(`doc_${d.kind}` as DictKey)}</strong><span className="small muted"> · {d.title} · {formatDateShort(d.created_at, lang)}</span></span>
              </button>
              {isOwner && <button className="btn small ghost" aria-label={t('delete')} onClick={() => confirm(`${t('delete')}?`) && remove.mutate(d.id)}>✕</button>}
            </li>
          ))}
        </ul>
      )}
      <div className="stack">
        <label>{t('docKind')}
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            {DOC_KINDS.map((k) => <option key={k} value={k}>{t(`doc_${k}` as DictKey)}</option>)}
          </select>
        </label>
        <label className="receipt-pick">
          <span>📎 {file ? file.name : t('docPick')}</span>
          <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        {file && <button className="btn primary" disabled={add.isPending} onClick={() => add.mutate()}>{add.isPending ? t('saving') : t('docUpload')}</button>}
        <p className="tiny muted">{t('docsPrivate')}</p>
      </div>
      <ErrorText error={docs.error ?? add.error ?? remove.error} />
    </Section>
  )
}

export function DiarySection({ staff, canWrite }: { staff: Staff; canWrite: boolean }) {
  const { t, lang } = useI18n()
  const farmId = useFarmId()
  const qc = useQueryClient()
  const diary = useDiary(staff.id)
  const [f, setF] = useState({ date: todayIso(), hours: '', notes: '' })
  const add = useMutation({
    networkMode: 'always',  // kept on the phone without signal (see outbox)
    mutationFn: () => saveRow('work_diary', { farm_id: farmId, staff_id: staff.id, date: f.date, hours: numOrNull(f.hours), notes: f.notes.trim() }),
    onSuccess: () => { setF({ ...f, hours: '', notes: '' }); qc.invalidateQueries({ queryKey: ['work_diary'] }) },
  })
  return (
    <Section title={`📓 ${t('diaryTitle')}`}>
      {canWrite && (
        <form className="stack" onSubmit={(e) => { e.preventDefault(); if (f.notes.trim()) add.mutate() }}>
          <label>{t('diaryWhat')}<textarea rows={2} required value={f.notes} placeholder={t('diaryHint')} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
          <div className="grid2">
            <label>{t('date')}<input type="date" value={f.date} max={todayIso()} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
            <label>{t('diaryHours')}<input inputMode="decimal" value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} /></label>
          </div>
          <button className="btn primary" disabled={add.isPending}>{t('save')}</button>
          <QueuedNote show={!!add.data?.queued} />
          <ErrorText error={add.error} />
        </form>
      )}
      {(diary.data ?? []).length === 0 ? <p className="muted">{t('diaryNone')}</p> : (
        <ul className="list">
          {(diary.data ?? []).slice(0, 30).map((d) => (
            <li key={d.id} className="row">
              <div className="grow"><strong>{formatDateShort(d.date, lang)}</strong>{d.hours != null ? <span className="small muted"> · {formatNumber(d.hours, 1, lang)} h</span> : null}<div className="small">{d.notes}</div></div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}
