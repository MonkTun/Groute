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
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system'
import { decode } from 'base64-arraybuffer'
import ConfettiCannon from 'react-native-confetti-cannon'

import { SPORT_LABELS, SKILL_LABELS, VISIBILITY_LABELS } from '@groute/shared'
import { useSession } from '../../lib/AuthProvider'
import { supabase } from '../../lib/supabase'

interface ActivityDetail {
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
    area: string | null
  } | null
}

interface Participant {
  id: string
  status: string
  user: {
    id: string
    display_name: string
    first_name: string | null
    last_name: string | null
    avatar_url: string | null
  } | null
}

export default function ActivityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useSession()
  const router = useRouter()
  const [activity, setActivity] = useState<ActivityDetail | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [myStatus, setMyStatus] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isJoining, setIsJoining] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [isUploadingBanner, setIsUploadingBanner] = useState(false)
  const [bannerUrl, setBannerUrl] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const [actResult, partResult, myPartResult] = await Promise.all([
        supabase
          .from('activities')
          .select(`
            *, creator:users!creator_id ( id, display_name, first_name, last_name, avatar_url, area )
          `)
          .eq('id', id)
          .single(),

        supabase
          .from('activity_participants')
          .select(`
            id, status,
            user:users!user_id ( id, display_name, first_name, last_name, avatar_url )
          `)
          .eq('activity_id', id)
          .eq('status', 'accepted'),

        user
          ? supabase
              .from('activity_participants')
              .select('status')
              .eq('activity_id', id)
              .eq('user_id', user.id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ])

      if (actResult.data) {
        const a = actResult.data
        setActivity({
          ...a,
          creator: Array.isArray(a.creator) ? a.creator[0] ?? null : a.creator,
        })
        setBannerUrl(a.banner_url)
      }
      setParticipants(
        (partResult.data ?? []).map((p) => ({
          ...p,
          user: Array.isArray(p.user) ? p.user[0] ?? null : p.user,
        }))
      )
      setMyStatus(myPartResult.data?.status ?? null)
      setIsLoading(false)
    }
    load()
  }, [id, user])

  async function handleJoin() {
    setIsJoining(true)
    const { data, error } = await supabase
      .from('activity_participants')
      .insert({ activity_id: id, user_id: user!.id })
      .select('status')
      .single()

    if (error) {
      Alert.alert('Error', error.message)
    } else {
      setMyStatus(data.status)
      if (data.status === 'accepted') {
        setShowConfetti(true)
        Alert.alert('Joined!', 'You have joined this activity.')
      } else {
        Alert.alert('Requested', 'Your request has been sent to the host.')
      }
    }
    setIsJoining(false)
  }

  async function handleDelete() {
    Alert.alert('Delete Activity', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('activities').delete().eq('id', id)
          router.back()
        },
      },
    ])
  }

  async function handleUploadBanner() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
      base64: true,
    })

    if (result.canceled || !result.assets[0]) return

    const asset = result.assets[0]
    setIsUploadingBanner(true)

    try {
      const ext = asset.uri.split('.').pop() ?? 'jpg'
      const filePath = `activity-photos/${id}.${ext}`
      const mimeType = asset.mimeType ?? 'image/jpeg'

      const base64 = asset.base64
        ?? await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        })

      const { error: uploadError } = await supabase.storage
        .from('activity-photos')
        .upload(filePath, decode(base64), {
          upsert: true,
          contentType: mimeType,
        })

      if (uploadError) {
        Alert.alert('Error', uploadError.message)
        setIsUploadingBanner(false)
        return
      }

      const { data: { publicUrl } } = supabase.storage.from('activity-photos').getPublicUrl(filePath)
      const freshUrl = `${publicUrl}?t=${Date.now()}`

      await supabase
        .from('activities')
        .update({ banner_url: freshUrl })
        .eq('id', id)

      setBannerUrl(freshUrl)
    } catch {
      Alert.alert('Error', 'Failed to upload photo')
    }
    setIsUploadingBanner(false)
  }

  if (isLoading || !activity) {
    return (
      <View style={styles.loading}>
        <Stack.Screen options={{ title: '' }} />
        <ActivityIndicator size="large" color="#0f8a6e" />
      </View>
    )
  }

  const creator = activity.creator
  const isCreator = activity.creator_id === user?.id
  const creatorName = creator
    ? creator.first_name && creator.last_name
      ? `${creator.first_name} ${creator.last_name}`
      : creator.display_name
    : 'Unknown'

  const scheduled = new Date(activity.scheduled_at)
  const dateStr = scheduled.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })
  const timeStr = scheduled.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit',
  })

  const goingCount = participants.length + 1

  return (
    <>
    <ScrollView style={styles.container}>
      <Stack.Screen options={{ title: activity.title, headerBackTitle: 'Back' }} />

      {/* Banner */}
      <View>
        {bannerUrl ? (
          <Image source={{ uri: bannerUrl }} style={styles.banner} />
        ) : (
          <View style={styles.bannerFallback}>
            <Text style={styles.bannerEmoji}>{'\u{1F3DE}'}</Text>
          </View>
        )}
        {isCreator && (
          <Pressable
            style={styles.bannerEditButton}
            onPress={handleUploadBanner}
            disabled={isUploadingBanner}
          >
            {isUploadingBanner ? (
              <ActivityIndicator size="small" color="#0f8a6e" />
            ) : (
              <Text style={styles.bannerEditText}>
                {bannerUrl ? 'Change photo' : 'Add photo'}
              </Text>
            )}
          </Pressable>
        )}
      </View>

      <View style={styles.body}>
        {/* Title + sport */}
        <View style={styles.titleRow}>
          <Text style={styles.title}>{activity.title}</Text>
          <View style={styles.sportTag}>
            <Text style={styles.sportTagText}>
              {SPORT_LABELS[activity.sport_type] ?? activity.sport_type}
            </Text>
          </View>
        </View>

        {activity.description && (
          <Text style={styles.description}>{activity.description}</Text>
        )}

        {/* Details */}
        <View style={styles.detailsGrid}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>When</Text>
            <Text style={styles.detailValue}>{dateStr}, {timeStr}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Where</Text>
            <Text style={styles.detailValue} numberOfLines={1}>{activity.location_name}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Going</Text>
            <Text style={styles.detailValue}>{goingCount} / {activity.max_participants}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Level</Text>
            <Text style={styles.detailValue}>{SKILL_LABELS[activity.skill_level] ?? activity.skill_level}</Text>
          </View>
        </View>

        {/* Host */}
        <Pressable style={styles.hostCard} onPress={() => creator && router.push(`/user/${creator.id}`)}>
          {creator?.avatar_url ? (
            <Image source={{ uri: creator.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial}>
                {(creator?.first_name?.[0] ?? creator?.display_name[0] ?? '?').toUpperCase()}
              </Text>
            </View>
          )}
          <View>
            <Text style={styles.hostName}>{creatorName}</Text>
            <Text style={styles.hostLabel}>Organizer</Text>
          </View>
        </Pressable>

        {/* Members */}
        <Text style={styles.sectionTitle}>Going ({goingCount})</Text>
        {participants.map((p) => {
          if (!p.user) return null
          const name = p.user.first_name && p.user.last_name
            ? `${p.user.first_name} ${p.user.last_name}`
            : p.user.display_name
          return (
            <Pressable key={p.id} style={styles.memberRow} onPress={() => router.push(`/user/${p.user!.id}`)}>
              {p.user.avatar_url ? (
                <Image source={{ uri: p.user.avatar_url }} style={styles.memberAvatar} />
              ) : (
                <View style={styles.memberAvatarFallback}>
                  <Text style={styles.memberInitial}>
                    {(p.user.first_name?.[0] ?? p.user.display_name[0]).toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={styles.memberName}>{name}</Text>
            </Pressable>
          )
        })}

        {/* Action */}
        <View style={styles.actionSection}>
          {isCreator ? (
            <View style={styles.manageSection}>
              <Text style={styles.manageSectionTitle}>Manage Activity</Text>
              <Pressable
                style={styles.manageButton}
                onPress={() => router.push(`/chat/${id}`)}
              >
                <Text style={styles.manageButtonText}>Open Group Chat</Text>
              </Pressable>
              <Pressable style={styles.deleteButton} onPress={handleDelete}>
                <Text style={styles.deleteText}>Delete Activity</Text>
              </Pressable>
            </View>
          ) : myStatus === 'accepted' ? (
            <Pressable
              style={styles.chatButton}
              onPress={() => router.push(`/chat/${id}`)}
            >
              <Text style={styles.chatButtonText}>Open Group Chat</Text>
            </Pressable>
          ) : myStatus === 'requested' ? (
            <View style={styles.pendingButton}>
              <Text style={styles.pendingText}>Request Pending</Text>
            </View>
          ) : (
            <Pressable
              style={[styles.joinButton, isJoining && { opacity: 0.6 }]}
              onPress={handleJoin}
              disabled={isJoining}
            >
              <Text style={styles.joinText}>
                {isJoining
                  ? 'Joining...'
                  : activity.visibility === 'public'
                    ? 'Join Activity'
                    : 'Request to Join'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </ScrollView>
    {showConfetti && <ConfettiCannon count={80} origin={{ x: -10, y: 0 }} fadeOut autoStart />}
    </>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fafafa' },
  banner: { width: '100%', height: 200 },
  bannerFallback: { width: '100%', height: 160, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' },
  bannerEmoji: { fontSize: 48 },
  body: { padding: 20 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1a1a2e', flex: 1 },
  sportTag: { backgroundColor: '#f0f0f0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  sportTagText: { fontSize: 12, fontWeight: '700', color: '#6b7280' },
  description: { fontSize: 14, color: '#6b7280', marginTop: 12, lineHeight: 20 },
  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20 },
  detailItem: { backgroundColor: '#ffffff', borderRadius: 12, padding: 12, width: '47%', borderWidth: 1, borderColor: '#e5e5e5' },
  detailLabel: { fontSize: 11, color: '#9ca3af', marginBottom: 2 },
  detailValue: { fontSize: 13, color: '#1a1a2e', fontWeight: '600' },
  hostCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#ffffff', borderRadius: 14, padding: 14, marginTop: 20, borderWidth: 1, borderColor: '#e5e5e5' },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarFallback: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#e5e5e5', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 16, fontWeight: '700', color: '#1a1a2e' },
  hostName: { fontSize: 15, fontWeight: '600', color: '#1a1a2e' },
  hostLabel: { fontSize: 12, color: '#9ca3af' },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, marginTop: 24, marginBottom: 12 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  memberAvatar: { width: 32, height: 32, borderRadius: 16 },
  memberAvatarFallback: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#e5e5e5', alignItems: 'center', justifyContent: 'center' },
  memberInitial: { fontSize: 13, fontWeight: '700', color: '#1a1a2e' },
  memberName: { fontSize: 14, color: '#1a1a2e' },
  actionSection: { marginTop: 32, marginBottom: 40 },
  joinButton: { backgroundColor: '#0f8a6e', borderRadius: 12, padding: 16, alignItems: 'center' },
  joinText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  chatButton: { backgroundColor: '#0f8a6e', borderRadius: 12, padding: 16, alignItems: 'center' },
  chatButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  pendingButton: { backgroundColor: '#f0f0f0', borderRadius: 12, padding: 16, alignItems: 'center' },
  pendingText: { fontSize: 16, fontWeight: '600', color: '#6b7280' },
  bannerEditButton: { position: 'absolute', bottom: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  bannerEditText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  manageSection: { gap: 12 },
  manageSectionTitle: { fontSize: 12, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  manageButton: { backgroundColor: '#0f8a6e', borderRadius: 12, padding: 16, alignItems: 'center' },
  manageButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  deleteButton: { borderWidth: 1, borderColor: '#fecaca', borderRadius: 12, padding: 16, alignItems: 'center' },
  deleteText: { fontSize: 16, fontWeight: '600', color: '#dc2626' },
})
