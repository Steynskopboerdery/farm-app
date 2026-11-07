import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../lib/i18n'

const ESRI_IMAGERY = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
const ESRI_LABELS = 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'
const SOUTH_AFRICA: [number, number] = [-30.5, 24.5]

interface Place { name: string; lat: number; lng: number }

/** Find a town or farm area by name (OpenStreetMap's free search, South Africa first). */
async function searchPlaces(q: string): Promise<Place[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=za,na,bw,ls,sz&q=${encodeURIComponent(q)}`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`search ${res.status}`)
  const rows = (await res.json()) as { display_name: string; lat: string; lon: string }[]
  return rows.map((r) => ({ name: r.display_name, lat: Number(r.lat), lng: Number(r.lon) }))
}

/** Satellite map to put a pin on the farm: search for the nearest town, use the phone's location, or tap the map. */
export function LocationPicker({ value, onChange }: { value: [number, number] | null; onChange: (v: [number, number]) => void }) {
  const { t } = useI18n()
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const marker = useRef<L.CircleMarker | null>(null)
  const [query, setQuery] = useState('')
  const [places, setPlaces] = useState<Place[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!el.current || map.current) return
    const m = L.map(el.current, { zoomControl: true, maxZoom: 19 }).setView(value ?? SOUTH_AFRICA, value ? 13 : 5)
    L.tileLayer(ESRI_IMAGERY, { maxNativeZoom: 18, maxZoom: 19, attribution: 'Esri, Maxar, Earthstar Geographics' }).addTo(m)
    L.tileLayer(ESRI_LABELS, { maxNativeZoom: 18, maxZoom: 19, opacity: 0.85 }).addTo(m)
    m.on('click', (e: L.LeafletMouseEvent) => onChange([e.latlng.lat, e.latlng.lng]))
    map.current = m
    return () => { m.remove(); map.current = null; marker.current = null }
    // The map is made once; the pin follows `value` below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const m = map.current
    if (!m || !value) return
    if (!marker.current) marker.current = L.circleMarker(value, { radius: 11, color: '#fff', weight: 3, fillColor: '#eb6834', fillOpacity: 1 }).addTo(m)
    else marker.current.setLatLng(value)
  }, [value])

  const go = (lat: number, lng: number, zoom = 14) => {
    onChange([lat, lng])
    map.current?.setView([lat, lng], zoom)
  }

  async function search(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setBusy(true)
    setMessage(null)
    try {
      const found = await searchPlaces(query.trim())
      setPlaces(found)
      if (!found.length) setMessage(t('setupNoPlace'))
      else if (found.length === 1) go(found[0].lat, found[0].lng, 12)
    } catch {
      setMessage(t('setupSearchFailed'))
    } finally {
      setBusy(false)
    }
  }

  function useGps() {
    setBusy(true)
    setMessage(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => { go(pos.coords.latitude, pos.coords.longitude, 15); setBusy(false) },
      () => { setMessage(t('setupGpsFailed')); setBusy(false) },
      { enableHighAccuracy: true, timeout: 15000 },
    )
  }

  return (
    <div className="stack">
      <form className="row search-row" onSubmit={search}>
        <input className="grow" value={query} placeholder={t('setupSearchPlaceholder')} onChange={(e) => setQuery(e.target.value)} aria-label={t('setupSearchPlaceholder')} />
        <button className="btn small" disabled={busy}>{t('setupSearch')}</button>
      </form>
      {places && places.length > 1 && (
        <ul className="list place-list">
          {places.map((p) => (
            <li key={`${p.lat},${p.lng}`}><button type="button" className="row link-row plain-btn" onClick={() => { setPlaces(null); go(p.lat, p.lng, 12) }}><span className="small">{p.name}</span></button></li>
          ))}
        </ul>
      )}
      <button type="button" className="btn" disabled={busy} onClick={useGps}>◎ {t('setupUseGps')}</button>
      <div ref={el} className="picker-map" />
      <p className="small muted">{value ? `📍 ${value[0].toFixed(4)}, ${value[1].toFixed(4)} · ${t('setupTapToMove')}` : t('setupTapMap')}</p>
      {message && <p className="small warn-text">{message}</p>}
    </div>
  )
}
