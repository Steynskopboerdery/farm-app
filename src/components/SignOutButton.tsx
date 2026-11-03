import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useI18n } from '../lib/i18n'
import { discardAll, pendingBeforeSignOut } from '../lib/outbox'
import { supabase } from '../lib/supabase'

/**
 * Log out, so someone else can log in on this phone. Saves still waiting for signal are sent first;
 * if some can't be sent, the person is asked before they are thrown away.
 */
export function SignOutButton({ className = 'btn' }: { className?: string }) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)
  const signOut = async () => {
    setBusy(true)
    try {
      const waiting = await pendingBeforeSignOut()
      if (waiting > 0 && !confirm(t('signOutPending', { n: waiting }))) return
      discardAll()
      // Local: always works, even without signal. Then nothing of this person's farm stays on the screen.
      await supabase.auth.signOut({ scope: 'local' })
      qc.clear()
    } finally {
      setBusy(false)
    }
  }
  return <button className={className} disabled={busy} onClick={signOut}>🚪 {t('signOutSwitch')}</button>
}
