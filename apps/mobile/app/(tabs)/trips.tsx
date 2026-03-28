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

import { SPORT_LABELS } from '@groute/shared'
import { useSession } from '../../lib/AuthProvider'
import { supabase } from '../../lib/supabase'

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

  const fetchTrips = useCallback(async () => {
    if (!user) return

    const [createdResult, participatingResult] = await Promise.all([
      supabase
        .from('activities')
        .select('id, title, sport_type, location_name, scheduled_at, max_participants, status')
        .eq('creator_id', user.id)
        .order('scheduled_at', { ascending: false }),

      supabase
        .from('activity_participants')
        .select(`
          status,
          activity:activities!activity_id (
            id, title, sport_type, location_name, scheduled_at, max_participants, status,
            creator:users!creator_id ( display_name, first_name, last_name )
          )
        `)
        .eq('user_id', user.id)
        .order('joined_at', { ascending: false }),
    ])

    // Get pending requests for hosted activities
    const myActivityIds = (createdResult.data ?? []).map((a) => a.id)
    let pendingMap = new Map<string, PendingRequest[]>()

    if (myActivityIds.length > 0) {
      const { data: pendingData } = await supabase
        .from('activity_participants')
        .select(`
          id, activity_id,
          user:users!user_id ( id, display_name, first_name, last_name, area )
        `)
        .eq('status', 'requested')
        .in('activity_id', myActivityIds)

      for (const p of pendingData ?? []) {
        const u = Array.isArray(p.user) ? p.user[0] : p.user
        if (!u) continue
        const list = pendingMap.get(p.activity_id) ?? []
        list.push({
          id: p.id,
          activity_id: p.activity_id,
          user_id: u.id,
          display_name: u.display_name,
          first_name: u.first_name,
          last_name: u.last_name,
          area: u.area,
        })
        pendingMap.set(p.activity_id, list)
      }
    }
    setPendingByActivity(pendingMap)

    const now = new Date()
    const allTrips: Trip[] = []

    // Created
    for (const a of createdResult.data ?? []) {
      allTrips.push({
        ...a,
        role: 'host',
        pendingCount: pendingMap.get(a.id)?.length ?? 0,
      })
    }

    // Participating
    for (const p of participatingResult.data ?? []) {
      const act = Array.isArray(p.activity) ? p.activity[0] : p.activity
      if (!act) continue
      const creator = Array.isArray(act.creator) ? act.creator[0] : act.creator
      const creatorName = creator
        ? creator.first_name && creator.last_name
          ? `${creator.first_name} ${creator.last_name[0]}.`
          : creator.display_name
        : 'Unknown'
      allTrips.push({
        ...act,
        role: 'participant',
        participantStatus: p.status as string,
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
    const { error } = await supabase
      .from('activity_participants')
      .update({ status: 'accepted' })
      .eq('id', participantId)

    if (error) {
      Alert.alert('Error', error.message)
      return
    }

    // Send welcome message
    const req = pendingByActivity.get(activityId)?.find((r) => r.id === participantId)
    if (req) {
      await supabase.from('messages').insert({
        activity_id: activityId,
        sender_id: req.user_id,
        content: 'has joined the activity!',
      })
    }

    await fetchTrips()
  }

  async function handleDecline(participantId: string) {
    const { error } = await supabase
      .from('activity_participants')
      .update({ status: 'declined' })
      .eq('id', participantId)

    if (error) {
      Alert.alert('Error', error.message)
      return
    }
    await fetchTrips()
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
            <Pressable
              style={styles.chatAction}
              onPress={() => router.push(`/chat/${item.id}`)}
            >
              <Text style={styles.chatActionText}>Chat</Text>
            </Pressable>
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
                  <View style={styles.requestInfo}>
                    <Text style={styles.requestName}>{name}</Text>
                    {req.area && <Text style={styles.requestArea}>{req.area}</Text>}
                  </View>
                  <View style={styles.requestActions}>
                    <Pressable
                      style={styles.acceptButton}
                      onPress={() => handleAccept(req.id, item.id)}
                    >
                      <Text style={styles.acceptText}>Accept</Text>
                    </Pressable>
                    <Pressable
                      style={styles.declineButton}
                      onPress={() => handleDecline(req.id)}
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
  chatAction: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  chatActionText: { fontSize: 13, fontWeight: '600', color: '#3b82f6' },

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
