import { useQuery } from '@tanstack/react-query'
import { useFarmId } from '../farm/FarmProvider'
import { supabase, type Tables } from './supabase'

// Yearly budgets (owners only), price alerts and saved predictions.

export type BudgetLine = Tables<'budget_lines'>
export type PriceAlert = Tables<'price_alerts'>

async function rows<T>(p: PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const { data, error } = await p
  if (error) throw new Error(error.message)
  return data ?? []
}

/** Every budget line and opening balance on the farm (all years: they are small). */
export function useBudgets(enabled = true) {
  const farmId = useFarmId()
  return useQuery({
    queryKey: ['budget', farmId],
    enabled,
    queryFn: async () => {
      const [lines, years] = await Promise.all([
        rows(supabase.from('budget_lines').select('*').eq('farm_id', farmId).is('deleted_at', null).order('kind', { ascending: false }).order('sort').order('created_at')),
        rows(supabase.from('budget_years').select('*').eq('farm_id', farmId).is('deleted_at', null)),
      ])
      return { lines, years }
    },
  })
}

/** Money that came in (payments received), for comparing with the budget. */
export function usePaymentsReceived(enabled = true) {
  const farmId = useFarmId()
  return useQuery({
    queryKey: ['invoices', farmId, 'payments'],
    enabled,
    queryFn: () => rows(supabase.from('payments').select('date, amount').eq('farm_id', farmId).is('deleted_at', null)),
  })
}

export function usePriceAlerts(enabled = true) {
  const farmId = useFarmId()
  return useQuery({
    queryKey: ['price_alerts', farmId],
    enabled,
    queryFn: () => rows(supabase.from('price_alerts').select('*').eq('farm_id', farmId).is('deleted_at', null).order('created_at')),
  })
}

export function usePredictionSnapshots(enabled = true) {
  const farmId = useFarmId()
  return useQuery({
    queryKey: ['prediction_snapshots', farmId],
    enabled,
    queryFn: () => rows(supabase.from('prediction_snapshots').select('*').eq('farm_id', farmId).order('made_month')),
  })
}
