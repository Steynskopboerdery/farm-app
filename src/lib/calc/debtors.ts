import { daysBetween } from './dates'

export interface OpenInvoice {
  id: string
  customer_id: string | null
  status: string
  due_date: string | null
  total: number | null
  paid: number
}

/** Balance still owed on an invoice (never negative). */
export function balanceOf(inv: Pick<OpenInvoice, 'total' | 'paid'>): number {
  return Math.max(0, Math.round(((inv.total ?? 0) - inv.paid) * 100) / 100)
}

/** Status from payments: paid once the payments cover the total. */
export function statusAfterPayment(current: string, total: number | null, paid: number): string {
  if ((total ?? 0) > 0 && paid + 0.005 >= (total ?? 0)) return 'paid'
  return current === 'paid' ? 'sent' : current
}

/** Money owed per customer on sent invoices, most overdue first. */
export function debtorsByCustomer(invoices: OpenInvoice[], today: string) {
  const map = new Map<string | null, { customerId: string | null; owed: number; overdue: number; invoices: number; oldestDaysOverdue: number }>()
  for (const inv of invoices) {
    if (inv.status !== 'sent') continue
    const owed = balanceOf(inv)
    if (owed <= 0) continue
    const late = inv.due_date ? Math.max(0, daysBetween(inv.due_date, today)) : 0
    const d = map.get(inv.customer_id) ?? { customerId: inv.customer_id, owed: 0, overdue: 0, invoices: 0, oldestDaysOverdue: 0 }
    d.owed = Math.round((d.owed + owed) * 100) / 100
    if (late > 0) d.overdue = Math.round((d.overdue + owed) * 100) / 100
    d.invoices += 1
    d.oldestDaysOverdue = Math.max(d.oldestDaysOverdue, late)
    map.set(inv.customer_id, d)
  }
  return [...map.values()].sort((a, b) => b.oldestDaysOverdue - a.oldestDaysOverdue || b.owed - a.owed)
}
