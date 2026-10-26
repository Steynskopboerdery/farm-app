import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ErrorText, Loading, numOrNull, SampleBadge, Section, textOrNull } from '../../components/ui'
import { useFarm } from '../../farm/FarmProvider'
import { hectaresFromBoundary, type Boundary } from '../../lib/calc/area'
import { formatDate, formatDateTime, formatHa } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { useAuditLog, useCamps, useCurrentPlantings, useFields, useMembers } from '../../lib/queries'
import { supabase } from '../../lib/supabase'

export function LandDetailPage() {
  const { kind, id } = useParams<{ kind: 'field' | 'camp'; id: string }>()
  const isField = kind === 'field'
  const table = isField ? 'fields' : 'camps'
  const { t, w, lang } = useI18n()
  const { isOwner } = useFarm()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const fields = useFields()
  const camps = useCamps()
  const plantings = useCurrentPlantings()

  const record = isField ? fields.data?.find((f) => f.id === id) : camps.data?.find((c) => c.id === id)
  const planting = isField && id ? plantings.data?.get(id) : undefined

  const [form, setForm] = useState({ name: '', hectares: '', type: '', notes: '' })
  useEffect(() => {
    if (!record) return
    setForm({
      name: record.name,
      hectares: record.hectares?.toString() ?? '',
      type: ('soil_type' in record ? record.soil_type : record.pasture_type) ?? '',
      notes: record.notes ?? '',
    })
  }, [record])

  const save = useMutation({
    mutationFn: async () => {
      const base = { name: form.name.trim(), hectares: numOrNull(form.hectares), notes: textOrNull(form.notes) }
      const { error } = isField
        ? await supabase.from('fields').update({ ...base, soil_type: textOrNull(form.type) }).eq('id', id!)
        : await supabase.from('camps').update({ ...base, pasture_type: textOrNull(form.type) }).eq('id', id!)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] })
      qc.invalidateQueries({ queryKey: ['audit_log'] })
    },
  })

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from(table).update({ deleted_at: new Date().toISOString() }).eq('id', id!)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] })
      navigate(`/land${isField ? '' : '?tab=camps'}`)
    },
  })

  if (fields.isLoading || camps.isLoading) return <Loading />
  if (!record) return <div className="page"><p>Not found.</p><Link to="/land">{t('back')}</Link></div>

  const boundary = record.boundary_geojson as unknown as Boundary | null

  function submit(e: FormEvent) {
    e.preventDefault()
    save.mutate()
  }

  return (
    <div className="page stack">
      <Link to={`/land${isField ? '' : '?tab=camps'}`} className="back">‹ {t('back')}</Link>
      <h1>{record.name} <SampleBadge show={record.is_sample} /></h1>

      {isField && (
        <Section title={t('currentCrop')}>
          {planting ? (
            <dl className="facts">
              <dt>{t('currentCrop')}</dt><dd>{w(planting.crop)}{planting.cultivar ? ` (${planting.cultivar})` : ''}</dd>
              <dt>{t('plantedOn')}</dt><dd>{formatDate(planting.planting_date, lang)}</dd>
              <dt>{t('expectedHarvest')}</dt><dd>{formatDate(planting.expected_harvest_date, lang)}</dd>
            </dl>
          ) : <p className="muted">{t('noCrop')}</p>}
          <p className="small muted">{t('comingPhase2')}</p>
        </Section>
      )}

      <Section title={t('outline')}>
        <p>{boundary ? t('outlineDrawn', { ha: formatHa(hectaresFromBoundary(boundary), lang) }) : t('outlineMissing')}</p>
        <div className="btn-row">
          {boundary && <Link className="btn" to={`/map?focus=${kind}:${id}`}>{t('showOnMap')}</Link>}
          {isOwner && <Link className="btn primary" to={`/map?draw=${kind}:${id}`}>{t('drawOnMap')}</Link>}
        </div>
      </Section>

      <form className="card stack" onSubmit={submit}>
        <label>{t('name')}<input required disabled={!isOwner} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label>{t('hectares')}<input inputMode="decimal" disabled={!isOwner} value={form.hectares} onChange={(e) => setForm({ ...form, hectares: e.target.value })} /></label>
        <label>{isField ? t('soilType') : t('pastureType')}<input disabled={!isOwner} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} /></label>
        <label>{t('notes')}<textarea rows={3} disabled={!isOwner} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
        {isOwner && <button className="btn primary" disabled={save.isPending}>{save.isPending ? t('saving') : save.isSuccess ? `✓ ${t('saved')}` : t('save')}</button>}
        <ErrorText error={save.error} />
      </form>

      {isOwner && <History table={table} id={id!} />}

      {isOwner && (
        <button className="btn danger" disabled={remove.isPending}
          onClick={() => confirm(t('removeConfirm', { name: record.name })) && remove.mutate()}>
          {isField ? t('removeField') : t('removeCamp')}
        </button>
      )}
      <ErrorText error={remove.error} />
    </div>
  )
}

const HIDDEN_KEYS = new Set(['updated_at', 'created_at', 'created_by', 'farm_id', 'id'])

function History({ table, id }: { table: string; id: string }) {
  const { t, lang } = useI18n()
  const log = useAuditLog(table, id)
  const members = useMembers()
  const who = (uid: string | null) => members.data?.find((m) => m.user_id === uid)?.email ?? '–'

  return (
    <Section title={t('history')}>
      {(log.data ?? []).length === 0 ? <p className="muted">{t('historyEmpty')}</p> : (
        <ul className="list">
          {log.data!.map((e) => {
            const o = (e.old_data ?? {}) as Record<string, unknown>
            const n = (e.new_data ?? {}) as Record<string, unknown>
            const changed = e.action === 'update'
              ? Object.keys(n).filter((k) => !HIDDEN_KEYS.has(k) && JSON.stringify(o[k]) !== JSON.stringify(n[k]))
              : []
            const label = e.action === 'insert' ? t('created') : n.deleted_at && !o.deleted_at ? t('deleted') : t('updated')
            return (
              <li key={e.id} className="history-item">
                <div><strong>{label}</strong> · {formatDateTime(e.changed_at, lang)}</div>
                <div className="small muted">{t('by')} {who(e.changed_by)}</div>
                {changed.length > 0 && (
                  <ul className="small changes">
                    {changed.map((k) => (
                      <li key={k}>{k.replace(/_/g, ' ')}: {k === 'boundary_geojson' ? (n[k] ? '✎' : '–') : `${fmt(o[k])} → ${fmt(n[k])}`}</li>
                    ))}
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

const fmt = (v: unknown) => (v == null || v === '' ? '–' : String(v))
