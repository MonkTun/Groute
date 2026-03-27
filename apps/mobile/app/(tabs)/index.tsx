import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  ScrollView,
} from 'react-native'
import { BlurView } from 'expo-blur'
import { useRouter } from 'expo-router'

import { SPORT_LABELS, SKILL_LABELS } from '@groute/shared'
import { useSession } from '../../lib/AuthProvider'
import { supabase } from '../../lib/supabase'

interface Activity {
  id: string
  title: string
  description: string | null
  sport_type: string
  skill_level: string
  visibility: string
  creator_id: string
  banner_url: string | null
  location_name: string
  scheduled_at: string
  max_participants: number
  status: string
  creator: {
    id: string
    display_name: string
    first_name: string | null
    last_name: string | null
    avatar_url: string | null
  } | null
}

interface Participant {
  activity_id: string
  status: string
}

const SPORT_COLORS: Record<string, { bg: string; text: string }> = {
  hiking: { bg: '#d1fae5', text: '#047857' },
  climbing: { bg: '#ffedd5', text: '#c2410c' },
  trail_running: { bg: '#e0f2fe', text: '#0369a1' },
  surfing: { bg: '#cffafe', text: '#0e7490' },
  cycling: { bg: '#ede9fe', text: '#6d28d9' },
  mountain_biking: { bg: '#fef3c7', text: '#b45309' },
  skiing: { bg: '#dbeafe', text: '#1d4ed8' },
  kayaking: { bg: '#ccfbf1', text: '#0f766e' },
  yoga: { bg: '#fce7f3', text: '#be185d' },
}

export default function DiscoverScreen() {
  const { user } = useSession()
  const router = useRouter()
  const [activities, setActivities] = useState<Activity[]>([])
  const [participationMap, setParticipationMap] = useState<Map<string, string>>(new Map())
  const [selectedSport, setSelectedSport] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const fetchActivities = useCallback(async () => {
    const [activitiesResult, participantsResult] = await Promise.all([
      supabase
        .from('activities')
        .select(`
          id, title, description, sport_type, skill_level, visibility, creator_id, banner_url,
          location_name, scheduled_at, max_participants, status,
          creator:users!creator_id ( id, display_name, first_name, last_name, avatar_url )
        `)
        .eq('status', 'open')
        .neq('visibility', 'private')
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(50),

      user
        ? supabase
            .from('activity_participants')
            .select('activity_id, status')
            .eq('user_id', user.id)
        : Promise.resolve({ data: [] }),
    ])

    setActivities(
      (activitiesResult.data ?? []).map((a) => ({
        ...a,
        creator: Array.isArray(a.creator) ? a.creator[0] ?? null : a.creator,
      }))
    )
    setParticipationMap(
      new Map((participantsResult.data ?? []).map((p: Participant) => [p.activity_id, p.status]))
    )
  }, [user])

  useEffect(() => {
    fetchActivities().finally(() => setIsLoading(false))
  }, [fetchActivities])

  async function handleRefresh() {
    setIsRefreshing(true)
    await fetchActivities()
    setIsRefreshing(false)
  }

  const filtered = activities.filter((a) => {
    if (selectedSport && a.sport_type !== selectedSport) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (!a.title.toLowerCase().includes(q) && !a.location_name.toLowerCase().includes(q)) {
        return false
      }
    }
    return true
  })

  function renderActivity({ item }: { item: Activity }) {
    const scheduled = new Date(item.scheduled_at)
    const dateStr = scheduled.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    })
    const timeStr = scheduled.toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit',
    })
    const creatorName = item.creator
      ? item.creator.first_name && item.creator.last_name
        ? `${item.creator.first_name} ${item.creator.last_name[0]}.`
        : item.creator.display_name
      : 'Unknown'
    const sportColor = SPORT_COLORS[item.sport_type] ?? { bg: '#27272a', text: '#a1a1aa' }
    const isOwner = item.creator_id === user?.id
    const participantStatus = participationMap.get(item.id)
    const isMine = isOwner || participantStatus === 'accepted'

    return (
      <Pressable
        style={[styles.card, isMine && styles.cardHighlight]}
        onPress={() => router.push(`/activity/${item.id}`)}
      >
        {item.banner_url && (
          <Image source={{ uri: item.banner_url }} style={styles.cardImage} />
        )}
        <View style={styles.cardBody}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
              {isOwner && <Text style={styles.ownerBadge}>HOST</Text>}
              {participantStatus === 'accepted' && !isOwner && (
                <Text style={styles.joinedBadge}>JOINED</Text>
              )}
              {participantStatus === 'requested' && (
                <Text style={styles.pendingBadge}>PENDING</Text>
              )}
            </View>
            <View style={[styles.sportBadge, { backgroundColor: sportColor.bg }]}>
              <Text style={[styles.sportBadgeText, { color: sportColor.text }]}>
                {SPORT_LABELS[item.sport_type] ?? item.sport_type}
              </Text>
            </View>
          </View>

          <Text style={styles.cardMeta}>{dateStr}, {timeStr}</Text>
          <Text style={styles.cardMeta} numberOfLines={1}>{item.location_name}</Text>

          <View style={styles.cardFooter}>
            <Text style={styles.cardCreator}>by {creatorName}</Text>
            <View style={styles.skillBadge}>
              <Text style={styles.skillText}>
                {SKILL_LABELS[item.skill_level] ?? item.skill_level}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    )
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
      {/* Activity list */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderActivity}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#fff"
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>{'\u{1F3D4}'}</Text>
            <Text style={styles.emptyTitle}>No activities found</Text>
            <Text style={styles.emptySubtitle}>Try a different filter or create one!</Text>
          </View>
        }
      />

      {/* FAB to create activity */}
      <Pressable
        style={styles.fab}
        onPress={() => router.push('/create-activity')}
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>

      {/* Bottom bar: filters + search */}
      <BlurView intensity={80} tint="dark" style={styles.bottomBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContent}
        >
          <Pressable
            style={[styles.filterPill, !selectedSport && styles.filterPillActive]}
            onPress={() => setSelectedSport(null)}
          >
            <Text style={[styles.filterText, !selectedSport && styles.filterTextActive]}>All</Text>
          </Pressable>
          {Object.entries(SPORT_LABELS).map(([key, label]) => (
            <Pressable
              key={key}
              style={[styles.filterPill, selectedSport === key && styles.filterPillActive]}
              onPress={() => setSelectedSport(selectedSport === key ? null : key)}
            >
              <Text style={[styles.filterText, selectedSport === key && styles.filterTextActive]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search activities..."
            placeholderTextColor="#71717a"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </BlurView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    paddingBottom: 4,
  },
  filtersContent: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, gap: 8, flexDirection: 'row' },
  filterPill: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  filterPillActive: { backgroundColor: 'rgba(255,255,255,0.9)' },
  filterText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '600' },
  filterTextActive: { color: '#000' },
  searchContainer: { paddingHorizontal: 16, paddingBottom: 8 },
  searchInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  list: { paddingHorizontal: 16, paddingBottom: 140 },
  card: {
    backgroundColor: '#18181b',
    borderRadius: 16,
    marginTop: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  cardHighlight: { borderColor: '#3b82f6', backgroundColor: '#0c1425' },
  cardImage: { width: '100%', height: 140 },
  cardBody: { padding: 14 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  cardTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#fff', flex: 1 },
  ownerBadge: { fontSize: 9, fontWeight: '700', color: '#f59e0b', backgroundColor: '#422006', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  joinedBadge: { fontSize: 9, fontWeight: '700', color: '#10b981', backgroundColor: '#052e16', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  pendingBadge: { fontSize: 9, fontWeight: '700', color: '#71717a', backgroundColor: '#27272a', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  sportBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  sportBadgeText: { fontSize: 11, fontWeight: '700' },
  cardMeta: { fontSize: 13, color: '#71717a', marginTop: 4 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  cardCreator: { fontSize: 12, color: '#a1a1aa' },
  skillBadge: { backgroundColor: '#27272a', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  skillText: { fontSize: 10, color: '#a1a1aa', fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#fff', marginTop: 12 },
  emptySubtitle: { fontSize: 14, color: '#71717a', marginTop: 4 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 120,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: { fontSize: 28, fontWeight: '300', color: '#000', marginTop: -2 },
})
