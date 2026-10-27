import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider'
import { LoginPage } from './auth/LoginPage'
import { Layout } from './components/Layout'
import { ErrorText, Loading } from './components/ui'
import { Splash } from './components/Splash'
import { CreateFarmPage } from './farm/CreateFarmPage'
import { FarmChooser } from './farm/FarmChooser'
import { useFarm } from './farm/FarmProvider'
import { RecordFormPage } from './features/crops/RecordFormPage'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { LandDetailPage } from './features/land/LandDetailPage'
import { LandPage } from './features/land/LandPage'
import { SettingsPage } from './features/settings/SettingsPage'
import { WeatherPage } from './features/weather/WeatherPage'
import { GroupPage } from './features/livestock/GroupPage'
import { LivestockFormPage } from './features/livestock/LivestockForms'
import { LivestockPage } from './features/livestock/LivestockPage'

// The map library is large, so it loads only when the map is opened.
const MapPage = lazy(() => import('./features/map/MapPage').then((m) => ({ default: m.MapPage })))

export default function App() {
  const { session, loading } = useAuth()
  const { farm, farms, needsChoice, loading: farmLoading, error, refresh } = useFarm()
  // Welcome screen for about 2 seconds each time the app opens.
  const [welcomed, setWelcomed] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setWelcomed(true), 2000)
    return () => window.clearTimeout(timer)
  }, [])

  if (!welcomed || loading || farmLoading) return <Splash />
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
  if (farms.length === 0) return <CreateFarmPage />
  if (needsChoice || !farm) return <BrowserRouter><FarmChooser /></BrowserRouter>

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
          <Route path="farms" element={<FarmChooser inApp />} />
          <Route path="livestock" element={<LivestockPage />} />
          <Route path="livestock/new" element={<LivestockFormPage kind="new" />} />
          <Route path="livestock/group/:id" element={<GroupPage />} />
          <Route path="livestock/group/:id/:kind/:recordId?" element={<LivestockFormPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
