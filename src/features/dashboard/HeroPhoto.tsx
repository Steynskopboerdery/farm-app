import { useQuery } from '@tanstack/react-query'
import { useRef, useState, type ReactNode } from 'react'
import { ErrorText } from '../../components/ui'
import { useFarm } from '../../farm/FarmProvider'
import { useI18n } from '../../lib/i18n'
import { supabase } from '../../lib/supabase'

const BUCKET = 'farm-photos'
const DEFAULT_PHOTO = '/hero-default.svg'
const HOLD_MS = 600

/** Shrinks a photo to at most 1600 px wide as JPEG, so it loads fast on farm signal. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 1600 / bitmap.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not read photo'))), 'image/jpeg', 0.82))
}

/** Home-screen header photo. Owners press and hold (or tap 📷) to choose their own. */
export function HeroPhoto({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const { farm, isOwner, refresh } = useFarm()
  const path = farm?.hero_photo_path ?? null
  const fileInput = useRef<HTMLInputElement>(null)
  const timer = useRef<number | null>(null)
  const [menu, setMenu] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const photo = useQuery({
    queryKey: ['hero-photo', path],
    enabled: !!path,
    staleTime: 6 * 24 * 3600_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path!, 7 * 24 * 3600)
      if (error) throw error
      return data.signedUrl
    },
  })
  const src = (path && photo.data) || DEFAULT_PHOTO

  const startHold = () => {
    if (!isOwner) return
    timer.current = window.setTimeout(() => { navigator.vibrate?.(30); setMenu(true) }, HOLD_MS)
  }
  const stopHold = () => { if (timer.current) window.clearTimeout(timer.current); timer.current = null }

  async function save(newPath: string | null) {
    const { error } = await supabase.from('farms').update({ hero_photo_path: newPath }).eq('id', farm!.id)
    if (error) throw error
    if (path && path !== newPath) await supabase.storage.from(BUCKET).remove([path])
    refresh()
  }

  async function upload(file: File) {
    setBusy(true)
    setError(null)
    try {
      const blob = await shrink(file)
      // A new name each time, so phones don't keep showing the old picture.
      const newPath = `${farm!.id}/home-${Date.now()}.jpg`
      const { error } = await supabase.storage.from(BUCKET).upload(newPath, blob, { contentType: 'image/jpeg' })
      if (error) throw error
      await save(newPath)
      setMenu(false)
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <header
      className="hero hero-photo"
      style={{ backgroundImage: `linear-gradient(180deg, rgba(4,20,10,.55) 0%, rgba(4,20,10,.12) 38%, rgba(4,20,10,.18) 60%, rgba(4,20,10,.78) 100%), url("${src}")` }}
      onPointerDown={startHold} onPointerUp={stopHold} onPointerLeave={stopHold} onPointerCancel={stopHold}
      onContextMenu={(e) => { if (isOwner) e.preventDefault() }}
    >
      {children}
      {isOwner && (
        <button type="button" className="photo-btn" aria-label={t('changePhoto')} onClick={() => setMenu(true)}>📷</button>
      )}
      <input ref={fileInput} type="file" accept="image/*" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }} />
      {menu && (
        <div className="sheet-backdrop" onClick={() => !busy && setMenu(false)} onPointerDown={(e) => e.stopPropagation()}>
          <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <h2>{t('homePhoto')}</h2>
            <p className="small muted">{t('homePhotoHelp')}</p>
            <button className="btn primary" disabled={busy} onClick={() => fileInput.current?.click()}>
              {busy ? t('saving') : `🖼 ${t('choosePhoto')}`}
            </button>
            {path && <button className="btn" disabled={busy} onClick={() => save(null).then(() => setMenu(false)).catch(setError)}>{t('defaultPhoto')}</button>}
            <button className="btn ghost" disabled={busy} onClick={() => setMenu(false)}>{t('cancel')}</button>
            <ErrorText error={error} />
          </div>
        </div>
      )}
    </header>
  )
}
