import { useCallback, useEffect, useState } from 'react'
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
import { useRouter } from 'expo-router'

import { SPORT_LABELS, SKILL_LABELS } from '@groute/shared'
import { useSession } from '../../lib/AuthProvider'
import { supabase } from '../../lib/supabase'

interface Profile {
  id: string
  display_name: string
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  bio: string | null
  area: string | null
}

interface UserSport {
  id: string
  sport_type: string
  self_reported_level: string
}

export default function ProfileScreen() {
  const { user } = useSession()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [sports, setSports] = useState<UserSport[]>([])
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [activityCount, setActivityCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const fetchProfile = useCallback(async () => {
    if (!user) return

    const [profileResult, sportsResult, followersResult, followingResult, activitiesResult] = await Promise.all([
      supabase
        .from('users')
        .select('id, display_name, first_name, last_name, avatar_url, bio, area')
        .eq('id', user.id)
        .single(),

      supabase
        .from('user_sports')
        .select('id, sport_type, self_reported_level')
        .eq('user_id', user.id),

      supabase
        .from('follows')
        .select('id', { count: 'exact', head: true })
        .eq('following_id', user.id),

      supabase
        .from('follows')
        .select('id', { count: 'exact', head: true })
        .eq('follower_id', user.id),

      supabase
        .from('activities')
        .select('id', { count: 'exact', head: true })
        .eq('creator_id', user.id),
    ])

    setProfile(profileResult.data)
    setSports(sportsResult.data ?? [])
    setFollowerCount(followersResult.count ?? 0)
    setFollowingCount(followingResult.count ?? 0)
    setActivityCount(activitiesResult.count ?? 0)
  }, [user])

  useEffect(() => {
    fetchProfile().finally(() => setIsLoading(false))
  }, [fetchProfile])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.replace('/')
  }

  if (isLoading || !profile) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    )
  }

  const displayName = profile.first_name && profile.last_name
    ? `${profile.first_name} ${profile.last_name}`
    : profile.display_name

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar + name */}
      <View style={styles.header}>
        {profile.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarInitial}>
              {(profile.first_name?.[0] ?? profile.display_name[0]).toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={styles.name}>{displayName}</Text>
        {profile.area && <Text style={styles.area}>{profile.area}</Text>}
        {profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{followerCount}</Text>
          <Text style={styles.statLabel}>Followers</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{followingCount}</Text>
          <Text style={styles.statLabel}>Following</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{activityCount}</Text>
          <Text style={styles.statLabel}>Activities</Text>
        </View>
      </View>

      {/* Sports */}
      {sports.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sports</Text>
          <View style={styles.sportsGrid}>
            {sports.map((s) => (
              <View key={s.id} style={styles.sportCard}>
                <Text style={styles.sportName}>
                  {SPORT_LABELS[s.sport_type] ?? s.sport_type}
                </Text>
                <Text style={styles.sportLevel}>
                  {SKILL_LABELS[s.self_reported_level] ?? s.self_reported_level}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Actions */}
      <View style={styles.section}>
        <Pressable style={styles.editButton} onPress={() => router.push('/edit-profile')}>
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </Pressable>
        <Pressable style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  content: { paddingBottom: 40 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  header: { alignItems: 'center', paddingTop: 24, paddingHorizontal: 24 },
  avatar: { width: 88, height: 88, borderRadius: 44 },
  avatarFallback: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#27272a', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 32, fontWeight: '700', color: '#fff' },
  name: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginTop: 14 },
  area: { fontSize: 14, color: '#71717a', marginTop: 4 },
  bio: { fontSize: 14, color: '#a1a1aa', marginTop: 8, textAlign: 'center', lineHeight: 20 },
  statsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 24, paddingHorizontal: 24 },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '700', color: '#fff' },
  statLabel: { fontSize: 12, color: '#71717a', marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: '#27272a' },
  section: { marginTop: 28, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#71717a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  sportsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sportCard: { backgroundColor: '#18181b', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#27272a', minWidth: '45%' },
  sportName: { fontSize: 14, fontWeight: '600', color: '#fff' },
  sportLevel: { fontSize: 12, color: '#71717a', marginTop: 4 },
  editButton: { backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center' },
  editButtonText: { color: '#000', fontSize: 15, fontWeight: '600' },
  signOutButton: { borderWidth: 1, borderColor: '#3f3f46', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 12 },
  signOutText: { color: '#fff', fontSize: 15, fontWeight: '500' },
})
