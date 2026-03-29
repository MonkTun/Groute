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
import { apiFetch } from '../../lib/api'

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

    const { data: socialData } = await apiFetch<{
      following: string[]
      followers: string[]
      mutualFriends: Friend[]
      notifications: Array<{
        id: string
        type: string
        read: boolean
        activity_id: string | null
        created_at: string
        from_user: Notification['from_user'] | Array<Notification['from_user']>
      }>
      dmConversations: Array<{
        partnerId: string
        partner: { id: string; display_name: string; first_name: string | null; last_name: string | null; avatar_url: string | null }
        lastMessage: string
        lastMessageAt: string
      }>
      groupChats: Array<{ id: string; title: string; sport_type?: string; scheduled_at?: string; creator_id?: string }>
    }>('/api/social')

    // Friends (mutual friends from social endpoint)
    setFriends(socialData?.mutualFriends ?? [])

    // Notifications
    const notifs = (socialData?.notifications ?? []).map((n) => ({
      ...n,
      from_user: Array.isArray(n.from_user) ? n.from_user[0] ?? null : n.from_user,
    }))
    setNotifications(notifs)
    setUnreadCount(notifs.filter((n) => !n.read).length)

    // Build conversations
    const convos: Conversation[] = []

    // DMs from social endpoint (already deduplicated by partner)
    for (const dm of socialData?.dmConversations ?? []) {
      const partner = dm.partner
      if (!partner) continue
      const name = partner.first_name && partner.last_name
        ? `${partner.first_name} ${partner.last_name}`
        : partner.display_name
      convos.push({
        id: `dm-${partner.id}`,
        type: 'dm',
        name,
        avatarUrl: partner.avatar_url,
        lastMessage: dm.lastMessage,
        lastMessageAt: dm.lastMessageAt,
        routePath: `/dm/${partner.id}`,
      })
    }

    // Group chats from social endpoint (already deduplicated)
    for (const chat of socialData?.groupChats ?? []) {
      convos.push({
        id: `group-${chat.id}`,
        type: 'group',
        name: chat.title,
        avatarUrl: null,
        lastMessage: 'Group chat',
        lastMessageAt: '',
        routePath: `/chat/${chat.id}`,
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
        <ActivityIndicator size="large" color="#0f8a6e" />
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
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#0f8a6e" />}
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
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#0f8a6e" />}
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
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#0f8a6e" />}
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
  container: { flex: 1, backgroundColor: '#fafafa' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fafafa' },

  // Tab bar
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e5e5e5' },
  tabButton: { flex: 1, paddingVertical: 11, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#1a1a2e' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#9ca3af' },
  tabTextActive: { color: '#1a1a2e' },

  // Friends
  friendRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e5e5e5' },
  friendAvatar: { width: 44, height: 44, borderRadius: 22 },
  friendAvatarFallback: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#e5e5e5', alignItems: 'center', justifyContent: 'center' },
  friendInitial: { fontSize: 18, fontWeight: '700', color: '#1a1a2e' },
  friendInfo: { flex: 1 },
  friendName: { fontSize: 15, fontWeight: '600', color: '#1a1a2e' },
  friendArea: { fontSize: 13, color: '#9ca3af', marginTop: 1 },
  dmButton: { backgroundColor: '#0f8a6e', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  dmText: { fontSize: 13, fontWeight: '600', color: '#fff' },

  // Conversations
  convoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#e5e5e5' },
  convoAvatar: { width: 48, height: 48, borderRadius: 24 },
  convoAvatarFallback: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#e5e5e5', alignItems: 'center', justifyContent: 'center' },
  groupFallback: { backgroundColor: '#dbeafe' },
  convoInitial: { fontSize: 18, fontWeight: '700', color: '#1a1a2e' },
  convoContent: { flex: 1 },
  convoNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  convoName: { fontSize: 15, fontWeight: '600', color: '#1a1a2e', flex: 1 },
  groupTag: { backgroundColor: '#f0f0f0', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  groupTagText: { fontSize: 10, fontWeight: '600', color: '#6b7280' },
  convoLastMsg: { fontSize: 13, color: '#9ca3af', marginTop: 2 },
  convoTime: { fontSize: 12, color: '#9ca3af' },

  // Notifications
  notifRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#e5e5e5' },
  notifAvatar: { width: 40, height: 40, borderRadius: 20 },
  notifAvatarFallback: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#e5e5e5', alignItems: 'center', justifyContent: 'center' },
  notifInitial: { fontSize: 16, fontWeight: '700', color: '#1a1a2e' },
  notifContent: { flex: 1 },
  notifMessage: { fontSize: 14, color: '#1a1a2e', lineHeight: 18 },
  notifTime: { fontSize: 12, color: '#9ca3af', marginTop: 2 },

  // Empty states
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#1a1a2e', marginTop: 12 },
  emptyText: { fontSize: 14, color: '#9ca3af', textAlign: 'center', marginTop: 4 },
})
