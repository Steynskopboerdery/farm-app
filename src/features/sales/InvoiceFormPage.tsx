import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ErrorText, Loading, numOrNull, textOrNull } from '../../components/ui'
import { useFarmId } from '../../farm/FarmProvider'
import { todayIso } from '../../lib/calc/dates'
import { invoiceTotals } from '../../lib/calc/invoice'
import { formatNumber, formatZar } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { useFarmSettings } from '../../lib/queries'
import { dueDateFor, useCustomers, useInvoiceItems, useInvoices, type InvoiceWithPayments, type SaleItem } from '../../lib/sales'
import { supabase } from '../../lib/supabase'
import { CustomerFields, customerRow } from './CustomerFormPage'

interface Line { description: string; quantity: string; unit: string; unitPrice: string; vat: boolean }
const UNITS = ['t', 'kg', 'head', 'bale', 'L', 'each']
const SUGGESTIONS = ['Wheat', 'Canola', 'Malting barley', 'Oats', 'Wool', 'Lambs', 'Weaner calves', 'Cull ewes', 'Cull cows', 'Hay bales']
const emptyLine = (): Line => ({ description: '', quantity: '', unit: 't', unitPrice: '', vat: true })

/** Routes: /sales/new and /sales/invoice/:id/edit (drafts only). */
export function InvoiceFormPage() {
  const { id } = useParams<{ id?: string }>()
  const invoices = useInvoices()
  const customers = useCustomers()
  const settings = useFarmSettings()
  const existing = id ? invoices.data?.find((i) => i.id === id) : undefined
  const items = useInvoiceItems(existing?.sale_id)
  if (invoices.isLoading || customers.isLoading || settings.isLoading || (existing && items.isLoading)) return <Loading />
  return <InvoiceForm key={existing?.id ?? 'new'} existing={existing} existingItems={items.data ?? []} />
}

function InvoiceForm({ existing, existingItems }: { existing?: InvoiceWithPayments; existingItems: SaleItem[] }) {
  const { t, lang } = useI18n()
  const farmId = useFarmId()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [params] = useSearchParams()
  const customers = useCustomers()
  const settings = useFarmSettings()
  const vatRegistered = existing ? Number(existing.vat_rate ?? 0) > 0 : !!settings.data?.vat_registered
  const vatRate = existing ? Number(existing.vat_rate ?? 0) : Number(settings.data?.vat_rate ?? 15)
  const terms = settings.data?.payment_terms_days ?? 30

  const [customerId, setCustomerId] = useState<string>(existing?.customer_id ?? params.get('customer') ?? customers.data?.[0]?.id ?? 'new')
  const [newCustomer, setNewCustomer] = useState<Record<string, string>>({ name: '' })
  const [issue, setIssue] = useState(existing?.issue_date ?? todayIso())
  const [due, setDue] = useState(existing?.due_date ?? '')
  const [dueTouched, setDueTouched] = useState(!!existing)
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [lines, setLines] = useState<Line[]>(() => existingItems.length
    ? existingItems.map((i) => ({ description: i.description, quantity: String(i.quantity), unit: i.unit ?? '', unitPrice: String(i.unit_price), vat: i.vat_applicable }))
    : [emptyLine()])

  const dueDate = dueTouched ? due : dueDateFor(issue, terms)
  const filled = lines.filter((l) => l.description.trim() && numOrNull(l.quantity) != null && numOrNull(l.unitPrice) != null)
  const totals = invoiceTotals(filled.map((l) => ({ quantity: numOrNull(l.quantity)!, unitPrice: numOrNull(l.unitPrice)!, vatApplicable: l.vat })), { vatRegistered, vatRate })
  const setLine = (i: number, patch: Partial<Line>) => setLines(lines.map((l, k) => (k === i ? { ...l, ...patch } : l)))

  const save = useMutation({
    mutationFn: async () => {
      if (filled.length === 0) throw new Error(t('addLine'))
      let custId = customerId
      if (custId === 'new') {
        const { data, error } = await supabase.from('customers').insert({ ...customerRow(newCustomer), farm_id: farmId }).select('id').single()
        if (error) throw error
        custId = data.id
      }
      const itemRows = (saleId: string) => filled.map((l) => ({
        farm_id: farmId, sale_id: saleId, description: l.description.trim(), quantity: numOrNull(l.quantity)!,
        unit: textOrNull(l.unit), unit_price: numOrNull(l.unitPrice)!, vat_applicable: l.vat,
      }))
      const money = { subtotal: totals.subtotal, vat_amount: totals.vat, total: totals.total }

      if (existing) {
        const saleId = existing.sale_id!
        let { error } = await supabase.from('sales').update({ customer_id: custId, date: issue, description: filled[0].description }).eq('id', saleId)
        if (error) throw error
        ;({ error } = await supabase.from('sale_items').update({ deleted_at: new Date().toISOString() }).eq('sale_id', saleId).is('deleted_at', null))
        if (error) throw error
        ;({ error } = await supabase.from('sale_items').insert(itemRows(saleId)))
        if (error) throw error
        ;({ error } = await supabase.from('invoices').update({ customer_id: custId, issue_date: issue, due_date: dueDate || null, notes: textOrNull(notes), ...money }).eq('id', existing.id))
        if (error) throw error
        return existing.id
      }

      const { data: sale, error: saleErr } = await supabase.from('sales').insert({ farm_id: farmId, customer_id: custId, date: issue, description: filled[0].description }).select('id').single()
      if (saleErr) throw saleErr
      const { error: itemsErr } = await supabase.from('sale_items').insert(itemRows(sale.id))
      if (itemsErr) throw itemsErr
      // The database hands out the number, so it is never used twice.
      const { data: number, error: numErr } = await supabase.rpc('next_invoice_number', { p_farm: farmId })
      if (numErr) throw numErr
      const { data: inv, error: invErr } = await supabase.from('invoices').insert({
        farm_id: farmId, sale_id: sale.id, customer_id: custId, invoice_number: number, issue_date: issue,
        due_date: dueDate || null, status: 'draft', vat_rate: vatRegistered ? vatRate : 0, notes: textOrNull(notes), ...money,
      }).select('id').single()
      if (invErr) throw invErr
      return inv.id
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['customers'] })
      qc.invalidateQueries({ queryKey: ['farm_settings'] })
      navigate(`/sales/invoice/${id}`)
    },
  })

  return (
    <div className="page stack">
      <Link to={existing ? `/sales/invoice/${existing.id}` : '/sales'} className="back">‹ {existing ? existing.invoice_number : t('salesTitle')}</Link>
      <h1>{existing ? `${t('editInvoice')} ${existing.invoice_number}` : t('newInvoice')}</h1>

      <form className="stack" onSubmit={(e) => { e.preventDefault(); save.mutate() }}>
        <section className="card stack">
          <label>{t('customer')}
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              {(customers.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value="new">+ {t('newCustomer')}</option>
            </select>
          </label>
          {customerId === 'new' && <div className="subcard stack"><CustomerFields value={newCustomer} onChange={setNewCustomer} /></div>}
          <div className="grid2">
            <label>{t('issueDate')}<input type="date" required value={issue} onChange={(e) => setIssue(e.target.value)} /></label>
            <label>{t('dueDateLabel')}<input type="date" value={dueDate} onChange={(e) => { setDueTouched(true); setDue(e.target.value) }} /></label>
          </div>
        </section>

        <section className="card stack">
          <h2>{t('lines')}</h2>
          <datalist id="line-suggestions">{SUGGESTIONS.map((s) => <option key={s} value={s} />)}</datalist>
          {lines.map((l, i) => (
            <div key={i} className="subcard stack line-edit">
              <div className="card-head">
                <strong className="small muted">#{i + 1}</strong>
                {lines.length > 1 && <button type="button" className="btn small ghost" onClick={() => setLines(lines.filter((_, k) => k !== i))} aria-label={t('delete')}>✕</button>}
              </div>
              <label>{t('description')}<input list="line-suggestions" value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} /></label>
              <div className="grid3">
                <label>{t('qty')}<input inputMode="decimal" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} /></label>
                <label>{t('unitLabel')}
                  <select value={l.unit} onChange={(e) => setLine(i, { unit: e.target.value })}>
                    {[...new Set([...UNITS, l.unit].filter(Boolean))].map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </label>
                <label>{t('unitPrice')}<input inputMode="decimal" value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: e.target.value })} /></label>
              </div>
              {vatRegistered && <label className="check"><input type="checkbox" checked={l.vat} onChange={(e) => setLine(i, { vat: e.target.checked })} /> {t('vatOnLine')}</label>}
              {numOrNull(l.quantity) != null && numOrNull(l.unitPrice) != null && (
                <p className="right small"><strong>{formatZar(Math.round(numOrNull(l.quantity)! * numOrNull(l.unitPrice)! * 100) / 100, lang)}</strong></p>
              )}
            </div>
          ))}
          <button type="button" className="btn" onClick={() => setLines([...lines, emptyLine()])}>+ {t('addLine')}</button>

          <div className="inv-totals screen">
            <div><span>{t('subtotal')}</span><span>{formatZar(totals.subtotal, lang)}</span></div>
            {vatRegistered && <div><span>{t('vatAmount', { rate: formatNumber(vatRate, 2, lang) })}</span><span>{formatZar(totals.vat, lang)}</span></div>}
            <div className="inv-grand"><span>{t('totalDue')}</span><span>{formatZar(totals.total, lang)}</span></div>
          </div>
          {!vatRegistered && <p className="small muted">{t('noVatNote')}</p>}
        </section>

        <section className="card">
          <label>{t('notes')}<textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        </section>

        <button className="btn primary" disabled={save.isPending || filled.length === 0}>{save.isPending ? t('saving') : t('save')}</button>
        <ErrorText error={save.error} />
      </form>
    </div>
  )
}
