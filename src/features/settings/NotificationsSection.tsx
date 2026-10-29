import { useEffect, useState } from 'react'
import { Section } from '../../components/ui'
import { useI18n } from '../../lib/i18n'
import { disablePush, enablePush, pushState, testPush, updatePushLang, type PushState } from '../../lib/push'

/** Switch phone notifications on or off for this phone. */
export function NotificationsSection() {
  const { t, lang } = useI18n()
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { pushState().then(setState) }, [])
  // Notifications follow the language chosen in the app.
  useEffect(() => { if (state === 'on') updatePushLang(lang) }, [state, lang])

  async function run(action: () => Promise<unknown>, done?: string) {
    setBusy(true)
    setError(null)
    setNote(null)
    try {
      await action()
      if (done) setNote(done)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg === 'blocked' ? t('pushBlocked') : msg)
    } finally {
      setState(await pushState())
      setBusy(false)
    }
  }

  return (
    <Section title={`🔔 ${t('pushTitle')}`}>
      <p className="small muted">{t('pushIntro')}</p>
      {state === 'unsupported' && <p className="pill-info">{t('pushUnsupported')}</p>}
      {state === 'needs-install' && <p className="pill-info">{t('pushIos')}</p>}
      {state === 'blocked' && <p className="warning">{t('pushBlocked')}</p>}
      {state === 'off' && <button className="btn primary" disabled={busy} onClick={() => run(() => enablePush(lang), t('pushOnDone'))}>🔔 {t('pushTurnOn')}</button>}
      {state === 'on' && (
        <>
          <p className="pill-info">✓ {t('pushIsOn')}</p>
          <div className="btn-row">
            <button className="btn" disabled={busy} onClick={() => run(async () => {
              const n = await testPush()
              if (!n) throw new Error(t('pushTestNone'))
            }, t('pushTestSent'))}>{t('pushTest')}</button>
            <button className="btn ghost" disabled={busy} onClick={() => run(disablePush)}>{t('pushTurnOff')}</button>
          </div>
        </>
      )}
      {note && <p className="small">✓ {note}</p>}
      {error && <p className="error small">{error}</p>}
    </Section>
  )
}
