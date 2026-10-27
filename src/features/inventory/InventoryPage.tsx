import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ErrorText, Loading, numOrNull, textOrNull } from '../../components/ui'
import { useFarm, useFarmId } from '../../farm/FarmProvider'
import { todayIso } from '../../lib/calc/dates'
import { stockOnHand } from '../../lib/calc/reports'
import { formatDateShort, formatNumber, formatZar } from '../../lib/format'
import { useI18n, type DictKey } from '../../lib/i18n'
import { COST_CATEGORIES, STORE_CATEGORIES, useCosts, useInventory } from '../../lib/inventory'
import { useFields, useGroups, useSeasons } from '../../lib/queries'
import { defaultSeasonId } from '../../lib/fieldRecords'
import { supabase } from '../../lib/supabase'
import { shrink } from '../dashboard/HeroPhoto'

const CAT_EMOJI: Record<string, string> = { seed: '🌾', fertiliser: '🌱', chemical: '🧪', feed: '🌽', other: '📦' }

export function InventoryPage() {
  const { t } = useI18n()
  const { isOwner } = useFarm()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'costs' && isOwner ? 'costs' : 'store'
  return (
    <div className="page stack">
      <Link to="/menu" className="back">‹ {t('menu')}</Link>
      <h1>{t('inventoryTitle')}</h1>
      {isOwner && (
        <div className="segmented">
          <button className={tab === 'store' ? 'on' : ''} onClick={() => setParams({})}>📦 {t('storeTab')}</button>
          <button className={tab === 'costs' ? 'on' : ''} onClick={() => setParams({ tab: 'costs' })}>💵 {t('costsTab')}</button>
        </div>
      )}
      {tab === 'store' ? <Store /> : <Costs />}
    </div>
  )
}

function Store() {
  const { t, lang } = useI18n()
  const { isOwner } = useFarm()
  const farmId = useFarmId()
  const qc = useQueryClient()
  const inv = useInventory()
  const [adding, setAdding] = useState(false)
  const [f, setF] = useState({ name: '', category: 'fertiliser', unit: 'kg', reorder: '' })

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('inventory_items').insert({ farm_id: farmId, name: f.name.trim(), category: f.category, unit: f.unit.trim() || 'kg', reorder_level: numOrNull(f.reorder) })
      if (error) throw error
    },
    onSuccess: () => { setAdding(false); setF({ name: '', category: 'fertiliser', unit: 'kg', reorder: '' }); qc.invalidateQueries({ queryKey: ['inventory'] }) },
  })

  if (inv.isLoading) return <Loading />
  const stock = stockOnHand(inv.data?.movements ?? [])
  const items = inv.data?.items ?? []
  const low = items.filter((i) => i.reorder_level != null && (stock.get(i.id) ?? 0) < Number(i.reorder_level))

  return (
    <>
      {low.length > 0 && (
        <div className="warning">
          <strong>⚠ {t('lowStock')}</strong>
          {low.map((i) => <p key={i.id}>{i.name}: {formatNumber(stock.get(i.id) ?? 0, 1, lang)} {i.unit}</p>)}
        </div>
      )}
      {STORE_CATEGORIES.map((cat) => {
        const list = items.filter((i) => i.category === cat)
        if (!list.length) return null
        return (
          <section key={cat} className="card">
            <h2>{CAT_EMOJI[cat]} {t(`cat_${cat}` as DictKey)}</h2>
            <ul className="list">
              {list.map((i) => {
                const q = stock.get(i.id) ?? 0
                const isLow = i.reorder_level != null && q < Number(i.reorder_level)
                return (
                  <li key={i.id}>
                    <Link className="row link-row" to={`/inventory/item/${i.id}`}>
                      <div className="grow"><strong>{i.name}</strong>{isLow && <span className="badge st-dead"> {t('lowStock')}</span>}</div>
                      <div className="right"><strong>{formatNumber(q, 1, lang)}</strong> <span className="small muted">{i.unit}</span></div>
                      <span className="chev">›</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
      {items.length === 0 && <p className="muted">{t('noItems')}</p>}
      {isOwner && !adding && <button className="btn" onClick={() => setAdding(true)}>+ {t('addItem')}</button>}
      {adding && (
        <form className="card stack" onSubmit={(e) => { e.preventDefault(); add.mutate() }}>
          <h2>{t('addItem')}</h2>
          <label>{t('itemName')}<input required autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <div className="grid2">
            <label>{t('category')}
              <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value, unit: e.target.value === 'chemical' ? 'L' : f.unit })}>
                {STORE_CATEGORIES.map((c) => <option key={c} value={c}>{t(`cat_${c}` as DictKey)}</option>)}
              </select>
            </label>
            <label>{t('unitWord')}
              <select value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })}>
                {['kg', 't', 'L', 'mL', 'g', 'bale', 'bag', 'each'].map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </label>
          </div>
          <label>{t('reorderLevel')} ({f.unit})<input inputMode="decimal" value={f.reorder} onChange={(e) => setF({ ...f, reorder: e.target.value })} /></label>
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => setAdding(false)}>{t('cancel')}</button>
            <button className="btn primary" disabled={add.isPending}>{t('save')}</button>
          </div>
          <ErrorText error={add.error} />
        </form>
      )}
      <ErrorText error={inv.error} />
    </>
  )
}

function Costs() {
  const { t, lang } = useI18n()
  const farmId = useFarmId()
  const qc = useQueryClient()
  const costs = useCosts()
  const fields = useFields()
  const groups = useGroups()
  const seasons = useSeasons()
  const [f, setF] = useState({ category: 'fuel', date: todayIso(), amount: '', description: '', supplier: '', field: '', group: '', season: '' })
  const [receipt, setReceipt] = useState<File | null>(null)
  const season = f.season || defaultSeasonId(seasons.data) || ''
  const fieldName = new Map((fields.data ?? []).map((x) => [x.id, x.name]))
  const groupName = new Map((groups.data ?? []).map((x) => [x.id, x.name]))
  const list = costs.data ?? []
  const total = list.filter((c) => c.season_id === season).reduce((s, c) => s + Number(c.amount), 0)

  async function openReceipt(path: string) {
    const { data, error } = await supabase.storage.from('receipts').createSignedUrl(path, 600)
    if (!error) window.open(data.signedUrl, '_blank', 'noopener')
  }

  const add = useMutation({
    mutationFn: async () => {
      const amount = numOrNull(f.amount)
      if (!amount) throw new Error(t('amount'))
      const { data, error } = await supabase.from('costs').insert({
        farm_id: farmId, category: f.category, date: f.date, amount, description: textOrNull(f.description),
        supplier: textOrNull(f.supplier), field_id: f.field || null, group_id: f.group || null, season_id: season || null,
      }).select('id').single()
      if (error) throw error
      if (receipt) {
        // Photos are shrunk; PDFs are kept as they are.
        const isPdf = receipt.type === 'application/pdf'
        const body = isPdf ? receipt : await shrink(receipt)
        const path = `${farmId}/${data.id}.${isPdf ? 'pdf' : 'jpg'}`
        const up = await supabase.storage.from('receipts').upload(path, body, { contentType: isPdf ? 'application/pdf' : 'image/jpeg', upsert: true })
        if (up.error) throw up.error
        const { error: e2 } = await supabase.from('costs').update({ receipt_path: path }).eq('id', data.id)
        if (e2) throw e2
      }
    },
    onSuccess: () => { setF({ ...f, amount: '', description: '', supplier: '' }); setReceipt(null); qc.invalidateQueries({ queryKey: ['costs'] }) },
  })
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('costs').update({ deleted_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['costs'] }),
  })


  return (
    <>
      <form className="card stack" onSubmit={(e) => { e.preventDefault(); add.mutate() }}>
        <h2>{t('addCost')}</h2>
        <div className="chips">
          {COST_CATEGORIES.map((c) => (
            <button key={c} type="button" className={`chip ${f.category === c ? 'on' : ''}`} onClick={() => setF({ ...f, category: c })}>{t(`costCat_${c}` as DictKey)}</button>
          ))}
        </div>
        <div className="grid2">
          <label>{t('date')}<input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
          <label>{t('amount')}<input inputMode="decimal" required value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></label>
        </div>
        <label>{t('description')}<input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
        <label>{t('supplier')}<input list="suppliers" value={f.supplier} onChange={(e) => setF({ ...f, supplier: e.target.value })} /></label>
        <datalist id="suppliers">{[...new Set(list.map((c) => c.supplier).filter(Boolean))].map((x) => <option key={x!} value={x!} />)}</datalist>
        <label className="receipt-pick">
          <span>🧾 {receipt ? receipt.name : t('addReceipt')}</span>
          <input type="file" accept="image/*,application/pdf" onChange={(e) => setReceipt(e.target.files?.[0] ?? null)} />
          <span className="hint">{t('receiptHelp')}</span>
        </label>
        <div className="grid2">
          <label>{t('linkField')}
            <select value={f.field} onChange={(e) => setF({ ...f, field: e.target.value })}>
              <option value="">–</option>{(fields.data ?? []).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </label>
          <label>{t('linkGroup')}
            <select value={f.group} onChange={(e) => setF({ ...f, group: e.target.value })}>
              <option value="">–</option>{(groups.data ?? []).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </label>
        </div>
        <label>{t('season')}
          <select value={season} onChange={(e) => setF({ ...f, season: e.target.value })}>
            {(seasons.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.label || s.year}</option>)}
          </select>
        </label>
        <button className="btn primary" disabled={add.isPending}>{add.isPending ? t('saving') : t('save')}</button>
        <ErrorText error={add.error} />
      </form>

      <section className="card">
        <div className="card-head"><h2>{t('costsTab')}</h2><strong>{formatZar(total, lang)}</strong></div>
        {list.length === 0 ? <p className="muted">{t('noCosts')}</p> : (
          <ul className="list">
            {list.slice(0, 60).map((c) => (
              <li key={c.id} className="row">
                <div className="grow">
                  <div><strong>{t(`costCat_${c.category}` as DictKey)}</strong>{c.supplier ? ` · ${c.supplier}` : ''}{c.description ? ` · ${c.description}` : ''}</div>
                  <div className="small muted">{formatDateShort(c.date, lang)}{c.field_id ? ` · ${fieldName.get(c.field_id) ?? ''}` : ''}{c.group_id ? ` · ${groupName.get(c.group_id) ?? ''}` : ''}</div>
                </div>
                {c.receipt_path && <button className="btn small ghost" aria-label={t('viewReceipt')} onClick={() => openReceipt(c.receipt_path!)}>🧾</button>}
                <strong>{formatZar(c.amount, lang)}</strong>
                <button className="btn small ghost" aria-label={t('delete')} onClick={() => confirm(`${t('delete')}?`) && remove.mutate(c.id)}>✕</button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <ErrorText error={costs.error ?? remove.error} />
    </>
  )
}
