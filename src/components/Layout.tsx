import { NavLink, Outlet } from 'react-router-dom'
import { useFarm } from '../farm/FarmProvider'
import { useI18n } from '../lib/i18n'
import { useOnline } from './useOnline'

const icons = {
  home: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',
  map: 'M9 3L3 5v16l6-2 6 2 6-2V3l-6 2-6-2zm0 0v16m6-14v16',
  land: 'M3 20h18M5 20V10l7-5 7 5v10M9 20v-6h6v6',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.3 7.3 0 0 0-2-1.2L14.5 3h-4l-.4 2.6a7.3 7.3 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.3 7.3 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7.3 7.3 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z',
}

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
  )
}

export function Layout() {
  const { t } = useI18n()
  const { farm } = useFarm()
  const online = useOnline()

  return (
    <div className="shell">
      <header className="topbar">
        <span className="topbar-title">{farm?.name ?? t('appName')}</span>
      </header>
      {!online && <div className="offline-bar">{t('offline')}</div>}
      <main className="content">
        <Outlet />
      </main>
      <nav className="tabbar">
        <NavLink to="/" end><Icon d={icons.home} /><span>{t('navHome')}</span></NavLink>
        <NavLink to="/map"><Icon d={icons.map} /><span>{t('navMap')}</span></NavLink>
        <NavLink to="/land"><Icon d={icons.land} /><span>{t('navLand')}</span></NavLink>
        <NavLink to="/settings"><Icon d={icons.settings} /><span>{t('navSettings')}</span></NavLink>
      </nav>
    </div>
  )
}
