import { invoiceTotals } from '../../lib/calc/invoice'
import type { Tables } from '../../lib/supabase'

/** Everything printed on an invoice, gathered once for the screen preview and the PDF. */
export interface InvoiceView {
  number: string
  issueDate: string
  dueDate: string | null
  status: string
  vatRegistered: boolean
  vatRate: number
  seller: { name: string; address: string | null; phone: string | null; email: string | null; vatNumber: string | null }
  bank: { bank: string | null; accountName: string | null; accountNumber: string | null; branchCode: string | null; accountType: string | null }
  footer: string | null
  customer: { name: string; contact: string | null; address: string | null; email: string | null; phone: string | null; vatNumber: string | null } | null
  lines: { description: string; quantity: number; unit: string | null; unitPrice: number; vat: boolean; total: number }[]
  subtotal: number
  vat: number
  total: number
  paid: number
  balance: number
  notes: string | null
}

export function buildInvoiceView(args: {
  invoice: Pick<Tables<'invoices'>, 'invoice_number' | 'issue_date' | 'due_date' | 'status' | 'vat_rate' | 'notes'>
  items: Pick<Tables<'sale_items'>, 'description' | 'quantity' | 'unit' | 'unit_price' | 'vat_applicable'>[]
  settings: Tables<'farm_settings'> | null | undefined
  farmName: string
  customer: Tables<'customers'> | null | undefined
  paid: number
}): InvoiceView {
  const { invoice, items, settings, farmName, customer, paid } = args
  const vatRate = Number(invoice.vat_rate ?? 0)
  const vatRegistered = vatRate > 0
  const lines = items.map((i) => ({ quantity: Number(i.quantity), unitPrice: Number(i.unit_price), vatApplicable: i.vat_applicable }))
  const totals = invoiceTotals(lines, { vatRegistered, vatRate })
  return {
    number: invoice.invoice_number,
    issueDate: invoice.issue_date,
    dueDate: invoice.due_date,
    status: invoice.status,
    vatRegistered,
    vatRate,
    seller: {
      name: settings?.legal_name || farmName, address: settings?.address ?? null, phone: settings?.phone ?? null,
      email: settings?.email ?? null, vatNumber: settings?.vat_registered ? settings.vat_number ?? null : null,
    },
    bank: {
      bank: settings?.bank_name ?? null, accountName: settings?.bank_account_name ?? null, accountNumber: settings?.bank_account_number ?? null,
      branchCode: settings?.bank_branch_code ?? null, accountType: settings?.bank_account_type ?? null,
    },
    footer: settings?.invoice_footer ?? null,
    customer: customer ? {
      name: customer.name, contact: customer.contact_person, address: customer.address, email: customer.email,
      phone: customer.phone, vatNumber: customer.vat_number,
    } : null,
    lines: items.map((i, k) => ({
      description: i.description, quantity: Number(i.quantity), unit: i.unit, unitPrice: Number(i.unit_price),
      vat: i.vat_applicable, total: totals.lineTotals[k],
    })),
    subtotal: totals.subtotal,
    vat: totals.vat,
    total: totals.total,
    paid,
    balance: Math.max(0, Math.round((totals.total - paid) * 100) / 100),
    notes: invoice.notes,
  }
}
