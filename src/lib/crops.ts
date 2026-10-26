// Map colours: bright enough to stand out on satellite images.
export const CROP_COLOURS: Record<string, string> = {
  wheat: '#f6c343',
  canola: '#fff200',
  barley: '#ff8a3d',
  oats: '#c8e66b',
  lupins: '#b99cff',
}
export const DEFAULT_FIELD_COLOUR = '#ffffff'
export const CAMP_COLOUR = '#3ddc84'

export const CROP_OPTIONS = ['wheat', 'canola', 'barley', 'oats', 'lupins']

export function cropColour(crop: string | null | undefined): string {
  return (crop && CROP_COLOURS[crop.toLowerCase()]) || DEFAULT_FIELD_COLOUR
}
