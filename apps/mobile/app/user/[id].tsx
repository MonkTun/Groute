import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'

import { SPORT_LABELS, SKILL_LABELS } from '@groute/shared'
import { useSession } from '../../lib/AuthProvider'
import { apiFetch, apiPost, apiDelete } from '../../lib/api'

const C = {
  bg: '#fafafa',
  card: '#ffffff',
  primary: '#0f8a6e',
  primaryMuted: 'rgba(15,138,110,0.1)',
  text: '#1a1a2e',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  border: '#e5e5e5',
}

interface UserProfile {
  id: string
  displayName: string
  firstName: string | null
  lastName: string | null
  avatarUrl: string | null
  area: string | null
  preferredLanguage: string | null
  eduEmail: string | null
  createdAt: string
  sports: UserSport[]
  isFollowing: boolean
  mutualFriendCount: number
}

interface UserSport {
  sportType: string
  selfReportedLevel: string
}

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useSession()
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [sports, setSports] = useState<UserSport[]>([])
  const [isFollowing, setIsFollowing] = useState(false)
  const [isMutual, setIsMutual] = useState(false)
  const [mutualFriendCount, setMutualFriendCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const isMe = id === user?.id

  useEffect(() => {
    async function load() {
      if (!user) return

      const { data } = await apiFetch<UserProfile>(`/api/users/${id}`)

      if (data) {
        setProfile(data)
        setSports(data.sports ?? [])
        setIsFollowing(data.isFollowing ?? false)
        setIsMutual(data.isFollowing && data.mutualFriendCount > 0)
        setMutualFriendCount(data.mutualFriendCount ?? 0)
      }

      setIsLoading(false)
    }
    load()
  }, [id, user])

  async function handleFollow() {
    if (!user) return
    await apiPost('/api/follow', { followingId: id })
    setIsFollowing(true)
  }

  async function handleUnfollow() {
    if (!user) return
    await apiDelete('/api/follow', { followingId: id })
    setIsFollowing(false)
    setIsMutual(false)
  }

  if (isLoading || !profile) {
    return (
      <View style={s.loading}>
        <Stack.Screen options={{ title: '' }} />
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    )
  }

  const fullName = profile.firstName && profile.lastName
    ? `${profile.firstName} ${profile.lastName}`
    : profile.displayName

  const joinedDate = new Date(profile.createdAt).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <ScrollView style={s.container}>
      <Stack.Screen options={{ title: fullName, headerBackTitle: 'Back' }} />

      {/* Header */}
      <View style={s.header}>
        {profile.avatarUrl ? (
          <Image source={{ uri: profile.avatarUrl }} style={s.avatar} />
        ) : (
          <View style={s.avatarFallback}>
            <Text style={s.avatarInitial}>{(profile.firstName?.[0] ?? profile.displayName[0]).toUpperCase()}</Text>
          </View>
        )}
        <Text style={s.name}>{fullName}</Text>
        {profile.area && <Text style={s.area}>{profile.area}</Text>}

        <View style={s.statsRow}>
          {mutualFriendCount > 0 && (
            <Text style={s.stat}>{mutualFriendCount} mutual friend{mutualFriendCount !== 1 ? 's' : ''}</Text>
          )}
          {profile.eduEmail && (
            <View style={s.verifiedBadge}>
              <Text style={s.verifiedText}>.edu verified</Text>
            </View>
          )}
        </View>

        <Text style={s.joined}>Joined {joinedDate}</Text>
      </View>

      {/* Actions */}
      {!isMe && (
        <View style={s.actions}>
          {isFollowing ? (
            <Pressable style={s.followingBtn} onPress={handleUnfollow}>
              <Text style={s.followingBtnText}>{isMutual ? 'Friends' : 'Following'}</Text>
            </Pressable>
          ) : (
            <Pressable style={s.followBtn} onPress={handleFollow}>
              <Text style={s.followBtnText}>Follow</Text>
            </Pressable>
          )}
          {isMutual && (
            <Pressable style={s.messageBtn} onPress={() => router.push(`/dm/${id}`)}>
              <Text style={s.messageBtnText}>Message</Text>
            </Pressable>
          )}
        </View>
      )}

      {isMe && (
        <View style={s.actions}>
          <Pressable style={s.editBtn} onPress={() => router.push('/edit-profile')}>
            <Text style={s.editBtnText}>Edit Profile</Text>
          </Pressable>
        </View>
      )}

      {/* Sports */}
      {sports.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Activities</Text>
          <View style={s.sportsGrid}>
            {sports.map((sp) => (
              <View key={sp.sportType} style={s.sportCard}>
                <Text style={s.sportName}>{SPORT_LABELS[sp.sportType] ?? sp.sportType}</Text>
                <Text style={s.sportLevel}>{SKILL_LABELS[sp.selfReportedLevel] ?? sp.selfReportedLevel}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Info */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>About</Text>
        <View style={s.infoCard}>
          {profile.area && (
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Location</Text>
              <Text style={s.infoValue}>{profile.area}</Text>
            </View>
          )}
          {profile.preferredLanguage && (
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Language</Text>
              <Text style={s.infoValue}>{profile.preferredLanguage}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },

  header: { alignItems: 'center', paddingTop: 24, paddingBottom: 16, paddingHorizontal: 20 },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarFallback: { width: 96, height: 96, borderRadius: 48, backgroundColor: C.primaryMuted, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 36, fontWeight: '700', color: C.primary },
  name: { fontSize: 22, fontWeight: '700', color: C.text, marginTop: 14 },
  area: { fontSize: 14, color: C.textSecondary, marginTop: 4 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  stat: { fontSize: 13, color: C.textMuted },
  verifiedBadge: { backgroundColor: '#dbeafe', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  verifiedText: { fontSize: 11, fontWeight: '600', color: '#2563eb' },
  joined: { fontSize: 12, color: C.textMuted, marginTop: 6 },

  actions: { flexDirection: 'row', justifyContent: 'center', gap: 10, paddingHorizontal: 20, paddingBottom: 20 },
  followBtn: { backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 28, paddingVertical: 10 },
  followBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  followingBtn: { backgroundColor: '#f0f0f0', borderRadius: 10, paddingHorizontal: 28, paddingVertical: 10 },
  followingBtnText: { fontSize: 15, fontWeight: '600', color: C.textSecondary },
  messageBtn: { backgroundColor: C.primaryMuted, borderRadius: 10, paddingHorizontal: 28, paddingVertical: 10 },
  messageBtnText: { fontSize: 15, fontWeight: '600', color: C.primary },
  editBtn: { backgroundColor: '#f0f0f0', borderRadius: 10, paddingHorizontal: 28, paddingVertical: 10 },
  editBtnText: { fontSize: 15, fontWeight: '600', color: C.text },

  section: { paddingHorizontal: 20, marginTop: 8 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  sportsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sportCard: { backgroundColor: C.card, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: C.border },
  sportName: { fontSize: 14, fontWeight: '600', color: C.text },
  sportLevel: { fontSize: 12, color: C.textMuted, marginTop: 2 },

  infoCard: { backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f0f0f0' },
  infoLabel: { fontSize: 14, color: C.textMuted },
  infoValue: { fontSize: 14, fontWeight: '500', color: C.text },
})
