import { useState, type FormEvent } from 'react'
import { LanguageSwitch, VersionLabel } from '../components/LanguageSwitch'
import { Logo } from '../components/Logo'
import { useI18n, type DictKey } from '../lib/i18n'
import { supabase } from '../lib/supabase'

/** Supabase puts the reason a login link failed in the address (#error_code=...). */
function linkErrorFromUrl(): DictKey | null {
  const params = new URLSearchParams(window.location.hash.slice(1) || window.location.search.slice(1))
  const code = params.get('error_code')
  if (!code && !params.get('error')) return null
  history.replaceState(null, '', window.location.pathname)
  return code === 'otp_expired' ? 'linkExpired' : 'linkFailed'
}

/** Turns Supabase's English error messages into plain words. */
function friendlyError(message: string): DictKey | null {
  if (/rate limit/i.test(message)) return 'tooManyEmails'
  if (/invalid login credentials/i.test(message)) return 'wrongPassword'
  return null
}

export function LoginPage() {
  const { t } = useI18n()
  const [method, setMethod] = useState<'link' | 'password'>('link')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [showCode, setShowCode] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(() => {
    const key = linkErrorFromUrl()
    return key ? t(key) : null
  })

  const show = (message: string) => {
    const key = friendlyError(message)
    setError(key ? t(key) : message)
  }

  async function sendLink(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    })
    setBusy(false)
    if (error) show(error.message)
    else setSent(true)
  }

  async function verify(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' })
    setBusy(false)
    if (error) show(error.message)
  }

  async function passwordLogin(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) show(error.message)
  }

  const emailInput = (
    <label>
      {t('email')}
      <input type="email" inputMode="email" autoComplete="email" required value={email}
        onChange={(e) => setEmail(e.target.value)} />
    </label>
  )

  return (
    <div className="page narrow login">
      <div className="login-brand">
        <Logo size={64} light={false} />
      </div>
      {error && <p className="notice">{error}</p>}
      {!sent && (
        <div className="segmented">
          <button type="button" className={method === 'link' ? 'on' : ''} onClick={() => setMethod('link')}>{t('loginByEmail')}</button>
          <button type="button" className={method === 'password' ? 'on' : ''} onClick={() => setMethod('password')}>{t('loginByPassword')}</button>
        </div>
      )}
      {sent ? (
        <form className="card stack" onSubmit={verify}>
          <h2>{t('checkEmail')}</h2>
          <p className="muted">{t('checkEmailBody')}</p>
          <p><strong>{email}</strong></p>
          <p className="small muted">{t('newestEmailOnly')}</p>
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
      ) : method === 'link' ? (
        <form className="card stack" onSubmit={sendLink}>
          <p className="muted">{t('loginIntro')}</p>
          {emailInput}
          <button className="btn primary" disabled={busy}>{busy ? t('sending') : t('sendLink')}</button>
        </form>
      ) : (
        <form className="card stack" onSubmit={passwordLogin}>
          <p className="muted">{t('passwordIntro')}</p>
          {emailInput}
          <label>
            {t('password')}
            <input type="password" autoComplete="current-password" required value={password}
              onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button className="btn primary" disabled={busy}>{t('loginTitle')}</button>
        </form>
      )}
      <LanguageSwitch />
      <VersionLabel />
    </div>
  )
}
