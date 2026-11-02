import { describe, expect, it } from 'vitest'
import appRules from './alerts.ts?raw'
import phoneRules from '../../../supabase/functions/notify/alerts.ts?raw'
import { floweringRisks, floweringWindows, plantingRain, priceHits, priceRank } from './alerts'

describe('farm alerts', () => {
  it('sees when enough rain has fallen or is coming to plant', () => {
    const gauge = new Map([['2027-04-10', 12], ['2027-04-11', 15], ['2027-04-05', 40]])
    const fc = [{ date: '2027-04-12', rainMm: 4 }, { date: '2027-04-13', rainMm: 30 }, { date: '2027-04-20', rainMm: 50 }]
    const p = plantingRain(gauge, fc, '2027-04-11')
    expect(p.fell).toBe(27)
    expect(p.enoughFell).toBe(true)
    expect(p.coming).toBe(34)
    expect(p.enoughComing).toBe(true)
    expect(p.season).toBe(true)
    expect(plantingRain(gauge, fc, '2027-08-01').season).toBe(false)
  })
  it('warns of frost or heat only while a crop is flowering', () => {
    const w = floweringWindows([{ crop: 'canola', planting_date: '2027-04-25', field: 'Field 4' }, { crop: 'maize', planting_date: '2027-04-25' }])
    expect(w).toEqual([{ crop: 'canola', field: 'Field 4', from: '2027-07-04', to: '2027-08-23' }])
    const r = floweringRisks(w, [
      { date: '2027-07-10', min: -1, max: 14 }, { date: '2027-07-11', min: 5, max: 31 }, { date: '2027-06-01', min: -3, max: 12 }, { date: '2027-07-12', min: 4, max: 18 },
    ])
    expect(r.map((x) => `${x.date} ${x.kind}`)).toEqual(['2027-07-10 frost', '2027-07-11 heat'])
    expect(r[0].fields).toEqual(['Field 4'])
  })
  it('finds price targets that were reached', () => {
    const alerts = [
      { id: 'a', series: 'rapeseedOil', direction: 'above', target: 25_000, active: true },
      { id: 'b', series: 'dap', direction: 'below', target: 12_000, active: true },
      { id: 'c', series: 'wheat', direction: 'above', target: 1, active: false },
    ]
    const hits = priceHits(alerts, new Map([['rapeseedOil', 26_000], ['dap', 13_000], ['wheat', 5000]]))
    expect(hits.map((h) => h.id)).toEqual(['a'])
  })
  it('ranks today’s price against the last 5 years', () => {
    const pts = Array.from({ length: 60 }, (_, i): [string, number] => [`m${i}`, 100 + i])
    expect(priceRank(pts)!.dear).toBe(true)
    pts[59] = ['m59', 50]
    expect(priceRank(pts)).toEqual({ rank: 0, cheap: true, dear: false })
    expect(priceRank(pts.slice(0, 10))).toBeNull()
  })
  it('the phone notifications use the same rules as the app', () => {
    expect(phoneRules).toBe(appRules)
  })
})
