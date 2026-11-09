import L from 'leaflet'
import { applyAffine, type Affine } from '../../lib/calc/affine'

/** Map metres (as used for the fit) ↔ latitude / longitude. */
export const toMetres = (ll: L.LatLng): [number, number] => {
  const p = L.CRS.EPSG3857.project(ll)
  return [p.x, p.y]
}
export const toLatLng = (xy: [number, number]): L.LatLng => L.CRS.EPSG3857.unproject(L.point(xy[0], xy[1]))

/**
 * A photo laid on the map through an affine fit, so it moves, zooms and turns with the satellite view.
 * Each corner of the photo is placed on the map and the picture is stretched between them.
 */
export function affineImageLayer(url: string, w: number, h: number, t: Affine, opacity = 0.6) {
  let img: HTMLImageElement | null = null
  let map: L.Map | null = null
  const place = () => {
    if (!img || !map) return
    const at = (x: number, y: number) => map!.latLngToLayerPoint(toLatLng(applyAffine(t, x, y)))
    const p0 = at(0, 0)
    const p1 = at(w, 0)
    const p2 = at(0, h)
    img.style.transform = `matrix(${(p1.x - p0.x) / w}, ${(p1.y - p0.y) / w}, ${(p2.x - p0.x) / h}, ${(p2.y - p0.y) / h}, ${p0.x}, ${p0.y})`
  }
  const Layer = L.Layer.extend({
    onAdd(m: L.Map) {
      map = m
      img = L.DomUtil.create('img', 'leaflet-zoom-hide affine-overlay') as HTMLImageElement
      img.src = url
      Object.assign(img.style, { width: `${w}px`, height: `${h}px`, opacity: String(opacity) })
      m.getPanes().overlayPane.appendChild(img)
      m.on('zoomend viewreset', place)
      place()
    },
    onRemove(m: L.Map) {
      m.off('zoomend viewreset', place)
      img?.remove()
      img = null
      map = null
    },
  })
  const layer = new Layer() as L.Layer & { setOpacity: (o: number) => void }
  layer.setOpacity = (o: number) => { if (img) img.style.opacity = String(o) }
  return layer
}
