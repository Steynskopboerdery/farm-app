// Sends phone notifications (Web Push) for the farm app.
//   mode "message"        : a new private or broadcast message            (called by the database)
//   mode "leave_request"  : a worker asked for leave -> the owners         (called by the database)
//   mode "leave_answer"   : leave approved / declined -> the worker        (called by the database)
//   mode "task"           : a task was given to someone                    (called by the database)
//   mode "daily"          : the morning summary at 07:30                   (called by pg_cron)
//   mode "test"           : a test notification to the logged-in person's own phones
// Database calls carry the shared secret from Vault; "test" needs the person's login.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

type Lang = 'en' | 'af'
interface Note { title: string; body: string; url: string; tag: string }
interface Member { farm_id: string; user_id: string; role: string; permissions: Record<string, boolean> | null; display_name: string | null; email: string | null }

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

const W = {
  en: {
    tasksDue: (n: number, list: string) => `${n} task${n === 1 ? '' : 's'} due: ${list}`,
    whpToday: (f: string, p: string) => `Withholding ends today: ${f} (${p})`,
    births: (word: string, g: string, d: number) => (d === 0 ? `${word} starts today: ${g}` : `${word} starts in ${d} days: ${g}`),
    lambing: 'Lambing', calving: 'Calving',
    shearing: (g: string, d: number) => (d === 0 ? `Shearing today: ${g}` : `Shearing in ${d} days: ${g}`),
    leaveWaiting: (n: number) => `${n} leave request${n === 1 ? '' : 's'} waiting for you`,
    lowStock: (list: string) => `Low in the store: ${list}`,
    service: (list: string) => `Service due: ${list}`,
    missing: (list: string) => `Animals missing at the last count: ${list}`,
    pins: (n: number) => `${n} open map pin${n === 1 ? '' : 's'}`,
    leaveAsked: (who: string, from: string, to: string) => `${who} asked for leave: ${from}${to !== from ? ` – ${to}` : ''}`,
    leaveTitle: '🏖️ Leave request',
    approved: 'Your leave was approved', declined: 'Your leave was declined',
    taskTitle: '⏰ New task for you',
    testTitle: 'FarmPlans', testBody: 'Notifications work on this phone. ✓',
    morning: 'Good morning',
  },
  af: {
    tasksDue: (n: number, list: string) => `${n} ${n === 1 ? 'taak' : 'take'} moet gedoen word: ${list}`,
    whpToday: (f: string, p: string) => `Onttrekkingstyd eindig vandag: ${f} (${p})`,
    births: (word: string, g: string, d: number) => (d === 0 ? `${word} begin vandag: ${g}` : `${word} begin oor ${d} dae: ${g}`),
    lambing: 'Lam', calving: 'Kalf',
    shearing: (g: string, d: number) => (d === 0 ? `Skeer vandag: ${g}` : `Skeer oor ${d} dae: ${g}`),
    leaveWaiting: (n: number) => `${n} verlofversoek${n === 1 ? '' : 'e'} wag vir jou`,
    lowStock: (list: string) => `Min in die stoor: ${list}`,
    service: (list: string) => `Diens nodig: ${list}`,
    missing: (list: string) => `Diere weg by die laaste telling: ${list}`,
    pins: (n: number) => `${n} oop kaartspeld${n === 1 ? '' : 'e'}`,
    leaveAsked: (who: string, from: string, to: string) => `${who} vra verlof: ${from}${to !== from ? ` – ${to}` : ''}`,
    leaveTitle: '🏖️ Verlofversoek',
    approved: 'Jou verlof is goedgekeur', declined: 'Jou verlof is afgekeur',
    taskTitle: '⏰ Nuwe taak vir jou',
    testTitle: 'FarmPlans', testBody: 'Kennisgewings werk op hierdie foon. ✓',
    morning: 'Goeie môre',
  },
}

const DAY = 86_400_000
/** Today in South Africa (UTC+2). */
const saToday = () => new Date(Date.now() + 2 * 3_600_000).toISOString().slice(0, 10)
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10)
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY)
const short = (s: string, n = 140) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
const list = (xs: string[], n = 3) => xs.slice(0, n).join(', ') + (xs.length > n ? ` +${xs.length - n}` : '')

let configured = false
let notifySecret = ''
async function configure() {
  if (configured) return
  const { data, error } = await admin.rpc('push_config')
  if (error || !data?.[0]?.private_key) throw new Error('Push is not configured')
  webpush.setVapidDetails('https://github.com/Steynskopboerdery/farm-app', data[0].public_key, data[0].private_key)
  notifySecret = data[0].notify_secret
  configured = true
}

/** Sends one note per user (in each phone's own language); removes phones that are no longer subscribed. */
async function send(userIds: string[], make: (lang: Lang) => Note | null) {
  const ids = [...new Set(userIds)].filter(Boolean)
  if (!ids.length) return 0
  const { data: subs } = await admin.from('push_subscriptions').select('*').in('user_id', ids)
  let sent = 0
  await Promise.all((subs ?? []).map(async (s) => {
    const note = make((s.lang === 'af' ? 'af' : 'en'))
    if (!note) return
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(note), { TTL: 60 * 60 * 24, urgency: 'normal' })
      sent++
      await admin.from('push_subscriptions').update({ last_used_at: new Date().toISOString() }).eq('id', s.id)
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode
      if (code === 404 || code === 410) await admin.from('push_subscriptions').delete().eq('id', s.id)
      else console.error('push failed', code, String(e))
    }
  }))
  return sent
}

async function members(farmId: string): Promise<Member[]> {
  const { data } = await admin.from('farm_members').select('farm_id, user_id, role, permissions, display_name, email').eq('farm_id', farmId).is('deleted_at', null)
  return (data ?? []) as Member[]
}
const can = (m: Member, perm: string) => m.role === 'owner' || !!m.permissions?.[perm]

async function personName(farmId: string, userId: string) {
  const { data: s } = await admin.from('staff').select('full_name').eq('farm_id', farmId).eq('user_id', userId).is('deleted_at', null).maybeSingle()
  if (s?.full_name) return s.full_name
  const { data: m } = await admin.from('farm_members').select('display_name, email').eq('farm_id', farmId).eq('user_id', userId).maybeSingle()
  return m?.display_name || m?.email?.split('@')[0] || 'FarmPlans'
}

async function onMessage(id: string) {
  const { data: m } = await admin.from('messages').select('*').eq('id', id).maybeSingle()
  if (!m || m.deleted_at) return 0
  const from = await personName(m.farm_id, m.sender_id)
  const to = m.recipient_id ? [m.recipient_id] : (await members(m.farm_id)).map((x) => x.user_id).filter((u) => u !== m.sender_id)
  return send(to, () => ({
    title: m.recipient_id ? `💬 ${from}` : `📢 ${from}`, body: short(m.body),
    url: m.recipient_id ? `/chat/${m.sender_id}` : '/chat/all', tag: `chat-${m.recipient_id ? m.sender_id : 'all'}`,
  }))
}

async function onLeave(id: string, answer: boolean) {
  const { data: l } = await admin.from('leave_requests').select('*, staff:staff!inner(full_name, user_id)').eq('id', id).maybeSingle()
  if (!l) return 0
  const staff = l.staff as { full_name: string; user_id: string | null }
  if (answer) {
    if (!staff.user_id) return 0
    return send([staff.user_id], (lang) => ({ title: l.status === 'approved' ? `✓ ${W[lang].approved}` : W[lang].declined, body: `${l.start_date}${l.end_date !== l.start_date ? ` – ${l.end_date}` : ''}${l.owner_note ? ` · ${l.owner_note}` : ''}`, url: '/team', tag: `leave-${l.id}` }))
  }
  const owners = (await members(l.farm_id)).filter((m) => m.role === 'owner' && m.user_id !== staff.user_id).map((m) => m.user_id)
  return send(owners, (lang) => ({ title: W[lang].leaveTitle, body: W[lang].leaveAsked(staff.full_name, l.start_date, l.end_date) + (l.reason ? ` · ${l.reason}` : ''), url: '/team?tab=leave', tag: `leave-${l.id}` }))
}

async function onTask(id: string) {
  const { data: t } = await admin.from('tasks').select('*').eq('id', id).maybeSingle()
  if (!t || !t.assigned_to || t.status !== 'open') return 0
  return send([t.assigned_to], (lang) => ({ title: W[lang].taskTitle, body: short(`${t.title}${t.due_date ? ` · ${t.due_date}` : ''}`), url: '/', tag: `task-${t.id}` }))
}

/** The morning summary: one notification per person per farm, listing what matters to them today. */
async function daily() {
  const today = saToday()
  const monday = new Date(`${today}T12:00:00Z`).getUTCDay() === 1
  const { data: farms } = await admin.from('farms').select('id, name').is('deleted_at', null)
  let sent = 0
  for (const farm of farms ?? []) {
    const team = await members(farm.id)
    if (!team.length) continue
    type Line = { users: string[]; text: (lang: Lang) => string }
    const lines: Line[] = []
    const owners = team.filter((m) => m.role === 'owner').map((m) => m.user_id)
    const fieldPeople = team.filter((m) => can(m, 'field_records')).map((m) => m.user_id)
    const animalPeople = team.filter((m) => can(m, 'animal_records')).map((m) => m.user_id)

    // Tasks due today or overdue: to the person it is for, or everyone when it is for anyone.
    const { data: tasks } = await admin.from('tasks').select('title, due_date, assigned_to').eq('farm_id', farm.id).eq('status', 'open').is('deleted_at', null).lte('due_date', today)
    const perUser = new Map<string, string[]>()
    for (const t of tasks ?? []) for (const u of t.assigned_to ? [t.assigned_to] : team.map((m) => m.user_id)) perUser.set(u, [...(perUser.get(u) ?? []), t.title])
    for (const [u, titles] of perUser) lines.push({ users: [u], text: (lang) => W[lang].tasksDue(titles.length, list(titles)) })

    // Withholding periods ending today.
    const { data: sprays } = await admin.from('field_operations').select('date, product, withholding_period_days, field:fields!inner(name)').eq('farm_id', farm.id).eq('type', 'spray').is('deleted_at', null).not('withholding_period_days', 'is', null).gte('date', addDays(today, -400))
    for (const s of sprays ?? []) {
      if (addDays(s.date, Number(s.withholding_period_days)) === today) {
        lines.push({ users: fieldPeople, text: (lang) => W[lang].whpToday((s.field as unknown as { name: string }).name, s.product ?? '–') })
      }
    }

    // Lambing / calving and shearing: a week before, and on the day.
    const { data: births } = await admin.from('breeding_plans').select('expected_birth_start, group:livestock_groups!inner(name, species, deleted_at)').eq('farm_id', farm.id).is('deleted_at', null).in('expected_birth_start', [today, addDays(today, 7)])
    for (const b of births ?? []) {
      const g = b.group as unknown as { name: string; species: string; deleted_at: string | null }
      if (g.deleted_at) continue
      const d = daysBetween(today, b.expected_birth_start!)
      lines.push({ users: animalPeople, text: (lang) => W[lang].births(g.species === 'cattle' ? W[lang].calving : W[lang].lambing, g.name, d) })
    }
    const { data: shear } = await admin.from('shearing_plans').select('planned_date, group:livestock_groups!inner(name)').eq('farm_id', farm.id).is('deleted_at', null).is('done_date', null).in('planned_date', [today, addDays(today, 7)])
    for (const s of shear ?? []) {
      const d = daysBetween(today, s.planned_date)
      lines.push({ users: animalPeople, text: (lang) => W[lang].shearing((s.group as unknown as { name: string }).name, d) })
    }

    // Leave waiting for the owner.
    const { count: pending } = await admin.from('leave_requests').select('id', { count: 'exact', head: true }).eq('farm_id', farm.id).eq('status', 'pending').is('deleted_at', null)
    if (pending) lines.push({ users: owners, text: (lang) => W[lang].leaveWaiting(pending) })

    // Monday: the weekly check for owners.
    if (monday) {
      const [{ data: items }, { data: moves }] = await Promise.all([
        admin.from('inventory_items').select('id, name, reorder_level').eq('farm_id', farm.id).is('deleted_at', null).not('reorder_level', 'is', null),
        admin.from('inventory_movements').select('item_id, quantity').eq('farm_id', farm.id).is('deleted_at', null),
      ])
      const stock = new Map<string, number>()
      for (const m of moves ?? []) stock.set(m.item_id, (stock.get(m.item_id) ?? 0) + Number(m.quantity))
      const low = (items ?? []).filter((i) => (stock.get(i.id) ?? 0) < Number(i.reorder_level)).map((i) => i.name)
      if (low.length) lines.push({ users: owners, text: (lang) => W[lang].lowStock(list(low)) })

      const [{ data: vehicles }, { data: logs }] = await Promise.all([
        admin.from('vehicles').select('id, name, service_interval').eq('farm_id', farm.id).is('deleted_at', null).not('service_interval', 'is', null),
        admin.from('vehicle_logs').select('vehicle_id, kind, reading').eq('farm_id', farm.id).is('deleted_at', null).not('reading', 'is', null),
      ])
      const due = (vehicles ?? []).filter((v) => {
        const own = (logs ?? []).filter((l) => l.vehicle_id === v.id).map((l) => ({ kind: l.kind, reading: Number(l.reading) }))
        if (!own.length) return false
        const now = Math.max(...own.map((l) => l.reading))
        const services = own.filter((l) => l.kind === 'service').map((l) => l.reading)
        const last = services.length ? Math.max(...services) : Math.min(...own.map((l) => l.reading))
        return now >= last + Number(v.service_interval) * 0.9
      }).map((v) => v.name)
      if (due.length) lines.push({ users: owners, text: (lang) => W[lang].service(list(due)) })

      const { data: counts } = await admin.from('head_counts').select('group_id, date, counted, expected, group:livestock_groups!inner(name, deleted_at)').eq('farm_id', farm.id).is('deleted_at', null).order('date', { ascending: false }).limit(500)
      const seen = new Set<string>()
      const missing: string[] = []
      for (const c of counts ?? []) {
        if (seen.has(c.group_id)) continue
        seen.add(c.group_id)
        const g = c.group as unknown as { name: string; deleted_at: string | null }
        if (!g.deleted_at && c.counted < c.expected) missing.push(`${g.name} (−${c.expected - c.counted})`)
      }
      if (missing.length) lines.push({ users: owners, text: (lang) => W[lang].missing(list(missing)) })

      const { count: pins } = await admin.from('map_pins').select('id', { count: 'exact', head: true }).eq('farm_id', farm.id).is('deleted_at', null).is('resolved_at', null)
      if (pins) lines.push({ users: owners, text: (lang) => W[lang].pins(pins) })
    }

    for (const m of team) {
      const mine = lines.filter((l) => l.users.includes(m.user_id))
      if (!mine.length) continue
      sent += await send([m.user_id], (lang) => ({
        title: `${W[lang].morning} · ${farm.name}`, body: mine.map((l) => `• ${l.text(lang)}`).join('\n'), url: '/', tag: `daily-${farm.id}`,
      }))
    }
  }
  return sent
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    await configure()
    const body = await req.json().catch(() => ({}))
    if (body.mode === 'test') {
      const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
      const { data, error } = await admin.auth.getUser(token)
      if (error || !data.user) return json({ error: 'Not logged in' }, 401)
      const sent = await send([data.user.id], (lang) => ({ title: W[lang].testTitle, body: W[lang].testBody, url: '/settings', tag: 'test' }))
      return json({ sent })
    }
    if (req.headers.get('x-farm-secret') !== notifySecret) return json({ error: 'Not allowed' }, 403)
    let sent = 0
    if (body.mode === 'message') sent = await onMessage(body.id)
    else if (body.mode === 'leave_request') sent = await onLeave(body.id, false)
    else if (body.mode === 'leave_answer') sent = await onLeave(body.id, true)
    else if (body.mode === 'task') sent = await onTask(body.id)
    else if (body.mode === 'daily') sent = await daily()
    else return json({ error: 'Unknown mode' }, 400)
    return json({ sent })
  } catch (e) {
    console.error(e)
    return json({ error: String(e) }, 500)
  }
})
