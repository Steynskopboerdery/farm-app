import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider'
import { LoginPage } from './auth/LoginPage'
import { Layout } from './components/Layout'
import { ErrorText, Loading } from './components/ui'
import { CreateFarmPage } from './farm/CreateFarmPage'
import { useFarm } from './farm/FarmProvider'
import { RecordFormPage } from './features/crops/RecordFormPage'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { LandDetailPage } from './features/land/LandDetailPage'
import { LandPage } from './features/land/LandPage'
import { SettingsPage } from './features/settings/SettingsPage'
import { WeatherPage } from './features/weather/WeatherPage'

// The map library is large, so it loads only when the map is opened.
const MapPage = lazy(() => import('./features/map/MapPage').then((m) => ({ default: m.MapPage })))

export default function App() {
  const { session, loading } = useAuth()
  const { farm, loading: farmLoading, error, refresh } = useFarm()

  if (loading || farmLoading) return <Loading />
  if (!session) return <LoginPage />
  // Don't offer "set up a farm" just because the farm could not be loaded (e.g. no signal).
  if (error && !farm) {
    return (
      <div className="page narrow stack">
        <ErrorText error={error} />
        <button className="btn primary" onClick={refresh}>↻</button>
      </div>
    )
  }
  if (!farm) return <CreateFarmPage />

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="map" element={<Suspense fallback={<Loading />}><MapPage /></Suspense>} />
          <Route path="land" element={<LandPage />} />
          <Route path="land/:kind/:id" element={<LandDetailPage />} />
          <Route path="land/field/:id/record/:type/:recordId?" element={<RecordFormPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="weather" element={<WeatherPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
