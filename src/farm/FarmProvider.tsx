import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { supabase, type Tables } from '../lib/supabase'

export type Role = 'owner' | 'worker'

interface FarmState {
  farm: Tables<'farms'> | null
  role: Role | null
  isOwner: boolean
  /** The real role, even while an owner is previewing worker mode. */
  realRole: Role | null
  previewingWorker: boolean
  setPreviewWorker: (on: boolean) => void
  loading: boolean
  error: unknown
  refresh: () => void
}

const Ctx = createContext<FarmState | null>(null)
const PREVIEW_KEY = 'farm.previewWorker'

export function FarmProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const userId = session?.user.id
  const qc = useQueryClient()

  // Join any farm this email was invited to, once per login.
  const invites = useQuery({
    queryKey: ['accept-invites', userId],
    enabled: !!userId,
    staleTime: Infinity,
    queryFn: async () => {
      const { data } = await supabase.rpc('accept_invites')
      return data ?? 0
    },
  })

  const membership = useQuery({
    queryKey: ['membership', userId],
    enabled: !!userId && invites.isFetched,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('farm_members')
        .select('role, farm:farms(*)')
        .eq('user_id', userId!)
        .is('deleted_at', null)
        .order('created_at')
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })

  useEffect(() => {
    if (!userId) qc.clear()
  }, [userId, qc])

  // Owners can preview what workers see. This only changes the screens: the database
  // still treats them as owner, so nothing is locked out by mistake.
  const [previewWorker, setPreviewWorkerState] = useState(() => {
    try { return localStorage.getItem(PREVIEW_KEY) === '1' } catch { return false }
  })
  const setPreviewWorker = (on: boolean) => {
    setPreviewWorkerState(on)
    try { localStorage.setItem(PREVIEW_KEY, on ? '1' : '0') } catch { /* private mode */ }
  }

  const realRole = (membership.data?.role as Role | undefined) ?? null
  const previewingWorker = realRole === 'owner' && previewWorker
  const role: Role | null = previewingWorker ? 'worker' : realRole
  const value: FarmState = {
    farm: membership.data?.farm ?? null,
    role,
    isOwner: role === 'owner',
    realRole,
    previewingWorker,
    setPreviewWorker,
    loading: !!userId && (invites.isLoading || membership.isLoading),
    error: membership.error,
    refresh: () => qc.invalidateQueries({ queryKey: ['membership'] }),
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFarm() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useFarm outside FarmProvider')
  return v
}

/** The current farm id; only use inside pages shown after a farm exists. */
// eslint-disable-next-line react-refresh/only-export-components
export function useFarmId(): string {
  const { farm } = useFarm()
  if (!farm) throw new Error('No farm')
  return farm.id
}
