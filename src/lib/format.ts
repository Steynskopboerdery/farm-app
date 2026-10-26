import type { Lang } from './i18n'

const locale = (lang: Lang) => (lang === 'af' ? 'af-ZA' : 'en-ZA')

/** 26 October 2026 */
export function formatDate(iso: string | null | undefined, lang: Lang = 'en'): string {
  if (!iso) return '–'
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  return new Intl.DateTimeFormat(locale(lang), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d)
}

/** 26 Oct 2026 */
export function formatDateShort(iso: string | null | undefined, lang: Lang = 'en'): string {
  if (!iso) return '–'
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  return new Intl.DateTimeFormat(locale(lang), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(d)
}

export function formatDateTime(iso: string, lang: Lang = 'en'): string {
  return new Intl.DateTimeFormat(locale(lang), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

export function formatZar(amount: number | null | undefined, lang: Lang = 'en'): string {
  if (amount == null) return '–'
  return new Intl.NumberFormat(locale(lang), { style: 'currency', currency: 'ZAR' }).format(amount)
}

export function formatNumber(n: number | null | undefined, decimals = 0, lang: Lang = 'en'): string {
  if (n == null) return '–'
  return new Intl.NumberFormat(locale(lang), { maximumFractionDigits: decimals, minimumFractionDigits: 0 }).format(n)
}

export function formatHa(n: number | null | undefined, lang: Lang = 'en'): string {
  return n == null ? '–' : `${formatNumber(n, 2, lang)} ha`
}
