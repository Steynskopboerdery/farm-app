import type { ReactNode } from 'react'
import { useI18n } from '../lib/i18n'

export function SampleBadge({ show }: { show?: boolean | null }) {
  const { t } = useI18n()
  return show ? <span className="badge sample">{t('sample')}</span> : null
}

export function Loading() {
  const { t } = useI18n()
  return <p className="muted center">{t('loading')}</p>
}

export function ErrorText({ error }: { error: unknown }) {
  const { t } = useI18n()
  if (!error) return null
  return <p className="error">{t('error')}: {error instanceof Error ? error.message : String(error)}</p>
}

export function Section({ title, children, action, id }: { title: string; children: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <section className="card" id={id}>
      <div className="card-head"><h2>{title}</h2>{action}</div>
      {children}
    </section>
  )
}

/** Turns an empty input into null and numbers into numbers for saving. */
export const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')))
export const textOrNull = (v: string) => (v.trim() === '' ? null : v.trim())
