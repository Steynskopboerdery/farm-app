import { describe, expect, it } from 'vitest'
import { previousTaxYear, taxYear, totalsBy, vatSummary } from './exportData'

describe('tax year', () => {
  it('October 2026 is in the 2026/27 tax year (1 Mar 2026 – 28 Feb 2027)', () => {
    expect(taxYear('2026-10-29')).toEqual({ from: '2026-03-01', to: '2027-02-28', label: '2026/27' })
  })
  it('January falls in the year that started the previous March; leap years end on the 29th', () => {
    expect(taxYear('2028-01-15')).toEqual({ from: '2027-03-01', to: '2028-02-29', label: '2027/28' })
  })
  it('previous tax year', () => {
    expect(previousTaxYear('2026-10-29').label).toBe('2025/26')
  })
})

describe('VAT summary', () => {
  const invoices = [
    { issue_date: '2026-09-10', status: 'sent', subtotal: 55_000, vat_amount: 8_250, total: 63_250 },
    { issue_date: '2026-10-01', status: 'paid', subtotal: 10_000, vat_amount: 1_500, total: 11_500 },
    { issue_date: '2026-10-05', status: 'draft', subtotal: 9_999, vat_amount: 1_499.85, total: 11_498.85 },
    { issue_date: '2026-08-31', status: 'paid', subtotal: 1_000, vat_amount: 150, total: 1_150 },
  ]
  const costs = [
    { date: '2026-09-02', amount: 11_500, vat_amount: 1_500 },
    { date: '2026-10-12', amount: 2_300, vat_amount: 300 },
    { date: '2026-10-12', amount: 800, vat_amount: null },
  ]
  it('September–October: R9 750 charged less R1 800 paid = R7 950 to SARS (drafts left out)', () => {
    expect(vatSummary(invoices, costs, '2026-09-01', '2026-10-31')).toEqual({
      sales: 65_000, output: 9_750, input: 1_800, net: 7_950, costsTotal: 14_600, costsWithoutVat: 1,
    })
  })
  it('totals per category in range', () => {
    const rows = [{ date: '2026-09-01', c: 'fuel', a: 100 }, { date: '2026-09-02', c: 'fuel', a: 50.5 }, { date: '2026-09-03', c: 'labour', a: 200 }, { date: '2027-01-01', c: 'fuel', a: 1 }]
    expect(totalsBy(rows, '2026-01-01', '2026-12-31', (r) => r.c, (r) => r.a)).toEqual([['labour', 200], ['fuel', 150.5]])
  })
})
