import { describe, expect, it } from 'vitest'
import { parseMapText, type TextLine } from './mapText'

const line = (text: string, confidence = 90, x = 100, y = 100): TextLine => ({ text, confidence, box: { x0: x - 10, y0: y - 5, x1: x + 10, y1: y + 5 } })

describe('reading a farm map photo', () => {
  it('finds names with sizes in hectares or morgen, and where they are written', () => {
    const r = parseMapText([line('Land 4 - 50 ha', 90, 200, 300), line('Bo-land 42,8ha'), line('Kamp 3: 30 morg'), line('Rivierland')])
    expect(r).toEqual([
      { name: 'Land 4', hectares: 50, kind: 'field', x: 200, y: 300 },
      { name: 'Bo land', hectares: 42.8, kind: 'field', x: 100, y: 100 },
      { name: 'Kamp 3', hectares: 25.7, kind: 'camp', x: 100, y: 100 },
      { name: 'Rivierland', hectares: null, kind: 'field', x: 100, y: 100 },
    ])
  })
  it('skips smudges, stray marks and unsure reads', () => {
    expect(parseMapText([line('| ~ .'), line('x'), line('Land 9 12 ha', 20)])).toEqual([])
  })
  it('keeps one of each name, preferring the one with a size', () => {
    const r = parseMapText([line('Field 7'), line('Field 7 45 ha')])
    expect(r).toHaveLength(1)
    expect(r[0].hectares).toBe(45)
  })
})
