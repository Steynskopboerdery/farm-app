import { Link, useNavigate } from 'react-router-dom'
import { useFarm, type Area } from '../../farm/FarmProvider'
import { useI18n, type DictKey } from '../../lib/i18n'
import { useAuth } from '../../auth/AuthProvider'
import { SignOutButton } from '../../components/SignOutButton'
import { WelcomeTour } from '../../components/WelcomeTour'
import { useState } from 'react'

const TILES: { to: string | null; label: DictKey; emoji: string; ownerOnly?: boolean; phase?: number; area?: Area }[] = [
  { to: '/sales', label: 'menuSales', emoji: '🧾', ownerOnly: true },
  { to: '/team', label: 'teamTitle', emoji: '👷', area: 'team' },
  { to: '/chat', label: 'chatTitle', emoji: '💬', area: 'chat' },
  { to: '/weather', label: 'weather', emoji: '⛅', area: 'weather' },
  { to: '/outlook', label: 'ol_title', emoji: '🔮', area: 'outlook' },
  { to: '/budget', label: 'bud_title', emoji: '📒', ownerOnly: true },
  { to: '/reports', label: 'menuReports', emoji: '📊', ownerOnly: true },
  { to: '/inventory', label: 'menuInventory', emoji: '📦', area: 'inventory' },
  { to: '/rain', label: 'rainTitle', emoji: '🌧️', area: 'rain' },
  { to: '/vehicles', label: 'vehiclesTitle', emoji: '🚜', area: 'vehicles' },
  { to: '/pins', label: 'pinsTitle', emoji: '📍', area: 'pins' },
  { to: '/grazing', label: 'menuGrazing', emoji: '🌿', area: 'grazing' },
  { to: '/export', label: 'exp_title', emoji: '📤', ownerOnly: true },
  { to: '/settings', label: 'navSettings', emoji: '⚙️' },
]

export function MenuPage() {
  const { t } = useI18n()
  const { isOwner, sees, realRole, previewingWorker, setPreviewWorker } = useFarm()
  const { session } = useAuth()
  const navigate = useNavigate()
  const [tour, setTour] = useState(false)
  return (
    <div className="page stack">
      <h1>{t('menu')}</h1>
      <div className="menu-grid">
        {TILES.filter((tile) => (!tile.ownerOnly || isOwner) && (!tile.area || sees(tile.area))).map((tile) => tile.to ? (
          <Link key={tile.label} to={tile.to} className="menu-tile">
            <span className="menu-emoji" aria-hidden="true">{tile.emoji}</span>
            <span>{t(tile.label)}</span>
          </Link>
        ) : (
          <div key={tile.label} className="menu-tile soon" aria-disabled="true">
            <span className="menu-emoji" aria-hidden="true">{tile.emoji}</span>
            <span>{t(tile.label)}</span>
            <span className="tiny muted">{t('comingPhase', { n: tile.phase ?? '' })}</span>
          </div>
        ))}
      </div>
      <section className="card row account-row">
        <span className="grow"><span className="small muted">{t('loggedInAs')}</span><br /><strong>{session?.user.email}</strong></span>
        <SignOutButton className="btn small" />
      </section>
      <button className="btn" onClick={() => setTour(true)}>❓ {t('tourAgain')}</button>
      {tour && <WelcomeTour onClose={() => setTour(false)} />}
      {realRole === 'owner' && (
        previewingWorker
          ? <button className="btn lime" onClick={() => setPreviewWorker(false)}>{t('backToOwner')}</button>
          : <button className="btn" onClick={() => { setPreviewWorker(true); navigate('/') }}>👁 {t('viewAsWorker')}</button>
      )}
    </div>
  )
}
