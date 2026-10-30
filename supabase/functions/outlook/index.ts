// Data for the Prediction tab. Downloads, summarises and caches (in outlook_cache):
//   climate  : NASA POWER daily rain and temperature for the farm's point, 1981 to now
//              -> per year and month: rain (mm), mean min / max temperature, frost-risk days, autumn break date
//   enso     : NOAA CPC Oceanic Niño Index history and the official ENSO probabilities for the coming seasons
//   markets  : World Bank Pink Sheet monthly world prices (US$) and the Rand / Dollar rate (Frankfurter, ECB data)
// All sources are free; the app shows their names. Callers must be logged in (or be the database, with the shared secret).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import * as XLSX from 'npm:xlsx@0.18.5'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
const UA = { 'User-Agent': 'FarmManager/1.0 github.com/Steynskopboerdery/farm-app' }
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
const r1 = (n: number) => Math.round(n * 10) / 10
const DAY = 86_400_000

/** Cached value if fresh enough, else load and store. A failed reload falls back to the old copy. */
async function cached<T>(key: string, maxAgeHours: number, load: () => Promise<T>): Promise<{ data: T; fetchedAt: string; stale?: boolean }> {
  const { data: row } = await admin.from('outlook_cache').select('data, fetched_at').eq('key', key).maybeSingle()
  if (row && Date.now() - Date.parse(row.fetched_at) < maxAgeHours * 3_600_000) return { data: row.data as T, fetchedAt: row.fetched_at }
  try {
    const data = await load()
    const fetchedAt = new Date().toISOString()
    await admin.from('outlook_cache').upsert({ key, data, fetched_at: fetchedAt })
    return { data, fetchedAt }
  } catch (e) {
    if (row) return { data: row.data as T, fetchedAt: row.fetched_at, stale: true }
    throw e
  }
}

// Climate ---------------------------------------------------------------------------------------

interface YearClimate { rain: (number | null)[]; tmin: (number | null)[]; tmax: (number | null)[]; frost: (number | null)[]; breakDate: string | null; days: number }

async function loadClimate(lat: number, lon: number) {
  const end = new Date(Date.now() - 2 * DAY).toISOString().slice(0, 10).replace(/-/g, '')
  const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=PRECTOTCORR,T2M_MIN,T2M_MAX&community=AG&longitude=${lon.toFixed(3)}&latitude=${lat.toFixed(3)}&start=19810101&end=${end}&format=JSON`
  const res = await fetch(url, { headers: UA })
  if (!res.ok) throw new Error(`NASA POWER answered ${res.status}`)
  const j = await res.json()
  const p = j.properties?.parameter as Record<string, Record<string, number>>
  if (!p?.PRECTOTCORR) throw new Error('NASA POWER: no data')
  const fill = j.header?.fill_value ?? -999
  const val = (k: string, d: string) => { const v = p[k]?.[d]; return v == null || v === fill ? null : v }

  const years: Record<string, YearClimate> = {}
  const acc: Record<string, { rain: number[]; rainN: number[]; tmin: number[]; tmax: number[]; tn: number[]; frost: number[]; daily: { md: string; mm: number }[]; days: number }> = {}
  let lastDate = ''
  for (const d of Object.keys(p.PRECTOTCORR).sort()) {
    const rain = val('PRECTOTCORR', d)
    if (rain == null) continue
    lastDate = d
    const y = d.slice(0, 4)
    const m = Number(d.slice(4, 6)) - 1
    const a = acc[y] ??= { rain: Array(12).fill(0), rainN: Array(12).fill(0), tmin: Array(12).fill(0), tmax: Array(12).fill(0), tn: Array(12).fill(0), frost: Array(12).fill(0), daily: [], days: 0 }
    a.rain[m] += rain
    a.rainN[m]++
    a.days++
    a.daily.push({ md: d.slice(4), mm: rain })
    const tmin = val('T2M_MIN', d)
    const tmax = val('T2M_MAX', d)
    if (tmin != null && tmax != null) {
      a.tmin[m] += tmin
      a.tmax[m] += tmax
      a.tn[m]++
      // Grid temperatures are an area average; frost in low spots starts around +1 °C on this scale.
      if (tmin <= 1) a.frost[m]++
    }
  }
  for (const [y, a] of Object.entries(acc)) {
    const daysIn = (m: number) => new Date(Date.UTC(Number(y), m + 1, 0)).getUTCDate()
    // Autumn break: first day from 1 March with at least 20 mm over 3 days.
    let breakDate: string | null = null
    const from = a.daily.findIndex((x) => x.md >= '0301')
    if (from >= 0) {
      for (let i = from; i < a.daily.length && a.daily[i].md <= '0731'; i++) {
        const sum3 = a.daily[i].mm + (a.daily[i + 1]?.mm ?? 0) + (a.daily[i + 2]?.mm ?? 0)
        if (sum3 >= 20) { breakDate = `${a.daily[i].md.slice(0, 2)}-${a.daily[i].md.slice(2)}`; break }
      }
    }
    years[y] = {
      // A month counts only when nearly complete, so partial months don't look dry.
      rain: a.rain.map((v, m) => (a.rainN[m] >= daysIn(m) - 2 ? r1(v) : null)),
      tmin: a.tmin.map((v, m) => (a.tn[m] ? r1(v / a.tn[m]) : null)),
      tmax: a.tmax.map((v, m) => (a.tn[m] ? r1(v / a.tn[m]) : null)),
      frost: a.frost.map((v, m) => (a.tn[m] >= daysIn(m) - 2 ? v : null)),
      breakDate,
      days: a.days,
    }
  }
  // This year's rain so far, month by month including the part month, for "season so far".
  const cy = lastDate.slice(0, 4)
  const soFar = acc[cy] ? acc[cy].rain.map(r1) : Array(12).fill(0)
  return { lat, lon, lastDate: `${lastDate.slice(0, 4)}-${lastDate.slice(4, 6)}-${lastDate.slice(6)}`, years, currentYear: Number(cy), currentYearRain: soFar }
}

// ENSO --------------------------------------------------------------------------------------------

async function loadEnso() {
  const res = await fetch('https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt', { headers: UA })
  if (!res.ok) throw new Error(`NOAA ONI answered ${res.status}`)
  const oni = (await res.text()).trim().split('\n').slice(1).map((l) => l.trim().split(/\s+/))
    .filter((c) => c.length >= 4).map(([season, year, , anom]) => ({ season, year: Number(year), anom: Number(anom) }))
  let probs: { season: string; laNina: number; neutral: number; elNino: number }[] = []
  let issued: string | null = null
  try {
    const page = await fetch('https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso/roni/probabilities/', { headers: UA })
    const text = (await page.text()).replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ')
    issued = text.match(/Issued ([A-Z][a-z]+ \d{4})/)?.[1] ?? null
    const table = text.slice(text.indexOf('Season'))
    for (const m of table.matchAll(/\b([JFMASOND]{3}) [A-Z][a-z]{2} [A-Z][a-z]{2} [A-Z][a-z]{2} (\d{1,3}) (\d{1,3}) (\d{1,3})\b/g)) {
      probs.push({ season: m[1], laNina: Number(m[2]), neutral: Number(m[3]), elNino: Number(m[4]) })
    }
  } catch { probs = [] }
  return { oni: oni.filter((o) => o.year >= 1980), probs, issued }
}

// Markets -----------------------------------------------------------------------------------------

const SERIES: Record<string, string> = {
  rapeseedOil: 'Rapeseed oil', wheat: 'Wheat, US HRW', barley: 'Barley', maize: 'Maize', beef: 'Beef', lamb: 'Lamb',
  urea: 'Urea', dap: 'DAP', potash: 'Potassium chloride', crude: 'Crude oil, Brent',
}

async function loadMarkets() {
  const page = await fetch('https://www.worldbank.org/en/research/commodity-markets', { headers: { ...UA, Accept: 'text/html' } })
  const html = await page.text()
  const link = html.match(/https?:[^"' ]*CMO-Historical-Data-Monthly\.xlsx/)?.[0]
  if (!link) throw new Error('World Bank: monthly price file not found')
  const file = await fetch(link, { headers: UA })
  if (!file.ok) throw new Error(`World Bank file answered ${file.status}`)
  const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' })
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Monthly Prices'], { header: 1, raw: true }) as unknown[][]
  const updated = rows.slice(0, 5).map((r) => String(r?.[0] ?? '')).find((s) => s.startsWith('Updated'))?.replace('Updated on ', '') ?? null
  const hi = rows.findIndex((r) => Array.isArray(r) && r.some((c) => typeof c === 'string' && c.startsWith('Crude oil, average')))
  const header = (rows[hi] as unknown[]).map((c) => String(c ?? '').replace(/\*/g, '').trim())
  const units = (rows[hi + 1] as unknown[]).map((c) => String(c ?? '').replace(/[()]/g, ''))
  const data = rows.slice(hi + 2).filter((r) => typeof r?.[0] === 'string' && /^\d{4}M\d{2}$/.test(r[0] as string))
  const recent = data.slice(-180)  // 15 years
  const series: Record<string, { name: string; unit: string; points: [string, number][] }> = {}
  for (const [key, name] of Object.entries(SERIES)) {
    const col = header.findIndex((h) => h === name)
    if (col < 0) continue
    series[key] = {
      name, unit: units[col],
      points: recent.map((r) => [`${String(r[0]).slice(0, 4)}-${String(r[0]).slice(5)}`, Number(r[col])] as [string, number]).filter(([, v]) => Number.isFinite(v)),
    }
  }
  // Rand per US dollar, monthly average.
  const start = `${recent[0] ? String(recent[0][0]).slice(0, 4) : '2011'}-01-01`
  const fxRes = await fetch(`https://api.frankfurter.app/${start}..?from=USD&to=ZAR`, { headers: UA })
  const fxJson = await fxRes.json()
  const byMonth = new Map<string, number[]>()
  for (const [d, v] of Object.entries(fxJson.rates ?? {}) as [string, { ZAR: number }][]) {
    const m = d.slice(0, 7)
    byMonth.set(m, [...(byMonth.get(m) ?? []), v.ZAR])
  }
  const fx = [...byMonth.entries()].sort().map(([m, v]) => [m, Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 1000) / 1000] as [string, number])
  return { updated, series, fx }
}

async function allowed(req: Request) {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (token) {
    const { data } = await admin.auth.getUser(token)
    if (data.user) return true
  }
  const secret = req.headers.get('x-farm-secret')
  if (!secret) return false
  const { data } = await admin.rpc('push_config')
  return secret === data?.[0]?.notify_secret
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    if (!(await allowed(req))) return json({ error: 'Not logged in' }, 401)
    const body = await req.json().catch(() => ({}))
    const lat = Number(body.lat)
    const lon = Number(body.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return json({ error: 'lat and lon are required' }, 400)
    // About 5 km grid: nearby farms share one download.
    const key = `${lat.toFixed(2)},${lon.toFixed(2)}`
    const [climate, enso, markets] = await Promise.allSettled([
      cached(`climate:${key}`, 24 * 7, () => loadClimate(Number(lat.toFixed(2)), Number(lon.toFixed(2)))),
      cached('enso', 24, loadEnso),
      cached('markets', 24 * 3, loadMarkets),
    ])
    const part = <T,>(r: PromiseSettledResult<T>) => (r.status === 'fulfilled' ? r.value : { error: String(r.reason) })
    return json({ climate: part(climate), enso: part(enso), markets: part(markets) })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
