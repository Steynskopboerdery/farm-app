import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorText, Loading } from '../../components/ui'
import { PIN_EMOJI, usePins } from '../../lib/farmRecords'
import { formatDateShort } from '../../lib/format'
import { useI18n, type DictKey } from '../../lib/i18n'

/** Everything pinned on the map: fences to fix, water points, erosion... */
export function PinsPage() {
  const { t, lang } = useI18n()
  const [showDone, setShowDone] = useState(false)
  const pins = usePins(showDone)
  if (pins.isLoading) return <Loading />
  const list = pins.data ?? []
  return (
    <div className="page stack">
      <Link to="/menu" className="back">‹ {t('menu')}</Link>
      <h1>📍 {t('pinsTitle')}</h1>
      <p className="muted">{t('pinsIntro')}</p>
      <Link className="btn primary" to="/map">🗺️ {t('pinAdd')}</Link>
      <label className="check"><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> {t('pinsShowDone')}</label>
      {list.length === 0 ? <p className="muted">{t('pinsNone')}</p> : (
        <ul className="list card">
          {list.map((p) => (
            <li key={p.id}>
              <Link className="row link-row" to={`/map?pin=${p.id}`}>
                <span className="kind-emoji" aria-hidden="true">{PIN_EMOJI[p.kind]}</span>
                <div className="grow">
                  <strong>{p.title}</strong>{p.resolved_at && <span className="badge owner"> ✓ {t('pinResolved')}</span>}
                  <div className="small muted">{t(`pin_${p.kind}` as DictKey)} · {formatDateShort(p.created_at, lang)}{p.photo_path ? ' · 📷' : ''}</div>
                </div>
                <span className="chev">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <ErrorText error={pins.error} />
    </div>
  )
}
