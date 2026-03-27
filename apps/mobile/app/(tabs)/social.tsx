import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'

import { useSession } from '../../lib/AuthProvider'
import { supabase } from '../../lib/supabase'

type Tab = 'friends' | 'messages' | 'notifications'

interface Friend {
  id: string
  display_name: string
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  area: string | null
}

interface Notification {
  id: string
  type: string
  activity_id: string | null
  created_at: string
  from_user: {
    id: string
    display_name: string
    first_name: string | null
    last_name: string | null
    avatar_url: string | null
  } | null
}

interface Conversation {
  id: string
  type: 'dm' | 'group'
  name: string
  avatarUrl: string | null
  lastMessage: string
  lastMessageAt: string
  routePath: string
}

export default function SocialScreen() {
  const { user } = useSession()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('friends')
  const [friends, setFriends] = useState<Friend[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const fetchData = useCallback(async () => {
    if (!user) return

    const [
      fwingResult, fwersResult,
      notifResult,
      dmResult, groupResult, myActivitiesResult,
    ] = await Promise.all([
      supabase.from('follows').select('following_id').eq('follower_id', user.id),
      supabase.from('follows').select('follower_id').eq('following_id', user.id),

      supabase
        .from('notifications')
        .select(`
          id, type, read, activity_id, created_at,
          from_user:users!from_user_id ( id, display_name, first_name, last_name, avatar_url )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30),

      // DMs
      supabase
        .from('messages')
        .select(`
          id, content, created_at, sender_id, receiver_id,
          sender:users!sender_id ( id, display_name, first_name, last_name, avatar_url ),
          receiver:users!receiver_id ( id, display_name, first_name, last_name, avatar_url )
        `)
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .is('activity_id', null)
        .not('receiver_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50),

      // Group chats I participate in
      supabase
        .from('activity_participants')
        .select('activity:activities!activity_id ( id, title, banner_url )')
        .eq('user_id', user.id)
        .eq('status', 'accepted'),

      // Group chats I created
      supabase
        .from('activities')
        .select('id, title, banner_url')
        .eq('creator_id', user.id)
        .eq('status', 'open'),
    ])

    // Friends (mutual follows)
    const followingSet = new Set((fwingResult.data ?? []).map((f) => f.following_id))
    const followerSet = new Set((fwersResult.data ?? []).map((f) => f.follower_id))
    const mutualIds = [...followingSet].filter((id) => followerSet.has(id))

    if (mutualIds.length > 0) {
      const { data } = await supabase
        .from('users')
        .select('id, display_name, first_name, last_name, avatar_url, area')
        .in('id', mutualIds)
      setFriends(data ?? [])
    } else {
      setFriends([])
    }

    // Notifications
    const notifs = (notifResult.data ?? []).map((n) => ({
      ...n,
      from_user: Array.isArray(n.from_user) ? n.from_user[0] ?? null : n.from_user,
    }))
    setNotifications(notifs)
    setUnreadCount(notifs.filter((n) => !n.read).length)

    // Build conversations
    const convos: Conversation[] = []

    // DMs — deduplicate by partner
    const dmPartners = new Map<string, Conversation>()
    for (const msg of dmResult.data ?? []) {
      const isFromMe = msg.sender_id === user.id
      const partner = isFromMe
        ? (Array.isArray(msg.receiver) ? msg.receiver[0] : msg.receiver)
        : (Array.isArray(msg.sender) ? msg.sender[0] : msg.sender)
      if (!partner) continue
      if (!dmPartners.has(partner.id)) {
        const name = partner.first_name && partner.last_name
          ? `${partner.first_name} ${partner.last_name}`
          : partner.display_name
        dmPartners.set(partner.id, {
          id: `dm-${partner.id}`,
          type: 'dm',
          name,
          avatarUrl: partner.avatar_url,
          lastMessage: isFromMe ? `You: ${msg.content}` : msg.content,
          lastMessageAt: msg.created_at,
          routePath: `/dm/${partner.id}`,
        })
      }
    }
    convos.push(...dmPartners.values())

    // Group chats
    const seen = new Set<string>()
    for (const p of groupResult.data ?? []) {
      const activity = Array.isArray(p.activity) ? p.activity[0] : p.activity
      if (!activity || seen.has(activity.id)) continue
      seen.add(activity.id)
      convos.push({
        id: `group-${activity.id}`,
        type: 'group',
        name: activity.title,
        avatarUrl: activity.banner_url,
        lastMessage: 'Group chat',
        lastMessageAt: '',
        routePath: `/chat/${activity.id}`,
      })
    }
    for (const a of myActivitiesResult.data ?? []) {
      if (seen.has(a.id)) continue
      seen.add(a.id)
      convos.push({
        id: `group-${a.id}`,
        type: 'group',
        name: a.title,
        avatarUrl: a.banner_url,
        lastMessage: 'Group chat',
        lastMessageAt: '',
        routePath: `/chat/${a.id}`,
      })
    }

    convos.sort((a, b) => {
      if (a.lastMessageAt && b.lastMessageAt) {
        return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      }
      return a.lastMessageAt ? -1 : 1
    })
    setConversations(convos)
  }, [user])

  useEffect(() => {
    fetchData().finally(() => setIsLoading(false))
  }, [fetchData])

  async function handleRefresh() {
    setIsRefreshing(true)
    await fetchData()
    setIsRefreshing(false)
  }

  function getNotifMessage(n: Notification): string {
    const name = n.from_user?.first_name ?? n.from_user?.display_name ?? 'Someone'
    switch (n.type) {
      case 'invite': return `${name} invited you to an activity`
      case 'join_request': return `${name} wants to join your activity`
      case 'accepted': return `${name} accepted your join request`
      case 'follow': return `${name} started following you`
      default: return `${name} sent you a notification`
    }
  }

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        {(['friends', 'messages', 'notifications'] as Tab[]).map((t) => (
          <Pressable
            key={t}
            style={[styles.tabButton, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'friends' ? `Friends (${friends.length})`
                : t === 'messages' ? 'Messages'
                : `Notifications${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Friends tab */}
      {tab === 'friends' && (
        <FlatList
          data={friends}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#fff" />}
          renderItem={({ item }) => {
            const name = item.first_name && item.last_name
              ? `${item.first_name} ${item.last_name}`
              : item.display_name
            return (
              <View style={styles.friendRow}>
                {item.avatar_url ? (
                  <Image source={{ uri: item.avatar_url }} style={styles.friendAvatar} />
                ) : (
                  <View style={styles.friendAvatarFallback}>
                    <Text style={styles.friendInitial}>
                      {(item.first_name?.[0] ?? item.display_name[0]).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.friendInfo}>
                  <Text style={styles.friendName}>{name}</Text>
                  {item.area && <Text style={styles.friendArea}>{item.area}</Text>}
                </View>
                <Pressable style={styles.dmButton} onPress={() => router.push(`/dm/${item.id}`)}>
                  <Text style={styles.dmText}>Message</Text>
                </Pressable>
              </View>
            )
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No friends yet. Follow someone and have them follow back!</Text>
            </View>
          }
        />
      )}

      {/* Messages tab */}
      {tab === 'messages' && (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#fff" />}
          renderItem={({ item }) => (
            <Pressable
              style={styles.convoRow}
              onPress={() => router.push(item.routePath as never)}
            >
              {item.avatarUrl ? (
                <Image source={{ uri: item.avatarUrl }} style={styles.convoAvatar} />
              ) : (
                <View style={[styles.convoAvatarFallback, item.type === 'group' && styles.groupFallback]}>
                  <Text style={styles.convoInitial}>
                    {item.type === 'group' ? '\u{1F465}' : item.name[0].toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.convoContent}>
                <View style={styles.convoNameRow}>
                  <Text style={styles.convoName} numberOfLines={1}>{item.name}</Text>
                  {item.type === 'group' && (
                    <View style={styles.groupTag}>
                      <Text style={styles.groupTagText}>Group</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.convoLastMsg} numberOfLines={1}>{item.lastMessage}</Text>
              </View>
              {item.lastMessageAt ? (
                <Text style={styles.convoTime}>
                  {new Date(item.lastMessageAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
              ) : null}
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>{'\u{1F4AC}'}</Text>
              <Text style={styles.emptyTitle}>No conversations yet</Text>
              <Text style={styles.emptyText}>Join an activity or message a friend to get started</Text>
            </View>
          }
        />
      )}

      {/* Notifications tab */}
      {tab === 'notifications' && (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#fff" />}
          renderItem={({ item }) => (
            <Pressable
              style={styles.notifRow}
              onPress={() => item.activity_id && router.push(`/activity/${item.activity_id}`)}
            >
              {item.from_user?.avatar_url ? (
                <Image source={{ uri: item.from_user.avatar_url }} style={styles.notifAvatar} />
              ) : (
                <View style={styles.notifAvatarFallback}>
                  <Text style={styles.notifInitial}>
                    {(item.from_user?.first_name?.[0] ?? item.from_user?.display_name[0] ?? '?').toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.notifContent}>
                <Text style={styles.notifMessage}>{getNotifMessage(item)}</Text>
                <Text style={styles.notifTime}>
                  {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No notifications yet</Text>
            </View>
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },

  // Tab bar
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#27272a' },
  tabButton: { flex: 1, paddingVertical: 11, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#fff' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#71717a' },
  tabTextActive: { color: '#fff' },

  // Friends
  friendRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#18181b' },
  friendAvatar: { width: 44, height: 44, borderRadius: 22 },
  friendAvatarFallback: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#27272a', alignItems: 'center', justifyContent: 'center' },
  friendInitial: { fontSize: 18, fontWeight: '700', color: '#fff' },
  friendInfo: { flex: 1 },
  friendName: { fontSize: 15, fontWeight: '600', color: '#fff' },
  friendArea: { fontSize: 13, color: '#71717a', marginTop: 1 },
  dmButton: { backgroundColor: '#27272a', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  dmText: { fontSize: 13, fontWeight: '600', color: '#fff' },

  // Conversations
  convoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#18181b' },
  convoAvatar: { width: 48, height: 48, borderRadius: 24 },
  convoAvatarFallback: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#27272a', alignItems: 'center', justifyContent: 'center' },
  groupFallback: { backgroundColor: '#1e3a5f' },
  convoInitial: { fontSize: 18, fontWeight: '700', color: '#fff' },
  convoContent: { flex: 1 },
  convoNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  convoName: { fontSize: 15, fontWeight: '600', color: '#fff', flex: 1 },
  groupTag: { backgroundColor: '#27272a', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  groupTagText: { fontSize: 10, fontWeight: '600', color: '#71717a' },
  convoLastMsg: { fontSize: 13, color: '#71717a', marginTop: 2 },
  convoTime: { fontSize: 12, color: '#52525b' },

  // Notifications
  notifRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#18181b' },
  notifAvatar: { width: 40, height: 40, borderRadius: 20 },
  notifAvatarFallback: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#27272a', alignItems: 'center', justifyContent: 'center' },
  notifInitial: { fontSize: 16, fontWeight: '700', color: '#fff' },
  notifContent: { flex: 1 },
  notifMessage: { fontSize: 14, color: '#fff', lineHeight: 18 },
  notifTime: { fontSize: 12, color: '#71717a', marginTop: 2 },

  // Empty states
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#fff', marginTop: 12 },
  emptyText: { fontSize: 14, color: '#71717a', textAlign: 'center', marginTop: 4 },
})
