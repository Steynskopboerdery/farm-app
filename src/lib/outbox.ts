// Saves made without signal are kept on the phone (even if the app is closed) and sent when signal returns.
// Used for the quick records people make out in the veld: rain, fuel, head counts, diary, ticking off tasks,
// map pins and leave requests. Each new row gets its id on the phone, so sending twice never makes a duplicate.
import { useSyncExternalStore } from 'react'
import { supabase } from './supabase'

export interface OutboxItem {
  key: string
  table: string
  op: 'insert' | 'update'
  values: Record<string, unknown>
  id?: string              // for updates: the row to change
  at: string
  error?: string           // the database refused it (shown so it can be fixed or thrown away)
}

const KEY = 'farm.outbox'
const listeners = new Set<() => void>()
let cache: OutboxItem[] | null = null

function load(): OutboxItem[] {
  if (cache) return cache
  try { cache = JSON.parse(localStorage.getItem(KEY) ?? '[]') as OutboxItem[] } catch { cache = [] }
  return cache
}
function store(items: OutboxItem[]) {
  cache = items
  try { localStorage.setItem(KEY, JSON.stringify(items)) } catch { /* storage full or blocked: kept in memory */ }
  listeners.forEach((l) => l())
}

export function useOutbox(): OutboxItem[] {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb) }, load, load)
}

/** A failed request that is about signal, not about the data. */
export function isNetworkError(e: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  const msg = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e)
  const code = typeof e === 'object' && e && 'code' in e ? String((e as { code: unknown }).code ?? '') : ''
  return !code && /failed to fetch|network|load failed|fetch failed|timed? ?out/i.test(msg)
}

async function send(item: OutboxItem) {
  const { error } = item.op === 'insert'
    ? await supabase.from(item.table as 'rain_readings').insert(item.values as never)
    : await supabase.from(item.table as 'rain_readings').update(item.values as never).eq('id', item.id!)
  // Already there (sent before the phone heard back): fine.
  if (error && error.code === '23505') return
  if (error) throw error
}

export type SaveResult = { queued: boolean }

/** Insert a row now, or keep it on the phone if there is no signal. */
export async function saveRow(table: string, values: Record<string, unknown>): Promise<SaveResult> {
  return save({ key: crypto.randomUUID(), table, op: 'insert', values: { id: crypto.randomUUID(), ...values }, at: new Date().toISOString() })
}

/** Change a row now, or keep the change on the phone if there is no signal. */
export async function updateRow(table: string, id: string, values: Record<string, unknown>): Promise<SaveResult> {
  return save({ key: crypto.randomUUID(), table, op: 'update', id, values, at: new Date().toISOString() })
}

async function save(item: OutboxItem): Promise<SaveResult> {
  // Keep the order: if older saves are waiting, this one waits behind them.
  if (!navigator.onLine || load().some((x) => !x.error)) {
    store([...load(), item])
    void flush()
    return { queued: true }
  }
  try {
    await send(item)
    return { queued: false }
  } catch (e) {
    if (!isNetworkError(e)) throw e
    store([...load(), item])
    return { queued: true }
  }
}

let flushing: Promise<number> | null = null
const sentListeners = new Set<() => void>()
/** Called after waiting saves went through, e.g. to refresh the screens. */
export function onOutboxSent(cb: () => void) { sentListeners.add(cb); return () => { sentListeners.delete(cb) } }

/** Send what is waiting, oldest first. Stops at the first signal problem and tries again later. */
export function flush(): Promise<number> {
  if (flushing) return flushing
  flushing = (async () => {
    let sent = 0
    for (const item of [...load()]) {
      if (item.error) continue
      if (!navigator.onLine) break
      try {
        await send(item)
        store(load().filter((x) => x.key !== item.key))
        sent++
      } catch (e) {
        if (isNetworkError(e)) break
        store(load().map((x) => (x.key === item.key ? { ...x, error: e instanceof Error ? e.message : String((e as { message?: string }).message ?? e) } : x)))
      }
    }
    if (sent) sentListeners.forEach((l) => l())
    return sent
  })().finally(() => { flushing = null })
  return flushing
}

export function discard(key: string) {
  store(load().filter((x) => x.key !== key))
}

export function retry(key: string) {
  store(load().map((x) => (x.key === key ? { ...x, error: undefined } : x)))
  void flush()
}

/** Try again when signal returns, when the app comes back to the front, and every half minute. */
export function startOutbox() {
  const kick = () => { if (load().length) void flush() }
  window.addEventListener('online', kick)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') kick() })
  window.setInterval(kick, 30_000)
  kick()
}
