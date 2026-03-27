import { redirect } from 'next/navigation'

import { createServerClient } from '@/lib/supabase/server'
import { DMChat } from '@/components/DMChat'

export default async function DMPage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const { userId: otherUserId } = await params
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [otherUserResult, messagesResult] = await Promise.all([
    supabase
      .from('users')
      .select('id, display_name, first_name, last_name, avatar_url, area')
      .eq('id', otherUserId)
      .single(),

    supabase
      .from('messages')
      .select(`
        id, content, created_at,
        sender:users!sender_id ( id, display_name, first_name, last_name, avatar_url )
      `)
      .is('activity_id', null)
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`
      )
      .order('created_at', { ascending: true })
      .limit(200),
  ])

  const otherUser = otherUserResult.data
  if (!otherUser) redirect('/social')

  const messages = (messagesResult.data ?? []).map((m) => ({
    id: m.id,
    content: m.content,
    createdAt: m.created_at,
    sender: Array.isArray(m.sender) ? m.sender[0] : m.sender,
  }))

  const otherName = otherUser.first_name && otherUser.last_name
    ? `${otherUser.first_name} ${otherUser.last_name}`
    : otherUser.display_name

  return (
    <DMChat
      otherUserId={otherUserId}
      otherUserName={otherName}
      currentUserId={user.id}
      initialMessages={messages}
    />
  )
}
