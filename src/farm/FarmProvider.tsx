import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { supabase, type Tables } from '../lib/supabase'

export type Role = 'owner' | 'worker'
export type Permission = 'field_records' | 'animal_records' | 'tasks' | 'pasture'
export const PERMISSIONS: Permission[] = ['field_records', 'animal_records', 'tasks', 'pasture']
export interface Membership { role: Role; permissions: Partial<Record<Permission, boolean>>; farm: Tables<'farms'> }

interface FarmState {
  /** Every farm this person belongs to. */
  farms: Membership[]
  farm: Tables<'farms'> | null
  role: Role | null
  isOwner: boolean
  /** Owners can do everything; workers only what the owner switched on for them. */
  can: (perm: Permission) => boolean
  /** The real role, even while an owner is previewing worker mode. */
  realRole: Role | null
  previewingWorker: boolean
  setPreviewWorker: (on: boolean) => void
  /** True when the person has several farms and hasn't picked one since opening the app. */
  needsChoice: boolean
  selectFarm: (farmId: string) => void
  loading: boolean
  error: unknown
  refresh: () => Promise<unknown>
}

const Ctx = createContext<FarmState | null>(null)
const PREVIEW_KEY = 'farm.previewWorker'
const SELECTED_KEY = 'farm.selected'   // last farm used, remembered on this device
const CHOSEN_KEY = 'farm.chosen'       // picked since the app was opened (cleared when the app closes)

const read = (store: () => Storage, key: string) => { try { return store().getItem(key) } catch { return null } }
const write = (store: () => Storage, key: string, value: string) => { try { store().setItem(key, value) } catch { /* private mode */ } }

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

  const memberships = useQuery({
    queryKey: ['membership', userId],
    enabled: !!userId && invites.isFetched,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('farm_members')
        .select('role, permissions, farm:farms(*)')
        .eq('user_id', userId!)
        .is('deleted_at', null)
        .order('created_at')
      if (error) throw error
      return (data ?? [])
        .filter((m) => m.farm && !m.farm.deleted_at)
        .map((m) => ({ role: m.role as Role, permissions: (m.permissions ?? {}) as Membership['permissions'], farm: m.farm! }))
        .sort((a, b) => a.farm.name.localeCompare(b.farm.name))
    },
  })

  useEffect(() => {
    if (!userId) qc.clear()
  }, [userId, qc])

  const [selectedId, setSelectedId] = useState(() => read(() => localStorage, SELECTED_KEY))
  const [chosen, setChosen] = useState(() => read(() => sessionStorage, CHOSEN_KEY) === '1')
  const selectFarm = (farmId: string) => {
    setSelectedId(farmId)
    setChosen(true)
    write(() => localStorage, SELECTED_KEY, farmId)
    write(() => sessionStorage, CHOSEN_KEY, '1')
  }

  // Owners can preview what workers see. This only changes the screens: the database
  // still treats them as owner, so nothing is locked out by mistake.
  const [previewWorker, setPreviewWorkerState] = useState(() => read(() => localStorage, PREVIEW_KEY) === '1')
  const setPreviewWorker = (on: boolean) => {
    setPreviewWorkerState(on)
    write(() => localStorage, PREVIEW_KEY, on ? '1' : '0')
  }

  const farms = memberships.data ?? []
  const current = farms.find((m) => m.farm.id === selectedId) ?? (farms.length === 1 ? farms[0] : null)
  const realRole = current?.role ?? null
  const previewingWorker = realRole === 'owner' && previewWorker
  const role: Role | null = previewingWorker ? 'worker' : realRole
  const value: FarmState = {
    farms,
    farm: current?.farm ?? null,
    role,
    isOwner: role === 'owner',
    // While previewing, an owner sees a worker with no extra permissions.
    can: (perm) => role === 'owner' || (!previewingWorker && !!current?.permissions[perm]),
    realRole,
    previewingWorker,
    setPreviewWorker,
    needsChoice: farms.length > 1 && (!chosen || !current),
    selectFarm,
    loading: !!userId && (invites.isLoading || memberships.isLoading),
    error: memberships.error,
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
