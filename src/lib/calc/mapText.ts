// Turning the text read off a photo of a farm map into fields and camps: a name, the size if it is written
// next to it, and where on the photo it is written (so a traced outline can be given the right name).

export interface TextLine { text: string; confidence: number; box: { x0: number; y0: number; x1: number; y1: number } }
export interface MapLabel { name: string; hectares: number | null; kind: 'field' | 'camp'; x: number; y: number }

const MORGEN_HA = 0.8565
const SIZE = /(\d{1,4}(?:[.,]\d{1,3})?)\s*(ha\b|hekt\w*|hect\w*|morg\w*|mg\b)?/i
const CAMP = /^(kamp|camp|weiding|veld)\b/i

/** Lines read from the photo → names with sizes. Lines that are only numbers, marks or a letter or two are skipped. */
export function parseMapText(lines: TextLine[]): MapLabel[] {
  const out: MapLabel[] = []
  for (const l of lines) {
    if (l.confidence < 45) continue
    const text = l.text.replace(/\s+/g, ' ').trim()
    // The size is the number with a unit (ha, morgen); without units, the last of two numbers ("Land 4 50" = land 4, 50 ha).
    const nums = [...text.matchAll(new RegExp(SIZE.source, 'gi'))]
    const m = nums.find((x) => x[2]) ?? (nums.length >= 2 ? nums[nums.length - 1] : undefined)
    let hectares: number | null = null
    let name = text
    if (m) {
      const n = Number(m[1].replace(',', '.'))
      const unit = (m[2] ?? '').toLowerCase()
      hectares = Math.round((unit.startsWith('m') ? n * MORGEN_HA : n) * 100) / 100
      name = text.slice(0, m.index) + ' ' + text.slice(m.index! + m[0].length)
    }
    name = name.replace(/[|_~=:;()[\]{}<>"'`*•·,.\-–]+/g, ' ').replace(/\s+/g, ' ').trim()
    // A land number alone ("Land 4", "4") still counts; stray marks don't.
    if ((name.match(/[a-zA-ZÀ-ÿ]/g) ?? []).length < 2 && !/^\d{1,3}$/.test(name)) continue
    if (name.length > 40) continue
    out.push({ name, hectares, kind: CAMP.test(name) ? 'camp' : 'field', x: (l.box.x0 + l.box.x1) / 2, y: (l.box.y0 + l.box.y1) / 2 })
  }
  // The same name read twice: keep the one with a size.
  const best = new Map<string, MapLabel>()
  for (const a of out) {
    const k = a.name.toLowerCase()
    const b = best.get(k)
    if (!b || (b.hectares == null && a.hectares != null)) best.set(k, a)
  }
  return [...best.values()]
}
