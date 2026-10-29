import L from './leafletGlobal'
import '@geoman-io/leaflet-geoman-free'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'
import { useQueryClient } from '@tanstack/react-query'
import type { MultiPolygon, Polygon } from 'geojson'
import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ErrorText, SampleBadge } from '../../components/ui'
import { useFarm, useFarmId } from '../../farm/FarmProvider'
import { hectaresFromBoundary, type Boundary } from '../../lib/calc/area'
import { CAMP_COLOUR, cropColour } from '../../lib/crops'
import { formatHa } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { useCamps, useCurrentPlantings, useFields } from '../../lib/queries'
import { supabase } from '../../lib/supabase'
import { OVERLAY_KEY } from '../land/MapImportPage'
import { PIN_EMOJI, usePins } from '../../lib/farmRecords'
import { PinDetails, PinForm } from './PinSheets'

type Kind = 'field' | 'camp'
interface Area { kind: Kind; id: string; name: string; hectares: number | null; boundary: Boundary | null; isSample: boolean; crop: string | null }
type Mode = 'view' | 'drawing' | 'assign' | 'editing' | 'pin'

// Between Swellendam and Bredasdorp, used until outlines exist.
const DEFAULT_CENTER: L.LatLngTuple = [-34.25, 20.25]
const DEFAULT_ZOOM = 11

const ESRI_IMAGERY = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
const ESRI_LABELS = 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'
const ESRI_ATTRIBUTION = 'Imagery &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community'

const table = (k: Kind) => (k === 'field' ? 'fields' : 'camps')

export function MapPage() {
  const { t, w, lang } = useI18n()
  const { isOwner } = useFarm()
  const farmId = useFarmId()
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const fields = useFields()
  const camps = useCamps()
  const plantings = useCurrentPlantings()
  const pins = usePins()
  const pinGroupRef = useRef<L.LayerGroup | null>(null)
  const [newPin, setNewPin] = useState<{ lat: number; lng: number } | null>(null)
  const [pinId, setPinId] = useState<string | null>(null)
  const selectedPin = pinId ? (pins.data ?? []).find((p) => p.id === pinId) ?? null : null

  const mapEl = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const groupRef = useRef<L.FeatureGroup | null>(null)
  const layersRef = useRef(new Map<string, L.Polygon>())
  const fittedRef = useRef(false)

  const [mode, setMode] = useState<Mode>('view')
  const modeRef = useRef<Mode>('view')
  modeRef.current = mode
  const [selected, setSelected] = useState<{ kind: Kind; id: string } | null>(null)
  const [drawTarget, setDrawTarget] = useState<{ kind: Kind; id: string } | null>(null)
  const [pending, setPending] = useState<{ geometry: Boundary; ha: number } | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  // An old farm map photo laid see-through over the satellite view, to trace outlines from.
  const [overlay, setOverlay] = useState<string | null>(() => { try { return sessionStorage.getItem(OVERLAY_KEY) } catch { return null } })
  const [overlayOpacity, setOverlayOpacity] = useState(0.5)
  const [overlayShown, setOverlayShown] = useState(true)
  const removeOverlay = () => { try { sessionStorage.removeItem(OVERLAY_KEY) } catch { /* ignore */ } setOverlay(null) }

  const areas: Area[] = useMemo(() => [
    ...(fields.data ?? []).map((f) => ({
      kind: 'field' as const, id: f.id, name: f.name, hectares: f.hectares, isSample: f.is_sample,
      boundary: f.boundary_geojson as unknown as Boundary | null, crop: plantings.data?.get(f.id)?.crop ?? null,
    })),
    ...(camps.data ?? []).map((c) => ({
      kind: 'camp' as const, id: c.id, name: c.name, hectares: c.hectares, isSample: c.is_sample,
      boundary: c.boundary_geojson as unknown as Boundary | null, crop: null,
    })),
  ], [fields.data, camps.data, plantings.data])

  const selectedArea = selected ? areas.find((a) => a.kind === selected.kind && a.id === selected.id) ?? null : null

  // Create the map once.
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return
    const map = L.map(mapEl.current, { zoomControl: true, maxZoom: 20 }).setView(DEFAULT_CENTER, DEFAULT_ZOOM)
    map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>')
    L.tileLayer(ESRI_IMAGERY, { maxNativeZoom: 18, maxZoom: 20, attribution: ESRI_ATTRIBUTION }).addTo(map)
    L.tileLayer(ESRI_LABELS, { maxNativeZoom: 18, maxZoom: 20, opacity: 0.8 }).addTo(map)
    groupRef.current = L.featureGroup().addTo(map)
    pinGroupRef.current = L.layerGroup().addTo(map)
    // Our own help text replaces Geoman's English-only hints.
    map.pm.setGlobalOptions({ allowSelfIntersection: false, snappable: true, tooltips: false })
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Draw outlines whenever the data changes (not while editing a shape).
  useEffect(() => {
    const map = mapRef.current
    const group = groupRef.current
    if (!map || !group || mode === 'editing') return
    group.clearLayers()
    layersRef.current.clear()
    for (const a of areas) {
      if (!a.boundary) continue
      const colour = a.kind === 'camp' ? CAMP_COLOUR : cropColour(a.crop)
      const isSel = selected?.kind === a.kind && selected.id === a.id
      const layer = L.geoJSON(a.boundary, {
        style: {
          color: colour, weight: isSel ? 5 : 3, fillColor: colour, fillOpacity: isSel ? 0.35 : 0.2,
          dashArray: a.kind === 'camp' ? '8 6' : undefined,
        },
      }).getLayers()[0] as L.Polygon
      layer.bindTooltip(a.name, { permanent: true, direction: 'center', className: 'area-label' })
      layer.on('click', (e) => {
        L.DomEvent.stopPropagation(e)
        if (modeRef.current === 'pin') { setNewPin({ lat: e.latlng.lat, lng: e.latlng.lng }); return }
        setPinId(null)
        setSelected({ kind: a.kind, id: a.id })
      })
      group.addLayer(layer)
      layersRef.current.set(`${a.kind}:${a.id}`, layer)
    }
    if (!fittedRef.current && group.getLayers().length > 0 && !params.get('focus')) {
      map.fitBounds(group.getBounds(), { padding: [30, 30] })
      fittedRef.current = true
    }
  }, [areas, selected, mode, params])

  // Pins: an emoji marker each; tap to open.
  useEffect(() => {
    const g = pinGroupRef.current
    if (!g) return
    g.clearLayers()
    for (const p of pins.data ?? []) {
      const icon = L.divIcon({ className: 'pin-marker', html: `<span><i>${PIN_EMOJI[p.kind] ?? '📍'}</i></span>`, iconSize: [34, 34], iconAnchor: [17, 34] })
      const m = L.marker([p.lat, p.lng], { icon, title: p.title })
      m.on('click', (e) => { L.DomEvent.stopPropagation(e); setSelected(null); setPinId(p.id) })
      g.addLayer(m)
    }
  }, [pins.data])

  // ?pin=<id> from the pins list
  useEffect(() => {
    const id = params.get('pin')
    const p = id ? (pins.data ?? []).find((x) => x.id === id) : null
    if (p && mapRef.current) {
      mapRef.current.setView([p.lat, p.lng], 17)
      fittedRef.current = true
      setPinId(p.id)
      setParams({}, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, pins.data])

  // Pin mode: the next tap on the map places the pin.
  useEffect(() => {
    const map = mapRef.current
    if (!map || mode !== 'pin') return
    const place = (e: L.LeafletMouseEvent) => { setNewPin({ lat: e.latlng.lat, lng: e.latlng.lng }) }
    map.on('click', place)
    map.getContainer().classList.add('placing-pin')
    return () => { map.off('click', place); map.getContainer().classList.remove('placing-pin') }
  }, [mode])

  // Tap empty map to clear the selection.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const clear = () => { if (mode === 'view') { setSelected(null); setPinId(null) } }
    map.on('click', clear)
    return () => { map.off('click', clear) }
  }, [mode])

  // Links from other pages: ?focus=field:<id> or ?draw=field:<id>
  useEffect(() => {
    const focus = params.get('focus')
    const draw = params.get('draw')
    if (focus && layersRef.current.has(focus)) {
      const [kind, id] = focus.split(':') as [Kind, string]
      setSelected({ kind, id })
      mapRef.current?.fitBounds(layersRef.current.get(focus)!.getBounds(), { padding: [40, 40], maxZoom: 17 })
      fittedRef.current = true
      setParams({}, { replace: true })
    } else if (draw && isOwner && mapRef.current) {
      const [kind, id] = draw.split(':') as [Kind, string]
      setParams({}, { replace: true })
      startDrawing({ kind, id })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, areas])

  function startDrawing(target: { kind: Kind; id: string } | null) {
    const map = mapRef.current
    if (!map) return
    setSelected(null)
    setDrawTarget(target)
    setMode('drawing')
    map.once('pm:create', (e: { layer: L.Layer }) => {
      const geometry = (e.layer as L.Polygon).toGeoJSON().geometry as Polygon | MultiPolygon
      map.removeLayer(e.layer)
      setPending({ geometry, ha: hectaresFromBoundary(geometry) })
      setMode('assign')
    })
    map.pm.enableDraw('Polygon', { templineStyle: { color: '#ffdd00' }, hintlineStyle: { color: '#ffdd00', dashArray: '5 5' }, pathOptions: { color: '#ffdd00' } })
  }

  function cancelDrawing() {
    const map = mapRef.current
    map?.pm.disableDraw()
    map?.off('pm:create')
    setPending(null)
    setDrawTarget(null)
    setMode('view')
  }

  // Geoman has no public API for these two; they are used widely and wrapped in try/catch.
  type DrawInternals = { Polygon: { _finishShape: () => void; _removeLastVertex: () => void } }
  const drawTool = () => mapRef.current?.pm.Draw as unknown as DrawInternals | undefined
  function finishShape() {
    try { drawTool()?.Polygon._finishShape() } catch { /* not enough corners */ }
  }
  function undoCorner() {
    try { drawTool()?.Polygon._removeLastVertex() } catch { /* nothing to undo */ }
  }

  async function saveBoundary(kind: Kind, id: string, geometry: Boundary | null, hectares?: number) {
    const patch: { boundary_geojson: never; hectares?: number } = { boundary_geojson: geometry as never }
    if (hectares != null) patch.hectares = hectares
    const { error } = await supabase.from(table(kind)).update(patch).eq('id', id)
    if (error) throw error
    await qc.invalidateQueries({ queryKey: [table(kind)] })
  }

  async function assign(choice: { type: 'new'; kind: Kind; name: string } | { type: 'existing'; kind: Kind; id: string }) {
    if (!pending) return
    setBusy(true)
    setError(null)
    try {
      if (choice.type === 'new') {
        const { data, error } = await supabase.from(table(choice.kind))
          .insert({ farm_id: farmId, name: choice.name, hectares: pending.ha, boundary_geojson: pending.geometry as never })
          .select('id').single()
        if (error) throw error
        await qc.invalidateQueries({ queryKey: [table(choice.kind)] })
        setSelected({ kind: choice.kind, id: data.id })
      } else {
        await saveBoundary(choice.kind, choice.id, pending.geometry, pending.ha)
        setSelected({ kind: choice.kind, id: choice.id })
      }
      setPending(null)
      setDrawTarget(null)
      setMode('view')
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  function startEditing() {
    if (!selected) return
    const layer = layersRef.current.get(`${selected.kind}:${selected.id}`)
    if (!layer) return
    layer.closeTooltip()
    layer.pm.enable({ allowSelfIntersection: false })
    setMode('editing')
  }

  async function saveEditing() {
    if (!selected) return
    const layer = layersRef.current.get(`${selected.kind}:${selected.id}`)
    if (!layer) return
    const geometry = layer.toGeoJSON().geometry as Boundary
    setBusy(true)
    try {
      layer.pm.disable()
      await saveBoundary(selected.kind, selected.id, geometry, hectaresFromBoundary(geometry))
      setMode('view')
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  function cancelEditing() {
    if (selected) layersRef.current.get(`${selected.kind}:${selected.id}`)?.pm.disable()
    setMode('view') // redraws from saved data
  }

  async function removeOutline() {
    if (!selectedArea || !confirm(t('mapDeleteConfirm', { name: selectedArea.name }))) return
    try {
      await saveBoundary(selectedArea.kind, selectedArea.id, null)
      setSelected(null)
    } catch (e) {
      setError(e)
    }
  }

  function locate() {
    const map = mapRef.current
    if (!map) return
    map.locate({ setView: true, maxZoom: 16, enableHighAccuracy: true })
    map.once('locationfound', (e: L.LocationEvent) => {
      L.circleMarker(e.latlng, { radius: 8, color: '#fff', weight: 3, fillColor: '#1a73e8', fillOpacity: 1 }).addTo(map)
    })
  }

  function fitAll() {
    const g = groupRef.current
    if (g && g.getLayers().length) mapRef.current?.fitBounds(g.getBounds(), { padding: [30, 30] })
  }

  const withoutOutline = areas.filter((a) => !a.boundary)
  const targetArea = drawTarget ? areas.find((a) => a.kind === drawTarget.kind && a.id === drawTarget.id) : null

  return (
    <div className="map-page">
      <div ref={mapEl} className="map" />
      {overlay && overlayShown && <img src={overlay} alt="" className="map-overlay" style={{ opacity: overlayOpacity }} />}
      {overlay && (
        <div className="overlay-bar">
          <span className="tiny">{t('overlayHelp')}</span>
          <input type="range" min={0.1} max={0.9} step={0.05} value={overlayOpacity} aria-label={t('seeThrough')}
            onChange={(e) => setOverlayOpacity(Number(e.target.value))} />
          <button className="btn small" onClick={() => setOverlayShown(!overlayShown)}>{overlayShown ? '🙈' : '👁'}</button>
          <button className="btn small" onClick={removeOverlay} aria-label={t('close')}>✕</button>
        </div>
      )}

      <div className="map-tools">
        <button className="btn map-btn" onClick={locate}>◎ {t('mapLocate')}</button>
        <button className="btn map-btn" onClick={fitAll}>⤢ {t('mapFitAll')}</button>
      </div>

      {mode === 'view' && !selectedArea && !selectedPin && (
        <div className="map-sheet compact">
          <div className="btn-row">
            {isOwner && <button className="btn primary" onClick={() => startDrawing(null)}>✎ {t('mapDraw')}</button>}
            <button className={`btn ${isOwner ? '' : 'primary'}`} onClick={() => { setNewPin(null); setMode('pin') }}>📍 {t('pinAdd')}</button>
          </div>
          <p className="tiny muted">{t('mapAttribution')}</p>
        </div>
      )}

      {mode === 'pin' && !newPin && (
        <div className="map-sheet">
          <p>{t('pinPlaceHelp')}</p>
          <div className="btn-row">
            <button className="btn" onClick={() => setMode('view')}>{t('cancel')}</button>
            <button className="btn" onClick={() => {
              mapRef.current?.locate({ enableHighAccuracy: true })
              mapRef.current?.once('locationfound', (e: L.LocationEvent) => { mapRef.current?.setView(e.latlng, 17); setNewPin({ lat: e.latlng.lat, lng: e.latlng.lng }) })
            }}>◎ {t('pinHere')}</button>
          </div>
        </div>
      )}
      {mode === 'pin' && newPin && (
        <PinForm at={newPin} onCancel={() => { setNewPin(null); setMode('view') }} onDone={(id) => { setNewPin(null); setMode('view'); setPinId(id) }} />
      )}
      {mode === 'view' && selectedPin && !selectedArea && <PinDetails pin={selectedPin} onClose={() => setPinId(null)} />}

      {mode === 'drawing' && (
        <div className="map-sheet">
          {targetArea && <p><strong>{targetArea.name}</strong></p>}
          <p>{t('mapDrawHelp')}</p>
          <div className="btn-row">
            <button className="btn" onClick={undoCorner}>↶</button>
            <button className="btn" onClick={cancelDrawing}>{t('cancel')}</button>
            <button className="btn primary" onClick={finishShape}>✓ {t('save')}</button>
          </div>
        </div>
      )}

      {mode === 'assign' && pending && (
        <AssignSheet
          ha={formatHa(pending.ha, lang)}
          target={targetArea ?? null}
          withoutOutline={withoutOutline}
          busy={busy}
          onAssign={assign}
          onCancel={cancelDrawing}
        />
      )}

      {mode === 'editing' && (
        <div className="map-sheet">
          <p>{t('mapEditHelp')}</p>
          <div className="btn-row">
            <button className="btn" onClick={cancelEditing}>{t('cancel')}</button>
            <button className="btn primary" disabled={busy} onClick={saveEditing}>{busy ? t('saving') : t('save')}</button>
          </div>
        </div>
      )}

      {mode === 'view' && selectedArea && (
        <div className="map-sheet">
          <div className="row">
            <div className="grow">
              <h2>{selectedArea.name} <SampleBadge show={selectedArea.isSample} /></h2>
              <div className="muted">
                {selectedArea.kind === 'field' ? t('field') : t('camp')} · {formatHa(selectedArea.hectares, lang)}
                {selectedArea.kind === 'field' && ` · ${selectedArea.crop ? w(selectedArea.crop) : t('noCrop')}`}
              </div>
              {selectedArea.boundary && (
                <div className="small muted">{t('mapAreaFromOutline')}: {formatHa(hectaresFromBoundary(selectedArea.boundary), lang)}</div>
              )}
            </div>
            <button className="btn small" onClick={() => setSelected(null)} aria-label={t('close')}>✕</button>
          </div>
          <div className="btn-row">
            <Link className="btn primary" to={`/land/${selectedArea.kind}/${selectedArea.id}`}>{t('mapOpenDetails')}</Link>
            {isOwner && <button className="btn" onClick={startEditing}>{t('mapEditOutline')}</button>}
            {isOwner && <button className="btn danger" onClick={removeOutline}>{t('mapDeleteOutline')}</button>}
          </div>
        </div>
      )}
      {error != null && <div className="map-error"><ErrorText error={error} /></div>}
    </div>
  )
}

function AssignSheet({ ha, target, withoutOutline, busy, onAssign, onCancel }: {
  ha: string
  target: Area | null
  withoutOutline: Area[]
  busy: boolean
  onAssign: (c: { type: 'new'; kind: Kind; name: string } | { type: 'existing'; kind: Kind; id: string }) => void
  onCancel: () => void
}) {
  const { t } = useI18n()
  const [choice, setChoice] = useState<string>(target ? `${target.kind}:${target.id}` : withoutOutline[0] ? `${withoutOutline[0].kind}:${withoutOutline[0].id}` : 'new-field')
  const [name, setName] = useState('')

  function submit() {
    if (choice === 'new-field' || choice === 'new-camp') {
      if (!name.trim()) return
      onAssign({ type: 'new', kind: choice === 'new-field' ? 'field' : 'camp', name: name.trim() })
    } else {
      const [kind, id] = choice.split(':') as [Kind, string]
      onAssign({ type: 'existing', kind, id })
    }
  }

  return (
    <div className="map-sheet stack">
      <h2>{t('mapAssignTitle')}</h2>
      <p>{t('mapAssignArea')}: <strong>{ha}</strong></p>
      {target ? <p><strong>{target.name}</strong></p> : (
        <>
          <label>
            {t('mapChoose')}
            <select value={choice} onChange={(e) => setChoice(e.target.value)}>
              {withoutOutline.length > 0 && (
                <optgroup label={t('mapExisting')}>
                  {withoutOutline.map((a) => (
                    <option key={`${a.kind}:${a.id}`} value={`${a.kind}:${a.id}`}>
                      {a.kind === 'field' ? t('field') : t('camp')}: {a.name}
                    </option>
                  ))}
                </optgroup>
              )}
              <option value="new-field">+ {t('mapNewField')}</option>
              <option value="new-camp">+ {t('mapNewCamp')}</option>
            </select>
          </label>
          {(choice === 'new-field' || choice === 'new-camp') && (
            <label>{t('name')}<input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></label>
          )}
        </>
      )}
      <div className="btn-row">
        <button className="btn" onClick={onCancel}>{t('cancel')}</button>
        <button className="btn primary" disabled={busy} onClick={submit}>{busy ? t('saving') : t('save')}</button>
      </div>
    </div>
  )
}
