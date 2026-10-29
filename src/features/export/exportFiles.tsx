// Builds the Excel workbook and PDF summary for the accountant / bank. Loaded only when used (large libraries).
import { Document, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer'
import writeXlsxFile from 'write-excel-file/browser'
import type { Cell, Sheet } from 'write-excel-file/browser'
import { totalsBy, vatSummary } from '../../lib/calc/exportData'
import { formatDate, formatNumber as fmtNumber, formatZar as fmtZar } from '../../lib/format'
import type { DictKey, Lang } from '../../lib/i18n'
import type { ExportData } from './ExportPage'

type T = (k: DictKey, vars?: Record<string, string | number>) => string
const fixSpaces = (x: string) => x.replace(/ /g, ' ')
const zar = (n: number | null | undefined, lang: Lang) => fixSpaces(fmtZar(n, lang))
const num = (n: number | null | undefined, d: number, lang: Lang) => fixSpaces(fmtNumber(n, d, lang))

const bold = (value: string): Cell => ({ value, fontWeight: 'bold' })
const money = (n: number | null | undefined): Cell => (n == null ? null : { value: Number(n), type: Number, format: '#,##0.00' })
const n3 = (n: number | null | undefined): Cell => (n == null ? null : { value: Number(n), type: Number, format: '#,##0.###' })
const date = (d: string | null | undefined): Cell => (d ? { value: new Date(`${d.slice(0, 10)}T00:00:00Z`), type: Date, format: 'yyyy-mm-dd' } : null)
const text = (s: string | null | undefined): Cell => s ?? null

function sheet(name: string, header: string[], rows: Cell[][]): Sheet<never> {
  return { sheet: name.slice(0, 31), data: [header.map(bold), ...rows], stickyRowsCount: 1, columns: header.map((h) => ({ width: Math.max(12, Math.min(40, h.length + 4)) })) }
}

export async function excelBlob(d: ExportData, t: T, w: (word: string) => string): Promise<Blob> {
  const field = (id: string | null) => (id ? d.fieldName.get(id) ?? '' : '')
  const group = (id: string | null) => (id ? d.groupName.get(id) ?? '' : '')
  const vat = vatSummary(d.invoices, d.costs, d.from, d.to)
  const sheets: Sheet<never>[] = [
    sheet(t('exp_summary'), [t('description'), t('amount')], [
      [t('exp_period'), `${d.from} – ${d.to}`],
      [t('exp_farm'), d.farmName],
      [t('exp_salesExVat'), money(vat.sales)],
      [t('exp_costsTotal'), money(vat.costsTotal)],
      [t('exp_vatOutput'), money(vat.output)],
      [t('exp_vatInput'), money(vat.input)],
      [t('exp_vatNet'), money(vat.net)],
      ...totalsBy(d.costs, d.from, d.to, (c) => t(`costCat_${c.category}` as DictKey), (c) => Number(c.amount)).map(([k, v]) => [`${t('costWord')}: ${k}`, money(v)]),
    ]),
    sheet(t('costsTab'), [t('date'), t('category'), t('supplier'), t('description'), t('amount'), 'VAT', t('field'), t('groups'), t('viewReceipt')],
      d.costs.map((c) => [date(c.date), t(`costCat_${c.category}` as DictKey), text(c.supplier), text(c.description), money(c.amount), money(c.vat_amount), field(c.field_id), group(c.group_id), c.receipt_path ? '✓' : ''])),
    sheet(t('exp_invoices'), [t('invoiceNo'), t('issueDate'), t('dueDateLabel'), t('customer'), t('status'), t('subtotal'), 'VAT', t('totalDue'), t('paidSoFar'), t('balanceDue')],
      d.invoices.map((i) => [i.invoice_number, date(i.issue_date), date(i.due_date), text(d.customerName.get(i.customer_id ?? '')), t(`status_${i.status}` as DictKey), money(i.subtotal), money(i.vat_amount), money(i.total), money(i.paid), money(i.balance)])),
    sheet(t('exp_payments'), [t('date'), t('invoiceNo'), t('amount'), t('method'), t('reference')],
      d.payments.map((p) => [date(p.date), text(d.invoiceNumber.get(p.invoice_id)), money(p.amount), text(p.method), text(p.reference)])),
    sheet(t('exp_fieldRecords'), [t('date'), t('field'), t('eventType'), t('product'), t('rate'), '', t('exp_total'), '', t('costWord'), t('withholdingDays'), t('windKmh'), t('tempC'), t('notes')],
      d.operations.map((o) => [date(o.date), field(o.field_id), t(o.type === 'spray' ? 'sprayWord' : o.type === 'fertiliser' ? 'fertiliser' : 'otherWork'), text(o.product), n3(o.rate), text(o.rate_unit), n3(o.total_amount), text(o.unit), money(o.cost), n3(o.withholding_period_days), n3(o.wind_kmh), n3(o.temp_c), text(o.notes)])),
    sheet(t('exp_plantings'), [t('plantingDate'), t('field'), t('crop'), t('cultivar'), t('seedTotal'), t('seedCost')],
      d.plantings.map((p) => [date(p.planting_date), field(p.field_id), w(p.crop), text(p.cultivar), n3(p.seed_kg), money(p.seed_cost)])),
    sheet(t('harvestTitle'), [t('date'), t('field'), 't', 'ha', 't/ha'],
      d.harvests.map((h) => [date(h.date), field(h.field_id), n3(h.tons), n3(h.hectares_harvested), n3(h.yield_per_ha)])),
    sheet(t('exp_animalEvents'), [t('date'), t('groups'), t('eventType'), t('qty'), t('product'), t('notes')],
      d.events.map((e) => [date(e.date), group(e.group_id), t(`ev_${e.type}` as DictKey), n3(e.quantity), text(e.product), text(e.notes)])),
    sheet(t('rainTitle'), [t('date'), t('rainGauge'), 'mm'], d.rain.map((r) => [date(r.date), text(r.gauge), n3(r.mm)])),
    sheet(t('vehiclesTitle'), [t('date'), t('vehicle'), t('eventType'), t('litres'), t('exp_reading'), t('notes')],
      d.fuel.map((l) => [date(l.date), text(d.vehicleName.get(l.vehicle_id)), t(`vlog_${l.kind}` as DictKey), n3(l.litres), n3(l.reading), text(l.notes)])),
  ]
  return writeXlsxFile(sheets).toBlob()
}

const green = '#14532d'
const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: '#111' },
  h1: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: green, marginBottom: 2 },
  sub: { color: '#555', marginBottom: 18 },
  h2: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: green, marginTop: 14, marginBottom: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 0.5, borderBottomColor: '#ddd', paddingVertical: 4 },
  strong: { fontFamily: 'Helvetica-Bold' },
  note: { fontSize: 8, color: '#666', marginTop: 4 },
  foot: { position: 'absolute', bottom: 28, left: 40, right: 40, textAlign: 'center', color: '#666', fontSize: 8 },
})

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <View style={s.row}><Text style={strong ? s.strong : undefined}>{label}</Text><Text style={strong ? s.strong : undefined}>{value}</Text></View>
}

function SummaryPdf({ d, t, w, lang }: { d: ExportData; t: T; w: (word: string) => string; lang: Lang }) {
  const vat = vatSummary(d.invoices, d.costs, d.from, d.to)
  const costCats = totalsBy(d.costs, d.from, d.to, (c) => t(`costCat_${c.category}` as DictKey), (c) => Number(c.amount))
  const inputs = d.operations.reduce((x, o) => x + Number(o.cost ?? 0), 0) + d.plantings.reduce((x, p) => x + Number(p.seed_cost ?? 0), 0)
  const byCrop = new Map<string, { tons: number; ha: number }>()
  for (const h of d.harvests) {
    const crop = d.plantings.find((p) => p.field_id === h.field_id && p.season_id === h.season_id)?.crop ?? '–'
    const row = byCrop.get(crop) ?? { tons: 0, ha: 0 }
    row.tons += Number(h.tons)
    row.ha += Number(h.hectares_harvested ?? 0)
    byCrop.set(crop, row)
  }
  const rain = d.rain.reduce((x, r) => x + Number(r.mm), 0)
  const unpaid = d.invoices.filter((i) => i.status === 'sent').reduce((x, i) => x + Number(i.balance ?? 0), 0)
  return (
    <Document title={`${d.farmName} ${d.from} – ${d.to}`}>
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>{d.farmName}</Text>
        <Text style={s.sub}>{t('exp_pdfTitle')} · {formatDate(d.from, lang)} – {formatDate(d.to, lang)}</Text>

        <Text style={s.h2}>{t('exp_money')}</Text>
        <Line label={t('exp_salesExVat')} value={zar(vat.sales, lang)} />
        <Line label={t('exp_inputsOnFields')} value={zar(inputs, lang)} />
        {costCats.map(([k, v]) => <Line key={k} label={`${t('costWord')}: ${k}`} value={zar(v, lang)} />)}
        <Line label={t('exp_unpaid')} value={zar(unpaid, lang)} />

        <Text style={s.h2}>VAT</Text>
        <Line label={t('exp_vatOutput')} value={zar(vat.output, lang)} />
        <Line label={t('exp_vatInput')} value={zar(vat.input, lang)} />
        <Line label={vat.net >= 0 ? t('exp_vatPayable') : t('exp_vatRefund')} value={zar(Math.abs(vat.net), lang)} strong />
        {vat.costsWithoutVat > 0 && <Text style={s.note}>{t('exp_vatMissing', { n: vat.costsWithoutVat })}</Text>}

        <Text style={s.h2}>{t('harvestTitle')}</Text>
        {[...byCrop.entries()].map(([crop, r]) => (
          <Line key={crop} label={crop === '–' ? '–' : w(crop)} value={`${num(r.tons, 1, lang)} t${r.ha ? ` · ${num(r.tons / r.ha, 2, lang)} t/ha` : ''}`} />
        ))}
        {byCrop.size === 0 && <Text>–</Text>}

        <Text style={s.h2}>{t('exp_other')}</Text>
        <Line label={t('rainTitle')} value={`${num(rain, 0, lang)} mm`} />
        <Line label={t('exp_fuel')} value={`${num(d.fuel.reduce((x, l) => x + Number(l.litres ?? 0), 0), 0, lang)} L`} />
        <Line label={t('exp_herd')} value={`${num(d.sheep, 0, lang)} ${t('sheep').toLowerCase()} · ${num(d.cattle, 0, lang)} ${t('cattle').toLowerCase()}`} />

        <Text style={s.note}>{t('exp_pdfNote')}</Text>
        <Text style={s.foot} fixed>FarmPlans · {formatDate(new Date().toISOString().slice(0, 10), lang)}</Text>
      </Page>
    </Document>
  )
}

export function summaryPdfBlob(d: ExportData, t: T, w: (word: string) => string, lang: Lang): Promise<Blob> {
  return pdf(<SummaryPdf d={d} t={t} w={w} lang={lang} />).toBlob()
}
