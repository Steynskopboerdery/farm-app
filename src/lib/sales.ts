import { useQuery } from '@tanstack/react-query'
import { useFarmId } from '../farm/FarmProvider'
import { addDays, daysBetween, todayIso } from './calc/dates'
import { supabase, type Tables } from './supabase'

export type Customer = Tables<'customers'>
export type Invoice = Tables<'invoices'>
export type SaleItem = Tables<'sale_items'>
export type Payment = Tables<'payments'>

async function rows<T>(p: PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const { data, error } = await p
  if (error) throw new Error(error.message)
  return data ?? []
}

export function useCustomers() {
  const farmId = useFarmId()
  return useQuery({
    queryKey: ['customers', farmId],
    queryFn: () => rows(supabase.from('customers').select('*').eq('farm_id', farmId).is('deleted_at', null).order('name')),
  })
}

/** All invoices with their payments, newest first. */
export function useInvoices() {
  const farmId = useFarmId()
  return useQuery({
    queryKey: ['invoices', farmId],
    queryFn: async () => {
      const [invoices, payments] = await Promise.all([
        rows(supabase.from('invoices').select('*').eq('farm_id', farmId).is('deleted_at', null).order('issue_date', { ascending: false }).order('invoice_number', { ascending: false })),
        rows(supabase.from('payments').select('*').eq('farm_id', farmId).is('deleted_at', null).order('date')),
      ])
      return invoices.map((inv) => {
        const paid = payments.filter((p) => p.invoice_id === inv.id).reduce((s, p) => s + p.amount, 0)
        return { ...inv, paid: Math.round(paid * 100) / 100, balance: Math.round(((inv.total ?? 0) - paid) * 100) / 100, payments: payments.filter((p) => p.invoice_id === inv.id) }
      })
    },
  })
}
export type InvoiceWithPayments = NonNullable<ReturnType<typeof useInvoices>['data']>[number]

/** One invoice with its lines. */
export function useInvoiceItems(saleId: string | null | undefined) {
  const farmId = useFarmId()
  return useQuery({
    queryKey: ['invoices', farmId, 'items', saleId],
    enabled: !!saleId,
    queryFn: () => rows(supabase.from('sale_items').select('*').eq('farm_id', farmId).eq('sale_id', saleId!).is('deleted_at', null).order('created_at')),
  })
}

/** Days past the due date (0 if not yet due). */
export function daysOverdue(dueDate: string | null, today = todayIso()): number {
  if (!dueDate) return 0
  return Math.max(0, daysBetween(dueDate, today))
}

export function dueDateFor(issueDate: string, termsDays: number): string {
  return addDays(issueDate, termsDays)
}
