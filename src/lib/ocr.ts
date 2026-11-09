// Reading the writing on a photo, on the phone itself (free; no photo leaves the phone). The reading program
// and the English / Afrikaans language data (about 9 MB, served by the app from /tesseract) download the first
// time and are kept. Works best on printed or clear block writing.
import type { TextLine } from './calc/mapText'

export async function readText(image: string, onProgress?: (p: number) => void): Promise<TextLine[]> {
  const { createWorker } = await import('tesseract.js')
  const base = `${location.origin}/tesseract`
  const worker = await createWorker(['eng', 'afr'], 1, {
    workerPath: `${base}/worker.min.js`,
    corePath: `${base}/`,
    langPath: `${base}/lang`,
    logger: (m: { status: string; progress: number }) => { if (m.status === 'recognizing text') onProgress?.(m.progress) },
  })
  try {
    const { data } = await worker.recognize(image)
    return (data.lines ?? []).map((l) => ({ text: l.text, confidence: l.confidence, box: l.bbox }))
  } finally {
    await worker.terminate()
  }
}
