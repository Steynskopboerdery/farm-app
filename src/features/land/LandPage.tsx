import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ErrorText, Loading, numOrNull, SampleBadge } from '../../components/ui'
import { useFarm, useFarmId } from '../../farm/FarmProvider'
import { CropIcon } from '../../components/CropIcon'
import { CAMP_COLOUR } from '../../lib/crops'
import { formatHa } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { useCamps, useCurrentPlantings, useFields } from '../../lib/queries'
import { supabase } from '../../lib/supabase'

export function LandPage() {
  const { t, w, lang } = useI18n()
  const { isOwner } = useFarm()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'camps' ? 'camps' : 'fields'
  const fields = useFields()
  const camps = useCamps()
  const plantings = useCurrentPlantings()

  const rows = tab === 'fields' ? fields : camps
  const total = (rows.data ?? []).reduce((s, r) => s + (r.hectares ?? 0), 0)

  return (
    <div className="page stack">
      <h1>{t('landTitle')}</h1>
      <div className="segmented wide">
        <button className={tab === 'fields' ? 'on' : ''} onClick={() => setParams({})}>{t('fields')} ({fields.data?.length ?? 0})</button>
        <button className={tab === 'camps' ? 'on' : ''} onClick={() => setParams({ tab: 'camps' })}>{t('camps')} ({camps.data?.length ?? 0})</button>
      </div>
      {rows.isLoading ? <Loading /> : (
        <ul className="list card">
          {(rows.data ?? []).map((r) => {
            const crop = tab === 'fields' ? plantings.data?.get(r.id)?.crop : null
            return (
              <li key={r.id}>
                <Link className="row link-row" to={`/land/${tab === 'fields' ? 'field' : 'camp'}/${r.id}`}>
                  {tab === 'camps' ? <span className="swatch" style={{ background: CAMP_COLOUR }} /> : <CropIcon crop={crop} size={38} />}
                  <div className="grow">
                    <div>{r.name} <SampleBadge show={r.is_sample} /></div>
                    <div className="small muted">
                      {tab === 'fields' ? (crop ? w(crop) : t('noCrop')) : ('pasture_type' in r && r.pasture_type) || ''}
                      {!r.boundary_geojson && ` · ${t('mapNoOutline')}`}
                    </div>
                  </div>
                  <div>{formatHa(r.hectares, lang)}</div>
                  <span className="chev">›</span>
                </Link>
              </li>
            )
          })}
          <li className="row total"><div className="grow">{t('total')}</div><div>{formatHa(total, lang)}</div><span className="chev" /></li>
        </ul>
      )}
      <ErrorText error={rows.error} />
      {isOwner && <AddForm kind={tab === 'fields' ? 'field' : 'camp'} />}
    </div>
  )
}

function AddForm({ kind }: { kind: 'field' | 'camp' }) {
  const { t } = useI18n()
  const farmId = useFarmId()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [ha, setHa] = useState('')
  const table = kind === 'field' ? 'fields' : 'camps'

  const add = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from(table).insert({ farm_id: farmId, name: name.trim(), hectares: numOrNull(ha) }).select('id').single()
      if (error) throw error
      return data.id
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: [table] })
      navigate(`/land/${kind}/${id}`)
    },
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    if (name.trim()) add.mutate()
  }

  return (
    <form className="card stack" onSubmit={submit}>
      <h2>{kind === 'field' ? t('addField') : t('addCamp')}</h2>
      <label>{t('name')}<input required value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label>{t('hectares')}<input inputMode="decimal" value={ha} onChange={(e) => setHa(e.target.value)} /></label>
      <p className="small muted">{t('hectaresHelp')}</p>
      <button className="btn primary" disabled={add.isPending}>{add.isPending ? t('saving') : t('add')}</button>
      <ErrorText error={add.error} />
    </form>
  )
}
