export interface InvoiceLine {
  quantity: number
  unitPrice: number
  vatApplicable?: boolean
}

export interface VatSettings {
  vatRegistered: boolean
  vatRate: number // percent, e.g. 15
}

const toCents = (rand: number) => Math.round(rand * 100)

/** Line totals, subtotal, VAT and total in Rand. Worked in cents so there is no rounding drift. */
export function invoiceTotals(lines: InvoiceLine[], vat: VatSettings) {
  const lineTotals = lines.map((l) => toCents(l.quantity * l.unitPrice))
  const subtotalCents = lineTotals.reduce((a, b) => a + b, 0)
  const vatableCents = vat.vatRegistered
    ? lines.reduce((sum, l, i) => sum + (l.vatApplicable === false ? 0 : lineTotals[i]), 0)
    : 0
  const vatCents = Math.round((vatableCents * vat.vatRate) / 100)
  return {
    lineTotals: lineTotals.map((c) => c / 100),
    subtotal: subtotalCents / 100,
    vat: vatCents / 100,
    total: (subtotalCents + vatCents) / 100,
  }
}

/** Sequential invoice number, e.g. INV-0001. */
export function formatInvoiceNumber(prefix: string, n: number, digits = 4): string {
  return `${prefix}${String(n).padStart(digits, '0')}`
}
