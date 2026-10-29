import { useMutationState } from '@tanstack/react-query'
import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useFarm } from '../farm/FarmProvider'
import { useMessagesLive, useUnread } from '../lib/team'
import { useI18n } from '../lib/i18n'
import { QuickAddSheet } from './QuickAddSheet'
import { useOnline } from './useOnline'

const icons = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zm0 0v14m6-12v14',
  land: 'M4 20c3-6 13-6 16 0M6 15c3-4 9-4 12 0M8 10c2-2.5 6-2.5 8 0M12 4v4',
  animals: 'M7 14a5 4 0 0 0 10 0 5 4 0 0 0-10 0zM5 12a2 2 0 1 1 0-4M9 18v2M15 18v2M17 10c1.5-.5 2.5-2 2-3.5',
  menu: 'M4 6h16M4 12h16M4 18h16',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.3 7.3 0 0 0-2-1.2L14.5 3h-4l-.4 2.6a7.3 7.3 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.3 7.3 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7.3 7.3 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z',
}

export const MENU_ICON = icons.menu

export function Icon({ d, size = 24 }: { d: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
  )
}

export function Layout() {
  const { t } = useI18n()
  const { farm, previewingWorker, setPreviewWorker } = useFarm()
  // Everyone may record rain, fuel and map pins, so the + button is always there.
  const canAdd = true
  const online = useOnline()
  // New messages arrive live anywhere in the app.
  useMessagesLive()
  const unread = useUnread()
  const waiting = useMutationState({ filters: { status: 'pending' }, select: (m) => m.state.isPaused }).filter(Boolean).length
  const { pathname } = useLocation()
  const [adding, setAdding] = useState(false)
  // The home screen has its own green header.
  const showTopbar = pathname !== '/'

  return (
    <div className={`shell ${pathname === '/map' ? 'on-map' : ''} ${showTopbar ? '' : 'no-topbar'}`}>
      {showTopbar && (
        <header className="topbar">
          <NavLink to="/farms" className="farm-switch" aria-label={t('switchFarm')}>
            <img src="/icon.svg" alt="" width={30} height={30} />
            <span className="topbar-title">{farm?.name ?? t('appName')}</span>
            <span className="switch-caret" aria-hidden="true">▾</span>
          </NavLink>
          <NavLink to="/chat" className="gear chat-link" aria-label={t('chatTitle')}>💬{unread.total > 0 && <span className="unread">{unread.total}</span>}</NavLink>
          <NavLink to="/menu" className="gear" aria-label={t('menu')}><Icon d={icons.menu} size={24} /></NavLink>
        </header>
      )}
      {!online && <div className="offline-bar">{t('offline')}</div>}
      {waiting > 0 && <div className="offline-bar waiting">⏳ {t('offlineWaiting', { n: waiting })}</div>}
      {previewingWorker && (
        <div className="preview-bar">
          <span>👁 {t('previewingWorker')}</span>
          <button className="btn small lime" onClick={() => setPreviewWorker(false)}>{t('backToOwner')}</button>
        </div>
      )}
      <main className="content">
        <Outlet />
      </main>
      <nav className={`tabbar ${canAdd ? 'with-fab' : ''}`}>
        <NavLink to="/" end><Icon d={icons.home} /><span>{t('navHome')}</span></NavLink>
        <NavLink to="/map"><Icon d={icons.map} /><span>{t('navMap')}</span></NavLink>
        {canAdd && (
          <button type="button" className="fab" aria-label={t('quickAdd')} onClick={() => setAdding(true)}>
            <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>
          </button>
        )}
        <NavLink to="/land"><Icon d={icons.land} /><span>{t('navLand')}</span></NavLink>
        <NavLink to="/livestock"><Icon d={icons.animals} /><span>{t('navAnimals')}</span></NavLink>
      </nav>
      {adding && <QuickAddSheet onClose={() => setAdding(false)} />}
    </div>
  )
}
