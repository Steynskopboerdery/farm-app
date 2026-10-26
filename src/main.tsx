import { createRoot } from 'react-dom/client'
import { StartupError } from './components/ErrorBoundary'
import './index.css'

const root = createRoot(document.getElementById('root')!)

import('./bootstrap')
  .then((m) => m.start(root))
  .catch((e: unknown) => root.render(<StartupError title="The app could not start" detail={String(e)} />))
