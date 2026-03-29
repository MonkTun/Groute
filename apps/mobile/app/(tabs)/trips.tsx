import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'

import ConfettiCannon from 'react-native-confetti-cannon'

import { SPORT_LABELS } from '@groute/shared'
import { useSession } from '../../lib/AuthProvider'
import { apiFetch, apiPatch, apiPost, apiDelete } from '../../lib/api'

interface Trip {
  id: string
  title: string
  sport_type: string
  location_name: string
  scheduled_at: string
  max_participants: number
  role: 'host' | 'participant'
  participantStatus?: string
  creatorName?: string
  pendingCount: number
}

interface PendingRequest {
  id: string
  activity_id: string
  user_id: string
  display_name: string
  first_name: string | null
  last_name: string | null
  area: string | null
}

export default function TripsScreen() {
  const { user } = useSession()
  const router = useRouter()
  const [upcoming, setUpcoming] = useState<Trip[]>([])
  const [past, setPast] = useState<Trip[]>([])
  const [pendingByActivity, setPendingByActivity] = useState<Map<string, PendingRequest[]>>(new Map())
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)

  const fetchTrips = useCallback(async () => {
    if (!user) return

    const { data, error } = await apiFetch<{
      created: Array<{
        id: string; title: string; sport_type: string; location_name: string
        scheduled_at: string; max_participants: number; status: string
      }>
      participating: Array<{
        id: string; title: string; sport_type: string; location_name: string
        scheduled_at: string; max_participants: number; status: string
        participantStatus: string
        creator: { id: string; display_name: string; first_name: string | null; last_name: string | null } | null
      }>
      pendingRequests: Array<{
        id: string; user_id: string; activity_id: string; status: string; joined_at: string
        user: { id: string; display_name: string; first_name: string | null; last_name: string | null; avatar_url: string | null } | null
        activity: { id: string; title: string; sport_type: string } | null
      }>
    }>('/api/trips')

    if (error || !data) return

    // Build pending requests map
    const pendingMap = new Map<string, PendingRequest[]>()
    for (const p of data.pendingRequests) {
      if (!p.user) continue
      const list = pendingMap.get(p.activity_id) ?? []
      list.push({
        id: p.id,
        activity_id: p.activity_id,
        user_id: p.user.id,
        display_name: p.user.display_name,
        first_name: p.user.first_name,
        last_name: p.user.last_name,
        area: null,
      })
      pendingMap.set(p.activity_id, list)
    }
    setPendingByActivity(pendingMap)

    const now = new Date()
    const allTrips: Trip[] = []

    // Created
    for (const a of data.created) {
      allTrips.push({
        ...a,
        role: 'host',
        pendingCount: pendingMap.get(a.id)?.length ?? 0,
      })
    }

    // Participating
    for (const p of data.participating) {
      const creator = p.creator
      const creatorName = creator
        ? creator.first_name && creator.last_name
          ? `${creator.first_name} ${creator.last_name[0]}.`
          : creator.display_name
        : 'Unknown'
      allTrips.push({
        id: p.id,
        title: p.title,
        sport_type: p.sport_type,
        location_name: p.location_name,
        scheduled_at: p.scheduled_at,
        max_participants: p.max_participants,
        role: 'participant',
        participantStatus: p.participantStatus,
        creatorName,
        pendingCount: 0,
      })
    }

    setUpcoming(allTrips.filter((t) => new Date(t.scheduled_at) >= now))
    setPast(allTrips.filter((t) => new Date(t.scheduled_at) < now))
  }, [user])

  useEffect(() => {
    fetchTrips().finally(() => setIsLoading(false))
  }, [fetchTrips])

  async function handleRefresh() {
    setIsRefreshing(true)
    await fetchTrips()
    setIsRefreshing(false)
  }

  async function handleAccept(participantId: string, activityId: string) {
    const { error } = await apiPatch(`/api/activities/${activityId}/participants/${participantId}`, { status: 'accepted' })

    if (error) {
      Alert.alert('Error', error)
      return
    }

    setShowConfetti(true)
    await fetchTrips()
  }

  async function handleDecline(participantId: string, activityId: string) {
    const { error } = await apiPatch(`/api/activities/${activityId}/participants/${participantId}`, { status: 'declined' })

    if (error) {
      Alert.alert('Error', error)
      return
    }
    await fetchTrips()
  }

  function handleLeave(activityId: string) {
    Alert.alert('Leave Activity', 'Are you sure you want to leave?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave', style: 'destructive',
        onPress: async () => {
          await apiPost(`/api/activities/${activityId}/leave`, {})
          await fetchTrips()
        },
      },
    ])
  }

  function handleDeleteActivity(activityId: string) {
    Alert.alert('Delete Activity', 'This will remove the activity for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await apiDelete(`/api/activities/${activityId}`)
          await fetchTrips()
        },
      },
    ])
  }

  function renderTrip({ item, isPast }: { item: Trip; isPast?: boolean }) {
    const scheduled = new Date(item.scheduled_at)
    const dateStr = scheduled.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    })
    const timeStr = scheduled.toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit',
    })

    const isExpanded = expandedActivity === item.id
    const pending = pendingByActivity.get(item.id) ?? []

    return (
      <View style={[styles.card, isPast && styles.cardPast]}>
        <Pressable
          style={styles.cardMain}
          onPress={() => router.push(`/activity/${item.id}`)}
        >
          <View style={styles.cardTop}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
              {item.role === 'host' ? (
                <View style={styles.hostBadge}>
                  <Text style={styles.hostBadgeText}>HOST</Text>
                </View>
              ) : item.participantStatus === 'accepted' ? (
                <View style={styles.goingBadge}>
                  <Text style={styles.goingBadgeText}>GOING</Text>
                </View>
              ) : (
                <View style={styles.requestedBadge}>
                  <Text style={styles.requestedBadgeText}>REQUESTED</Text>
                </View>
              )}
            </View>
            <View style={styles.sportTag}>
              <Text style={styles.sportTagText}>
                {SPORT_LABELS[item.sport_type] ?? item.sport_type}
              </Text>
            </View>
          </View>

          <Text style={styles.meta}>{dateStr} at {timeStr}</Text>
          <Text style={styles.meta} numberOfLines={1}>{item.location_name}</Text>

          {item.role === 'participant' && item.creatorName && (
            <Text style={styles.hostedBy}>Hosted by {item.creatorName}</Text>
          )}
        </Pressable>

        {/* Actions */}
        {!isPast && (
          <View style={styles.cardActions}>
            <Pressable style={styles.actionBtn} onPress={() => router.push(`/chat/${item.id}`)}>
              <Text style={styles.actionBtnText}>Chat</Text>
            </Pressable>
            {item.role === 'host' ? (
              <>
                <View style={styles.actionDivider} />
                <Pressable style={styles.actionBtn} onPress={() => router.push(`/edit-activity?id=${item.id}`)}>
                  <Text style={styles.actionBtnText}>Edit</Text>
                </Pressable>
                <View style={styles.actionDivider} />
                <Pressable style={styles.actionBtn} onPress={() => handleDeleteActivity(item.id)}>
                  <Text style={styles.actionBtnTextDanger}>Delete</Text>
                </Pressable>
              </>
            ) : (
              <>
                <View style={styles.actionDivider} />
                <Pressable style={styles.actionBtn} onPress={() => handleLeave(item.id)}>
                  <Text style={styles.actionBtnTextDanger}>Leave</Text>
                </Pressable>
              </>
            )}
          </View>
        )}

        {/* Pending requests (host only) */}
        {item.role === 'host' && pending.length > 0 && !isPast && (
          <View style={styles.pendingSection}>
            <Pressable
              style={styles.pendingHeader}
              onPress={() => setExpandedActivity(isExpanded ? null : item.id)}
            >
              <Text style={styles.pendingHeaderText}>
                {pending.length} pending {pending.length === 1 ? 'request' : 'requests'}
              </Text>
              <Text style={styles.chevron}>{isExpanded ? '\u25B2' : '\u25BC'}</Text>
            </Pressable>

            {isExpanded && pending.map((req) => {
              const name = req.first_name && req.last_name
                ? `${req.first_name} ${req.last_name}`
                : req.display_name
              return (
                <View key={req.id} style={styles.requestRow}>
                  <Pressable style={styles.requestInfo} onPress={() => router.push(`/user/${req.user_id}`)}>
                    <Text style={styles.requestName}>{name}</Text>
                    {req.area && <Text style={styles.requestArea}>{req.area}</Text>}
                  </Pressable>
                  <View style={styles.requestActions}>
                    <Pressable
                      style={styles.acceptButton}
                      onPress={() => handleAccept(req.id, item.id)}
                    >
                      <Text style={styles.acceptText}>Accept</Text>
                    </Pressable>
                    <Pressable
                      style={styles.declineButton}
                      onPress={() => handleDecline(req.id, item.id)}
                    >
                      <Text style={styles.declineText}>Decline</Text>
                    </Pressable>
                  </View>
                </View>
              )
            })}
          </View>
        )}
      </View>
    )
  }

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#0f8a6e" />
      </View>
    )
  }

  const sections = [
    ...(upcoming.length > 0 ? [{ title: 'Upcoming', data: upcoming, isPast: false }] : []),
    ...(past.length > 0 ? [{ title: 'Past', data: past, isPast: true }] : []),
  ]

  if (sections.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyEmoji}>{'\u{1F3D5}'}</Text>
        <Text style={styles.emptyTitle}>No trips yet</Text>
        <Text style={styles.emptySubtitle}>Create or join an activity from the Discover tab.</Text>
      </View>
    )
  }

  return (
    <>
    <SectionList
      style={styles.container}
      sections={sections}
      keyExtractor={(item) => `${item.role}-${item.id}`}
      renderItem={({ item, section }) => renderTrip({ item, isPast: section.isPast })}
      renderSectionHeader={({ section }) => (
        <Text style={styles.sectionHeader}>{section.title}</Text>
      )}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#0f8a6e" />
      }
      stickySectionHeadersEnabled={false}
    />
    {showConfetti && <ConfettiCannon count={80} origin={{ x: -10, y: 0 }} fadeOut autoStart />}
    </>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fafafa' },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 20,
    marginBottom: 8,
  },

  // Card
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    marginBottom: 10,
    overflow: 'hidden',
  },
  cardPast: { opacity: 0.5 },
  cardMain: { padding: 14 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  cardTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a2e', flex: 1 },
  hostBadge: { backgroundColor: '#fef3c7', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  hostBadgeText: { fontSize: 9, fontWeight: '700', color: '#b45309' },
  goingBadge: { backgroundColor: '#d1fae5', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  goingBadgeText: { fontSize: 9, fontWeight: '700', color: '#047857' },
  requestedBadge: { backgroundColor: '#f0f0f0', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  requestedBadgeText: { fontSize: 9, fontWeight: '700', color: '#6b7280' },
  sportTag: { backgroundColor: '#f0f0f0', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  sportTagText: { fontSize: 11, fontWeight: '700', color: '#6b7280' },
  meta: { fontSize: 13, color: '#9ca3af', marginTop: 4 },
  hostedBy: { fontSize: 11, color: '#6b7280', marginTop: 6 },

  // Actions
  cardActions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#e5e5e5' },
  actionBtn: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  actionBtnText: { fontSize: 13, fontWeight: '600', color: '#3b82f6' },
  actionBtnTextDanger: { fontSize: 13, fontWeight: '600', color: '#dc2626' },
  actionDivider: { width: 1, backgroundColor: '#e5e5e5' },

  // Pending requests
  pendingSection: { borderTopWidth: 1, borderTopColor: '#e5e5e5' },
  pendingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10 },
  pendingHeaderText: { fontSize: 12, fontWeight: '600', color: '#b45309' },
  chevron: { fontSize: 10, color: '#9ca3af' },
  requestRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#e5e5e5' },
  requestInfo: { flex: 1 },
  requestName: { fontSize: 14, fontWeight: '600', color: '#1a1a2e' },
  requestArea: { fontSize: 12, color: '#9ca3af', marginTop: 1 },
  requestActions: { flexDirection: 'row', gap: 8 },
  acceptButton: { backgroundColor: '#d1fae5', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  acceptText: { fontSize: 12, fontWeight: '600', color: '#047857' },
  declineButton: { backgroundColor: '#fecaca', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  declineText: { fontSize: 12, fontWeight: '600', color: '#dc2626' },

  // Empty
  empty: { flex: 1, backgroundColor: '#fafafa', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#1a1a2e', marginTop: 12 },
  emptySubtitle: { fontSize: 14, color: '#9ca3af', marginTop: 4, textAlign: 'center' },
})
