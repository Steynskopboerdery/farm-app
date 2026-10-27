import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ErrorText, Loading, numOrNull, Section, textOrNull } from '../../components/ui'
import { useFarm, useFarmId } from '../../farm/FarmProvider'
import { todayIso } from '../../lib/calc/dates'
import { statusAfterPayment } from '../../lib/calc/debtors'
import { formatDateShort, formatZar } from '../../lib/format'
import { useI18n, type DictKey } from '../../lib/i18n'
import { useFarmSettings } from '../../lib/queries'
import { daysOverdue, useCustomers, useInvoiceItems, useInvoices } from '../../lib/sales'
import { supabase } from '../../lib/supabase'
import { InvoicePreview } from './InvoicePreview'
import { buildInvoiceView } from './invoiceView'

const METHODS = ['eft', 'cash', 'card', 'other'] as const

export function InvoicePage() {
  const { id } = useParams<{ id: string }>()
  const { t, lang } = useI18n()
  const { farm } = useFarm()
  const farmId = useFarmId()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const invoices = useInvoices()
  const customers = useCustomers()
  const settings = useFarmSettings()
  const inv = invoices.data?.find((i) => i.id === id)
  const items = useInvoiceItems(inv?.sale_id)
  const [pay, setPay] = useState<{ date: string; amount: string; method: string; reference: string } | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const refresh = () => qc.invalidateQueries({ queryKey: ['invoices'] })

  const view = inv && items.data ? buildInvoiceView({
    invoice: inv, items: items.data, settings: settings.data, farmName: farm?.name ?? '',
    customer: customers.data?.find((c) => c.id === inv.customer_id), paid: inv.paid,
  }) : null

  async function makePdf() {
    const { invoicePdfBlob } = await import('./invoicePdf')
    const blob = await invoicePdfBlob(view!, t, lang)
    // Keep a copy in the farm's private storage.
    const path = `${farmId}/${inv!.invoice_number}.pdf`
    const { error } = await supabase.storage.from('invoices').upload(path, blob, { contentType: 'application/pdf', upsert: true })
    if (!error && inv!.pdf_path !== path) await supabase.from('invoices').update({ pdf_path: path }).eq('id', inv!.id)
    return blob
  }

  const pdfAction = useMutation({
    mutationFn: async (mode: 'download' | 'share') => {
      const blob = await makePdf()
      const fileName = `${inv!.invoice_number}.pdf`
      const file = new File([blob], fileName, { type: 'application/pdf' })
      if (mode === 'share' && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${inv!.invoice_number} · ${view!.seller.name}` })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 10_000)
      }
      setMessage(`✓ ${t('pdfSaved')}`)
    },
    onSuccess: refresh,
  })

  const markSent = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('invoices').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', inv!.id)
      if (error) throw error
    },
    onSuccess: refresh,
  })

  async function updateStatus(paidNow: number) {
    const status = statusAfterPayment(inv!.status, inv!.total, paidNow)
    const { error } = await supabase.from('invoices').update({ status, paid_at: status === 'paid' ? new Date().toISOString() : null }).eq('id', inv!.id)
    if (error) throw error
  }

  const addPayment = useMutation({
    mutationFn: async () => {
      const amount = numOrNull(pay!.amount)
      if (!amount || amount <= 0) throw new Error(t('amount'))
      const { error } = await supabase.from('payments').insert({
        farm_id: farmId, invoice_id: inv!.id, date: pay!.date, amount, method: pay!.method, reference: textOrNull(pay!.reference),
      })
      if (error) throw error
      await updateStatus(inv!.paid + amount)
    },
    onSuccess: () => { setPay(null); refresh() },
  })

  const removePayment = useMutation({
    mutationFn: async (p: { id: string; amount: number }) => {
      const { error } = await supabase.from('payments').update({ deleted_at: new Date().toISOString() }).eq('id', p.id)
      if (error) throw error
      await updateStatus(inv!.paid - p.amount)
    },
    onSuccess: refresh,
  })

  const deleteDraft = useMutation({
    mutationFn: async () => {
      const now = new Date().toISOString()
      let { error } = await supabase.from('invoices').update({ deleted_at: now }).eq('id', inv!.id)
      if (error) throw error
      if (inv!.sale_id) ({ error } = await supabase.from('sales').update({ deleted_at: now }).eq('id', inv!.sale_id))
      if (error) throw error
    },
    onSuccess: () => { refresh(); navigate('/sales') },
  })

  if (invoices.isLoading || items.isLoading || settings.isLoading) return <Loading />
  if (!inv || !view) return <div className="page"><p>Not found.</p><Link to="/sales">{t('back')}</Link></div>

  const missingDetails = !settings.data?.bank_account_number || !(settings.data?.legal_name || farm?.name)
  const late = inv.status === 'sent' && inv.balance > 0 ? daysOverdue(inv.due_date) : 0

  return (
    <div className="page stack">
      <Link to="/sales" className="back">‹ {t('salesTitle')}</Link>
      <div className="card-head">
        <h1>{inv.invoice_number}</h1>
        <span className={`status status-${inv.status}`}>{t(`status_${inv.status}` as DictKey)}</span>
      </div>
      {late > 0 && <p className="warning">{t('overdueDays', { n: late })} · {t('balanceDue')} {formatZar(inv.balance, lang)}</p>}
      {missingDetails && <p className="notice">{t('needSettings')} <Link to="/settings">{t('navSettings')} ›</Link></p>}

      <div className="btn-row">
        <button className="btn primary" disabled={pdfAction.isPending} onClick={() => pdfAction.mutate('share')}>{pdfAction.isPending ? t('makingPdf') : `↗ ${t('sharePdf')}`}</button>
        <button className="btn" disabled={pdfAction.isPending} onClick={() => pdfAction.mutate('download')}>⬇ {t('downloadPdf')}</button>
      </div>
      {message && <p className="small">{message}</p>}
      <ErrorText error={pdfAction.error} />

      <div className="btn-row">
        {inv.status === 'draft' && <button className="btn lime" disabled={markSent.isPending} onClick={() => markSent.mutate()}>✓ {t('markSent')}</button>}
        {inv.status !== 'paid' && !pay && <button className="btn" onClick={() => setPay({ date: todayIso(), amount: String(inv.balance), method: 'eft', reference: '' })}>💰 {t('addPayment')}</button>}
        {inv.status === 'draft' && <Link className="btn" to={`/sales/invoice/${inv.id}/edit`}>{t('editInvoice')}</Link>}
      </div>
      {inv.status !== 'draft' && <p className="tiny muted">{t('sentLocked')}</p>}

      {pay && (
        <form className="card stack" onSubmit={(e) => { e.preventDefault(); addPayment.mutate() }}>
          <h2>{t('addPayment')}</h2>
          <div className="grid2">
            <label>{t('paymentDate')}<input type="date" value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} /></label>
            <label>{t('amount')}<input inputMode="decimal" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /></label>
          </div>
          <div className="grid2">
            <label>{t('method')}
              <select value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>
                {METHODS.map((m) => <option key={m} value={m}>{t(`pm_${m}` as DictKey)}</option>)}
              </select>
            </label>
            <label>{t('reference')}<input value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} /></label>
          </div>
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => setPay(null)}>{t('cancel')}</button>
            <button className="btn primary" disabled={addPayment.isPending}>{t('save')}</button>
          </div>
          <ErrorText error={addPayment.error} />
        </form>
      )}

      {inv.payments.length > 0 && (
        <Section title={t('payments')}>
          <ul className="list">
            {inv.payments.map((p) => (
              <li key={p.id} className="row">
                <div className="grow">
                  <div><strong>{formatZar(p.amount, lang)}</strong> · {p.method ? t(`pm_${p.method}` as DictKey) : ''}</div>
                  <div className="small muted">{formatDateShort(p.date, lang)}{p.reference ? ` · ${p.reference}` : ''}</div>
                </div>
                <button className="btn small ghost" aria-label={t('delete')} onClick={() => confirm(`${t('delete')}?`) && removePayment.mutate({ id: p.id, amount: p.amount })}>✕</button>
              </li>
            ))}
          </ul>
          <dl className="facts">
            <dt>{t('paidSoFar')}</dt><dd>{formatZar(inv.paid, lang)}</dd>
            <dt><strong>{t('balanceDue')}</strong></dt><dd><strong>{formatZar(inv.balance, lang)}</strong></dd>
          </dl>
        </Section>
      )}

      <InvoicePreview v={view} />

      {inv.status === 'draft' && (
        <button className="btn danger" disabled={deleteDraft.isPending} onClick={() => confirm(t('deleteDraftConfirm')) && deleteDraft.mutate()}>{t('deleteDraft')}</button>
      )}
      <ErrorText error={markSent.error ?? removePayment.error ?? deleteDraft.error} />
    </div>
  )
}
