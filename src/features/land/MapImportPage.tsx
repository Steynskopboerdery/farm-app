import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CropIcon } from '../../components/CropIcon'
import { ErrorText, numOrNull, textOrNull } from '../../components/ui'
import { useFarmId } from '../../farm/FarmProvider'
import { CROP_OPTIONS } from '../../lib/crops'
import { useI18n, type DictKey } from '../../lib/i18n'
import { useCamps, useFields } from '../../lib/queries'
import { photoDataUrl, readPhoto, type FieldMapReading } from '../../lib/readPhoto'
import { supabase } from '../../lib/supabase'

export const OVERLAY_KEY = 'farm.mapOverlay'

interface Row { use: boolean; kind: 'field' | 'camp'; name: string; hectares: string; crop: string; notes: string }

/** Photo of an old farm map: read the fields with AI and/or lay it over the satellite map to trace outlines. */
export function MapImportPage() {
  const { t, w } = useI18n()
  const farmId = useFarmId()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const fields = useFields()
  const camps = useCamps()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const existing = new Set([...(fields.data ?? []), ...(camps.data ?? [])].map((x) => x.name.trim().toLowerCase()))

  async function pick(f: File | undefined) {
    if (!f) return
    setFile(f)
    setRows(null)
    setError(null)
    setPreview(await photoDataUrl(f))
  }

  async function read() {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const r = await readPhoto<FieldMapReading>('fieldmap', farmId, file)
      const toRow = (kind: 'field' | 'camp') => (a: FieldMapReading['fields'][number]): Row => ({
        use: !existing.has(a.name.trim().toLowerCase()), kind, name: a.name, hectares: a.hectares != null ? String(a.hectares) : '',
        crop: a.crop && CROP_OPTIONS.includes(a.crop) ? a.crop : '', notes: a.notes ?? '',
      })
      setRows([...r.fields.map(toRow('field')), ...r.camps.map(toRow('camp'))])
      setNote(`${t(`conf_${r.confidence}` as DictKey)}${r.notes ? ` · ${r.notes}` : ''}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const create = useMutation({
    mutationFn: async () => {
      const chosen = (rows ?? []).filter((r) => r.use && r.name.trim())
      const toInsert = (kind: 'field' | 'camp') => chosen.filter((r) => r.kind === kind).map((r) => ({
        farm_id: farmId, name: r.name.trim(), hectares: numOrNull(r.hectares),
        notes: textOrNull([t('fromOldMap'), r.crop ? w(r.crop) : '', r.notes].filter(Boolean).join(' · ')),
      }))
      const f = toInsert('field')
      const c = toInsert('camp')
      if (f.length) { const { error } = await supabase.from('fields').insert(f); if (error) throw error }
      if (c.length) { const { error } = await supabase.from('camps').insert(c); if (error) throw error }
      return f.length + c.length
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fields'] })
      qc.invalidateQueries({ queryKey: ['camps'] })
      navigate('/land')
    },
  })

  function trace() {
    if (!preview) return
    try { sessionStorage.setItem(OVERLAY_KEY, preview) } catch { setError(t('photoTooBig')); return }
    navigate('/map?overlay=1')
  }

  const setRow = (i: number, patch: Partial<Row>) => setRows((rs) => rs!.map((r, k) => (k === i ? { ...r, ...patch } : r)))
  const count = (rows ?? []).filter((r) => r.use).length

  return (
    <div className="page stack">
      <Link to="/land" className="back">‹ {t('landTitle')}</Link>
      <h1>{t('importMap')}</h1>
      <p className="muted">{t('importMapHelp')}</p>

      <label className="receipt-pick">
        <span>📷 {file ? file.name : t('chooseMapPhoto')}</span>
        <input type="file" accept="image/*" onChange={(e) => pick(e.target.files?.[0])} />
      </label>
      {preview && <img src={preview} alt="" className="map-preview" />}

      {preview && (
        <div className="stack-tight">
          <button className="btn lime" disabled={busy} onClick={read}>{busy ? t('reading') : `✨ ${t('readMapAi')}`}</button>
          <button className="btn" onClick={trace}>🗺 {t('traceOnMap')}</button>
          <p className="tiny muted">{t('aiCostNote')}</p>
        </div>
      )}
      {error && <p className="error">{error}</p>}

      {rows && (
        <section className="card stack">
          <div className="card-head"><h2>{t('foundOnMap')}</h2><span className="small muted">{note}</span></div>
          {rows.length === 0 ? <p className="muted">{t('noData')}</p> : rows.map((r, i) => (
            <div key={i} className={`subcard import-row ${r.use ? '' : 'off'}`}>
              <label className="check"><input type="checkbox" checked={r.use} onChange={(e) => setRow(i, { use: e.target.checked })} />
                {existing.has(r.name.trim().toLowerCase()) ? <span className="small warn-text">{t('alreadyExists')}</span> : null}
              </label>
              <div className="grid2">
                <label>{t('name')}<input value={r.name} onChange={(e) => setRow(i, { name: e.target.value })} /></label>
                <label>{t('hectares')}<input inputMode="decimal" value={r.hectares} onChange={(e) => setRow(i, { hectares: e.target.value })} /></label>
              </div>
              <div className="grid2">
                <label>{t('typeWord')}
                  <select value={r.kind} onChange={(e) => setRow(i, { kind: e.target.value as 'field' | 'camp' })}>
                    <option value="field">{t('field')}</option><option value="camp">{t('camp')}</option>
                  </select>
                </label>
                {r.kind === 'field' && (
                  <label>{t('crop')}
                    <select value={r.crop} onChange={(e) => setRow(i, { crop: e.target.value })}>
                      <option value="">–</option>{CROP_OPTIONS.map((c) => <option key={c} value={c}>{w(c)}</option>)}
                    </select>
                  </label>
                )}
              </div>
              {r.crop && <CropIcon crop={r.crop} size={28} />}
            </div>
          ))}
          <p className="small muted">{t('checkBeforeSave')}</p>
          <button className="btn primary" disabled={!count || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? t('saving') : t('addSelected', { n: count })}
          </button>
          <ErrorText error={create.error} />
        </section>
      )}
    </div>
  )
}
