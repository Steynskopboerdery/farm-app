// Yearly budget and monthly cash flow: planned money in and out per month, the running bank balance,
// and what actually happened (costs paid, money received) to compare.

const r2 = (n: number) => Math.round(n * 100) / 100

export const INCOME_CATEGORIES = ['rent', 'crops', 'livestock', 'wool', 'other_in'] as const
export const EXPENSE_CATEGORIES = ['management', 'labour', 'crop_inputs', 'vet', 'feed', 'fuel', 'insurance', 'overheads', 'other'] as const

export interface BudgetLineLite { kind: string; category: string; label: string; amount: number; months: number[] }

/** Planned money in and out for each month (index 0 = January). A line's amount is split evenly over its months. */
export function monthlyPlan(lines: BudgetLineLite[]) {
  const income = Array<number>(12).fill(0)
  const expense = Array<number>(12).fill(0)
  for (const l of lines) {
    const months = [...new Set(l.months)].filter((m) => m >= 1 && m <= 12)
    if (!months.length) continue
    const each = Number(l.amount) / months.length
    for (const m of months) (l.kind === 'income' ? income : expense)[m - 1] += each
  }
  return { income: income.map(r2), expense: expense.map(r2) }
}

export interface CashMonth { month: number; income: number; expense: number; net: number; balance: number }

/** Month by month: money in, money out, the difference and the bank balance at the end of the month. */
export function cashFlow(income: number[], expense: number[], opening: number): CashMonth[] {
  let balance = opening
  return income.map((inc, i) => {
    const net = inc - expense[i]
    balance += net
    return { month: i + 1, income: r2(inc), expense: r2(expense[i]), net: r2(net), balance: r2(balance) }
  })
}

/** Months to watch: the balance goes below zero, or more goes out than comes in by a lot (a fifth of the year's spending). */
export function tightMonths(rows: CashMonth[]) {
  const yearOut = rows.reduce((a, r) => a + r.expense, 0)
  return rows.filter((r) => r.balance < 0 || (yearOut > 0 && -r.net > yearOut / 5)).map((r) => ({ month: r.month, balance: r.balance, net: r.net, belowZero: r.balance < 0 }))
}

/** Lowest balance in the year and the month it happens. */
export function lowestPoint(rows: CashMonth[]) {
  return rows.reduce((lo, r) => (r.balance < lo.balance ? r : lo), rows[0])
}

export interface ActualInputs {
  costs: { date: string; category: string; amount: number }[]
  ops: { date: string; cost: number | null }[]
  plantings: { planting_date: string | null; seed_cost: number | null }[]
  payments: { date: string; amount: number }[]
}

/** Which budget category a recorded cost belongs to. */
export const costToBudget = (category: string) => ({ fuel: 'fuel', machinery: 'fuel', labour: 'labour', feed: 'feed' } as Record<string, string>)[category] ?? 'other'

/** What actually went out and came in each month of a year, and spending per budget category. */
export function actuals(year: number, a: ActualInputs) {
  const income = Array<number>(12).fill(0)
  const expense = Array<number>(12).fill(0)
  const byCategory: Record<string, number> = {}
  const inYear = (d: string | null | undefined) => !!d && Number(d.slice(0, 4)) === year
  const month = (d: string) => Number(d.slice(5, 7)) - 1
  const out = (d: string, amount: number, cat: string) => {
    expense[month(d)] += amount
    byCategory[cat] = (byCategory[cat] ?? 0) + amount
  }
  for (const c of a.costs) if (inYear(c.date)) out(c.date, Number(c.amount), costToBudget(c.category))
  for (const o of a.ops) if (inYear(o.date) && o.cost) out(o.date, Number(o.cost), 'crop_inputs')
  for (const p of a.plantings) if (inYear(p.planting_date) && p.seed_cost) out(p.planting_date!, Number(p.seed_cost), 'crop_inputs')
  for (const p of a.payments) if (inYear(p.date)) income[month(p.date)] += Number(p.amount)
  return { income: income.map(r2), expense: expense.map(r2), byCategory: Object.fromEntries(Object.entries(byCategory).map(([k, v]) => [k, r2(v)])) }
}

/** Planned spending per category for the year. */
export function planByCategory(lines: BudgetLineLite[], kind: 'income' | 'expense') {
  const out: Record<string, number> = {}
  for (const l of lines) if (l.kind === kind) out[l.category] = r2((out[l.category] ?? 0) + Number(l.amount))
  return out
}

/** A starting budget from the farm's own figures: crops on the planned hectares, animals, and wool. */
export function budgetFromPlan(args: {
  cropHa: Map<string, number>
  crops: { name: string; yield_t_per_ha: number | null; price_per_t: number | null; input_cost_per_ha: number | null }[]
  herds: { name: string; females: number; weaning_pct: number | null; price_per_head: number | null; wool_kg_per_head: number | null; wool_price_per_kg: number | null; cost_per_head_per_year: number | null }[]
}): BudgetLineLite[] {
  const lines: BudgetLineLite[] = []
  for (const [crop, ha] of args.cropHa) {
    const e = args.crops.find((c) => c.name === crop)
    if (!e || !ha) continue
    if (e.yield_t_per_ha && e.price_per_t) lines.push({ kind: 'income', category: 'crops', label: crop, amount: Math.round(ha * Number(e.yield_t_per_ha) * Number(e.price_per_t)), months: [12] })
    if (e.input_cost_per_ha) lines.push({ kind: 'expense', category: 'crop_inputs', label: crop, amount: Math.round(ha * Number(e.input_cost_per_ha)), months: [4, 5, 6, 7] })
  }
  for (const h of args.herds) {
    if (!h.females) continue
    if (h.weaning_pct && h.price_per_head) lines.push({ kind: 'income', category: 'livestock', label: h.name, amount: Math.round((h.females * Number(h.weaning_pct)) / 100 * Number(h.price_per_head)), months: [12] })
    if (h.wool_kg_per_head && h.wool_price_per_kg) lines.push({ kind: 'income', category: 'wool', label: h.name, amount: Math.round(h.females * Number(h.wool_kg_per_head) * Number(h.wool_price_per_kg)), months: [10] })
    if (h.cost_per_head_per_year) lines.push({ kind: 'expense', category: 'vet', label: h.name, amount: Math.round(h.females * Number(h.cost_per_head_per_year)), months: [2, 6, 9, 10] })
  }
  return lines
}
