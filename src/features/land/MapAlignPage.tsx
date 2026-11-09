import L from '../map/leafletGlobal'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useFarm, useFarmId } from '../../farm/FarmProvider'
import { fitAffine, fitError, type PointPair } from '../../lib/calc/affine'
import { formatNumber } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { loadOverlay, saveOverlay } from '../../lib/mapOverlay'
import { useFarmLocation } from '../../lib/useWeather'
import { affineImageLayer, toMetres } from '../map/affineOverlay'

const ESRI_IMAGERY = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'

interface Pair { photo?: [number, number]; map?: L.LatLng }

/**
 * Line up a photo of an old farm map with the satellite map: tap a spot on the photo, then the same spot on the
 * map, at least three times (field corners, dams, road crossings far apart work best). The fit takes care of
 * scale, turning and stretching, so the photo then sits exactly on the map for tracing.
 */
export function MapAlignPage() {
  const { t, lang } = useI18n()
  const farmId = useFarmId()
  const { farm } = useFarm()
  const navigate = useNavigate()
  const loc = useFarmLocation()
  const saved = loadOverlay(farmId)
  const [pairs, setPairs] = useState<Pair[]>([])
  const [zoom, setZoom] = useState(1)
  const [opacity, setOpacity] = useState(0.55)
  const mapEl = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const marks = useRef<L.LayerGroup | null>(null)
  const overlay = useRef<ReturnType<typeof affineImageLayer> | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  const done = pairs.filter((p): p is Required<Pair> => !!p.photo && !!p.map)
  const fitPairs: PointPair[] = done.map((p) => ({ photo: p.photo, map: toMetres(p.map) }))
  const fit = saved ? fitAffine(fitPairs) : null
  // Error in metres on the ground (map metres shrink towards the poles).
  const errM = fit && fitPairs.length >= 4 ? fitError(fit, fitPairs) * Math.cos(((farm?.map_center_lat ?? loc.lat) * Math.PI) / 180) : null
  const waitingFor: 'photo' | 'map' = pairs.length && !pairs[pairs.length - 1].map ? 'map' : 'photo'

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return
    const m = L.map(mapEl.current, { maxZoom: 20 }).setView([loc.lat, loc.lng], 14)
    L.tileLayer(ESRI_IMAGERY, { maxNativeZoom: 18, maxZoom: 20, attribution: 'Esri, Maxar, Earthstar Geographics' }).addTo(m)
    marks.current = L.layerGroup().addTo(m)
    mapRef.current = m
    return () => { m.remove(); mapRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A tap on the map completes the current point.
  useEffect(() => {
    const m = mapRef.current
    if (!m) return
    const onTap = (e: L.LeafletMouseEvent) => {
      setPairs((ps) => (ps.length && !ps[ps.length - 1].map ? [...ps.slice(0, -1), { ...ps[ps.length - 1], map: e.latlng }] : ps))
    }
    m.on('click', onTap)
    return () => { m.off('click', onTap) }
  }, [])

  // Numbered marks on the map, and the photo laid over it once there are three points.
  useEffect(() => {
    const m = mapRef.current
    if (!m || !marks.current) return
    marks.current.clearLayers()
    done.forEach((p, i) => L.marker(p.map, { icon: L.divIcon({ className: 'align-mark', html: `<span>${i + 1}</span>`, iconSize: [28, 28], iconAnchor: [14, 14] }) }).addTo(marks.current!))
    overlay.current?.remove()
    overlay.current = null
    if (fit && saved) {
      overlay.current = affineImageLayer(saved.photo, saved.w, saved.h, fit, opacity)
      overlay.current.addTo(m)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairs])
  useEffect(() => { overlay.current?.setOpacity(opacity) }, [opacity])

  if (!saved) {
    return (
      <div className="page stack">
        <Link to="/land/import" className="back">‹ {t('importMap')}</Link>
        <p className="muted">{t('alignNoPhoto')}</p>
      </div>
    )
  }

  function tapPhoto(e: MouseEvent<HTMLImageElement>) {
    if (waitingFor !== 'photo' || !imgRef.current) return
    const r = imgRef.current.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * saved!.w
    const y = ((e.clientY - r.top) / r.height) * saved!.h
    setPairs((ps) => [...ps, { photo: [x, y] }])
  }

  function save() {
    if (!fit || !saved) return
    saveOverlay(farmId, { ...saved, t: fit })
    navigate('/map')
  }

  const step = waitingFor === 'photo' ? t('alignTapPhoto', { n: pairs.length + 1 }) : t('alignTapMap', { n: pairs.length })

  return (
    <div className="page stack align-page">
      <Link to="/land/import" className="back">‹ {t('importMap')}</Link>
      <h1>📐 {t('alignTitle')}</h1>
      <p className="small">{t('alignHelp')}</p>
      <p className={`align-step ${waitingFor}`}>{waitingFor === 'photo' ? '1️⃣' : '2️⃣'} {step}</p>

      <div className="align-photo-wrap">
        <div className="align-photo" style={{ width: `${zoom * 100}%` }}>
          <img ref={imgRef} src={saved.photo} alt="" onClick={tapPhoto} className={waitingFor === 'photo' ? 'tappable' : ''} />
          {pairs.map((p, i) => p.photo && (
            <span key={i} className={`align-dot ${p.map ? '' : 'open'}`} style={{ left: `${(p.photo[0] / saved.w) * 100}%`, top: `${(p.photo[1] / saved.h) * 100}%` }}>{i + 1}</span>
          ))}
        </div>
      </div>
      <div className="btn-row">
        <button className="btn small" onClick={() => setZoom(Math.max(1, zoom / 1.5))}>➖</button>
        <button className="btn small" onClick={() => setZoom(Math.min(6, zoom * 1.5))}>➕ {t('alignZoomPhoto')}</button>
      </div>

      <div ref={mapEl} className={`align-map ${waitingFor === 'map' ? 'waiting' : ''}`} />

      {fit && (
        <label className="small">{t('seeThrough')}
          <input type="range" min={0.15} max={0.9} step={0.05} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} />
        </label>
      )}
      <p className="small">
        {done.length < 3 ? t('alignNeedMore', { n: 3 - done.length })
          : errM == null ? t('alignAddFourth')
            : errM < 15 ? `✓ ${t('alignGood', { m: formatNumber(errM, 0, lang) })}` : `⚠️ ${t('alignRough', { m: formatNumber(errM, 0, lang) })}`}
      </p>
      <div className="btn-row">
        <button className="btn" disabled={!pairs.length} onClick={() => setPairs(pairs.slice(0, -1).concat(pairs[pairs.length - 1]?.map ? [{ photo: pairs[pairs.length - 1].photo }] : []))}>↶ {t('alignUndo')}</button>
        <button className="btn primary" disabled={!fit} onClick={save}>✓ {t('alignSave')}</button>
      </div>
    </div>
  )
}
