// The PDF version of the invoice. Loaded only when someone taps Download or Share, as the PDF library is large.
import { Document, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer'
import { formatDate, formatNumber as fmtNumber, formatZar as fmtZar } from '../../lib/format'
import type { DictKey, Lang } from '../../lib/i18n'
import type { InvoiceView } from './invoiceView'

// The built-in PDF font has no narrow no-break space (used by some phones for R 1 000), so use a normal one.
const fixSpaces = (x: string) => x.replace(/\u202f/g, '\u00a0')
const formatZar = (n: number | null | undefined, lang: Lang) => fixSpaces(fmtZar(n, lang))
const formatNumber = (n: number | null | undefined, d: number, lang: Lang) => fixSpaces(fmtNumber(n, d, lang))

const green = '#14532d'
const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: '#111' },
  head: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  seller: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: green, marginBottom: 4 },
  kind: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: green, textAlign: 'right', marginBottom: 6 },
  right: { textAlign: 'right' },
  label: { fontSize: 8, color: '#555', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 },
  bill: { marginBottom: 18, padding: 10, backgroundColor: '#f2f5ef', borderRadius: 4 },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#ccc', paddingVertical: 6 },
  th: { fontFamily: 'Helvetica-Bold', backgroundColor: green, color: '#fff', paddingVertical: 6, paddingHorizontal: 4 },
  cDesc: { flex: 4, paddingHorizontal: 4 },
  cNum: { flex: 1.6, textAlign: 'right', paddingHorizontal: 4 },
  totals: { marginTop: 12, marginLeft: 'auto', width: 220 },
  tRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  grand: { fontFamily: 'Helvetica-Bold', fontSize: 12, borderTopWidth: 1, borderTopColor: green, paddingTop: 5, marginTop: 3 },
  bank: { marginTop: 24, padding: 10, borderWidth: 0.5, borderColor: '#bbb', borderRadius: 4 },
  foot: { position: 'absolute', bottom: 28, left: 40, right: 40, textAlign: 'center', color: '#666', fontSize: 8 },
})

function InvoicePdf({ v, t, lang }: { v: InvoiceView; t: (k: DictKey, vars?: Record<string, string | number>) => string; lang: Lang }) {
  const bank = [
    v.bank.accountName && `${t('bankAccountName')}: ${v.bank.accountName}`,
    v.bank.bank && `${t('bankName')}: ${v.bank.bank}`,
    v.bank.accountNumber && `${t('bankAccountNumber')}: ${v.bank.accountNumber}`,
    v.bank.branchCode && `${t('bankBranchCode')}: ${v.bank.branchCode}`,
    v.bank.accountType && `${t('bankAccountType')}: ${v.bank.accountType}`,
  ].filter(Boolean) as string[]
  return (
    <Document title={`${v.number} ${v.seller.name}`} author={v.seller.name}>
      <Page size="A4" style={s.page}>
        <View style={s.head}>
          <View style={{ maxWidth: 260 }}>
            <Text style={s.seller}>{v.seller.name}</Text>
            {v.seller.address ? <Text>{v.seller.address}</Text> : null}
            {[v.seller.phone, v.seller.email].filter(Boolean).length ? <Text>{[v.seller.phone, v.seller.email].filter(Boolean).join('  ·  ')}</Text> : null}
            {v.seller.vatNumber ? <Text>{t('vatNo')} {v.seller.vatNumber}</Text> : null}
          </View>
          <View>
            <Text style={s.kind}>{v.vatRegistered ? t('taxInvoice') : t('invoiceWord')}</Text>
            <Text style={[s.right, { fontFamily: 'Helvetica-Bold' }]}>{t('invoiceNo')} {v.number}</Text>
            <Text style={s.right}>{t('issueDate')}: {formatDate(v.issueDate, lang)}</Text>
            {v.dueDate ? <Text style={s.right}>{t('dueDateLabel')}: {formatDate(v.dueDate, lang)}</Text> : null}
          </View>
        </View>

        <View style={s.bill}>
          <Text style={s.label}>{t('billTo')}</Text>
          {v.customer ? (
            <>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>{v.customer.name}</Text>
              {v.customer.contact ? <Text>{v.customer.contact}</Text> : null}
              {v.customer.address ? <Text>{v.customer.address}</Text> : null}
              {v.customer.vatNumber ? <Text>{t('vatNo')} {v.customer.vatNumber}</Text> : null}
            </>
          ) : <Text>–</Text>}
        </View>

        <View style={[s.row, { borderBottomWidth: 0, paddingVertical: 0 }]}>
          <Text style={[s.th, s.cDesc]}>{t('description')}</Text>
          <Text style={[s.th, s.cNum]}>{t('qty')}</Text>
          <Text style={[s.th, s.cNum]}>{t('unitPrice').replace(' (R)', '')}</Text>
          <Text style={[s.th, s.cNum]}>{t('totalDue')}</Text>
        </View>
        {v.lines.map((l, i) => (
          <View key={i} style={s.row} wrap={false}>
            <Text style={s.cDesc}>{l.description}{v.vatRegistered && !l.vat ? ' *' : ''}</Text>
            <Text style={s.cNum}>{formatNumber(l.quantity, 3, lang)}{l.unit ? ` ${l.unit}` : ''}</Text>
            <Text style={s.cNum}>{formatZar(l.unitPrice, lang)}</Text>
            <Text style={s.cNum}>{formatZar(l.total, lang)}</Text>
          </View>
        ))}

        <View style={s.totals}>
          <View style={s.tRow}><Text>{t('subtotal')}</Text><Text>{formatZar(v.subtotal, lang)}</Text></View>
          {v.vatRegistered ? <View style={s.tRow}><Text>{t('vatAmount', { rate: formatNumber(v.vatRate, 2, lang) })}</Text><Text>{formatZar(v.vat, lang)}</Text></View> : null}
          <View style={[s.tRow, s.grand]}><Text>{t('totalDue')}</Text><Text>{formatZar(v.total, lang)}</Text></View>
          {v.paid > 0 ? <View style={s.tRow}><Text>{t('paidSoFar')}</Text><Text>{formatZar(v.paid, lang)}</Text></View> : null}
          {v.paid > 0 ? <View style={[s.tRow, s.grand]}><Text>{t('balanceDue')}</Text><Text>{formatZar(v.balance, lang)}</Text></View> : null}
        </View>
        {v.vatRegistered && v.lines.some((l) => !l.vat) ? <Text style={{ fontSize: 8, color: '#555', marginTop: 6 }}>* {t('vatOnLine')}: 0%</Text> : null}

        {v.notes ? <Text style={{ marginTop: 16 }}>{v.notes}</Text> : null}
        {bank.length ? (
          <View style={s.bank}>
            <Text style={s.label}>{t('bankingDetails')}</Text>
            {bank.map((b) => <Text key={b}>{b}</Text>)}
            <Text style={{ fontSize: 8, color: '#555', marginTop: 4 }}>{t('pleaseUseRef')}</Text>
          </View>
        ) : null}
        {v.footer ? <Text style={s.foot} fixed>{v.footer}</Text> : null}
      </Page>
    </Document>
  )
}

export async function invoicePdfBlob(v: InvoiceView, t: (k: DictKey, vars?: Record<string, string | number>) => string, lang: Lang): Promise<Blob> {
  return pdf(<InvoicePdf v={v} t={t} lang={lang} />).toBlob()
}
