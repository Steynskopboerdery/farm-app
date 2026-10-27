import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ErrorText, Loading, numOrNull, textOrNull } from '../../components/ui'
import { useFarm, useFarmId } from '../../farm/FarmProvider'
import { todayIso } from '../../lib/calc/dates'
import { averageUnitCost, stockOnHand } from '../../lib/calc/reports'
import { formatDateShort, formatNumber, formatZar } from '../../lib/format'
import { useI18n, type DictKey } from '../../lib/i18n'
import { STORE_CATEGORIES, useInventory } from '../../lib/inventory'
import { supabase } from '../../lib/supabase'

export function ItemPage() {
  const { id } = useParams<{ id: string }>()
  const { t, lang } = useI18n()
  const { isOwner } = useFarm()
  const farmId = useFarmId()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const inv = useInventory()
  const [move, setMove] = useState<{ dir: 1 | -1; qty: string; price: string; date: string; notes: string } | null>(null)
  const [edit, setEdit] = useState(false)
  const item = inv.data?.items.find((i) => i.id === id)
  const [f, setF] = useState({ name: '', category: '', unit: '', reorder: '' })
  const refresh = () => qc.invalidateQueries({ queryKey: ['inventory'] })

  const addMove = useMutation({
    mutationFn: async () => {
      const qty = numOrNull(move!.qty)
      if (!qty) throw new Error(t('qty'))
      const { error } = await supabase.from('inventory_movements').insert({
        farm_id: farmId, item_id: id!, date: move!.date, quantity: move!.dir * Math.abs(qty),
        unit_cost: move!.dir > 0 ? numOrNull(move!.price) : null, notes: textOrNull(move!.notes),
      })
      if (error) throw error
    },
    onSuccess: () => { setMove(null); refresh() },
  })
  const removeMove = useMutation({
    mutationFn: async (mid: string) => {
      const { error } = await supabase.from('inventory_movements').update({ deleted_at: new Date().toISOString() }).eq('id', mid)
      if (error) throw error
    },
    onSuccess: refresh,
  })
  const saveItem = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('inventory_items').update({ name: f.name.trim(), category: f.category, unit: f.unit, reorder_level: numOrNull(f.reorder) }).eq('id', id!)
      if (error) throw error
    },
    onSuccess: () => { setEdit(false); refresh() },
  })
  const removeItem = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('inventory_items').update({ deleted_at: new Date().toISOString() }).eq('id', id!)
      if (error) throw error
    },
    onSuccess: () => { refresh(); navigate('/inventory') },
  })

  if (inv.isLoading) return <Loading />
  if (!item) return <div className="page"><p>Not found.</p><Link to="/inventory">{t('back')}</Link></div>
  const moves = (inv.data?.movements ?? []).filter((m) => m.item_id === item.id)
  const q = stockOnHand(moves).get(item.id) ?? 0
  const avg = averageUnitCost(moves)

  return (
    <div className="page stack">
      <Link to="/inventory" className="back">‹ {t('inventoryTitle')}</Link>
      <h1>{item.name}</h1>
      <div className="stats">
        <div className="stat"><span className="stat-n">{formatNumber(q, 1, lang)} {item.unit}</span><span className="stat-l">{t('onHand')}</span></div>
        {isOwner && <div className="stat"><span className="stat-n">{avg != null ? formatZar(avg * Math.max(0, q), lang) : '–'}</span><span className="stat-l">{t('stockValue')}{avg != null ? ` · ${formatZar(avg, lang)}/${item.unit}` : ''}</span></div>}
      </div>
      {item.reorder_level != null && q < Number(item.reorder_level) && <p className="warning">⚠ {t('lowStock')}: {t('reorderLevel').toLowerCase()} {formatNumber(Number(item.reorder_level), 1, lang)} {item.unit}</p>}

      {isOwner && !move && (
        <div className="btn-row">
          <button className="btn primary" onClick={() => setMove({ dir: 1, qty: '', price: '', date: todayIso(), notes: '' })}>+ {t('addReceived')}</button>
          <button className="btn" onClick={() => setMove({ dir: -1, qty: '', price: '', date: todayIso(), notes: '' })}>− {t('addUsed')}</button>
        </div>
      )}
      {move && (
        <form className="card stack" onSubmit={(e) => { e.preventDefault(); addMove.mutate() }}>
          <h2>{move.dir > 0 ? t('addReceived') : t('addUsed')}</h2>
          <div className="grid2">
            <label>{t('date')}<input type="date" value={move.date} onChange={(e) => setMove({ ...move, date: e.target.value })} /></label>
            <label>{t('qty')} ({item.unit})<input inputMode="decimal" autoFocus value={move.qty} onChange={(e) => setMove({ ...move, qty: e.target.value })} /></label>
          </div>
          {move.dir > 0 && <label>{t('pricePer', { unit: item.unit })}<input inputMode="decimal" value={move.price} onChange={(e) => setMove({ ...move, price: e.target.value })} /></label>}
          <label>{t('notes')}<input value={move.notes} onChange={(e) => setMove({ ...move, notes: e.target.value })} /></label>
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => setMove(null)}>{t('cancel')}</button>
            <button className="btn primary" disabled={addMove.isPending}>{t('save')}</button>
          </div>
          <ErrorText error={addMove.error} />
        </form>
      )}

      <section className="card">
        <h2>{t('stockMoves')}</h2>
        {moves.length === 0 ? <p className="muted">{t('noEvents')}</p> : (
          <ul className="list">
            {moves.map((m) => (
              <li key={m.id} className="row">
                <span className={`ev-dot ${m.quantity > 0 ? 'ev-birth' : 'ev-death'}`} aria-hidden="true" />
                <div className="grow">
                  <div><strong>{m.quantity > 0 ? '+' : '−'}{formatNumber(Math.abs(m.quantity), 1, lang)} {item.unit}</strong>{isOwner && m.unit_cost != null ? ` · ${formatZar(m.unit_cost, lang)}/${item.unit}` : ''}</div>
                  <div className="small muted">{formatDateShort(m.date, lang)}{m.notes ? ` · ${m.notes}` : ''}</div>
                </div>
                {isOwner && !m.field_operation_id && <button className="btn small ghost" aria-label={t('delete')} onClick={() => confirm(`${t('delete')}?`) && removeMove.mutate(m.id)}>✕</button>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {isOwner && (edit ? (
        <form className="card stack" onSubmit={(e) => { e.preventDefault(); saveItem.mutate() }}>
          <label>{t('itemName')}<input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <div className="grid2">
            <label>{t('category')}
              <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
                {STORE_CATEGORIES.map((c) => <option key={c} value={c}>{t(`cat_${c}` as DictKey)}</option>)}
              </select>
            </label>
            <label>{t('unitWord')}<input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} /></label>
          </div>
          <label>{t('reorderLevel')}<input inputMode="decimal" value={f.reorder} onChange={(e) => setF({ ...f, reorder: e.target.value })} /></label>
          <button className="btn primary" disabled={saveItem.isPending}>{t('save')}</button>
          <ErrorText error={saveItem.error} />
        </form>
      ) : (
        <button className="btn" onClick={() => { setF({ name: item.name, category: item.category, unit: item.unit, reorder: item.reorder_level?.toString() ?? '' }); setEdit(true) }}>{t('edit')}</button>
      ))}
      {isOwner && <button className="btn danger" onClick={() => confirm(`${t('delete')} ${item.name}?`) && removeItem.mutate()}>{t('delete')}</button>}
      <ErrorText error={removeMove.error ?? removeItem.error} />
    </div>
  )
}
