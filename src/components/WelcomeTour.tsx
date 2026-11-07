import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useFarm } from '../farm/FarmProvider'
import { useI18n, type DictKey } from '../lib/i18n'
import { supabase } from '../lib/supabase'

const SLIDES: { emoji: string; title: DictKey; text: DictKey; ownerOnly?: boolean }[] = [
  { emoji: '👋', title: 'tour1Title', text: 'tour1Text' },
  { emoji: '➕', title: 'tour2Title', text: 'tour2Text' },
  { emoji: '🗺️', title: 'tour3Title', text: 'tour3Text' },
  { emoji: '🌧️', title: 'tour4Title', text: 'tour4Text' },
  { emoji: '💬', title: 'tour5Title', text: 'tour5Text' },
  { emoji: '📒', title: 'tour6Title', text: 'tour6Text', ownerOnly: true },
  { emoji: '📶', title: 'tour7Title', text: 'tour7Text' },
]

/** True until this person has seen the short explanation (remembered on their account, so once per person). */
// eslint-disable-next-line react-refresh/only-export-components
export function useTourNeeded() {
  const { session } = useAuth()
  return !!session && !session.user.user_metadata?.tour_seen
}

/** A short explanation of the app, shown once to everyone after they first get into a farm (and from the Menu). */
export function WelcomeTour({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()
  const { farm, isOwner } = useFarm()
  const slides = SLIDES.filter((s) => !s.ownerOnly || isOwner)
  const [i, setI] = useState(0)
  const s = slides[i]
  const finish = () => {
    onClose()
    // Remember it on the account, so it doesn't show again on another phone either.
    void supabase.auth.updateUser({ data: { tour_seen: true } })
  }
  return (
    <div className="sheet-backdrop tour">
      <div className="sheet tour-sheet" role="dialog" aria-modal="true" aria-label={t('tourLabel')}>
        <div className="tour-emoji" aria-hidden>{s.emoji}</div>
        <h2>{t(s.title, { farm: farm?.name ?? '' })}</h2>
        <p>{t(s.text)}</p>
        <div className="setup-dots" aria-hidden>{slides.map((x, k) => <span key={x.title} className={k <= i ? 'on' : ''} />)}</div>
        <div className="btn-row">
          {i > 0 ? <button className="btn" onClick={() => setI(i - 1)}>‹ {t('back')}</button> : <button className="btn ghost" onClick={finish}>{t('tourSkip')}</button>}
          {i < slides.length - 1
            ? <button className="btn primary" onClick={() => setI(i + 1)}>{t('next')} ›</button>
            : <button className="btn primary" onClick={finish}>✓ {t('tourDone')}</button>}
        </div>
      </div>
    </div>
  )
}
