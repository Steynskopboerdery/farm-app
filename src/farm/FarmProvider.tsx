import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { supabase, type Tables } from '../lib/supabase'

export type Role = 'owner' | 'worker'

interface FarmState {
  farm: Tables<'farms'> | null
  role: Role | null
  isOwner: boolean
  loading: boolean
  error: unknown
  refresh: () => void
}

const Ctx = createContext<FarmState | null>(null)

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

  const role = (membership.data?.role as Role | undefined) ?? null
  const value: FarmState = {
    farm: membership.data?.farm ?? null,
    role,
    isOwner: role === 'owner',
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
