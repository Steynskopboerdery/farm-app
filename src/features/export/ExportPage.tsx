import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorText } from '../../components/ui'
import { useFarm, useFarmId } from '../../farm/FarmProvider'
import { todayIso } from '../../lib/calc/dates'
import { previousTaxYear, taxYear, vatSummary } from '../../lib/calc/exportData'
import { formatZar } from '../../lib/format'
import { useI18n, type DictKey } from '../../lib/i18n'
import { supabase, type Tables } from '../../lib/supabase'

export interface ExportData {
  from: string
  to: string
  farmName: string
  costs: Tables<'costs'>[]
  invoices: (Tables<'invoices'> & { paid: number; balance: number })[]
  payments: Tables<'payments'>[]
  operations: Tables<'field_operations'>[]
  plantings: Tables<'plantings'>[]
  harvests: Tables<'harvests'>[]
  events: Tables<'animal_events'>[]
  rain: Tables<'rain_readings'>[]
  fuel: Tables<'vehicle_logs'>[]
  fieldName: Map<string, string>
  groupName: Map<string, string>
  customerName: Map<string, string>
  invoiceNumber: Map<string, string>
  vehicleName: Map<string, string>
  sheep: number
  cattle: number
}

async function all<T>(p: PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const { data, error } = await p
  if (error) throw new Error(error.message)
  return data ?? []
}

/** Everything recorded in a period, for the accountant, SARS or the bank. */
async function loadExport(farmId: string, farmName: string, from: string, to: string): Promise<ExportData> {
  const sb = supabase
  const [costs, invoices, payments, operations, plantings, harvests, events, rain, fuel, fields, groups, customers, vehicles] = await Promise.all([
    all(sb.from('costs').select('*').eq('farm_id', farmId).is('deleted_at', null).gte('date', from).lte('date', to).order('date')),
    all(sb.from('invoices').select('*').eq('farm_id', farmId).is('deleted_at', null).gte('issue_date', from).lte('issue_date', to).order('issue_date')),
    all(sb.from('payments').select('*').eq('farm_id', farmId).is('deleted_at', null).order('date')),
    all(sb.from('field_operations').select('*').eq('farm_id', farmId).is('deleted_at', null).gte('date', from).lte('date', to).order('date')),
    all(sb.from('plantings').select('*').eq('farm_id', farmId).is('deleted_at', null).gte('planting_date', from).lte('planting_date', to).order('planting_date')),
    all(sb.from('harvests').select('*').eq('farm_id', farmId).is('deleted_at', null).gte('date', from).lte('date', to).order('date')),
    all(sb.from('animal_events').select('*').eq('farm_id', farmId).is('deleted_at', null).gte('date', from).lte('date', to).order('date')),
    all(sb.from('rain_readings').select('*').eq('farm_id', farmId).is('deleted_at', null).gte('date', from).lte('date', to).order('date')),
    all(sb.from('vehicle_logs').select('*').eq('farm_id', farmId).is('deleted_at', null).gte('date', from).lte('date', to).order('date')),
    all(sb.from('fields').select('id, name').eq('farm_id', farmId).is('deleted_at', null)),
    all(sb.from('livestock_groups').select('id, name, species, quantity').eq('farm_id', farmId).is('deleted_at', null)),
    all(sb.from('customers').select('id, name').eq('farm_id', farmId).is('deleted_at', null)),
    all(sb.from('vehicles').select('id, name').eq('farm_id', farmId).is('deleted_at', null)),
  ])
  const paidBy = new Map<string, number>()
  for (const p of payments) paidBy.set(p.invoice_id, (paidBy.get(p.invoice_id) ?? 0) + Number(p.amount))
  return {
    from, to, farmName, costs, payments: payments.filter((p) => p.date >= from && p.date <= to), operations, plantings, harvests, events, rain, fuel,
    invoices: invoices.map((i) => ({ ...i, paid: paidBy.get(i.id) ?? 0, balance: Math.round((Number(i.total ?? 0) - (paidBy.get(i.id) ?? 0)) * 100) / 100 })),
    fieldName: new Map(fields.map((f) => [f.id, f.name])),
    groupName: new Map(groups.map((g) => [g.id, g.name])),
    customerName: new Map(customers.map((c) => [c.id, c.name])),
    invoiceNumber: new Map(invoices.map((i) => [i.id, i.invoice_number])),
    vehicleName: new Map(vehicles.map((v) => [v.id, v.name])),
    sheep: groups.filter((g) => g.species === 'sheep').reduce((s, g) => s + g.quantity, 0),
    cattle: groups.filter((g) => g.species === 'cattle').reduce((s, g) => s + g.quantity, 0),
  }
}

async function share(blob: Blob, name: string) {
  const file = new File([blob], name, { type: blob.type })
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return } catch { /* cancelled: fall back to download */ }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

type Preset = 'tax' | 'lastTax' | 'calendar' | 'lastCalendar' | 'custom'

export function ExportPage() {
  const { t, w, lang } = useI18n()
  const { farm } = useFarm()
  const farmId = useFarmId()
  const today = todayIso()
  const year = Number(today.slice(0, 4))
  const ranges: Record<Exclude<Preset, 'custom'>, { from: string; to: string; label: string }> = {
    tax: { ...taxYear(today), label: `${t('exp_taxYear')} ${taxYear(today).label}` },
    lastTax: { ...previousTaxYear(today), label: `${t('exp_taxYear')} ${previousTaxYear(today).label}` },
    calendar: { from: `${year}-01-01`, to: `${year}-12-31`, label: String(year) },
    lastCalendar: { from: `${year - 1}-01-01`, to: `${year - 1}-12-31`, label: String(year - 1) },
  }
  const [preset, setPreset] = useState<Preset>('lastTax')
  const [custom, setCustom] = useState({ from: `${year}-01-01`, to: today })
  const range = preset === 'custom' ? custom : ranges[preset]
  const [busy, setBusy] = useState<'xlsx' | 'pdf' | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [vat, setVat] = useState<ReturnType<typeof vatSummary> | null>(null)

  async function run(kind: 'xlsx' | 'pdf') {
    setBusy(kind)
    setError(null)
    try {
      const data = await loadExport(farmId, farm?.name ?? 'Farm', range.from, range.to)
      setVat(vatSummary(data.invoices, data.costs, range.from, range.to))
      const files = await import('./exportFiles')
      const base = `${(farm?.name ?? 'farm').replace(/[^\w-]+/g, '-')}_${range.from}_${range.to}`
      if (kind === 'xlsx') await share(await files.excelBlob(data, t, w), `${base}.xlsx`)
      else await share(await files.summaryPdfBlob(data, t, w, lang), `${base}.pdf`)
    } catch (e) {
      setError(e)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="page stack">
      <Link to="/menu" className="back">‹ {t('menu')}</Link>
      <h1>📤 {t('exp_title')}</h1>
      <p className="muted">{t('exp_intro')}</p>
      <section className="card stack">
        <h2>{t('exp_period')}</h2>
        <div className="chips">
          {(Object.keys(ranges) as Exclude<Preset, 'custom'>[]).map((p) => (
            <button key={p} className={`chip ${preset === p ? 'on' : ''}`} onClick={() => setPreset(p)}>{ranges[p].label}</button>
          ))}
          <button className={`chip ${preset === 'custom' ? 'on' : ''}`} onClick={() => setPreset('custom')}>{t('exp_custom')}</button>
        </div>
        {preset === 'custom' && (
          <div className="grid2">
            <label>{t('exp_from')}<input type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} /></label>
            <label>{t('exp_to')}<input type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} /></label>
          </div>
        )}
        <p className="small muted">{range.from} – {range.to}</p>
        <button className="btn primary" disabled={!!busy} onClick={() => run('xlsx')}>{busy === 'xlsx' ? t('exp_making') : `📗 ${t('exp_excel')}`}</button>
        <button className="btn" disabled={!!busy} onClick={() => run('pdf')}>{busy === 'pdf' ? t('exp_making') : `📄 ${t('exp_pdf')}`}</button>
        <p className="tiny muted">{t('exp_contents')}</p>
        <ErrorText error={error} />
      </section>
      {vat && (
        <section className="card">
          <h2>VAT</h2>
          <dl className="facts">
            <dt>{t('exp_vatOutput')}</dt><dd>{formatZar(vat.output, lang)}</dd>
            <dt>{t('exp_vatInput')}</dt><dd>{formatZar(vat.input, lang)}</dd>
            <dt><strong>{t((vat.net >= 0 ? 'exp_vatPayable' : 'exp_vatRefund') as DictKey)}</strong></dt><dd><strong>{formatZar(Math.abs(vat.net), lang)}</strong></dd>
          </dl>
          {vat.costsWithoutVat > 0 && <p className="tiny muted">{t('exp_vatMissing', { n: vat.costsWithoutVat })}</p>}
        </section>
      )}
    </div>
  )
}
