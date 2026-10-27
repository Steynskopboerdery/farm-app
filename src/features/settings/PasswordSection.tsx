import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { ErrorText } from '../../components/ui'
import { useI18n } from '../../lib/i18n'
import { supabase } from '../../lib/supabase'

/** Lets anyone set a password so they can log in on another device without waiting for an email. */
export function PasswordSection() {
  const { t } = useI18n()
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [problem, setProblem] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
    },
    onSuccess: () => {
      setPassword('')
      setRepeat('')
    },
  })

  function submit() {
    setProblem(null)
    if (password.length < 8) return setProblem(t('passwordTooShort'))
    if (password !== repeat) return setProblem(t('passwordsDiffer'))
    save.mutate()
  }

  return (
    <form className="card stack" onSubmit={(e) => { e.preventDefault(); submit() }}>
      <h2>{t('password')}</h2>
      <p className="small muted">{t('passwordHelp')}</p>
      <label>{t('newPassword')}
        <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      <label>{t('repeatPassword')}
        <input type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
      </label>
      <button className="btn primary" disabled={save.isPending}>
        {save.isPending ? t('saving') : save.isSuccess ? `✓ ${t('passwordSaved')}` : t('setPassword')}
      </button>
      {problem && <p className="error">{problem}</p>}
      <ErrorText error={save.error} />
    </form>
  )
}
