// Weather forecast proxy for the farm app.
// Fetches MET Norway's Locationforecast (free, also for commercial use, CC BY 4.0:
// the app must show "Weather data: MET Norway"). MET asks every app to identify itself
// with a User-Agent, which a browser can't set, so the app calls this function instead.
// Only logged-in users can call it (verify_jwt).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const USER_AGENT = 'FarmManager/1.0 github.com/Steynskopboerdery/farm-app'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

// Small per-instance cache, kept until MET's own "Expires" time (usually ~30 min).
const cache = new Map<string, { expires: number; body: string }>()

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const params = req.method === 'POST' ? await req.json() : Object.fromEntries(new URL(req.url).searchParams)
    const lat = Number(params.lat)
    const lon = Number(params.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      return json({ error: 'lat and lon are required' }, 400)
    }
    // MET asks for at most 4 decimals; 2 (about 1 km) also lets nearby requests share the cache.
    const key = `${lat.toFixed(2)},${lon.toFixed(2)}`
    const hit = cache.get(key)
    if (hit && hit.expires > Date.now()) return new Response(hit.body, { headers: { ...CORS, 'Content-Type': 'application/json' } })

    const url = `https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${lat.toFixed(2)}&lon=${lon.toFixed(2)}`
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } })
    if (!res.ok) return json({ error: `Forecast service answered ${res.status}` }, 502)
    const body = await res.text()
    const expires = Date.parse(res.headers.get('expires') ?? '') || Date.now() + 30 * 60_000
    cache.set(key, { expires, body })
    return new Response(body, { headers: { ...CORS, 'Content-Type': 'application/json' } })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}
