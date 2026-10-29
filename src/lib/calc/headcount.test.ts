import { describe, expect, it } from 'vitest'
import { countDifference, latestCounts, overdueCounts } from './headcount'

describe('head counts', () => {
  it('3 short of 412 is 3 missing', () => {
    expect(countDifference({ counted: 409, expected: 412 })).toEqual({ diff: -3, missing: 3, extra: 0 })
  })
  it('keeps the latest count per group', () => {
    const list = [
      { group_id: 'ewes', date: '2026-10-20', counted: 409, expected: 412 },
      { group_id: 'ewes', date: '2026-10-01', counted: 412, expected: 412 },
      { group_id: 'cows', date: '2026-10-05', counted: 37, expected: 36 },
    ]
    expect(latestCounts(list).map((c) => [c.group_id, c.diff])).toEqual([['ewes', -3], ['cows', 1]])
  })
  it('lists groups not counted in 30 days', () => {
    const list = [{ group_id: 'ewes', date: '2026-10-20', counted: 1, expected: 1 }, { group_id: 'cows', date: '2026-09-01', counted: 1, expected: 1 }]
    expect(overdueCounts(['ewes', 'cows', 'rams'], list, '2026-10-29', 30)).toEqual(['cows', 'rams'])
  })
})
