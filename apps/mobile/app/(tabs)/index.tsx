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

import { SPORT_LABELS, SKILL_LABELS } from '@groute/shared'
import { useSession } from '../../lib/AuthProvider'
import { apiFetch } from '../../lib/api'
import FloatingActionButton from '../../components/FloatingActionButton'
import SearchBar from '../../components/SearchBar'

const C = {
  bg: '#fafafa',
  card: '#ffffff',
  cardBorder: '#e5e5e5',
  primary: '#0f8a6e',
  primaryMuted: 'rgba(15,138,110,0.1)',
  text: '#1a1a2e',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  amber: '#b45309',
  green: '#047857',
}

interface Activity {
  id: string
  title: string
  description: string | null
  sport_type: string
  skill_level: string
  banner_url: string | null
  creator_id: string
  location_name: string
  scheduled_at: string
  max_participants: number
  creator: {
    display_name: string
    first_name: string | null
    last_name: string | null
    avatar_url: string | null
  } | null
  participantCount: number
}

const SPORT_EMOJIS: Record<string, string> = {
  hiking: '\u{1F97E}',
  trail_running: '\u{1F3C3}',
}

export default function RightNowScreen() {
  const { user } = useSession()
  const router = useRouter()
  const [activities, setActivities] = useState<Activity[]>([])
  const [userSports, setUserSports] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const fetchData = useCallback(async () => {
    if (!user) return

    const now = new Date()
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000)

    const [activitiesResult, profileResult] = await Promise.all([
      apiFetch<Array<{
        id: string
        title: string
        description: string | null
        sport_type: string
        skill_level: string
        banner_url: string | null
        creator_id: string
        location_name: string
        scheduled_at: string
        max_participants: number
        participant_count: number
        creator: {
          display_name: string
          first_name: string | null
          last_name: string | null
          avatar_url: string | null
        } | null
      }>>('/api/activities'),

      apiFetch<{
        sports: Array<{ sport_type: string }>
      }>('/api/profile'),
    ])

    setUserSports(new Set((profileResult.data?.sports ?? []).map((s) => s.sport_type)))

    // Filter to 48h window client-side (API returns all open future activities)
    const allActivities = activitiesResult.data ?? []
    const within48h = allActivities
      .filter((a) => new Date(a.scheduled_at) <= in48h)
      .slice(0, 20)

    setActivities(
      within48h.map((a) => ({
        ...a,
        creator: Array.isArray(a.creator) ? a.creator[0] ?? null : a.creator,
        participantCount: a.participant_count,
      }))
    )
  }, [user])

  useEffect(() => {
    fetchData().finally(() => setIsLoading(false))
  }, [fetchData])

  async function handleRefresh() {
    setIsRefreshing(true)
    await fetchData()
    setIsRefreshing(false)
  }

  if (isLoading) {
    return (
      <View style={s.loading}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    )
  }

  const now = new Date()
  const in6h = new Date(now.getTime() + 6 * 60 * 60 * 1000)

  // Filter by search
  const filtered = searchQuery.trim()
    ? activities.filter((a) => {
        const q = searchQuery.toLowerCase()
        return (
          a.title.toLowerCase().includes(q) ||
          a.location_name.toLowerCase().includes(q) ||
          (SPORT_LABELS[a.sport_type] ?? a.sport_type).toLowerCase().includes(q)
        )
      })
    : activities

  const happeningSoon = filtered.filter((a) => new Date(a.scheduled_at) <= in6h)
  const upcoming = filtered.filter((a) => new Date(a.scheduled_at) > in6h)
  const forYou = searchQuery ? [] : filtered.filter((a) => userSports.has(a.sport_type)).slice(0, 6)

  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  type Section = { type: 'header' } | { type: 'search' } | { type: 'section-title'; title: string; dot?: boolean; icon?: string } | { type: 'activity'; activity: Activity; featured?: boolean } | { type: 'cta' } | { type: 'empty' }

  const sections: Section[] = [{ type: 'header' }, { type: 'search' }]

  if (happeningSoon.length > 0) {
    sections.push({ type: 'section-title', title: 'Happening Soon', dot: true })
    happeningSoon.forEach((a) => sections.push({ type: 'activity', activity: a, featured: true }))
  }

  if (forYou.length > 0) {
    sections.push({ type: 'section-title', title: 'For You', icon: '\u2728' })
    forYou.forEach((a) => sections.push({ type: 'activity', activity: a }))
  }

  if (upcoming.length > 0) {
    sections.push({ type: 'section-title', title: 'Coming Up' })
    upcoming.forEach((a) => sections.push({ type: 'activity', activity: a }))
  }

  if (filtered.length === 0) {
    sections.push({ type: 'empty' })
  }

  sections.push({ type: 'cta' })

  return (
    <View style={s.container}>
    <FlatList
      style={s.list}
      data={sections}
      keyExtractor={(_, i) => String(i)}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={C.primary} />}
      renderItem={({ item }) => {
        if (item.type === 'header') {
          return (
            <View style={s.header}>
              <Text style={s.greeting}>{greeting}</Text>
              <Text style={s.subtitle}>Here&apos;s what&apos;s happening around you</Text>
            </View>
          )
        }

        if (item.type === 'search') {
          return (
            <SearchBar
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          )
        }

        if (item.type === 'section-title') {
          return (
            <View style={s.sectionHeader}>
              {item.dot && <View style={s.liveDot} />}
              {item.icon && <Text style={s.sectionIcon}>{item.icon}</Text>}
              <Text style={s.sectionTitle}>{item.title}</Text>
            </View>
          )
        }

        if (item.type === 'activity') {
          return renderCard(item.activity, item.featured)
        }

        if (item.type === 'cta') {
          return (
            <Pressable style={s.ctaButton} onPress={() => router.push('/(tabs)/explore')}>
              <Text style={s.ctaText}>Explore the map</Text>
            </Pressable>
          )
        }

        if (item.type === 'empty') {
          return (
            <View style={s.empty}>
              <Text style={s.emptyEmoji}>{'\u{1F3D4}'}</Text>
              <Text style={s.emptyTitle}>Nothing happening right now</Text>
              <Text style={s.emptySubtitle}>Check back later or explore the map to find activities.</Text>
            </View>
          )
        }

        return null
      }}
    />
    <FloatingActionButton />
    </View>
  )

  function renderCard(activity: Activity, featured?: boolean) {
    const scheduled = new Date(activity.scheduled_at)
    const dateStr = scheduled.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    const timeStr = scheduled.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    const creatorName = activity.creator
      ? activity.creator.first_name && activity.creator.last_name
        ? `${activity.creator.first_name} ${activity.creator.last_name[0]}.`
        : activity.creator.display_name
      : 'Unknown'
    const spotsLeft = activity.max_participants - activity.participantCount

    return (
      <Pressable
        style={s.card}
        onPress={() => router.push(`/activity/${activity.id}`)}
      >
        {activity.banner_url ? (
          <Image source={{ uri: activity.banner_url }} style={featured ? s.cardImageFeatured : s.cardImage} />
        ) : (
          <View style={[s.cardImageFallback, featured && s.cardImageFeatured]}>
            <Text style={s.cardEmoji}>{SPORT_EMOJIS[activity.sport_type] ?? '\u{1F3DE}'}</Text>
          </View>
        )}
        <View style={s.cardBody}>
          <View style={s.cardTitleRow}>
            <Text style={s.cardTitle} numberOfLines={1}>{activity.title}</Text>
            <View style={s.sportBadge}>
              <Text style={s.sportBadgeText}>{SPORT_LABELS[activity.sport_type] ?? activity.sport_type}</Text>
            </View>
          </View>

          {featured && activity.description && (
            <Text style={s.cardDesc} numberOfLines={2}>{activity.description}</Text>
          )}

          <Text style={s.cardMeta}>{dateStr}, {timeStr}</Text>
          <Text style={s.cardMeta} numberOfLines={1}>{activity.location_name}</Text>

          <View style={s.cardFooter}>
            <View style={s.cardFooterLeft}>
              {activity.creator?.avatar_url ? (
                <Image source={{ uri: activity.creator.avatar_url }} style={s.miniAvatar} />
              ) : (
                <View style={s.miniAvatarFallback}>
                  <Text style={s.miniAvatarText}>{creatorName[0].toUpperCase()}</Text>
                </View>
              )}
              <Text style={s.goingText}>{activity.participantCount}/{activity.max_participants}</Text>
              {spotsLeft > 0 && spotsLeft <= 3 && (
                <View style={s.spotsLeftBadge}>
                  <Text style={s.spotsLeftText}>{spotsLeft} left</Text>
                </View>
              )}
            </View>
            <View style={s.skillBadge}>
              <Text style={s.skillText}>{SKILL_LABELS[activity.skill_level] ?? activity.skill_level}</Text>
            </View>
          </View>
        </View>
      </Pressable>
    )
  }
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  list: { flex: 1 },
  loading: { flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' },

  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  greeting: { fontSize: 26, fontWeight: '700', color: C.text },
  subtitle: { fontSize: 14, color: C.textSecondary, marginTop: 4 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.green },
  sectionIcon: { fontSize: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: C.text },

  card: {
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    overflow: 'hidden',
  },
  cardImage: { width: '100%', height: 110 },
  cardImageFeatured: { width: '100%', height: 150 },
  cardImageFallback: { width: '100%', height: 110, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' },
  cardEmoji: { fontSize: 32 },
  cardBody: { padding: 14 },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: C.text, flex: 1 },
  sportBadge: { backgroundColor: C.primaryMuted, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  sportBadgeText: { fontSize: 10, fontWeight: '700', color: C.primary },
  cardDesc: { fontSize: 12, color: C.textSecondary, marginTop: 6, lineHeight: 17 },
  cardMeta: { fontSize: 12, color: C.textMuted, marginTop: 4 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  cardFooterLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  miniAvatar: { width: 20, height: 20, borderRadius: 10 },
  miniAvatarFallback: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#e5e5e5', alignItems: 'center', justifyContent: 'center' },
  miniAvatarText: { fontSize: 9, fontWeight: '700', color: '#1a1a2e' },
  goingText: { fontSize: 11, color: C.textSecondary },
  spotsLeftBadge: { backgroundColor: '#fef3c7', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  spotsLeftText: { fontSize: 9, fontWeight: '700', color: C.amber },
  skillBadge: { backgroundColor: '#f0f0f0', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  skillText: { fontSize: 10, color: C.textSecondary, fontWeight: '600' },

  ctaButton: {
    alignSelf: 'center',
    backgroundColor: C.primaryMuted,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 12,
    marginBottom: 32,
  },
  ctaText: { fontSize: 14, fontWeight: '600', color: C.primary },

  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: C.text, marginTop: 12 },
  emptySubtitle: { fontSize: 14, color: C.textMuted, marginTop: 4, textAlign: 'center' },
})
