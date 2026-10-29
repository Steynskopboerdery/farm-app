import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CropIcon } from './CropIcon'
import { formatHa } from '../lib/format'
import { useI18n, type DictKey } from '../lib/i18n'
import { useCurrentPlantings, useFields, useGroups } from '../lib/queries'
import { AnimalIcon } from './AnimalIcon'
import { useFarm, type Permission } from '../farm/FarmProvider'

type Kind = 'spray' | 'fertiliser' | 'harvest' | 'planting' | 'other' | 'reminder' | 'animal' | 'rain' | 'fuel' | 'pin' | 'diary'
const KINDS: { kind: Kind; label: DictKey; emoji: string; perm: Permission | null; to?: string }[] = [
  { kind: 'spray', label: 'sprays', emoji: '💧', perm: 'field_records' },
  { kind: 'fertiliser', label: 'fertiliser', emoji: '🌱', perm: 'field_records' },
  { kind: 'harvest', label: 'harvestTitle', emoji: '🌾', perm: 'field_records' },
  { kind: 'planting', label: 'plantingTitle', emoji: '🚜', perm: 'field_records' },
  { kind: 'other', label: 'otherWork', emoji: '🛠', perm: 'field_records' },
  { kind: 'reminder', label: 'reminders', emoji: '⏰', perm: 'tasks' },
  { kind: 'animal', label: 'animalEvent', emoji: '🐑', perm: 'animal_records' },
  { kind: 'rain', label: 'rainShort', emoji: '🌧️', perm: null, to: '/rain' },
  { kind: 'fuel', label: 'fuelShort', emoji: '⛽', perm: null, to: '/vehicles' },
  { kind: 'pin', label: 'pinShort', emoji: '📍', perm: null, to: '/map' },
]

/** Bottom sheet behind the green + button: pick what to record, then which field. */
export function QuickAddSheet({ onClose }: { onClose: () => void }) {
  const { t, w, lang } = useI18n()
  const navigate = useNavigate()
  const fields = useFields()
  const plantings = useCurrentPlantings()
  const groups = useGroups()
  const { can } = useFarm()
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
          <h2>{kind === 'animal' ? t('chooseGroup') : kind ? t('chooseField') : t('quickAdd')}</h2>
          <button className="btn small ghost" onClick={kind ? () => setKind(null) : onClose}>{kind ? `‹ ${t('back')}` : '✕'}</button>
        </div>
        {!kind ? (
          <div className="kind-grid">
            {KINDS.filter((k) => !k.perm || can(k.perm)).map((k) => (
              <button key={k.kind} className="kind-btn" onClick={() => { if (k.to) { onClose(); navigate(k.to) } else setKind(k.kind) }}>
                <span className="kind-emoji" aria-hidden="true">{k.emoji}</span>
                <span>{t(k.label)}</span>
              </button>
            ))}
          </div>
        ) : kind === 'animal' ? (
          <ul className="list">
            {(groups.data ?? []).map((g) => (
              <li key={g.id}>
                <button className="row link-row plain" onClick={() => { onClose(); navigate(`/livestock/group/${g.id}/event`) }}>
                  <AnimalIcon species={g.species} size={34} />
                  <span className="grow left">{g.name}<span className="small muted"> · {w(g.class)}</span></span>
                  <span className="small muted">{g.quantity}</span>
                  <span className="chev">›</span>
                </button>
              </li>
            ))}
          </ul>
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
