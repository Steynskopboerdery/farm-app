import { FunctionsHttpError } from '@supabase/supabase-js'
import { shrink } from '../features/dashboard/HeroPhoto'
import { supabase } from './supabase'

export interface ReceiptReading {
  supplier: string | null
  date: string | null
  total_amount: number | null
  vat_amount: number | null
  category: 'fuel' | 'labour' | 'machinery' | 'seed' | 'fertiliser' | 'chemical' | 'feed' | 'other'
  description: string
  items: { description: string; quantity: number | null; unit: string | null; amount: number | null }[]
  confidence: 'high' | 'medium' | 'low'
}
export interface MapArea { name: string; hectares: number | null; crop: string | null; notes: string | null }
export interface FieldMapReading { fields: MapArea[]; camps: MapArea[]; notes: string | null; confidence: 'high' | 'medium' | 'low' }

async function toBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer())
  let s = ''
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  return btoa(s)
}

/** Sends a (shrunk) photo to the farm's photo reader and returns what it read, for the farmer to check. */
export async function readPhoto<T = ReceiptReading | FieldMapReading>(mode: 'receipt' | 'fieldmap', farmId: string, file: File): Promise<T> {
  const blob = await shrink(file)
  const { data, error } = await supabase.functions.invoke<{ result: T; error?: string }>('read-photo', {
    body: { mode, farmId, image: await toBase64(blob), mediaType: 'image/jpeg' },
  })
  if (error) {
    // The reader sends a readable reason in its reply.
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null) as { error?: string } | null
      throw new Error(body?.error ?? error.message)
    }
    throw error
  }
  if (!data?.result) throw new Error(data?.error ?? 'No answer')
  return data.result
}

/** A photo as a data URL (shrunk), e.g. to lay an old map over the satellite view. */
export async function photoDataUrl(file: File): Promise<string> {
  const blob = await shrink(file)
  return `data:image/jpeg;base64,${await toBase64(blob)}`
}
