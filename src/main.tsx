import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { StartupError } from './components/ErrorBoundary'
import './index.css'

const root = createRoot(document.getElementById('root')!)

import('./bootstrap')
  .then((m) => m.start(root))
  .catch((e: unknown) => root.render(<StartupError title="The app could not start" detail={String(e)} />))

// Offline support. When a new version is published, switch to it straight away,
// and check for one every hour and whenever the app is brought back to the screen.
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return
    const check = () => { if (navigator.onLine) registration.update().catch(() => {}) }
    setInterval(check, 60 * 60 * 1000)
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check() })
  },
})
