import { lazy, Suspense, useState } from 'react'
import { LanguageSwitch } from '../components/LanguageSwitch'
import { SignOutButton } from '../components/SignOutButton'
import { numOrNull } from '../components/ui'
import { CROP_OPTIONS } from '../lib/crops'
import { useI18n, type DictKey } from '../lib/i18n'
import { SPECIES } from '../lib/livestock'
import { supabase } from '../lib/supabase'
import { useFarm } from './FarmProvider'

const LocationPicker = lazy(() => import('./LocationPicker').then((m) => ({ default: m.LocationPicker })))

type Step = 'welcome' | 'farm' | 'where' | 'what' | 'done'
const STEPS: Step[] = ['welcome', 'farm', 'where', 'what']

/** First time in the app: welcome, name the farm, put it on the map, say what is farmed. Then the farm is made. */
export function CreateFarmPage() {
  const { t, w } = useI18n()
  const { refresh, selectFarm } = useFarm()
  const [step, setStep] = useState<Step>('welcome')
  const [name, setName] = useState('')
  const [town, setTown] = useState('')
  const [hectares, setHectares] = useState('')
  const [spot, setSpot] = useState<[number, number] | null>(null)
  const [crops, setCrops] = useState<string[]>([])
  const [animals, setAnimals] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const toggle = (list: string[], set: (v: string[]) => void, x: string) => set(list.includes(x) ? list.filter((y) => y !== x) : [...list, x])

  async function create() {
    setBusy(true)
    setError(null)
    try {
      const { data: farmId, error: e1 } = await supabase.rpc('create_farm', { p_name: name.trim(), p_location: town.trim() || undefined })
      if (e1) throw e1
      const patch: { total_hectares?: number; map_center_lat?: number; map_center_lng?: number } = {}
      const ha = numOrNull(hectares)
      if (ha) patch.total_hectares = ha
      if (spot) { patch.map_center_lat = spot[0]; patch.map_center_lng = spot[1] }
      if (Object.keys(patch).length) {
        const { error: e2 } = await supabase.from('farms').update(patch).eq('id', farmId)
        if (e2) throw e2
      }
      // One planning line per crop and animal kind: the figures are filled in later (Reports → planning figures).
      const lines = [...crops.map((c) => ({ kind: 'crop', name: c })), ...animals.map((a) => ({ kind: 'livestock', name: a }))]
      if (lines.length) {
        const { error: e3 } = await supabase.from('planning_estimates').insert(lines.map((l) => ({ ...l, farm_id: farmId })))
        if (e3) throw e3
      }
      selectFarm(farmId)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String((e as { message?: string }).message ?? e))
      setBusy(false)
    }
  }

  const at = STEPS.indexOf(step)
  const next = () => setStep(STEPS[at + 1] ?? 'done')
  const back = () => setStep(STEPS[at - 1] ?? 'welcome')

  return (
    <div className="page narrow setup">
      <div className="setup-dots" aria-hidden>{STEPS.map((s, i) => <span key={s} className={i <= at ? 'on' : ''} />)}</div>

      {step === 'welcome' && (
        <section className="card stack">
          <img src="/icon.svg" alt="" width={64} height={64} />
          <h1>{t('setupWelcome')}</h1>
          <p>{t('setupWelcomeText')}</p>
          <LanguageSwitch />
          <button className="btn primary" onClick={next}>{t('setupStart')}</button>
          <p className="small muted">{t('setupInvitedNote')}</p>
          <SignOutButton className="btn ghost" />
        </section>
      )}

      {step === 'farm' && (
        <form className="card stack" onSubmit={(e) => { e.preventDefault(); if (name.trim()) next() }}>
          <h1>{t('setupFarmTitle')}</h1>
          <label>{t('farmName')}<input required autoFocus value={name} placeholder={t('setupNamePlaceholder')} onChange={(e) => setName(e.target.value)} /></label>
          <label>{t('setupTown')}<input value={town} placeholder={t('setupTownPlaceholder')} onChange={(e) => setTown(e.target.value)} /></label>
          <label>{t('setupHectares')}<input inputMode="decimal" value={hectares} placeholder="500" onChange={(e) => setHectares(e.target.value)} />
            <span className="hint">{t('setupHectaresHint')}</span></label>
          <div className="btn-row">
            <button type="button" className="btn" onClick={back}>‹ {t('back')}</button>
            <button className="btn primary" disabled={!name.trim()}>{t('next')} ›</button>
          </div>
        </form>
      )}

      {step === 'where' && (
        <section className="card stack">
          <h1>{t('setupWhereTitle')}</h1>
          <p className="small">{t('setupWhereText')}</p>
          <Suspense fallback={<p className="muted">…</p>}><LocationPicker value={spot} onChange={setSpot} /></Suspense>
          <div className="btn-row">
            <button type="button" className="btn" onClick={back}>‹ {t('back')}</button>
            <button className="btn primary" onClick={next}>{spot ? `${t('next')} ›` : t('setupSkipForNow')}</button>
          </div>
          <p className="tiny muted">{t('setupMapCredit')}</p>
        </section>
      )}

      {step === 'what' && (
        <section className="card stack">
          <h1>{t('setupWhatTitle')}</h1>
          <p className="small">{t('setupWhatText')}</p>
          <span className="label-text">{t('setupCrops')}</span>
          <div className="chip-wrap">
            {CROP_OPTIONS.map((c) => <button key={c} type="button" className={`chip ${crops.includes(c) ? 'on' : ''}`} onClick={() => toggle(crops, setCrops, c)}>{w(c)}</button>)}
          </div>
          <span className="label-text">{t('setupAnimals')}</span>
          <div className="chip-wrap">
            {SPECIES.map((s) => <button key={s} type="button" className={`chip ${animals.includes(s) ? 'on' : ''}`} onClick={() => toggle(animals, setAnimals, s)}>{t(s as DictKey)}</button>)}
          </div>
          <div className="setup-summary small">
            <strong>{name}</strong>{town ? ` · ${town}` : ''}{hectares ? ` · ${hectares} ha` : ''}<br />
            {spot ? `📍 ${spot[0].toFixed(3)}, ${spot[1].toFixed(3)}` : t('setupNoSpot')}
          </div>
          <div className="btn-row">
            <button type="button" className="btn" onClick={back}>‹ {t('back')}</button>
            <button className="btn primary" disabled={busy} onClick={create}>{busy ? t('saving') : `✓ ${t('setupCreate')}`}</button>
          </div>
          {error && <p className="error">{error}</p>}
        </section>
      )}
    </div>
  )
}
