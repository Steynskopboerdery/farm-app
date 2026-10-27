import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CropIcon } from './CropIcon'
import { formatHa } from '../lib/format'
import { useI18n, type DictKey } from '../lib/i18n'
import { useCurrentPlantings, useFields } from '../lib/queries'

type Kind = 'spray' | 'fertiliser' | 'harvest' | 'planting' | 'other' | 'reminder'
const KINDS: { kind: Kind; label: DictKey; emoji: string }[] = [
  { kind: 'spray', label: 'sprays', emoji: '💧' },
  { kind: 'fertiliser', label: 'fertiliser', emoji: '🌱' },
  { kind: 'harvest', label: 'harvestTitle', emoji: '🌾' },
  { kind: 'planting', label: 'plantingTitle', emoji: '🚜' },
  { kind: 'other', label: 'otherWork', emoji: '🛠' },
  { kind: 'reminder', label: 'reminders', emoji: '⏰' },
]

/** Bottom sheet behind the green + button: pick what to record, then which field. */
export function QuickAddSheet({ onClose }: { onClose: () => void }) {
  const { t, w, lang } = useI18n()
  const navigate = useNavigate()
  const fields = useFields()
  const plantings = useCurrentPlantings()
  const [kind, setKind] = useState<Kind | null>(null)

  function pick(fieldId: string) {
    onClose()
    navigate(kind === 'reminder' ? `/land/field/${fieldId}#reminders` : `/land/field/${fieldId}/record/${kind}`)
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={t('quickAdd')} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="card-head">
          <h2>{kind ? t('chooseField') : t('quickAdd')}</h2>
          <button className="btn small ghost" onClick={kind ? () => setKind(null) : onClose}>{kind ? `‹ ${t('back')}` : '✕'}</button>
        </div>
        {!kind ? (
          <div className="kind-grid">
            {KINDS.map((k) => (
              <button key={k.kind} className="kind-btn" onClick={() => setKind(k.kind)}>
                <span className="kind-emoji" aria-hidden="true">{k.emoji}</span>
                <span>{t(k.label)}</span>
              </button>
            ))}
          </div>
        ) : (
          <ul className="list">
            {(fields.data ?? []).map((f) => {
              const crop = plantings.data?.get(f.id)?.crop
              return (
                <li key={f.id}>
                  <button className="row link-row plain" onClick={() => pick(f.id)}>
                    <CropIcon crop={crop} size={34} />
                    <span className="grow left">{f.name}<span className="small muted"> · {crop ? w(crop) : t('noCrop')}</span></span>
                    <span className="small muted">{formatHa(f.hectares, lang)}</span>
                    <span className="chev">›</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
