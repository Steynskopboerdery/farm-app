import { describe, expect, it } from 'vitest'
import { balanceOf, debtorsByCustomer, statusAfterPayment } from './debtors'

describe('balance and status', () => {
  it('R63 250 invoice with R20 000 paid leaves R43 250', () => {
    expect(balanceOf({ total: 63_250, paid: 20_000 })).toBe(43_250)
  })
  it('paid in full marks it paid; part payment keeps it sent', () => {
    expect(statusAfterPayment('sent', 63_250, 63_250)).toBe('paid')
    expect(statusAfterPayment('sent', 63_250, 20_000)).toBe('sent')
  })
  it('removing a payment from a paid invoice puts it back to sent', () => {
    expect(statusAfterPayment('paid', 1000, 500)).toBe('sent')
  })
})

describe('debtorsByCustomer', () => {
  const invoices = [
    { id: '1', customer_id: 'mill', status: 'sent', due_date: '2026-09-30', total: 63_250, paid: 20_000 },
    { id: '2', customer_id: 'mill', status: 'sent', due_date: '2026-11-15', total: 10_000, paid: 0 },
    { id: '3', customer_id: 'coop', status: 'sent', due_date: '2026-10-20', total: 5_000, paid: 0 },
    { id: '4', customer_id: 'coop', status: 'paid', due_date: '2026-08-01', total: 9_000, paid: 9_000 },
    { id: '5', customer_id: 'coop', status: 'draft', due_date: '2026-08-01', total: 1_000, paid: 0 },
  ]
  it('adds up what each customer owes on sent invoices, most overdue first', () => {
    expect(debtorsByCustomer(invoices, '2026-10-27')).toEqual([
      { customerId: 'mill', owed: 53_250, overdue: 43_250, invoices: 2, oldestDaysOverdue: 27 },
      { customerId: 'coop', owed: 5_000, overdue: 5_000, invoices: 1, oldestDaysOverdue: 7 },
    ])
  })
})
