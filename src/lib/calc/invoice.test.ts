import { describe, expect, it } from 'vitest'
import { formatInvoiceNumber, invoiceTotals } from './invoice'

const vat15 = { vatRegistered: true, vatRate: 15 }

describe('invoiceTotals', () => {
  it('10 t wheat at R5 500 with 15% VAT', () => {
    expect(invoiceTotals([{ quantity: 10, unitPrice: 5500 }], vat15)).toEqual({
      lineTotals: [55_000], subtotal: 55_000, vat: 8_250, total: 63_250,
    })
  })

  it('no VAT when the farm is not VAT registered', () => {
    expect(invoiceTotals([{ quantity: 10, unitPrice: 5500 }], { vatRegistered: false, vatRate: 15 }).total).toBe(55_000)
  })

  it('only charges VAT on lines marked for VAT', () => {
    const t = invoiceTotals([
      { quantity: 2, unitPrice: 1000 },
      { quantity: 1, unitPrice: 500, vatApplicable: false },
    ], vat15)
    expect(t).toEqual({ lineTotals: [2000, 500], subtotal: 2500, vat: 300, total: 2800 })
  })

  it('rounds each line to the cent', () => {
    const t = invoiceTotals([{ quantity: 3, unitPrice: 33.333 }], vat15)
    expect(t.lineTotals).toEqual([100])
    expect(t.vat).toBe(15)
    expect(t.total).toBe(115)
  })

  it('handles an empty invoice', () => {
    expect(invoiceTotals([], vat15)).toEqual({ lineTotals: [], subtotal: 0, vat: 0, total: 0 })
  })
})

describe('formatInvoiceNumber', () => {
  it('pads to 4 digits', () => {
    expect(formatInvoiceNumber('INV-', 1)).toBe('INV-0001')
    expect(formatInvoiceNumber('INV-', 12345)).toBe('INV-12345')
  })
})
