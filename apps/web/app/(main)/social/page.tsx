import { redirect } from 'next/navigation'

import { createServerClient } from '@/lib/supabase/server'
import { SocialView } from '@/components/SocialView'

export default async function SocialPage() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [
    followingResult,
    followersResult,
    createdChatsResult,
    participatingChatsResult,
    notificationsResult,
    dmConversationsResult,
  ] = await Promise.all([
    // People I follow
    supabase
      .from('follows')
      .select('following_id, user:users!following_id ( id, display_name, first_name, last_name, avatar_url, area )')
      .eq('follower_id', user.id),

    // People who follow me
    supabase
      .from('follows')
      .select('follower_id, user:users!follower_id ( id, display_name, first_name, last_name, avatar_url, area )')
      .eq('following_id', user.id),

    // Group chats I created
    supabase
      .from('activities')
      .select('id, title, sport_type, scheduled_at')
      .eq('creator_id', user.id)
      .order('scheduled_at', { ascending: false }),

    // Group chats I participate in
    supabase
      .from('activity_participants')
      .select('activity:activities!activity_id ( id, title, sport_type, scheduled_at )')
      .eq('user_id', user.id)
      .eq('status', 'accepted'),

    // Notifications
    supabase
      .from('notifications')
      .select(`
        id, type, read, created_at, activity_id,
        from_user:users!from_user_id ( id, display_name, first_name, last_name, avatar_url )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50),

    // DM conversations (get distinct users I've messaged with)
    supabase
      .from('messages')
      .select('sender_id, receiver_id, content, created_at')
      .is('activity_id', null)
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  // Build following/followers sets
  const followingSet = new Set(
    (followingResult.data ?? []).map((f) => f.following_id)
  )
  const followerSet = new Set(
    (followersResult.data ?? []).map((f) => f.follower_id)
  )

  // Mutual follows = friends
  const allUsers = new Map<string, { id: string; display_name: string; first_name: string | null; last_name: string | null; avatar_url: string | null; area: string | null }>()

  for (const f of followingResult.data ?? []) {
    const u = Array.isArray(f.user) ? f.user[0] : f.user
    if (u) allUsers.set(u.id, u)
  }
  for (const f of followersResult.data ?? []) {
    const u = Array.isArray(f.user) ? f.user[0] : f.user
    if (u) allUsers.set(u.id, u)
  }

  const friends = Array.from(allUsers.values()).filter(
    (u) => followingSet.has(u.id) && followerSet.has(u.id)
  )

  const incomingFollows = Array.from(allUsers.values()).filter(
    (u) => followerSet.has(u.id) && !followingSet.has(u.id)
  )

  // Group chats
  const groupChats: Array<{ id: string; title: string; sport_type: string; scheduled_at: string }> = []
  const seen = new Set<string>()

  for (const a of createdChatsResult.data ?? []) {
    if (!seen.has(a.id)) { groupChats.push(a); seen.add(a.id) }
  }
  for (const p of participatingChatsResult.data ?? []) {
    const act = Array.isArray(p.activity) ? p.activity[0] : p.activity
    if (act && !seen.has(act.id)) { groupChats.push(act); seen.add(act.id) }
  }
  groupChats.sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())

  // DM conversations: extract unique users
  const dmUsers = new Map<string, { userId: string; lastMessage: string; lastAt: string }>()
  for (const m of dmConversationsResult.data ?? []) {
    const otherId = m.sender_id === user.id ? m.receiver_id : m.sender_id
    if (!otherId || dmUsers.has(otherId)) continue
    dmUsers.set(otherId, { userId: otherId, lastMessage: m.content, lastAt: m.created_at })
  }

  // Fetch user info for DM partners
  const dmPartnerIds = Array.from(dmUsers.keys())
  let dmPartners: Array<{ id: string; display_name: string; first_name: string | null; last_name: string | null; avatar_url: string | null }> = []
  if (dmPartnerIds.length > 0) {
    const { data } = await supabase
      .from('users')
      .select('id, display_name, first_name, last_name, avatar_url')
      .in('id', dmPartnerIds)
    dmPartners = data ?? []
  }

  const dmConversations = dmPartners.map((p) => ({
    user: p,
    lastMessage: dmUsers.get(p.id)?.lastMessage ?? '',
    lastAt: dmUsers.get(p.id)?.lastAt ?? '',
  }))

  // Notifications
  const notifications = (notificationsResult.data ?? []).map((n) => ({
    id: n.id,
    type: n.type,
    read: n.read,
    createdAt: n.created_at,
    activityId: n.activity_id,
    fromUser: Array.isArray(n.from_user) ? n.from_user[0] : n.from_user,
  }))

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <SocialView
      friends={friends}
      incomingFollows={incomingFollows}
      groupChats={groupChats}
      dmConversations={dmConversations}
      notifications={notifications}
      unreadCount={unreadCount}
      currentUserId={user.id}
    />
  )
}
