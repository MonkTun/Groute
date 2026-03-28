import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'

import { SPORT_LABELS, SKILL_LABELS } from '@groute/shared'
import { useSession } from '../../lib/AuthProvider'
import { supabase } from '../../lib/supabase'

// ── Shared design tokens ──
const C = {
  bg: '#fafafa',
  card: '#ffffff',
  cardBorder: '#e5e5e5',
  primary: '#0f8a6e',
  primaryMuted: 'rgba(15,138,110,0.1)',
  primaryText: '#0f8a6e',
  text: '#1a1a2e',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  border: '#e5e5e5',
  green: '#047857',
  greenBg: '#d1fae5',
  mutedBg: '#f0f0f0',
}

interface Profile {
  id: string
  display_name: string
  first_name: string | null
  last_name: string | null
  email: string
  avatar_url: string | null
  bio: string | null
  area: string | null
  date_of_birth: string | null
  preferred_language: string | null
  edu_email: string | null
  edu_verified: boolean
  strava_connected: boolean
}

interface UserSport {
  sport_type: string
  self_reported_level: string
  strava_verified_level: string | null
}

export default function ProfileScreen() {
  const { user } = useSession()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [sports, setSports] = useState<UserSport[]>([])
  const [friends, setFriends] = useState<Array<{ id: string; display_name: string; first_name: string | null; last_name: string | null; avatar_url: string | null; area: string | null }>>([])
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [activityCount, setActivityCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const fetchProfile = useCallback(async () => {
    if (!user) return

    const [profileResult, sportsResult, followersResult, followingResult, activitiesResult] = await Promise.all([
      supabase
        .from('users')
        .select('id, display_name, first_name, last_name, email, avatar_url, bio, area, date_of_birth, preferred_language, edu_email, edu_verified, strava_connected')
        .eq('id', user.id)
        .single(),
      supabase
        .from('user_sports')
        .select('sport_type, self_reported_level, strava_verified_level')
        .eq('user_id', user.id),
      supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', user.id),
      supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', user.id),
      supabase.from('activities').select('id', { count: 'exact', head: true }).eq('creator_id', user.id),
    ])

    setProfile(profileResult.data)
    setSports(sportsResult.data ?? [])
    setFollowerCount(followersResult.count ?? 0)
    setFollowingCount(followingResult.count ?? 0)
    setActivityCount(activitiesResult.count ?? 0)

    // Fetch friends (mutual follows)
    const [fwingRes, fwersRes] = await Promise.all([
      supabase.from('follows').select('following_id').eq('follower_id', user.id),
      supabase.from('follows').select('follower_id').eq('following_id', user.id),
    ])
    const followingSet = new Set((fwingRes.data ?? []).map((f) => f.following_id))
    const followerSet = new Set((fwersRes.data ?? []).map((f) => f.follower_id))
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
  }, [user])

  useEffect(() => {
    fetchProfile().finally(() => setIsLoading(false))
  }, [fetchProfile])

  // Refetch when screen gains focus (e.g. returning from edit)
  // Using navigation event from expo-router's useFocusEffect equivalent
  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.replace('/')
  }

  if (isLoading || !profile) {
    return (
      <View style={s.loading}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    )
  }

  const displayName = profile.first_name && profile.last_name
    ? `${profile.first_name} ${profile.last_name}`
    : profile.display_name

  const dob = profile.date_of_birth ? new Date(profile.date_of_birth) : null
  const age = dob
    ? Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Header: avatar + name + edit */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          {profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={s.avatar} />
          ) : (
            <View style={s.avatarFallback}>
              <Text style={s.avatarInitial}>
                {(profile.first_name?.[0] ?? profile.display_name[0]).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={s.headerInfo}>
            <Text style={s.name}>{displayName}</Text>
            <Text style={s.subtitle}>{profile.area ?? profile.email}</Text>
          </View>
        </View>
        <View style={s.headerActions}>
          {profile.edu_verified && (
            <View style={s.verifiedBadge}>
              <Text style={s.verifiedText}>.edu Verified</Text>
            </View>
          )}
          <Pressable style={s.editButton} onPress={() => router.push('/edit-profile')}>
            <Text style={s.editButtonText}>Edit</Text>
          </Pressable>
        </View>
      </View>

      {/* Stats */}
      <View style={s.statsCard}>
        <View style={s.stat}>
          <Text style={s.statValue}>{followerCount}</Text>
          <Text style={s.statLabel}>Followers</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.stat}>
          <Text style={s.statValue}>{followingCount}</Text>
          <Text style={s.statLabel}>Following</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.stat}>
          <Text style={s.statValue}>{activityCount}</Text>
          <Text style={s.statLabel}>Activities</Text>
        </View>
      </View>

      {/* Card: Personal Info */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Personal Info</Text>
        <View style={s.infoGrid}>
          <View style={s.infoItem}>
            <Text style={s.infoLabel}>Name</Text>
            <Text style={s.infoValue}>{displayName}</Text>
          </View>
          <View style={s.infoItem}>
            <Text style={s.infoLabel}>Age</Text>
            <Text style={s.infoValue}>{age ?? '\u2014'}</Text>
          </View>
          <View style={s.infoItem}>
            <Text style={s.infoLabel}>Location</Text>
            <Text style={s.infoValue}>{profile.area ?? '\u2014'}</Text>
          </View>
          <View style={s.infoItem}>
            <Text style={s.infoLabel}>Email</Text>
            <Text style={s.infoValue} numberOfLines={1}>{profile.email}</Text>
          </View>
          {profile.preferred_language ? (
            <View style={s.infoItem}>
              <Text style={s.infoLabel}>Language</Text>
              <Text style={s.infoValue}>{profile.preferred_language}</Text>
            </View>
          ) : null}
          {profile.strava_connected ? (
            <View style={s.infoItem}>
              <Text style={s.infoLabel}>Strava</Text>
              <Text style={[s.infoValue, { color: C.green }]}>Connected</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Card: Activities & Experience */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Activities & Experience</Text>
        {sports.length > 0 ? (
          <View style={s.sportsList}>
            {sports.map((sport) => (
              <View key={sport.sport_type} style={s.sportRow}>
                <Text style={s.sportName}>
                  {SPORT_LABELS[sport.sport_type] ?? sport.sport_type}
                </Text>
                <View style={s.sportBadges}>
                  <View style={s.skillBadge}>
                    <Text style={s.skillBadgeText}>
                      {SKILL_LABELS[sport.self_reported_level] ?? sport.self_reported_level}
                    </Text>
                  </View>
                  {sport.strava_verified_level && (
                    <View style={s.stravaBadge}>
                      <Text style={s.stravaBadgeText}>
                        Strava: {SKILL_LABELS[sport.strava_verified_level]}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={s.emptyText}>No activities added yet.</Text>
        )}
      </View>

      {/* Card: Friends */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Friends ({friends.length})</Text>
        {friends.length > 0 ? (
          <View style={s.friendsList}>
            {friends.map((f) => {
              const fname = f.first_name && f.last_name
                ? `${f.first_name} ${f.last_name}`
                : f.display_name
              return (
                <Pressable key={f.id} style={s.friendRow} onPress={() => router.push(`/dm/${f.id}`)}>
                  {f.avatar_url ? (
                    <Image source={{ uri: f.avatar_url }} style={s.friendAvatar} />
                  ) : (
                    <View style={s.friendAvatarFallback}>
                      <Text style={s.friendInitial}>{(f.first_name?.[0] ?? f.display_name[0]).toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={s.friendInfo}>
                    <Text style={s.friendName}>{fname}</Text>
                    {f.area && <Text style={s.friendArea}>{f.area}</Text>}
                  </View>
                </Pressable>
              )
            })}
          </View>
        ) : (
          <Text style={s.emptyText}>No friends yet. Follow someone and have them follow back!</Text>
        )}
      </View>

      {/* Sign out */}
      <Pressable style={s.signOutButton} onPress={handleSignOut}>
        <Text style={s.signOutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { padding: 20, paddingBottom: 40 },
  loading: { flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  avatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: C.cardBorder },
  avatarFallback: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.primaryMuted, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.cardBorder },
  avatarInitial: { fontSize: 24, fontWeight: '700', color: C.primaryText },
  headerInfo: { flex: 1 },
  name: { fontSize: 20, fontWeight: '700', color: C.text },
  subtitle: { fontSize: 13, color: C.textSecondary, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  verifiedBadge: { backgroundColor: C.greenBg, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  verifiedText: { fontSize: 11, fontWeight: '600', color: C.green },
  editButton: {
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  editButtonText: { fontSize: 13, fontWeight: '600', color: C.text },

  // Stats
  statsCard: {
    flexDirection: 'row',
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 16,
    marginBottom: 16,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '700', color: C.text },
  statLabel: { fontSize: 12, color: C.textSecondary, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: C.border, marginVertical: 4 },

  // Card
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: C.text, marginBottom: 14 },

  // Info grid
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  infoItem: { width: '50%', marginBottom: 14 },
  infoLabel: { fontSize: 13, color: C.textSecondary, marginBottom: 2 },
  infoValue: { fontSize: 14, fontWeight: '500', color: C.text },

  // Sports
  sportsList: { gap: 8 },
  sportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sportName: { fontSize: 14, fontWeight: '500', color: C.text },
  sportBadges: { flexDirection: 'row', gap: 6 },
  skillBadge: { backgroundColor: C.mutedBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  skillBadgeText: { fontSize: 12, color: C.textSecondary },
  stravaBadge: { backgroundColor: C.greenBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  stravaBadgeText: { fontSize: 12, color: C.green },
  emptyText: { fontSize: 14, color: C.textSecondary },

  // Friends
  friendsList: { gap: 8 },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  friendAvatar: { width: 36, height: 36, borderRadius: 18 },
  friendAvatarFallback: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.primaryMuted, alignItems: 'center', justifyContent: 'center' },
  friendInitial: { fontSize: 14, fontWeight: '700', color: C.primary },
  friendInfo: { flex: 1 },
  friendName: { fontSize: 14, fontWeight: '500', color: C.text },
  friendArea: { fontSize: 12, color: C.textSecondary, marginTop: 1 },

  // Sign out
  signOutButton: {
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  signOutText: { color: C.textSecondary, fontSize: 15, fontWeight: '500' },
})
