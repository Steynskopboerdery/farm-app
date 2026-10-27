import { useI18n } from '../lib/i18n'
import { Logo } from './Logo'

/** Welcome screen shown for a moment when the app opens. */
export function Splash() {
  const { t } = useI18n()
  return (
    <div className="splash" role="status" aria-label="FarmPlans">
      <div className="splash-inner">
        <Logo size={84} />
        <p className="splash-tag">{t('tagline')}</p>
      </div>
      <div className="splash-dots" aria-hidden="true"><span /><span /><span /></div>
    </div>
  )
}
