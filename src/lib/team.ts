import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useFarmId } from '../farm/FarmProvider'
import { supabase, type Tables } from './supabase'

// Staff, schedule, leave, documents, work diary and messages.

export type Staff = Tables<'staff'>
export type Leave = Tables<'leave_requests'>
export type Shift = Tables<'shifts'>
export type StaffDoc = Tables<'staff_documents'>
export type DiaryEntry = Tables<'work_diary'>
export type Message = Tables<'messages'>

export const LEAVE_TYPES = ['annual', 'sick', 'family', 'unpaid', 'other'] as const
export const DOC_KINDS = ['cv', 'sick_note', 'leave_form', 'contract', 'id_copy', 'certificate', 'other'] as const
export const LEAVE_EMOJI: Record<string, string> = { annual: '🏖️', sick: '🤒', family: '👪', unpaid: '📅', other: '📝' }

async function rows<T>(p: PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const { data, error } = await p
  if (error) throw new Error(error.message)
  return data ?? []
}

/** Owners get everyone; a worker gets only their own record (row level security). */
export function useStaff() {
  const farmId = useFarmId()
  return useQuery({
    queryKey: ['staff', farmId],
    queryFn: () => rows(supabase.from('staff').select('*').eq('farm_id', farmId).is('deleted_at', null).order('active', { ascending: false }).order('full_name')),
  })
}

/** The logged-in person's own staff record, if the owner linked one. */
export function useMyStaff() {
  const { session } = useAuth()
  const staff = useStaff()
  return { ...staff, data: (staff.data ?? []).find((s) => s.user_id === session?.user.id) ?? null }
}

/** Names only, for the schedule (everyone on the farm). */
export function useStaffDirectory() {
  const farmId = useFarmId()
  return useQuery({
    queryKey: ['staff', farmId, 'directory'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('staff_directory', { fid: farmId })
      if (error) throw new Error(error.message)
      return data ?? []
    },
  })
}

export function useLeave(staffId?: string) {
  const farmId = useFarmId()
  return useQuery({
    queryKey: ['leave_requests', farmId, staffId ?? 'all'],
    queryFn: () => {
      let q = supabase.from('leave_requests').select('*').eq('farm_id', farmId).is('deleted_at', null)
      if (staffId) q = q.eq('staff_id', staffId)
      return rows(q.order('start_date', { ascending: false }).limit(1000))
    },
  })
}

export function useShifts(from: string, to: string) {
  const farmId = useFarmId()
  return useQuery({
    queryKey: ['shifts', farmId, from, to],
    queryFn: () => rows(supabase.from('shifts').select('*').eq('farm_id', farmId).is('deleted_at', null).gte('date', from).lte('date', to).order('date').order('start_time')),
  })
}

export function useStaffDocs(staffId: string | undefined) {
  const farmId = useFarmId()
  return useQuery({
    queryKey: ['staff_documents', farmId, staffId],
    enabled: !!staffId,
    queryFn: () => rows(supabase.from('staff_documents').select('*').eq('farm_id', farmId).eq('staff_id', staffId!).is('deleted_at', null).order('created_at', { ascending: false })),
  })
}

export function useDiary(staffId: string | undefined) {
  const farmId = useFarmId()
  return useQuery({
    queryKey: ['work_diary', farmId, staffId],
    enabled: !!staffId,
    queryFn: () => rows(supabase.from('work_diary').select('*').eq('farm_id', farmId).eq('staff_id', staffId!).is('deleted_at', null).order('date', { ascending: false }).limit(200)),
  })
}

/** What someone changed in the app (owners only), newest first. */
export function useActivity(userId: string | null | undefined, days = 30) {
  const farmId = useFarmId()
  return useQuery({
    queryKey: ['audit_log', farmId, 'by-user', userId, days],
    enabled: !!userId,
    queryFn: () => rows(supabase.from('audit_log').select('id, table_name, action, changed_at, old_data, new_data')
      .eq('farm_id', farmId).eq('changed_by', userId!).gte('changed_at', new Date(Date.now() - days * 86_400_000).toISOString())
      .order('changed_at', { ascending: false }).limit(500)),
  })
}

/** Upload a staff document (CV, sick note...) into <farm>/<staff>/ and record it. */
export async function uploadStaffDoc(farmId: string, staffId: string, file: File, kind: string, title: string | null, leaveId: string | null = null) {
  const ext = file.type === 'application/pdf' ? 'pdf' : 'jpg'
  let body: Blob = file
  if (file.type.startsWith('image/')) {
    const { shrink } = await import('../features/dashboard/HeroPhoto')
    body = await shrink(file)
  }
  const path = `${farmId}/${staffId}/${crypto.randomUUID()}.${ext}`
  const up = await supabase.storage.from('staff-docs').upload(path, body, { contentType: ext === 'pdf' ? 'application/pdf' : 'image/jpeg' })
  if (up.error) throw up.error
  const { error } = await supabase.from('staff_documents').insert({ farm_id: farmId, staff_id: staffId, kind, title: title || file.name, path, leave_id: leaveId })
  if (error) throw error
}

// Messages -----------------------------------------------------------------------

/** All messages I can see on this farm (my private chats and the broadcasts), oldest first. */
export function useMessages() {
  const farmId = useFarmId()
  return useQuery({
    queryKey: ['messages', farmId],
    queryFn: async () => (await rows(supabase.from('messages').select('*').eq('farm_id', farmId).is('deleted_at', null)
      .order('created_at', { ascending: false }).limit(1000))).reverse(),
  })
}

export function useChatReads() {
  const farmId = useFarmId()
  const { session } = useAuth()
  return useQuery({
    queryKey: ['chat_reads', farmId],
    queryFn: () => rows(supabase.from('chat_reads').select('*').eq('farm_id', farmId).eq('user_id', session!.user.id)),
    enabled: !!session,
  })
}

export async function markRead(farmId: string, peerId: string) {
  await supabase.from('chat_reads').upsert({ farm_id: farmId, peer_id: peerId, last_read_at: new Date().toISOString() }, { onConflict: 'farm_id,user_id,peer_id' })
}

/** The conversation a message belongs to, seen from me: the other person, or the farm id for broadcasts. */
export const threadOf = (m: Pick<Message, 'farm_id' | 'sender_id' | 'recipient_id'>, me: string) =>
  m.recipient_id == null ? m.farm_id : m.sender_id === me ? m.recipient_id : m.sender_id

/** Unread messages per conversation. */
export function useUnread() {
  const { session } = useAuth()
  const messages = useMessages()
  const reads = useChatReads()
  const me = session?.user.id ?? ''
  const last = new Map((reads.data ?? []).map((r) => [r.peer_id, r.last_read_at]))
  const byThread = new Map<string, number>()
  for (const m of messages.data ?? []) {
    if (m.sender_id === me) continue
    const th = threadOf(m, me)
    if (m.created_at > (last.get(th) ?? '')) byThread.set(th, (byThread.get(th) ?? 0) + 1)
  }
  return { byThread, total: [...byThread.values()].reduce((a, b) => a + b, 0) }
}

/** Live updates: new messages arrive without refreshing. Used once, in the app's frame (Layout). */
export function useMessagesLive() {
  const farmId = useFarmId()
  const qc = useQueryClient()
  useEffect(() => {
    const ch = supabase.channel(`messages:${farmId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `farm_id=eq.${farmId}` }, () => {
        qc.invalidateQueries({ queryKey: ['messages', farmId] })
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [farmId, qc])
}
