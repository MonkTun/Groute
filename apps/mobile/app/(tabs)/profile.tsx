import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useRouter, usePathname } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useSession } from '../../lib/AuthProvider'
import { apiFetch, apiPost, apiDelete } from '../../lib/api'

const C = {
  bg: '#fafafa',
  card: '#ffffff',
  cardBorder: '#e5e5e5',
  primary: '#0f8a6e',
  primaryMuted: 'rgba(15,138,110,0.1)',
  text: '#1a1a2e',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  border: '#e5e5e5',
}

interface Friend {
  id: string
  display_name: string
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  area: string | null
  lastMessage?: string
  lastMessageAt?: string
}

interface SearchUser {
  id: string
  display_name: string
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  area: string | null
  isFollowing: boolean
}

export default function SocialScreen() {
  const { user } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const insets = useSafeAreaInsets()

  const [profile, setProfile] = useState<{ display_name: string; first_name: string | null; last_name: string | null; avatar_url: string | null } | null>(null)
  const [friends, setFriends] = useState<Friend[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Add friend modal
  const [showAddFriend, setShowAddFriend] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchUser[]>([])
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set())

  const fetchData = useCallback(async () => {
    if (!user) return

    const [profileResult, socialResult, friendsResult] = await Promise.all([
      apiFetch<{ display_name: string; first_name: string | null; last_name: string | null; avatar_url: string | null }>('/api/profile'),
      apiFetch<{
        following: string[]
        followers: string[]
        mutualFriends: Friend[]
        dmConversations: Array<{ partnerId: string; partner: { id: string; display_name: string; first_name: string | null; last_name: string | null; avatar_url: string | null }; lastMessage: string; lastMessageAt: string }>
      }>('/api/social'),
      apiFetch<Friend[]>('/api/friends'),
    ])

    setProfile(profileResult.data ?? null)

    const followingIds = new Set(socialResult.data?.following ?? [])
    setFollowingSet(followingIds)

    // Build last message map per friend from DM conversations
    const lastMsgMap = new Map<string, { content: string; at: string }>()
    for (const dm of socialResult.data?.dmConversations ?? []) {
      lastMsgMap.set(dm.partnerId, {
        content: dm.lastMessage,
        at: dm.lastMessageAt,
      })
    }

    const mutualFriendProfiles = friendsResult.data ?? []

    const friendsWithMessages = mutualFriendProfiles.map((f) => ({
      ...f,
      lastMessage: lastMsgMap.get(f.id)?.content,
      lastMessageAt: lastMsgMap.get(f.id)?.at,
    }))

    // Sort: friends with recent messages first
    friendsWithMessages.sort((a, b) => {
      if (a.lastMessageAt && b.lastMessageAt) return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      return a.lastMessageAt ? -1 : 1
    })

    setFriends(friendsWithMessages)
  }, [user])

  useEffect(() => {
    fetchData().finally(() => setIsLoading(false))
  }, [fetchData])

  // Refetch on tab focus
  useEffect(() => {
    if (pathname === '/profile' && !isLoading) fetchData()
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRefresh() {
    setIsRefreshing(true)
    await fetchData()
    setIsRefreshing(false)
  }

  // Search users to add as friends
  async function handleSearch(query: string) {
    setSearchQuery(query)
    if (query.length < 2) { setSearchResults([]); return }

    const { data } = await apiFetch<Array<{ id: string; display_name: string; first_name: string | null; last_name: string | null; avatar_url: string | null; area: string | null }>>(
      `/api/users/search?q=${encodeURIComponent(query)}`
    )

    setSearchResults(
      (data ?? []).map((u) => ({ ...u, isFollowing: followingSet.has(u.id) }))
    )
  }

  async function handleFollow(userId: string) {
    await apiPost('/api/follow', { followingId: userId })
    setFollowingSet((prev) => new Set([...prev, userId]))
    setSearchResults((prev) => prev.map((u) => u.id === userId ? { ...u, isFollowing: true } : u))
  }

  async function handleUnfollow(userId: string) {
    await apiDelete('/api/follow', { followingId: userId })
    setFollowingSet((prev) => { const next = new Set(prev); next.delete(userId); return next })
    setSearchResults((prev) => prev.map((u) => u.id === userId ? { ...u, isFollowing: false } : u))
  }

  const displayName = profile
    ? profile.first_name && profile.last_name
      ? `${profile.first_name} ${profile.last_name}`
      : profile.display_name
    : ''

  if (isLoading) {
    return (
      <View style={s.loading}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    )
  }

  return (
    <View style={s.container}>
      {/* Header bar */}
      <View style={[s.headerBar, { paddingTop: insets.top + 12 }]}>
        <Text style={s.headerTitle}>Social</Text>
        <View style={s.headerRight}>
          {/* Add friend button */}
          <Pressable style={s.addBtn} onPress={() => setShowAddFriend(true)}>
            <Text style={s.addBtnText}>+</Text>
          </Pressable>

          {/* Profile avatar → own profile */}
          <Pressable style={s.profileBtn} onPress={() => user?.id ? router.push(`/user/${user.id}`) : undefined}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={s.headerAvatar} />
            ) : (
              <View style={s.headerAvatarFallback}>
                <Text style={s.headerAvatarInitial}>
                  {(profile?.first_name?.[0] ?? profile?.display_name[0] ?? '?').toUpperCase()}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* Friend / DM list */}
      <FlatList
        data={friends}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={C.primary} />}
        contentContainerStyle={friends.length === 0 ? s.emptyContainer : undefined}
        renderItem={({ item }) => {
          const name = item.first_name && item.last_name
            ? `${item.first_name} ${item.last_name}`
            : item.display_name
          return (
            <Pressable style={s.friendRow} onPress={() => router.push(`/dm/${item.id}`)}>
              <Pressable onPress={() => router.push(`/user/${item.id}`)}>
                {item.avatar_url ? (
                  <Image source={{ uri: item.avatar_url }} style={s.friendAvatar} />
                ) : (
                  <View style={s.friendAvatarFallback}>
                    <Text style={s.friendInitial}>{(item.first_name?.[0] ?? item.display_name[0]).toUpperCase()}</Text>
                  </View>
                )}
              </Pressable>
              <View style={s.friendInfo}>
                <Text style={s.friendName}>{name}</Text>
                {item.lastMessage ? (
                  <Text style={s.friendLastMsg} numberOfLines={1}>{item.lastMessage}</Text>
                ) : (
                  <Text style={s.friendArea}>{item.area ?? 'Tap to message'}</Text>
                )}
              </View>
              {item.lastMessageAt && (
                <Text style={s.friendTime}>
                  {new Date(item.lastMessageAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
              )}
            </Pressable>
          )
        }}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyEmoji}>{'\u{1F465}'}</Text>
            <Text style={s.emptyTitle}>No friends yet</Text>
            <Text style={s.emptySubtitle}>Tap + to find and follow people</Text>
          </View>
        }
        ListFooterComponent={null}
      />

      {/* Add friend modal */}
      <Modal visible={showAddFriend} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modalContainer}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Find People</Text>
            <Pressable onPress={() => { setShowAddFriend(false); setSearchQuery(''); setSearchResults([]); fetchData() }}>
              <Text style={s.modalDone}>Done</Text>
            </Pressable>
          </View>

          <TextInput
            style={s.searchInput}
            placeholder="Search by name..."
            placeholderTextColor={C.textMuted}
            value={searchQuery}
            onChangeText={handleSearch}
            autoFocus
          />

          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.id}
            contentContainerStyle={s.searchList}
            renderItem={({ item }) => {
              const name = item.first_name && item.last_name
                ? `${item.first_name} ${item.last_name}`
                : item.display_name
              return (
                <Pressable style={s.searchRow} onPress={() => { setShowAddFriend(false); router.push(`/user/${item.id}`) }}>
                  {item.avatar_url ? (
                    <Image source={{ uri: item.avatar_url }} style={s.searchAvatar} />
                  ) : (
                    <View style={s.searchAvatarFallback}>
                      <Text style={s.searchInitial}>{(item.first_name?.[0] ?? item.display_name[0]).toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={s.searchInfo}>
                    <Text style={s.searchName}>{name}</Text>
                    {item.area && <Text style={s.searchArea}>{item.area}</Text>}
                  </View>
                  {item.isFollowing ? (
                    <Pressable style={s.followingBtn} onPress={() => handleUnfollow(item.id)}>
                      <Text style={s.followingBtnText}>Following</Text>
                    </Pressable>
                  ) : (
                    <Pressable style={s.followBtn} onPress={() => handleFollow(item.id)}>
                      <Text style={s.followBtnText}>Follow</Text>
                    </Pressable>
                  )}
                </Pressable>
              )
            }}
            ListEmptyComponent={
              searchQuery.length >= 2 ? (
                <Text style={s.noResults}>No users found</Text>
              ) : (
                <Text style={s.noResults}>Search for people to follow</Text>
              )
            }
          />
        </View>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  loading: { flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' },

  // Header
  headerBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle: { fontSize: 22, fontWeight: '700', color: C.text },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  addBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.primaryMuted, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { fontSize: 20, fontWeight: '500', color: C.primary, marginTop: -1 },
  profileBtn: {},
  headerAvatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: C.border },
  headerAvatarFallback: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.primaryMuted, alignItems: 'center', justifyContent: 'center' },
  headerAvatarInitial: { fontSize: 13, fontWeight: '700', color: C.primary },

  // Friend list
  friendRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  friendAvatar: { width: 52, height: 52, borderRadius: 26 },
  friendAvatarFallback: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.primaryMuted, alignItems: 'center', justifyContent: 'center' },
  friendInitial: { fontSize: 20, fontWeight: '700', color: C.primary },
  friendInfo: { flex: 1 },
  friendName: { fontSize: 15, fontWeight: '600', color: C.text },
  friendLastMsg: { fontSize: 13, color: C.textMuted, marginTop: 2 },
  friendArea: { fontSize: 13, color: C.textMuted, marginTop: 2 },
  friendTime: { fontSize: 11, color: C.textMuted },

  // Empty
  emptyContainer: { flex: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: C.text, marginTop: 12 },
  emptySubtitle: { fontSize: 14, color: C.textMuted, marginTop: 4, textAlign: 'center' },

  // Add friend modal
  modalContainer: { flex: 1, backgroundColor: C.bg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  modalTitle: { fontSize: 18, fontWeight: '700', color: C.text },
  modalDone: { fontSize: 16, fontWeight: '600', color: C.primary },
  searchInput: { margin: 16, backgroundColor: C.card, borderRadius: 12, padding: 14, fontSize: 15, color: C.text, borderWidth: 1, borderColor: C.border },
  searchList: { paddingHorizontal: 16 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  searchAvatar: { width: 44, height: 44, borderRadius: 22 },
  searchAvatarFallback: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' },
  searchInitial: { fontSize: 16, fontWeight: '700', color: C.text },
  searchInfo: { flex: 1 },
  searchName: { fontSize: 15, fontWeight: '500', color: C.text },
  searchArea: { fontSize: 12, color: C.textMuted, marginTop: 1 },
  followBtn: { backgroundColor: C.primary, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 7 },
  followBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  followingBtn: { backgroundColor: '#f0f0f0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  followingBtnText: { fontSize: 13, fontWeight: '600', color: C.textSecondary },
  noResults: { textAlign: 'center', fontSize: 14, color: C.textMuted, paddingTop: 40 },
})
