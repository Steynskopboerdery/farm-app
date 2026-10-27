// Reads a photo with Claude (Anthropic) and returns structured data for the farm app to check:
//   mode "receipt": supplier, date, amounts, kind of cost
//   mode "fieldmap": fields and camps with names, sizes and crops from an old farm map
// Only farm owners can call it (each call costs a few US cents). Needs the ANTHROPIC_API_KEY secret.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import Anthropic from 'npm:@anthropic-ai/sdk'
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const MODEL = 'claude-opus-5-5'

const RECEIPT_SCHEMA = {
  type: 'object',
  properties: {
    supplier: { type: ['string', 'null'], description: 'Business that issued the receipt' },
    date: { type: ['string', 'null'], description: 'Receipt date as YYYY-MM-DD' },
    total_amount: { type: ['number', 'null'], description: 'Total paid in Rand, including VAT' },
    vat_amount: { type: ['number', 'null'], description: 'VAT in Rand, if shown' },
    category: { type: 'string', enum: ['fuel', 'labour', 'machinery', 'seed', 'fertiliser', 'chemical', 'feed', 'other'] },
    description: { type: 'string', description: 'Short description of what was bought, e.g. "Diesel 200 L"' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          quantity: { type: ['number', 'null'] },
          unit: { type: ['string', 'null'] },
          amount: { type: ['number', 'null'] },
        },
        required: ['description', 'quantity', 'unit', 'amount'],
        additionalProperties: false,
      },
    },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
  },
  required: ['supplier', 'date', 'total_amount', 'vat_amount', 'category', 'description', 'items', 'confidence'],
  additionalProperties: false,
}

const AREA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    hectares: { type: ['number', 'null'] },
    crop: { type: ['string', 'null'], description: 'Lower-case English crop name if written, e.g. wheat, canola, barley, oats, lupins' },
    notes: { type: ['string', 'null'] },
  },
  required: ['name', 'hectares', 'crop', 'notes'],
  additionalProperties: false,
}
const FIELDMAP_SCHEMA = {
  type: 'object',
  properties: {
    fields: { type: 'array', items: AREA, description: 'Crop lands' },
    camps: { type: 'array', items: AREA, description: 'Grazing camps' },
    notes: { type: ['string', 'null'], description: 'Anything on the map worth knowing that does not fit above' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
  },
  required: ['fields', 'camps', 'notes', 'confidence'],
  additionalProperties: false,
}

const PROMPTS = {
  receipt:
    'This is a photo of a receipt or invoice from a South African farm supplier. Read it and fill in the fields. ' +
    'Amounts are in Rand; use the final total paid (including VAT). Use null for anything you cannot read. ' +
    'Pick the category that best fits what was bought (diesel/petrol = fuel; repairs, parts, tyres = machinery; wages = labour).',
  fieldmap:
    'This is a photo of an old farm map or field chart (it may be hand-drawn). List every crop field ("land") and every grazing camp ("kamp") shown, ' +
    'with its name or number as written, its size in hectares if written (convert morgen to hectares: 1 morgen = 0.8565 ha), ' +
    'and the crop if written. Afrikaans words are common. Use null for anything not shown. Do not invent fields that are not on the map.',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const { mode, farmId, image, mediaType } = await req.json()
    if (mode !== 'receipt' && mode !== 'fieldmap') return json({ error: 'Unknown mode' }, 400)
    if (typeof image !== 'string' || image.length > 8_000_000) return json({ error: 'Photo missing or too large' }, 400)

    // Owners only: farm settings are visible to owners alone (row level security), so this doubles as the check.
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const { data: owner } = await supabase.from('farm_settings').select('farm_id').eq('farm_id', farmId).maybeSingle()
    if (!owner) return json({ error: 'Only the farm owner can use the photo reader' }, 403)

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) return json({ error: 'The photo reader is not set up yet (ANTHROPIC_API_KEY missing in Supabase secrets)' }, 503)
    const client = new Anthropic({ apiKey })

    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // If the model declines, Anthropic re-runs the request on its recommended fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: {
        effort: mode === 'receipt' ? 'low' : 'medium',
        format: { type: 'json_schema', schema: mode === 'receipt' ? RECEIPT_SCHEMA : FIELDMAP_SCHEMA },
      },
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType ?? 'image/jpeg', data: image } },
          { type: 'text', text: PROMPTS[mode as 'receipt' | 'fieldmap'] },
        ],
      }],
    } as never) as Anthropic.Beta.BetaMessage

    if (response.stop_reason === 'refusal') return json({ error: 'The photo could not be read' }, 422)
    if (response.stop_reason === 'max_tokens') return json({ error: 'The answer was cut short; try a clearer or smaller photo' }, 422)
    const text = response.content.find((b) => b.type === 'text')
    if (!text || text.type !== 'text') return json({ error: 'No answer from the reader' }, 502)
    return json({ result: JSON.parse(text.text), usage: response.usage })
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return json({ error: 'The Anthropic API key is not valid' }, 503)
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'Too many photos at once; try again in a minute' }, 429)
    if (e instanceof Anthropic.APIError) return json({ error: `Reader error ${e.status}: ${e.message}` }, 502)
    return json({ error: String(e) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}
