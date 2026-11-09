// A photo of an old farm map, kept on this phone: the photo, how it lines up with the satellite map,
// and the names read off it (with where on the photo each is written).
import type { Affine } from './calc/affine'
import type { MapLabel } from './calc/mapText'

export interface SavedOverlay { photo: string; w: number; h: number; t: Affine | null; labels: MapLabel[] }

const key = (farmId: string) => `farm.mapOverlay.v2.${farmId}`

export function loadOverlay(farmId: string): SavedOverlay | null {
  try {
    const s = localStorage.getItem(key(farmId)) ?? sessionStorage.getItem(key(farmId))
    return s ? (JSON.parse(s) as SavedOverlay) : null
  } catch {
    return null
  }
}

/** Saves on the phone; a very large photo that doesn't fit is kept until the app is closed. Returns false if it can't be kept at all. */
export function saveOverlay(farmId: string, o: SavedOverlay): boolean {
  const s = JSON.stringify(o)
  try { localStorage.setItem(key(farmId), s); return true } catch { /* full */ }
  try { sessionStorage.setItem(key(farmId), s); return true } catch { return false }
}

export function removeOverlay(farmId: string) {
  try { localStorage.removeItem(key(farmId)); sessionStorage.removeItem(key(farmId)) } catch { /* ignore */ }
}

/** Width and height of a photo in pixels. */
export function photoSize(url: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = reject
    img.src = url
  })
}
