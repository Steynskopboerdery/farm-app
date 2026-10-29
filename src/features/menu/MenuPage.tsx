import { Link } from 'react-router-dom'
import { useFarm } from '../../farm/FarmProvider'
import { useI18n, type DictKey } from '../../lib/i18n'

const TILES: { to: string | null; label: DictKey; emoji: string; ownerOnly?: boolean; phase?: number }[] = [
  { to: '/sales', label: 'menuSales', emoji: '🧾', ownerOnly: true },
  { to: '/team', label: 'teamTitle', emoji: '👷' },
  { to: '/chat', label: 'chatTitle', emoji: '💬' },
  { to: '/weather', label: 'weather', emoji: '⛅' },
  { to: '/reports', label: 'menuReports', emoji: '📊', ownerOnly: true },
  { to: '/inventory', label: 'menuInventory', emoji: '📦' },
  { to: '/rain', label: 'rainTitle', emoji: '🌧️' },
  { to: '/vehicles', label: 'vehiclesTitle', emoji: '🚜' },
  { to: '/pins', label: 'pinsTitle', emoji: '📍' },
  { to: '/grazing', label: 'menuGrazing', emoji: '🌿' },
  { to: '/export', label: 'exp_title', emoji: '📤', ownerOnly: true },
  { to: '/settings', label: 'navSettings', emoji: '⚙️' },
]

export function MenuPage() {
  const { t } = useI18n()
  const { isOwner } = useFarm()
  return (
    <div className="page stack">
      <h1>{t('menu')}</h1>
      <div className="menu-grid">
        {TILES.filter((tile) => !tile.ownerOnly || isOwner).map((tile) => tile.to ? (
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
    </div>
  )
}
