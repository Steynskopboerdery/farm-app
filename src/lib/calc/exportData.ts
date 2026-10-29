// Date ranges and totals for the accountant / bank export.

const r2 = (n: number) => Math.round(n * 100) / 100

const lastDayOfFeb = (year: number) => (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28)

/** South African tax year (1 March – end of February) that contains `day`. */
export function taxYear(day: string): { from: string; to: string; label: string } {
  const y = Number(day.slice(0, 4))
  const start = Number(day.slice(5, 7)) >= 3 ? y : y - 1
  return { from: `${start}-03-01`, to: `${start + 1}-02-${lastDayOfFeb(start + 1)}`, label: `${start}/${String(start + 1).slice(2)}` }
}

/** The tax year before the one containing `day`. */
export function previousTaxYear(day: string) {
  const cur = taxYear(day)
  return taxYear(`${Number(cur.from.slice(0, 4)) - 1}-06-01`)
}

export interface InvoiceLite { issue_date: string; status: string; subtotal: number | null; vat_amount: number | null; total: number | null }
export interface CostVatLite { date: string; amount: number; vat_amount: number | null }

/**
 * VAT for a period: VAT charged on invoices issued (drafts left out) less VAT paid on costs with a VAT amount.
 * A positive "net" is payable to SARS, negative is a refund.
 */
export function vatSummary(invoices: InvoiceLite[], costs: CostVatLite[], from: string, to: string) {
  const inRange = (d: string) => d >= from && d <= to
  const issued = invoices.filter((i) => i.status !== 'draft' && inRange(i.issue_date))
  const sales = r2(issued.reduce((s, i) => s + Number(i.subtotal ?? 0), 0))
  const output = r2(issued.reduce((s, i) => s + Number(i.vat_amount ?? 0), 0))
  const withVat = costs.filter((c) => inRange(c.date) && c.vat_amount != null)
  const input = r2(withVat.reduce((s, c) => s + Number(c.vat_amount), 0))
  const costsTotal = r2(costs.filter((c) => inRange(c.date)).reduce((s, c) => s + Number(c.amount), 0))
  return { sales, output, input, net: r2(output - input), costsTotal, costsWithoutVat: costs.filter((c) => inRange(c.date) && c.vat_amount == null).length }
}

/** Totals per key (e.g. cost category) for rows in range. */
export function totalsBy<T extends { date: string }>(rows: T[], from: string, to: string, key: (r: T) => string, value: (r: T) => number) {
  const out = new Map<string, number>()
  for (const r of rows) if (r.date >= from && r.date <= to) out.set(key(r), r2((out.get(key(r)) ?? 0) + value(r)))
  return [...out.entries()].sort((a, b) => b[1] - a[1])
}
