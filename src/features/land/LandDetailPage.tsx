import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ErrorText, Loading, numOrNull, SampleBadge, Section, textOrNull } from '../../components/ui'
import { useFarm } from '../../farm/FarmProvider'
import { hectaresFromBoundary, type Boundary } from '../../lib/calc/area'
import { formatDateTime, formatHa } from '../../lib/format'
import { useI18n, type DictKey } from '../../lib/i18n'
import { FieldSeasonPanel } from '../crops/FieldSeasonPanel'
import { useAuditLog, useCamps, useFields, useGroups, useMembers } from '../../lib/queries'
import { PlaceAnimals } from './PlaceAnimals'
import { PASTURES } from '../../lib/places'
import { supabase, type Tables } from '../../lib/supabase'

export function LandDetailPage() {
  const { kind, id } = useParams<{ kind: 'field' | 'camp'; id: string }>()
  const isField = kind === 'field'
  const table = isField ? 'fields' : 'camps'
  const { t, lang } = useI18n()
  const { isOwner } = useFarm()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const fields = useFields()
  const camps = useCamps()

  const fieldRec = isField ? fields.data?.find((f) => f.id === id) : undefined
  const campRec = isField ? undefined : camps.data?.find((c) => c.id === id)
  const record = fieldRec ?? campRec

  const [form, setForm] = useState({ name: '', hectares: '', type: '', notes: '' })
  useEffect(() => {
    if (!record) return
    setForm({
      name: record.name,
      hectares: record.hectares?.toString() ?? '',
      type: (fieldRec ? fieldRec.soil_type : campRec?.pasture_type) ?? '',
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

      {fieldRec && <FieldUse field={fieldRec} />}

      {!isField && <PlaceAnimals placeKind="camp" placeId={id!} hectares={record.hectares} />}

      <Section title={t('outline')}>
        <p>{boundary ? t('outlineDrawn', { ha: formatHa(hectaresFromBoundary(boundary), lang) }) : t('outlineMissing')}</p>
        <div className="btn-row">
          {boundary && <Link className="btn" to={`/map?focus=${kind}:${id}`}>{t('showOnMap')}</Link>}
          {isOwner && <Link className="btn primary" to={`/map?draw=${kind}:${id}`}>{t('drawOnMap')}</Link>}
        </div>
      </Section>

      <details className="card" open={!isField}>
      <summary><h2>{isField ? t('fieldDetails') : t('campDetails')}</h2></summary>
      <form className="stack" onSubmit={submit}>
        <label>{t('name')}<input required disabled={!isOwner} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label>{t('hectares')}<input inputMode="decimal" disabled={!isOwner} value={form.hectares} onChange={(e) => setForm({ ...form, hectares: e.target.value })} /></label>
        <label>{isField ? t('soilType') : t('pastureType')}<input disabled={!isOwner} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} /></label>
        <label>{t('notes')}<textarea rows={3} disabled={!isOwner} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
        {isOwner && <button className="btn primary" disabled={save.isPending}>{save.isPending ? t('saving') : save.isSuccess ? `✓ ${t('saved')}` : t('save')}</button>}
        <ErrorText error={save.error} />
      </form>
      </details>

      {isOwner && <History table={table} id={id!} withChildren={isField} />}

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

const HIDDEN_KEYS = new Set(['updated_at', 'created_at', 'created_by', 'farm_id', 'id', 'field_id', 'season_id', 'yield_per_ha'])

function History({ table, id, withChildren }: { table: string; id: string; withChildren?: boolean }) {
  const { t, lang } = useI18n()
  const log = useAuditLog(table, id, true, withChildren)
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
                <div>
                  <strong>{label}</strong>
                  {e.table_name !== table && ` · ${t(`rec_${e.table_name}` as DictKey)}: ${String(n.product ?? n.crop ?? o.product ?? o.crop ?? (n.tons != null ? `${n.tons} t` : ''))}`}
                  {' · '}{formatDateTime(e.changed_at, lang)}
                </div>
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

/** A field is planted for harvest (its crops and season records) or used for grazing (what grows, and the animals on it). */
function FieldUse({ field }: { field: Tables<'fields'> }) {
  const { t } = useI18n()
  const { isOwner } = useFarm()
  const qc = useQueryClient()
  const groups = useGroups()
  const onIt = (groups.data ?? []).filter((g) => g.field_id === field.id).length
  const save = useMutation({
    mutationFn: async (patch: Partial<Tables<'fields'>>) => {
      const { error } = await supabase.from('fields').update(patch).eq('id', field.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fields'] }),
  })
  const grazing = field.use === 'grazing'
  return (
    <>
      <section className="card stack">
        <h2>{t('fieldUseTitle')}</h2>
        <div className="segmented">
          <button className={!grazing ? 'on' : ''} disabled={!isOwner || save.isPending} onClick={() => save.mutate({ use: 'crop' })}>🌾 {t('useCrop')}</button>
          <button className={grazing ? 'on' : ''} disabled={!isOwner || save.isPending} onClick={() => save.mutate({ use: 'grazing' })}>🐑 {t('useGrazing')}</button>
        </div>
        <p className="small muted">{grazing ? t('useGrazingHelp') : t('useCropHelp')}</p>
        {grazing && (
          <>
            <span className="label-text">{t('whatGrowsHere')}</span>
            <div className="chip-wrap">
              {PASTURES.map((p) => (
                <button key={p} className={`chip ${field.pasture_type === p ? 'on' : ''}`} disabled={!isOwner || save.isPending}
                  onClick={() => save.mutate({ pasture_type: field.pasture_type === p ? null : p })}>{t(`past_${p}` as DictKey)}</button>
              ))}
            </div>
          </>
        )}
        <ErrorText error={save.error} />
      </section>
      {!grazing && <FieldSeasonPanel fieldId={field.id} fieldName={field.name} hectares={field.hectares} />}
      {/* Planted fields are grazed too: stubble after harvest, or a crop not worth harvesting. */}
      {(grazing || onIt > 0 || isOwner) && <PlaceAnimals placeKind="field" placeId={field.id} hectares={field.hectares} note={grazing ? undefined : t('grazeAfterHarvest')} />}
    </>
  )
}
