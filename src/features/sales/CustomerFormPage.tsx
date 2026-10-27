import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ErrorText, Loading, textOrNull } from '../../components/ui'
import { useFarmId } from '../../farm/FarmProvider'
import { formatDateShort, formatZar } from '../../lib/format'
import { useI18n, type DictKey } from '../../lib/i18n'
import { useCustomers, useInvoices, type Customer } from '../../lib/sales'
import { supabase } from '../../lib/supabase'

/** Fields for a customer, used on its own page and inside the invoice form. */
export function CustomerFields({ value, onChange }: { value: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  const { t } = useI18n()
  const input = (k: string, label: string, type = 'text') => (
    <label>{label}<input type={type} value={value[k] ?? ''} required={k === 'name'} onChange={(e) => onChange({ ...value, [k]: e.target.value })} /></label>
  )
  return (
    <>
      {input('name', t('customerName'))}
      {input('contact_person', t('contactPerson'))}
      <div className="grid2">{input('phone', t('phone'), 'tel')}{input('email', t('email'), 'email')}</div>
      <label>{t('address')}<textarea rows={3} value={value.address ?? ''} onChange={(e) => onChange({ ...value, address: e.target.value })} /></label>
      {input('vat_number', t('customerVat'))}
    </>
  )
}

export const customerRow = (v: Record<string, string>) => ({
  name: v.name.trim(), contact_person: textOrNull(v.contact_person ?? ''), phone: textOrNull(v.phone ?? ''),
  email: textOrNull(v.email ?? ''), address: textOrNull(v.address ?? ''), vat_number: textOrNull(v.vat_number ?? ''),
})

export function CustomerFormPage() {
  const { id } = useParams<{ id: string }>()
  const customers = useCustomers()
  if (customers.isLoading) return <Loading />
  const existing = id && id !== 'new' ? customers.data?.find((c) => c.id === id) : undefined
  return <CustomerForm key={existing?.id ?? 'new'} existing={existing} />
}

function CustomerForm({ existing }: { existing?: Customer }) {
  const { t, lang } = useI18n()
  const farmId = useFarmId()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const invoices = useInvoices()
  const [v, setV] = useState<Record<string, string>>(() => ({
    name: existing?.name ?? '', contact_person: existing?.contact_person ?? '', phone: existing?.phone ?? '',
    email: existing?.email ?? '', address: existing?.address ?? '', vat_number: existing?.vat_number ?? '',
  }))
  const save = useMutation({
    mutationFn: async () => {
      const { error } = existing
        ? await supabase.from('customers').update(customerRow(v)).eq('id', existing.id)
        : await supabase.from('customers').insert({ ...customerRow(v), farm_id: farmId })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); navigate('/sales?tab=customers') },
  })
  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('customers').update({ deleted_at: new Date().toISOString() }).eq('id', existing!.id)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); navigate('/sales?tab=customers') },
  })
  const theirs = (invoices.data ?? []).filter((i) => existing && i.customer_id === existing.id)

  return (
    <div className="page stack">
      <Link to="/sales?tab=customers" className="back">‹ {t('customersTab')}</Link>
      <h1>{existing ? existing.name : t('addCustomer')}</h1>
      <form className="card stack" onSubmit={(e) => { e.preventDefault(); save.mutate() }}>
        <CustomerFields value={v} onChange={setV} />
        <button className="btn primary" disabled={save.isPending}>{save.isPending ? t('saving') : t('save')}</button>
        <ErrorText error={save.error} />
      </form>
      {existing && (
        <section className="card">
          <div className="card-head"><h2>{t('invoicesTab')}</h2><Link className="btn small" to={`/sales/new?customer=${existing.id}`}>+ {t('newInvoice')}</Link></div>
          {theirs.length === 0 ? <p className="muted">{t('noInvoices')}</p> : (
            <ul className="list">
              {theirs.map((i) => (
                <li key={i.id}>
                  <Link className="row link-row" to={`/sales/invoice/${i.id}`}>
                    <div className="grow"><strong>{i.invoice_number}</strong><div className="small muted">{formatDateShort(i.issue_date, lang)}</div></div>
                    <div className="right"><div>{formatZar(i.total, lang)}</div><span className={`status status-${i.status}`}>{t(`status_${i.status}` as DictKey)}</span></div>
                    <span className="chev">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {existing && theirs.length === 0 && (
        <button className="btn danger" onClick={() => confirm(`${t('removeCustomer')}?`) && remove.mutate()}>{t('removeCustomer')}</button>
      )}
    </div>
  )
}
