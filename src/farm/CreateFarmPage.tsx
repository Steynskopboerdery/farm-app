import { useState, type FormEvent } from 'react'
import { useI18n } from '../lib/i18n'
import { supabase } from '../lib/supabase'
import { useFarm } from './FarmProvider'

export function CreateFarmPage() {
  const { t } = useI18n()
  const { refresh, selectFarm } = useFarm()
  const [name, setName] = useState('')
  const [location, setLocation] = useState('Near Swellendam, Western Cape')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    const { data, error } = await supabase.rpc('create_farm', { p_name: name.trim(), p_location: location.trim() || undefined })
    if (error) {
      setBusy(false)
      setError(error.message)
      return
    }
    selectFarm(data)
    await refresh()
    setBusy(false)
  }

  return (
    <div className="page narrow">
      <form className="card stack" onSubmit={submit}>
        <h1>{t('createFarmTitle')}</h1>
        <p className="muted">{t('createFarmIntro')}</p>
        <label>{t('farmName')}<input required value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label>{t('farmLocation')}<input value={location} onChange={(e) => setLocation(e.target.value)} /></label>
        <button className="btn primary" disabled={busy}>{busy ? t('saving') : t('createFarm')}</button>
        {error && <p className="error">{error}</p>}
        <button type="button" className="btn" onClick={() => supabase.auth.signOut()}>{t('signOut')}</button>
      </form>
    </div>
  )
}
