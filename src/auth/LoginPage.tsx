import { useState, type FormEvent } from 'react'
import { useI18n } from '../lib/i18n'
import { supabase } from '../lib/supabase'
import { LanguageSwitch } from '../components/LanguageSwitch'

export function LoginPage() {
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [showCode, setShowCode] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function sendLink(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    })
    setBusy(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  async function verify(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' })
    setBusy(false)
    if (error) setError(error.message)
  }

  return (
    <div className="page narrow login">
      <div className="login-brand">
        <img src="/icon.svg" alt="" width={72} height={72} />
        <h1>{t('appName')}</h1>
      </div>
      {!sent ? (
        <form className="card stack" onSubmit={sendLink}>
          <h2>{t('loginTitle')}</h2>
          <p className="muted">{t('loginIntro')}</p>
          <label>
            {t('email')}
            <input type="email" inputMode="email" autoComplete="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button className="btn primary" disabled={busy}>{busy ? t('sending') : t('sendLink')}</button>
        </form>
      ) : (
        <form className="card stack" onSubmit={verify}>
          <h2>{t('checkEmail')}</h2>
          <p className="muted">{t('checkEmailBody')}</p>
          <p><strong>{email}</strong></p>
          {/* A code only appears in the email once a custom email service is set up in Supabase. */}
          {showCode ? (
            <>
              <label>
                {t('code')}
                <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" required value={code}
                  onChange={(e) => setCode(e.target.value)} />
              </label>
              <button className="btn primary" disabled={busy}>{t('verifyCode')}</button>
            </>
          ) : (
            <button type="button" className="btn" onClick={() => setShowCode(true)}>{t('haveCode')}</button>
          )}
          <button type="button" className="btn" onClick={() => { setSent(false); setCode(''); setShowCode(false) }}>{t('useOtherEmail')}</button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
      <LanguageSwitch />
    </div>
  )
}
