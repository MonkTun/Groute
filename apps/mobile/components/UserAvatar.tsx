import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'

interface UserAvatarProps {
  userId: string
  avatarUrl: string | null | undefined
  name: string
  size?: number
  /** If false, tapping won't navigate to profile */
  navigable?: boolean
}

export default function UserAvatar({
  userId,
  avatarUrl,
  name,
  size = 40,
  navigable = true,
}: UserAvatarProps) {
  const router = useRouter()
  const initial = (name[0] ?? '?').toUpperCase()
  const borderRadius = size / 2

  const content = avatarUrl ? (
    <Image source={{ uri: avatarUrl }} style={{ width: size, height: size, borderRadius }} />
  ) : (
    <View style={[s.fallback, { width: size, height: size, borderRadius }]}>
      <Text style={[s.initial, { fontSize: size * 0.4 }]}>{initial}</Text>
    </View>
  )

  if (!navigable) return content

  return (
    <Pressable onPress={() => router.push(`/user/${userId}`)}>
      {content}
    </Pressable>
  )
}

const s = StyleSheet.create({
  fallback: { backgroundColor: '#e5e5e5', alignItems: 'center', justifyContent: 'center' },
  initial: { fontWeight: '700', color: '#1a1a2e' },
})
