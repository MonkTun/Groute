import { NextRequest, NextResponse } from 'next/server'

import { createApiClient } from '@/lib/supabase/api'

export async function GET(request: NextRequest) {
  const supabase = await createApiClient(request)
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [followingResult, followersResult, notificationsResult, dmResult, participatingResult, createdResult] =
    await Promise.all([
      // Users I follow
      supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id),

      // My followers
      supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', user.id),

      // Notifications
      supabase
        .from('notifications')
        .select(
          `id, type, read, created_at, activity_id,
           from_user:users!from_user_id ( id, display_name, first_name, last_name, avatar_url )`
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50),

      // DM conversations (last message per user)
      supabase
        .from('messages')
        .select(
          `id, content, created_at, sender_id, receiver_id,
           sender:users!sender_id ( id, display_name, first_name, last_name, avatar_url ),
           receiver:users!receiver_id ( id, display_name, first_name, last_name, avatar_url )`
        )
        .is('activity_id', null)
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(100),

      // Group chats I'm participating in
      supabase
        .from('activity_participants')
        .select(
          `activity_id, status,
           activity:activities!activity_id ( id, title, sport_type, scheduled_at, creator_id )`
        )
        .eq('user_id', user.id)
        .eq('status', 'accepted'),

      // Group chats I created
      supabase
        .from('activities')
        .select('id, title, sport_type, scheduled_at, creator_id')
        .eq('creator_id', user.id),
    ])

  // Build mutual friends set
  const followingIds = (followingResult.data ?? []).map((f) => f.following_id)
  const followerIds = (followersResult.data ?? []).map((f) => f.follower_id)
  const followingSet = new Set(followingIds)
  const mutualIds = followerIds.filter((id) => followingSet.has(id))

  // Fetch mutual friend profiles
  let mutualFriends: Array<Record<string, unknown>> = []
  if (mutualIds.length > 0) {
    const { data } = await supabase
      .from('users')
      .select('id, display_name, first_name, last_name, avatar_url, area, last_location_lat, last_location_lng, last_location_at')
      .in('id', mutualIds)
    mutualFriends = data ?? []
  }

  // Deduplicate DM conversations to get last message per conversation partner
  const dmConversations: Array<Record<string, unknown>> = []
  const seenPartners = new Set<string>()
  for (const msg of dmResult.data ?? []) {
    const partnerId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id
    if (partnerId && !seenPartners.has(partnerId)) {
      seenPartners.add(partnerId)
      const partner = msg.sender_id === user.id ? msg.receiver : msg.sender
      dmConversations.push({
        partnerId,
        partner: Array.isArray(partner) ? partner[0] : partner,
        lastMessage: msg.content,
        lastMessageAt: msg.created_at,
      })
    }
  }

  // Normalize group chats
  const groupChats = [
    ...(participatingResult.data ?? []).map((p) => {
      const activity = Array.isArray(p.activity) ? p.activity[0] : p.activity
      return activity
    }),
    ...(createdResult.data ?? []),
  ].filter(Boolean)

  // Deduplicate group chats by activity ID
  const seenActivities = new Set<string>()
  const uniqueGroupChats = groupChats.filter((chat) => {
    if (!chat || seenActivities.has(chat.id)) return false
    seenActivities.add(chat.id)
    return true
  })

  return NextResponse.json({
    data: {
      following: followingIds,
      followers: followerIds,
      mutualFriends,
      notifications: notificationsResult.data ?? [],
      dmConversations,
      groupChats: uniqueGroupChats,
    },
  })
}
