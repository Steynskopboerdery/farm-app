import { formatDate, formatNumber, formatZar } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import type { InvoiceView } from './invoiceView'

/** The invoice as it will print, shown on screen. */
export function InvoicePreview({ v }: { v: InvoiceView }) {
  const { t, lang } = useI18n()
  const bankLines = [
    v.bank.accountName && `${t('bankAccountName')}: ${v.bank.accountName}`,
    v.bank.bank && `${t('bankName')}: ${v.bank.bank}`,
    v.bank.accountNumber && `${t('bankAccountNumber')}: ${v.bank.accountNumber}`,
    v.bank.branchCode && `${t('bankBranchCode')}: ${v.bank.branchCode}`,
    v.bank.accountType && `${t('bankAccountType')}: ${v.bank.accountType}`,
  ].filter(Boolean)
  return (
    <article className="invoice-paper">
      <header className="inv-head">
        <div>
          <div className="inv-seller">{v.seller.name}</div>
          {v.seller.address && <div className="inv-pre">{v.seller.address}</div>}
          <div>{[v.seller.phone, v.seller.email].filter(Boolean).join(' · ')}</div>
          {v.seller.vatNumber && <div>{t('vatNo')} {v.seller.vatNumber}</div>}
        </div>
        <div className="inv-title">
          <div className="inv-kind">{v.vatRegistered ? t('taxInvoice') : t('invoiceWord')}</div>
          <div><strong>{t('invoiceNo')} {v.number}</strong></div>
          <div>{t('issueDate')}: {formatDate(v.issueDate, lang)}</div>
          {v.dueDate && <div>{t('dueDateLabel')}: {formatDate(v.dueDate, lang)}</div>}
        </div>
      </header>

      <section className="inv-bill">
        <div className="inv-label">{t('billTo')}</div>
        {v.customer ? (
          <>
            <div><strong>{v.customer.name}</strong></div>
            {v.customer.contact && <div>{v.customer.contact}</div>}
            {v.customer.address && <div className="inv-pre">{v.customer.address}</div>}
            {v.customer.vatNumber && <div>{t('vatNo')} {v.customer.vatNumber}</div>}
          </>
        ) : <div>–</div>}
      </section>

      <table className="inv-table">
        <thead>
          <tr><th>{t('description')}</th><th className="num">{t('qty')}</th><th className="num">{t('unitPrice').replace(' (R)', '')}</th><th className="num">{t('totalDue')}</th></tr>
        </thead>
        <tbody>
          {v.lines.map((l, i) => (
            <tr key={i}>
              <td>{l.description}{v.vatRegistered && !l.vat ? ' *' : ''}</td>
              <td className="num">{formatNumber(l.quantity, 3, lang)}{l.unit ? ` ${l.unit}` : ''}</td>
              <td className="num">{formatZar(l.unitPrice, lang)}</td>
              <td className="num">{formatZar(l.total, lang)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="inv-totals">
        <div><span>{t('subtotal')}</span><span>{formatZar(v.subtotal, lang)}</span></div>
        {v.vatRegistered && <div><span>{t('vatAmount', { rate: formatNumber(v.vatRate, 2, lang) })}</span><span>{formatZar(v.vat, lang)}</span></div>}
        <div className="inv-grand"><span>{t('totalDue')}</span><span>{formatZar(v.total, lang)}</span></div>
        {v.paid > 0 && <div><span>{t('paidSoFar')}</span><span>{formatZar(v.paid, lang)}</span></div>}
        {v.paid > 0 && <div className="inv-grand"><span>{t('balanceDue')}</span><span>{formatZar(v.balance, lang)}</span></div>}
      </section>
      {v.vatRegistered && v.lines.some((l) => !l.vat) && <p className="tiny muted">* {t('vatOnLine')}: 0%</p>}

      {v.notes && <p className="inv-pre">{v.notes}</p>}
      {bankLines.length > 0 && (
        <section className="inv-bank">
          <div className="inv-label">{t('bankingDetails')}</div>
          {bankLines.map((l) => <div key={l as string}>{l}</div>)}
          <div className="tiny muted">{t('pleaseUseRef')}</div>
        </section>
      )}
      {v.footer && <footer className="inv-foot">{v.footer}</footer>}
    </article>
  )
}
