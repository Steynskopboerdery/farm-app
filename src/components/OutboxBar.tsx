import { discard, retry, useOutbox } from '../lib/outbox'
import { useI18n } from '../lib/i18n'
import { formatDateTime } from '../lib/format'

/** "Saved on this phone" under a form, when there was no signal. */
export function QueuedNote({ show }: { show: boolean }) {
  const { t } = useI18n()
  return show ? <p className="pill-info small">📲 {t('outboxQueued')}</p> : null
}

/** Bar at the top while saves are waiting on this phone; lists any the database refused. */
export function OutboxBar() {
  const { t, lang } = useI18n()
  const items = useOutbox()
  if (!items.length) return null
  const failed = items.filter((i) => i.error)
  const waiting = items.length - failed.length
  return (
    <div className="offline-bar waiting outbox-bar">
      {waiting > 0 && <div>📲 {t('outboxWaiting', { n: waiting })}</div>}
      {failed.map((i) => (
        <div key={i.key} className="outbox-failed">
          <span>⚠ {t('outboxFailed', { when: formatDateTime(i.at, lang) })}: {i.error}</span>
          <button className="btn small" onClick={() => retry(i.key)}>{t('outboxRetry')}</button>
          <button className="btn small ghost" onClick={() => confirm(t('outboxDiscardConfirm')) && discard(i.key)}>{t('outboxDiscard')}</button>
        </div>
      ))}
    </div>
  )
}
