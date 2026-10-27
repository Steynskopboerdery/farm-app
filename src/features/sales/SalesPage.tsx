import { Link, useSearchParams } from 'react-router-dom'
import { ErrorText, Loading } from '../../components/ui'
import { todayIso } from '../../lib/calc/dates'
import { debtorsByCustomer } from '../../lib/calc/debtors'
import { formatDateShort, formatZar } from '../../lib/format'
import { useI18n, type DictKey } from '../../lib/i18n'
import { daysOverdue, useCustomers, useInvoices } from '../../lib/sales'

type Tab = 'invoices' | 'debtors' | 'customers'

export function SalesPage() {
  const { t, lang } = useI18n()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'invoices'
  const invoices = useInvoices()
  const customers = useCustomers()
  const today = todayIso()
  const customerName = new Map((customers.data ?? []).map((c) => [c.id, c.name]))

  if (invoices.isLoading || customers.isLoading) return <Loading />
  const list = invoices.data ?? []
  const debtors = debtorsByCustomer(list, today)
  const owed = debtors.reduce((s, d) => s + d.owed, 0)
  const overdue = debtors.reduce((s, d) => s + d.overdue, 0)

  return (
    <div className="page stack">
      <Link to="/menu" className="back">‹ {t('menu')}</Link>
      <div className="card-head">
        <h1>{t('salesTitle')}</h1>
        <Link className="btn small primary" to="/sales/new">+ {t('newInvoice')}</Link>
      </div>

      <div className="stats">
        <button className="stat plain-btn" onClick={() => setParams({ tab: 'debtors' })}>
          <span className="stat-n">{formatZar(owed, lang)}</span><span className="stat-l">{t('totalOwed')}</span>
        </button>
        <button className="stat plain-btn" onClick={() => setParams({ tab: 'debtors' })}>
          <span className={`stat-n ${overdue > 0 ? 'warn-text' : ''}`}>{formatZar(overdue, lang)}</span><span className="stat-l">{t('overdueTotal')}</span>
        </button>
      </div>

      <div className="segmented">
        {(['invoices', 'debtors', 'customers'] as Tab[]).map((k) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setParams({ tab: k })}>{t(`${k}Tab` as DictKey)}</button>
        ))}
      </div>
      <ErrorText error={invoices.error ?? customers.error} />

      {tab === 'invoices' && (list.length === 0 ? <p className="muted">{t('noInvoices')}</p> : (
        <ul className="list card">
          {list.map((inv) => {
            const late = inv.status === 'sent' && inv.balance > 0 ? daysOverdue(inv.due_date, today) : 0
            return (
              <li key={inv.id}>
                <Link className="row link-row" to={`/sales/invoice/${inv.id}`}>
                  <div className="grow">
                    <div><strong>{inv.invoice_number}</strong> · {inv.customer_id ? customerName.get(inv.customer_id) : '–'}</div>
                    <div className="small muted">{formatDateShort(inv.issue_date, lang)}{late ? <span className="warn-text"> · {t('overdueDays', { n: late })}</span> : null}</div>
                  </div>
                  <div className="right">
                    <div><strong>{formatZar(inv.total, lang)}</strong></div>
                    <span className={`status status-${inv.status}`}>{t(`status_${inv.status}` as DictKey)}</span>
                  </div>
                  <span className="chev">›</span>
                </Link>
              </li>
            )
          })}
        </ul>
      ))}

      {tab === 'debtors' && (debtors.length === 0 ? <p className="notice good">{t('noDebtors')}</p> : (
        <ul className="list card">
          {debtors.map((d) => (
            <li key={d.customerId ?? 'none'}>
              <Link className="row link-row" to={d.customerId ? `/sales/customer/${d.customerId}` : '/sales'}>
                <div className="grow">
                  <div><strong>{d.customerId ? customerName.get(d.customerId) : '–'}</strong></div>
                  <div className="small muted">
                    {t('invoicesCount', { n: d.invoices })} · {d.oldestDaysOverdue > 0 ? <span className="warn-text">{t('overdueDays', { n: d.oldestDaysOverdue })}</span> : t('notDueYet')}
                  </div>
                </div>
                <strong>{formatZar(d.owed, lang)}</strong>
                <span className="chev">›</span>
              </Link>
            </li>
          ))}
        </ul>
      ))}

      {tab === 'customers' && (
        <>
          {(customers.data ?? []).length === 0 ? <p className="muted">{t('noCustomers')}</p> : (
            <ul className="list card">
              {customers.data!.map((c) => {
                const owes = debtors.find((d) => d.customerId === c.id)?.owed ?? 0
                return (
                  <li key={c.id}>
                    <Link className="row link-row" to={`/sales/customer/${c.id}`}>
                      <span className="farm-avatar small" aria-hidden="true">{c.name.slice(0, 1).toUpperCase()}</span>
                      <div className="grow">
                        <div><strong>{c.name}</strong></div>
                        <div className="small muted">{[c.contact_person, c.phone].filter(Boolean).join(' · ')}</div>
                      </div>
                      {owes > 0 && <span className="small warn-text">{formatZar(owes, lang)}</span>}
                      <span className="chev">›</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
          <Link className="btn" to="/sales/customer/new">+ {t('addCustomer')}</Link>
        </>
      )}
    </div>
  )
}
