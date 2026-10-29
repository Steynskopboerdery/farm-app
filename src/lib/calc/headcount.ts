// Head counts: compare what was counted in the veld with what the records say.

export interface HeadCountLite { group_id: string; date: string; counted: number; expected: number }

/** Difference for one count: negative = animals missing. */
export function countDifference(c: { counted: number; expected: number }) {
  const diff = c.counted - c.expected
  return { diff, missing: diff < 0 ? -diff : 0, extra: diff > 0 ? diff : 0 }
}

/** The latest count per group, and whether it showed animals missing. */
export function latestCounts(counts: HeadCountLite[]) {
  const latest = new Map<string, HeadCountLite>()
  for (const c of [...counts].sort((a, b) => a.date.localeCompare(b.date))) latest.set(c.group_id, c)
  return [...latest.values()].map((c) => ({ ...c, ...countDifference(c) }))
}

/** Groups not counted for more than `days` days (or never). */
export function overdueCounts(groupIds: string[], counts: HeadCountLite[], today: string, days: number) {
  const last = new Map<string, string>()
  for (const c of counts) if (!last.has(c.group_id) || c.date > last.get(c.group_id)!) last.set(c.group_id, c.date)
  const limit = new Date(Date.parse(`${today}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10)
  return groupIds.filter((id) => !last.has(id) || last.get(id)! < limit)
}
