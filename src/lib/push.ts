// Phone notifications: switch on / off for this phone, and send a test.
import { PUSH_PUBLIC_KEY } from './config'
import type { Lang } from './i18n'
import { supabase } from './supabase'

export type PushState = 'unsupported' | 'needs-install' | 'blocked' | 'off' | 'on'

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
const standalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true

function keyBytes(base64url: string) {
  const s = atob(base64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (base64url.length % 4)) % 4))
  return Uint8Array.from(s, (c) => c.charCodeAt(0))
}

async function registration() {
  if (!('serviceWorker' in navigator)) return null
  return (await navigator.serviceWorker.getRegistration()) ?? null
}

export async function pushState(): Promise<PushState> {
  if (!('Notification' in window) || !('PushManager' in window) || !('serviceWorker' in navigator)) {
    // iPhones only allow notifications once the app is on the home screen.
    return isIos() && !standalone() ? 'needs-install' : 'unsupported'
  }
  if (Notification.permission === 'denied') return 'blocked'
  const reg = await registration()
  const sub = await reg?.pushManager.getSubscription()
  return sub && Notification.permission === 'granted' ? 'on' : 'off'
}

export async function enablePush(lang: Lang) {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('blocked')
  const reg = (await registration()) ?? (await navigator.serviceWorker.ready)
  const sub = (await reg.pushManager.getSubscription())
    ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(PUSH_PUBLIC_KEY) }))
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
  const { error } = await supabase.from('push_subscriptions').upsert(
    { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, lang, user_agent: navigator.userAgent.slice(0, 200) },
    { onConflict: 'endpoint' },
  )
  if (error) throw new Error(error.message)
}

export async function disablePush() {
  const reg = await registration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}

/** Keeps the phone's language up to date, so notifications come in English or Afrikaans as chosen. */
export async function updatePushLang(lang: Lang) {
  const reg = await registration()
  const sub = await reg?.pushManager.getSubscription()
  if (sub) await supabase.from('push_subscriptions').update({ lang }).eq('endpoint', sub.endpoint)
}

export async function testPush(): Promise<number> {
  const { data, error } = await supabase.functions.invoke<{ sent: number }>('notify', { body: { mode: 'test' } })
  if (error) throw new Error(error.message)
  return data?.sent ?? 0
}
