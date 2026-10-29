import { Section } from '../../components/ui'
import { fieldProfit } from '../../lib/calc/reports'
import { useSaleLines } from '../../lib/farmRecords'
import { formatNumber, formatZar } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { useAllCropRecords, useCosts, usePlanningEstimates } from '../../lib/inventory'
import { useFields } from '../../lib/queries'

/** Rand profit for one field in one season (owners only): real sales when linked, otherwise an estimate. */
export function FieldProfitCard({ fieldId, seasonId }: { fieldId: string; seasonId: string }) {
  const { t, lang } = useI18n()
  const fields = useFields()
  const records = useAllCropRecords()
  const costs = useCosts()
  const estimates = usePlanningEstimates()
  const sales = useSaleLines()
  const field = fields.data?.find((f) => f.id === fieldId)
  if (!field || !records.data) return null
  const est = estimates.data ?? []
  const [p] = fieldProfit({
    fields: [field], seasonId, plantings: records.data.plantings, ops: records.data.operations, harvests: records.data.harvests,
    costs: costs.data ?? [], sales: sales.data ?? [],
    pricePerT: (crop) => est.find((e) => e.kind === 'crop' && e.name === crop)?.price_per_t ?? null,
  })
  if (!p.crop && !p.cost && !p.income) return null
  const R = (n: number | null) => formatZar(n, lang)
  return (
    <Section title={`💰 ${t('profitTitle')}`}>
      <dl className="facts">
        <dt>{t('income')}</dt><dd>{R(p.income)}</dd>
        <dt>{t('costWord')}</dt><dd>{R(p.cost)}</dd>
        <dt><strong>{t('margin')}</strong></dt><dd className={p.margin != null && p.margin < 0 ? 'warn-text' : ''}><strong>{R(p.margin)}</strong></dd>
        <dt>{t('marginPerHa')}</dt><dd><strong>{p.marginPerHa != null ? `${R(p.marginPerHa)}` : '–'}</strong></dd>
        {p.tons > 0 && p.income != null && <><dt>{t('incomePerT')}</dt><dd>{R(Math.round((p.income / p.tons) * 100) / 100)}</dd></>}
      </dl>
      <p className="tiny muted">
        {p.incomeSource === 'sales' ? t('profitFromSales') : p.incomeSource === 'estimate' ? t('profitFromEstimate') : t('profitNoPrice')}
        {p.costPerHa != null && ` · ${t('costPerHa')}: ${formatNumber(p.costPerHa, 0, lang)} R/ha`}
      </p>
    </Section>
  )
}
