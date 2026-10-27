import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import { LanguageSwitch, VersionLabel } from '../../components/LanguageSwitch'
import { ErrorText, numOrNull, Section, textOrNull } from '../../components/ui'
import { useFarm, useFarmId } from '../../farm/FarmProvider'
import { useI18n } from '../../lib/i18n'
import { PasswordSection } from './PasswordSection'
import { useFarmSettings, useFields, useGroups, useInvites, useMembers, useSeasons, useSpecies } from '../../lib/queries'
import { supabase, type Tables } from '../../lib/supabase'

export function SettingsPage() {
  const { t } = useI18n()
  const { isOwner } = useFarm()
  const { session } = useAuth()

  return (
    <div className="page stack">
      <h1>{t('settingsTitle')}</h1>
      <Section title={t('language')}><LanguageSwitch /></Section>
      {!isOwner && <p className="notice">{t('workerNote')}</p>}
      {isOwner && (
        <>
          <FarmSection />
          <BusinessSection />
          <SeasonsSection />
          <SpeciesSection />
          <TeamSection />
          <SampleSection />
        </>
      )}
      <PasswordSection />
      <section className="card stack">
        <p className="muted">{session?.user.email}</p>
        <button className="btn" onClick={() => supabase.auth.signOut()}>{t('signOut')}</button>
      </section>
      <VersionLabel />
    </div>
  )
}

function SaveButton({ pending, success }: { pending: boolean; success: boolean }) {
  const { t } = useI18n()
  return <button className="btn primary" disabled={pending}>{pending ? t('saving') : success ? `✓ ${t('saved')}` : t('save')}</button>
}

function FarmSection() {
  const { t } = useI18n()
  const { farm, refresh } = useFarm()
  const [f, setF] = useState({ name: farm?.name ?? '', location: farm?.location_text ?? '', ha: farm?.total_hectares?.toString() ?? '' })
  useEffect(() => {
    if (farm) setF({ name: farm.name, location: farm.location_text ?? '', ha: farm.total_hectares?.toString() ?? '' })
  }, [farm])

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('farms')
        .update({ name: f.name.trim(), location_text: textOrNull(f.location), total_hectares: numOrNull(f.ha) }).eq('id', farm!.id)
      if (error) throw error
    },
    onSuccess: refresh,
  })

  return (
    <form className="card stack" onSubmit={(e) => { e.preventDefault(); save.mutate() }}>
      <h2>{t('farmDetails')}</h2>
      <label>{t('farmName')}<input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <label>{t('farmLocation')}<input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></label>
      <label>{t('totalHectares')}<input inputMode="decimal" value={f.ha} onChange={(e) => setF({ ...f, ha: e.target.value })} /></label>
      <SaveButton pending={save.isPending} success={save.isSuccess} />
      <ErrorText error={save.error} />
    </form>
  )
}

type SettingsForm = Record<string, string | boolean>
const TEXT_KEYS = ['legal_name', 'address', 'phone', 'email', 'vat_number', 'invoice_prefix', 'bank_name',
  'bank_account_name', 'bank_account_number', 'bank_branch_code', 'bank_account_type', 'invoice_footer'] as const
const NUM_KEYS = ['vat_rate', 'next_invoice_number', 'payment_terms_days'] as const

function BusinessSection() {
  const { t } = useI18n()
  const farmId = useFarmId()
  const qc = useQueryClient()
  const settings = useFarmSettings()
  const [f, setF] = useState<SettingsForm>({})

  useEffect(() => {
    const s = settings.data
    if (!s) return
    const next: SettingsForm = { vat_registered: s.vat_registered }
    for (const k of TEXT_KEYS) next[k] = s[k] ?? ''
    for (const k of NUM_KEYS) next[k] = String(s[k] ?? '')
    setF(next)
  }, [settings.data])

  const save = useMutation({
    mutationFn: async () => {
      const patch: Partial<Tables<'farm_settings'>> = { vat_registered: !!f.vat_registered }
      for (const k of TEXT_KEYS) (patch as Record<string, unknown>)[k] = textOrNull(String(f[k] ?? ''))
      for (const k of NUM_KEYS) {
        const n = numOrNull(String(f[k] ?? ''))
        if (n != null) (patch as Record<string, unknown>)[k] = n
      }
      patch.invoice_prefix = patch.invoice_prefix ?? 'INV-'
      const { error } = await supabase.from('farm_settings').update(patch).eq('farm_id', farmId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['farm_settings'] }),
  })

  const input = (key: string, label: string, mode?: 'decimal' | 'numeric' | 'tel' | 'email') => (
    <label>{label}
      <input inputMode={mode} type={mode === 'email' ? 'email' : 'text'} value={String(f[key] ?? '')}
        onChange={(e) => setF({ ...f, [key]: e.target.value })} />
    </label>
  )

  return (
    <form className="card stack" onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate() }}>
      <h2>{t('business')}</h2>
      {input('legal_name', t('legalName'))}
      <label>{t('address')}<textarea rows={3} value={String(f.address ?? '')} onChange={(e) => setF({ ...f, address: e.target.value })} /></label>
      {input('phone', t('phone'), 'tel')}
      {input('email', t('email'), 'email')}
      <label className="check"><input type="checkbox" checked={!!f.vat_registered} onChange={(e) => setF({ ...f, vat_registered: e.target.checked })} /> {t('vatRegistered')}</label>
      {f.vat_registered && <>{input('vat_number', t('vatNumber'))}{input('vat_rate', t('vatRate'), 'decimal')}</>}
      {input('invoice_prefix', t('invoicePrefix'))}
      {input('next_invoice_number', t('nextInvoiceNumber'), 'numeric')}
      {input('payment_terms_days', t('paymentTerms'), 'numeric')}
      <h3>{t('bank')}</h3>
      {input('bank_name', t('bankName'))}
      {input('bank_account_name', t('bankAccountName'))}
      {input('bank_account_number', t('bankAccountNumber'), 'numeric')}
      {input('bank_branch_code', t('bankBranchCode'), 'numeric')}
      {input('bank_account_type', t('bankAccountType'))}
      <label>{t('invoiceFooter')}<textarea rows={2} value={String(f.invoice_footer ?? '')} onChange={(e) => setF({ ...f, invoice_footer: e.target.value })} /></label>
      <SaveButton pending={save.isPending} success={save.isSuccess} />
      <ErrorText error={save.error ?? settings.error} />
    </form>
  )
}

function SeasonsSection() {
  const { t } = useI18n()
  const farmId = useFarmId()
  const qc = useQueryClient()
  const seasons = useSeasons()
  const [year, setYear] = useState(String(new Date().getFullYear()))

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('seasons').insert({ farm_id: farmId, year: Number(year), label: `${year}` })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seasons'] }),
  })

  return (
    <Section title={t('seasons')}>
      <p className="small muted">{t('seasonsHelp')}</p>
      <div className="stack">
        {(seasons.data ?? []).map((s) => <SeasonRow key={s.id} season={s} />)}
      </div>
      <form className="row" onSubmit={(e) => { e.preventDefault(); add.mutate() }}>
        <input className="grow" inputMode="numeric" aria-label={t('year')} value={year} onChange={(e) => setYear(e.target.value)} />
        <button className="btn" disabled={add.isPending}>+ {t('addSeason')}</button>
      </form>
      <ErrorText error={add.error} />
    </Section>
  )
}

function SeasonRow({ season }: { season: Tables<'seasons'> }) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const [label, setLabel] = useState(season.label ?? '')
  const [notes, setNotes] = useState(season.notes ?? '')
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('seasons').update({ label: textOrNull(label), notes: textOrNull(notes) }).eq('id', season.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seasons'] }),
  })
  return (
    <form className="subcard stack" onSubmit={(e) => { e.preventDefault(); save.mutate() }}>
      <strong>{season.year}</strong>
      <label>{t('label')}<input value={label} onChange={(e) => setLabel(e.target.value)} /></label>
      <label>{t('notes')}<textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      <SaveButton pending={save.isPending} success={save.isSuccess} />
      <ErrorText error={save.error} />
    </form>
  )
}

function SpeciesSection() {
  const { t, w } = useI18n()
  const qc = useQueryClient()
  const species = useSpecies()
  const [days, setDays] = useState<Record<string, string>>({})
  useEffect(() => {
    setDays(Object.fromEntries((species.data ?? []).map((s) => [s.id, String(s.gestation_days)])))
  }, [species.data])

  const save = useMutation({
    mutationFn: async () => {
      for (const s of species.data ?? []) {
        const n = Number(days[s.id])
        if (n > 0 && n !== s.gestation_days) {
          const { error } = await supabase.from('species_reference').update({ gestation_days: n }).eq('id', s.id)
          if (error) throw error
        }
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['species_reference'] }),
  })

  return (
    <form className="card stack" onSubmit={(e) => { e.preventDefault(); save.mutate() }}>
      <h2>{t('gestation')}</h2>
      <p className="small muted">{t('gestationHelp')}</p>
      {(species.data ?? []).map((s) => (
        <label key={s.id}>{w(s.species)}
          <input inputMode="numeric" value={days[s.id] ?? ''} onChange={(e) => setDays({ ...days, [s.id]: e.target.value })} />
        </label>
      ))}
      <SaveButton pending={save.isPending} success={save.isSuccess} />
      <ErrorText error={save.error} />
    </form>
  )
}

function TeamSection() {
  const { t } = useI18n()
  const farmId = useFarmId()
  const { session } = useAuth()
  const qc = useQueryClient()
  const members = useMembers()
  const invites = useInvites()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'worker' | 'owner'>('worker')

  const invite = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('farm_invites').insert({ farm_id: farmId, email: email.trim().toLowerCase(), role })
      if (error) throw error
    },
    onSuccess: () => {
      setEmail('')
      qc.invalidateQueries({ queryKey: ['farm_invites'] })
    },
  })

  const cancelInvite = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('farm_invites').update({ deleted_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['farm_invites'] }),
  })

  const setMemberRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      const { error } = await supabase.from('farm_members').update({ role }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['farm_members'] }),
  })

  return (
    <Section title={t('team')}>
      <p className="small muted">{t('teamHelp')}</p>
      <ul className="list">
        {(members.data ?? []).map((m) => (
          <li key={m.id} className="row">
            <div className="grow">{m.email}{m.user_id === session?.user.id ? ` (${t('you')})` : ''}</div>
            {m.user_id === session?.user.id ? <span className="small">{t('owner')}</span> : (
              <select value={m.role} onChange={(e) => setMemberRole.mutate({ id: m.id, role: e.target.value })}>
                <option value="worker">{t('worker')}</option>
                <option value="owner">{t('owner')}</option>
              </select>
            )}
          </li>
        ))}
        {(invites.data ?? []).map((i) => (
          <li key={i.id} className="row">
            <div className="grow">{i.email}<div className="small muted">{t('invited')} · {i.role === 'owner' ? t('owner') : t('worker')}</div></div>
            <button className="btn small" onClick={() => cancelInvite.mutate(i.id)}>✕</button>
          </li>
        ))}
      </ul>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); if (email.trim()) invite.mutate() }}>
        <label>{t('inviteEmail')}<input type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>{t('role')}
          <select value={role} onChange={(e) => setRole(e.target.value as 'worker' | 'owner')}>
            <option value="worker">{t('worker')}</option>
            <option value="owner">{t('owner')}</option>
          </select>
        </label>
        <button className="btn" disabled={invite.isPending}>{t('invite')}</button>
      </form>
      <ErrorText error={invite.error ?? setMemberRole.error ?? cancelInvite.error} />
    </Section>
  )
}

function SampleSection() {
  const { t } = useI18n()
  const farmId = useFarmId()
  const { refresh } = useFarm()
  const qc = useQueryClient()
  const fields = useFields()
  const groups = useGroups()
  const hasSample = (fields.data ?? []).some((f) => f.is_sample) || (groups.data ?? []).some((g) => g.is_sample)

  const done = () => {
    qc.invalidateQueries()
    refresh()
  }

  const load = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('load_sample_data', { p_farm: farmId })
      if (error) throw error
    },
    onSuccess: done,
  })

  // Only rows marked is_sample are removed. Linked plantings, animals and plans go with their field or group.
  const clear = useMutation({
    mutationFn: async () => {
      for (const table of ['tasks', 'livestock_groups', 'camps', 'fields', 'planning_estimates'] as const) {
        const { error } = await supabase.from(table).delete().eq('farm_id', farmId).eq('is_sample', true)
        if (error) throw error
      }
      // Keep a sample season if your own plantings now use it; otherwise remove it.
      const { data: seasons } = await supabase.from('seasons').select('id').eq('farm_id', farmId).eq('is_sample', true)
      for (const s of seasons ?? []) {
        const { count } = await supabase.from('plantings').select('id', { count: 'exact', head: true }).eq('season_id', s.id)
        const { error } = count
          ? await supabase.from('seasons').update({ is_sample: false, notes: null }).eq('id', s.id)
          : await supabase.from('seasons').delete().eq('id', s.id)
        if (error) throw error
      }
    },
    onSuccess: done,
  })

  return (
    <Section title={t('sampleData')}>
      <p className="small muted">{t('sampleHelp')}</p>
      {hasSample ? (
        <button className="btn danger" disabled={clear.isPending}
          onClick={() => confirm(t('removeSampleConfirm')) && clear.mutate()}>{clear.isPending ? t('saving') : t('removeSample')}</button>
      ) : (
        <button className="btn" disabled={load.isPending} onClick={() => load.mutate()}>{load.isPending ? t('saving') : t('loadSample')}</button>
      )}
      <ErrorText error={load.error ?? clear.error} />
    </Section>
  )
}
