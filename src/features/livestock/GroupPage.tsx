import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AnimalIcon } from '../../components/AnimalIcon'
import { ErrorText, Loading, Section } from '../../components/ui'
import { useFarm } from '../../farm/FarmProvider'
import { todayIso } from '../../lib/calc/dates'
import { ageInMonths } from '../../lib/calc/livestock'
import { formatDateShort, formatDateTime, formatNumber } from '../../lib/format'
import { useI18n, type DictKey } from '../../lib/i18n'
import { useGroupRecords, useGroupTasks } from '../../lib/livestock'
import { useAuditLog, useCamps, useGroups, useMembers } from '../../lib/queries'
import { supabase } from '../../lib/supabase'
import { countdown } from './LivestockCalendar'

export function GroupPage() {
  const { id } = useParams<{ id: string }>()
  const { t, w, lang } = useI18n()
  const { isOwner } = useFarm()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const groups = useGroups()
  const camps = useCamps()
  const records = useGroupRecords(id)
  const tasks = useGroupTasks(id)
  const today = todayIso()
  const group = groups.data?.find((g) => g.id === id)

  const done = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from('tasks').update({ status: 'done', done_at: new Date().toISOString() }).eq('id', taskId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('livestock_groups').update({ deleted_at: new Date().toISOString() }).eq('id', id!)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['livestock_groups'] })
      navigate('/livestock')
    },
  })

  if (groups.isLoading || records.isLoading) return <Loading />
  if (!group) return <div className="page"><p>Not found.</p><Link to="/livestock">{t('back')}</Link></div>

  const camp = camps.data?.find((c) => c.id === group.camp_id)
  const { events = [], animals = [], breeding = [], shearing = [] } = records.data ?? {}
  const alive = animals.filter((a) => a.status === 'alive')
  const base = `/livestock/group/${group.id}`
  const add = (to: string) => (isOwner ? <Link className="btn small" to={`${base}/${to}`}>+ {t('add')}</Link> : null)
  const birthWord = group.species === 'cattle' ? t('cal_calving') : t('cal_lambing')

  return (
    <div className="page stack">
      <Link to="/livestock" className="back">‹ {t('livestockTitle')}</Link>

      <section className="card group-hero">
        <AnimalIcon species={group.species} size={64} />
        <div className="grow">
          <h1>{group.name} {group.is_sample && <span className="badge sample">{t('sample')}</span>}</h1>
          <p className="muted">{[group.breed, w(group.class), w(group.species)].filter(Boolean).join(' · ')}</p>
          <p className="small">{camp ? <Link to={`/land/camp/${camp.id}`}>📍 {camp.name}</Link> : t('noCamp')}</p>
        </div>
        <div className="group-count big"><strong>{formatNumber(group.quantity, 0, lang)}</strong><span className="tiny muted">{t('head')}</span></div>
      </section>

      {isOwner && (
        <div className="btn-row">
          <Link className="btn primary" to={`${base}/event`}>+ {t('addEvent')}</Link>
        </div>
      )}
      {!isOwner && <p className="muted small">{t('viewOnly')}</p>}

      {(tasks.data ?? []).length > 0 && (
        <Section title={t('reminders')}>
          <ul className="list">
            {tasks.data!.map((task) => (
              <li key={task.id} className="row">
                <div className="grow">
                  <div>{task.title}</div>
                  <div className={`small ${task.due_date && task.due_date < today ? 'warn-text' : 'muted'}`}>{formatDateShort(task.due_date, lang)}</div>
                </div>
                <button className="btn small" disabled={done.isPending} onClick={() => done.mutate(task.id)}>✓ {t('markDone')}</button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title={t('breeding')} action={add('breeding')}>
        {breeding.length === 0 ? <p className="muted">{t('noEvents')}</p> : (
          <ul className="list">
            {breeding.map((b) => (
              <li key={b.id}>
                <Link className="row link-row" to={`${base}/breeding/${b.id}`}>
                  <span className="cal-dot cal-joining" aria-hidden="true" />
                  <div className="grow">
                    <div><strong>{t('cal_joining')}</strong> {formatDateShort(b.joining_start_date, lang)}{b.joining_end_date ? ` – ${formatDateShort(b.joining_end_date, lang)}` : ''}</div>
                    {b.expected_birth_start && (
                      <div className="small">{birthWord}: <strong>{formatDateShort(b.expected_birth_start, lang)}{b.expected_birth_end && b.expected_birth_end !== b.expected_birth_start ? ` – ${formatDateShort(b.expected_birth_end, lang)}` : ''}</strong></div>
                    )}
                    <div className="tiny muted">{b.gestation_days} {t('gestationLabel').toLowerCase().replace(/ \(.*\)/, '')}{b.males_used ? ` · ${b.males_used} ${t('males').toLowerCase()}` : ''}</div>
                  </div>
                  {b.expected_birth_start && <span className="small countdown">{countdown(t, today, b.expected_birth_start, b.expected_birth_end)}</span>}
                  <span className="chev">›</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {group.species === 'sheep' && (
        <Section title={t('shearingTitle')} action={add('shearing')}>
          {shearing.length === 0 ? <p className="muted">{t('noEvents')}</p> : (
            <ul className="list">
              {shearing.map((s) => (
                <li key={s.id}>
                  <Link className="row link-row" to={`${base}/shearing/${s.id}`}>
                    <span className="cal-dot cal-shearing" aria-hidden="true" />
                    <div className="grow">
                      <div><strong>{formatDateShort(s.done_date ?? s.planned_date, lang)}</strong>{s.done_date ? ` · ✓ ${t('shorn')}` : ''}</div>
                      <div className="small muted">{s.kg_wool != null ? `${formatNumber(s.kg_wool, 1, lang)} kg` : t('plannedDate')}</div>
                    </div>
                    {!s.done_date && <span className="small countdown">{countdown(t, today, s.planned_date, null)}</span>}
                    <span className="chev">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      <Section title={t('events')} action={add('event')}>
        {events.length === 0 ? <p className="muted">{t('noEvents')}</p> : (
          <ul className="list">
            {events.slice(0, 30).map((e) => {
              const animal = e.animal_id ? animals.find((a) => a.id === e.animal_id) : null
              const to = e.to_camp_id ? camps.data?.find((c) => c.id === e.to_camp_id)?.name : null
              return (
                <li key={e.id}>
                  <Link className="row link-row" to={`${base}/event/${e.id}`}>
                    <span className={`ev-dot ev-${e.type}`} aria-hidden="true" />
                    <div className="grow">
                      <div><strong>{t(`ev_${e.type}` as DictKey)}</strong>{e.quantity != null ? ` · ${formatNumber(e.quantity, 0, lang)}` : ''}{animal ? ` · ${animal.tag}` : ''}{to ? ` → ${to}` : ''}</div>
                      <div className="small muted">{formatDateShort(e.date, lang)}{e.product ? ` · ${e.product}` : ''}{e.weight_kg != null ? ` · ${formatNumber(e.weight_kg, 1, lang)} kg` : ''}</div>
                    </div>
                    <span className="chev">›</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </Section>

      {(group.species === 'cattle' || animals.length > 0) && (
        <Section title={`${t('animalsTitle')} · ${t('taggedCount', { n: alive.length })}`} action={add('animal')}>
          {animals.length === 0 ? <p className="muted">{t('noEvents')}</p> : (
            <ul className="list animal-list">
              {animals.map((a) => (
                <li key={a.id}>
                  <Link className="row link-row" to={`${base}/animal/${a.id}`}>
                    <span className="tag-chip">{a.tag}</span>
                    <div className="grow small">
                      {a.sex ? t(a.sex as DictKey) : ''}{a.birth_date ? ` · ${t('months', { n: ageInMonths(a.birth_date, today) })}` : ''}
                      {a.notes ? <span className="muted"> · {a.notes}</span> : null}
                    </div>
                    {a.status !== 'alive' && <span className={`badge st-${a.status}`}>{t(`st_${a.status}` as DictKey)}</span>}
                    <span className="chev">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {isOwner && <Link className="btn" to={`${base}/edit`}>{t('groupDetails')}</Link>}
      {isOwner && <GroupHistory groupId={group.id} />}
      {isOwner && (
        <button className="btn danger" disabled={remove.isPending}
          onClick={() => confirm(t('removeGroupConfirm', { name: group.name })) && remove.mutate()}>{t('removeGroup')}</button>
      )}
      <ErrorText error={records.error ?? done.error ?? remove.error} />
    </div>
  )
}

const HIDDEN = new Set(['updated_at', 'created_at', 'created_by', 'farm_id', 'id', 'group_id'])

function GroupHistory({ groupId }: { groupId: string }) {
  const { t, lang } = useI18n()
  const log = useAuditLog('livestock_groups', groupId, true, false, 'group_id')
  const members = useMembers()
  const who = (uid: string | null) => members.data?.find((m) => m.user_id === uid)?.email ?? '–'
  return (
    <Section title={t('history')}>
      {(log.data ?? []).length === 0 ? <p className="muted">{t('historyEmpty')}</p> : (
        <ul className="list">
          {log.data!.slice(0, 30).map((e) => {
            const o = (e.old_data ?? {}) as Record<string, unknown>
            const n = (e.new_data ?? {}) as Record<string, unknown>
            const changed = e.action === 'update' ? Object.keys(n).filter((k) => !HIDDEN.has(k) && JSON.stringify(o[k]) !== JSON.stringify(n[k])) : []
            const label = e.action === 'insert' ? t('created') : n.deleted_at && !o.deleted_at ? t('deleted') : t('updated')
            const what = e.table_name === 'animal_events' ? t(`ev_${String(n.type ?? o.type)}` as DictKey)
              : e.table_name === 'animals' ? `${t('tag')} ${String(n.tag ?? o.tag)}`
                : e.table_name === 'breeding_plans' ? t('cal_joining') : e.table_name === 'shearing_plans' ? t('cal_shearing') : ''
            return (
              <li key={e.id} className="history-item">
                <div><strong>{label}</strong>{what ? ` · ${what}` : ''} · {formatDateTime(e.changed_at, lang)}</div>
                <div className="small muted">{t('by')} {who(e.changed_by)}</div>
                {changed.length > 0 && (
                  <ul className="small changes">
                    {changed.map((k) => <li key={k}>{k.replace(/_/g, ' ')}: {String(o[k] ?? '–')} → {String(n[k] ?? '–')}</li>)}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Section>
  )
}
