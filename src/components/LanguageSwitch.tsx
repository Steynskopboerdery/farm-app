import { useI18n } from '../lib/i18n'

export function LanguageSwitch() {
  const { lang, setLang, t } = useI18n()
  return (
    <div className="segmented" role="group" aria-label={t('language')}>
      <button type="button" className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>English</button>
      <button type="button" className={lang === 'af' ? 'on' : ''} onClick={() => setLang('af')}>Afrikaans</button>
    </div>
  )
}
