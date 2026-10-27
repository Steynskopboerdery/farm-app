import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { ErrorText } from '../components/ui'
import { useI18n } from '../lib/i18n'
import { supabase } from '../lib/supabase'
import { useFarm } from './FarmProvider'

/** List of the person's farms: tap one to open it, or add another. Shown at start-up and from the farm name. */
export function FarmChooser({ inApp = false }: { inApp?: boolean }) {
  const { t } = useI18n()
  const { farms, farm: current, selectFarm, refresh } = useFarm()
  const navigate = useNavigate()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function open(id: string) {
    selectFarm(id)
    if (inApp) navigate('/')
  }

  async function add(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { data, error } = await supabase.rpc('create_farm', { p_name: name.trim(), p_location: location.trim() || undefined })
    if (error) {
      setError(error.message)
      setBusy(false)
      return
    }
    await refresh()
    setBusy(false)
    open(data)
  }

  return (
    <div className={`chooser ${inApp ? 'in-app' : ''}`}>
      {!inApp && <div className="chooser-head"><Logo size={52} /></div>}
      <div className="page narrow stack">
        <div>
          <h1>{t('chooseFarm')}</h1>
          <p className="muted">{t('chooseFarmHelp')}</p>
        </div>
        <ul className="farm-list">
          {farms.map((m) => (
            <li key={m.farm.id}>
              <button className={`farm-item ${current?.id === m.farm.id ? 'on' : ''}`} onClick={() => open(m.farm.id)}>
                <span className="farm-avatar" aria-hidden="true">{m.farm.name.slice(0, 1).toUpperCase()}</span>
                <span className="grow left">
                  <strong>{m.farm.name}</strong>
                  <span className="small muted block">{m.farm.location_text ?? ''}</span>
                </span>
                <span className={`badge ${m.role === 'owner' ? 'owner' : 'worker'}`}>{m.role === 'owner' ? t('roleOwner') : t('roleWorker')}</span>
                <span className="chev">›</span>
              </button>
            </li>
          ))}
        </ul>
        {adding ? (
          <form className="card stack" onSubmit={add}>
            <h2>{t('addFarm')}</h2>
            <label>{t('farmName')}<input required autoFocus value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label>{t('farmLocation')}<input value={location} onChange={(e) => setLocation(e.target.value)} /></label>
            <div className="btn-row">
              <button type="button" className="btn" onClick={() => setAdding(false)}>{t('cancel')}</button>
              <button className="btn primary" disabled={busy}>{busy ? t('saving') : t('createFarm')}</button>
            </div>
            {error && <ErrorText error={error} />}
            <p className="small muted">{t('addFarmHelp')}</p>
          </form>
        ) : (
          <button className="btn add-farm" onClick={() => setAdding(true)}>+ {t('addFarm')}</button>
        )}
        {!inApp && <button className="btn ghost" onClick={() => supabase.auth.signOut()}>{t('signOut')}</button>}
      </div>
    </div>
  )
}
