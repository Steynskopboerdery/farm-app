import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { ErrorText, Loading } from '../../components/ui'
import { useFarm, useFarmId } from '../../farm/FarmProvider'
import { formatDateShort } from '../../lib/format'
import { useI18n } from '../../lib/i18n'
import { useMembers } from '../../lib/queries'
import { supabase } from '../../lib/supabase'
import { markRead, threadOf, useMessages, useStaffDirectory, useUnread, type Message } from '../../lib/team'

function useNames() {
  const members = useMembers()
  const directory = useStaffDirectory()
  const { session } = useAuth()
  const me = session?.user.id ?? ''
  const list = (members.data ?? []).filter((m) => m.user_id !== me)
  const name = (id: string) => {
    const staff = (directory.data ?? []).find((x) => x.user_id === id)
    if (staff) return staff.full_name
    const m = (members.data ?? []).find((x) => x.user_id === id)
    return m ? m.display_name || m.email?.split('@')[0] || '–' : '–'
  }
  return { me, people: list, name, loading: members.isLoading }
}

const time = (iso: string, lang: 'en' | 'af') => {
  const d = new Date(iso)
  const today = new Date().toDateString() === d.toDateString()
  const hm = d.toLocaleTimeString(lang === 'af' ? 'af-ZA' : 'en-ZA', { hour: '2-digit', minute: '2-digit' })
  return today ? hm : `${formatDateShort(iso, lang)} ${hm}`
}

/** Conversations: the farm-wide broadcast channel, then one per person. */
export function ChatList() {
  const { t, lang } = useI18n()
  const farmId = useFarmId()
  const { me, people, name, loading } = useNames()
  const messages = useMessages()
  const unread = useUnread()
  if (loading || messages.isLoading) return <Loading />
  const lastIn = (thread: string) => [...(messages.data ?? [])].reverse().find((m) => threadOf(m, me) === thread)
  const rows = [
    { id: 'all', thread: farmId, title: `📢 ${t('chatEveryone')}`, sub: t('chatEveryoneSub') },
    ...people.map((p) => ({ id: p.user_id, thread: p.user_id, title: name(p.user_id), sub: p.role === 'owner' ? t('owner') : t('worker') })),
  ].map((r) => ({ ...r, last: lastIn(r.thread) }))
  // Most recent conversations first; the broadcast channel stays on top.
  rows.sort((a, b) => (a.id === 'all' ? -1 : b.id === 'all' ? 1 : (b.last?.created_at ?? '').localeCompare(a.last?.created_at ?? '')))
  return (
    <div className="page stack">
      <Link to="/team" className="back">‹ {t('teamTitle')}</Link>
      <h1>💬 {t('chatTitle')}</h1>
      {people.length === 0 && <p className="muted">{t('chatNobody')}</p>}
      <ul className="list card">
        {rows.map((r) => {
          const n = unread.byThread.get(r.thread) ?? 0
          return (
            <li key={r.id}>
              <Link className="row link-row" to={`/chat/${r.id}`}>
                <span className="avatar" aria-hidden="true">{r.id === 'all' ? '📢' : r.title.slice(0, 1).toUpperCase()}</span>
                <div className="grow">
                  <strong>{r.title}</strong>
                  <div className="small muted ellipsis">{r.last ? `${r.last.sender_id === me ? `${t('chatYou')}: ` : ''}${r.last.body}` : r.sub}</div>
                </div>
                <div className="chat-meta">
                  {r.last && <div className="tiny muted">{time(r.last.created_at, lang)}</div>}
                  {n > 0 && <span className="unread">{n}</span>}
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
      <p className="tiny muted">{t('chatPrivacy')}</p>
      <ErrorText error={messages.error} />
    </div>
  )
}

/** One conversation. /chat/all is the broadcast to everyone on the farm (only owners can write there). */
export function ChatThread() {
  const { peer = 'all' } = useParams<{ peer: string }>()
  const { t, lang } = useI18n()
  const { isOwner } = useFarm()
  const farmId = useFarmId()
  const qc = useQueryClient()
  const { me, name } = useNames()
  const messages = useMessages()
  const broadcast = peer === 'all'
  const thread = broadcast ? farmId : peer
  const list = (messages.data ?? []).filter((m) => threadOf(m, me) === thread)
  const [body, setBody] = useState('')
  const end = useRef<HTMLDivElement>(null)

  // Mark as read whenever new messages show while the chat is open.
  const lastId = list[list.length - 1]?.id
  useEffect(() => {
    if (!lastId) return
    markRead(farmId, thread).then(() => qc.invalidateQueries({ queryKey: ['chat_reads'] }))
    end.current?.scrollIntoView({ block: 'end' })
  }, [lastId, farmId, thread, qc])

  const send = useMutation({
    mutationFn: async () => {
      const text = body.trim()
      if (!text) return
      const { error } = await supabase.from('messages').insert({ farm_id: farmId, recipient_id: broadcast ? null : peer, body: text })
      if (error) throw error
    },
    onSuccess: () => { setBody(''); qc.invalidateQueries({ queryKey: ['messages', farmId] }) },
  })
  const hide = useMutation({
    mutationFn: async (m: Message) => {
      const { error } = await supabase.from('messages').update({ deleted_at: new Date().toISOString() }).eq('id', m.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['messages', farmId] }),
  })
  const canWrite = !broadcast || isOwner

  return (
    <div className="page chat-page">
      <Link to="/chat" className="back">‹ {t('chatTitle')}</Link>
      <h1 className="h2">{broadcast ? `📢 ${t('chatEveryone')}` : name(peer)}</h1>
      {broadcast && <p className="tiny muted">{isOwner ? t('chatBroadcastOwner') : t('chatBroadcastWorker')}</p>}
      {messages.isLoading ? <Loading /> : (
        <div className="bubbles">
          {list.length === 0 && <p className="muted center">{t('chatEmpty')}</p>}
          {list.map((m) => {
            const mine = m.sender_id === me
            return (
              <div key={m.id} className={`bubble ${mine ? 'mine' : ''}`}>
                {broadcast && !mine && <div className="tiny strong">{name(m.sender_id)}</div>}
                <div className="bubble-text">{m.body}</div>
                <div className="tiny muted">{time(m.created_at, lang)}
                  {mine && <button className="link-btn" onClick={() => confirm(t('chatHideConfirm')) && hide.mutate(m)}>{t('delete')}</button>}
                </div>
              </div>
            )
          })}
          <div ref={end} />
        </div>
      )}
      {canWrite && (
        <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send.mutate() }}>
          <textarea rows={1} value={body} placeholder={t('chatPlaceholder')} maxLength={4000}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(pointer: fine)').matches) { e.preventDefault(); send.mutate() } }} />
          <button className="btn primary" disabled={send.isPending || !body.trim()} aria-label={t('chatSendBtn')}>➤</button>
        </form>
      )}
      <ErrorText error={messages.error ?? send.error ?? hide.error} />
    </div>
  )
}
