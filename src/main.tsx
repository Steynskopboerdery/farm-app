import { createRoot } from 'react-dom/client'
import { StartupError } from './components/ErrorBoundary'
import './index.css'

const root = createRoot(document.getElementById('root')!)

// Check the Supabase settings before loading the app, so a missing setting
// shows a readable message instead of a white page.
if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
  root.render(
    <StartupError
      title="The app is missing its Supabase settings"
      detail="In Netlify: Project configuration → Environment variables. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, then Deploys → Trigger deploy → Deploy site."
    />,
  )
} else {
  import('./bootstrap')
    .then((m) => m.start(root))
    .catch((e: unknown) => root.render(<StartupError title="The app could not start" detail={String(e)} />))
}
