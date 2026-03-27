import { redirect } from 'next/navigation'

import { createServerClient } from '@/lib/supabase/server'
import { GroupChat } from '@/components/GroupChat'

export default async function ChatPage({
  params,
}: {
  params: Promise<{ activityId: string }>
}) {
  const { activityId } = await params
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [activityResult, messagesResult, participantsResult] = await Promise.all([
    supabase
      .from('activities')
      .select('id, title, sport_type, creator_id, scheduled_at, location_name')
      .eq('id', activityId)
      .single(),

    supabase
      .from('messages')
      .select(`
        id, content, created_at,
        sender:users!sender_id ( id, display_name, first_name, last_name, avatar_url )
      `)
      .eq('activity_id', activityId)
      .order('created_at', { ascending: true })
      .limit(200),

    supabase
      .from('activity_participants')
      .select(`
        id, status,
        user:users!user_id ( id, display_name, first_name, last_name, avatar_url, area )
      `)
      .eq('activity_id', activityId)
      .eq('status', 'accepted'),
  ])

  const activity = activityResult.data
  if (!activity) redirect('/social')

  const isCreator = activity.creator_id === user.id
  const isParticipant = (participantsResult.data ?? []).some((p) => {
    const u = Array.isArray(p.user) ? p.user[0] : p.user
    return u?.id === user.id
  })

  if (!isCreator && !isParticipant) redirect('/social')

  const messages = (messagesResult.data ?? []).map((m) => ({
    id: m.id,
    content: m.content,
    createdAt: m.created_at,
    sender: Array.isArray(m.sender) ? m.sender[0] : m.sender,
  }))

  const participants = (participantsResult.data ?? []).map((p) => ({
    id: p.id,
    user: Array.isArray(p.user) ? p.user[0] : p.user,
  }))

  return (
    <GroupChat
      activityId={activityId}
      activityTitle={activity.title}
      sportType={activity.sport_type}
      currentUserId={user.id}
      initialMessages={messages}
      participants={participants}
      isCreator={isCreator}
    />
  )
}
