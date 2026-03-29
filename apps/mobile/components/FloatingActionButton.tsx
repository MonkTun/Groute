import { Pressable, StyleSheet, Text } from 'react-native'
import { useRouter } from 'expo-router'

interface FloatingActionButtonProps {
  /** Latitude to prefill on the create-activity screen */
  lat?: number
  /** Longitude to prefill on the create-activity screen */
  lng?: number
}

export default function FloatingActionButton({ lat, lng }: FloatingActionButtonProps) {
  const router = useRouter()

  function handlePress() {
    const params = lat != null && lng != null ? `?lat=${lat}&lng=${lng}` : ''
    router.push(`/create-activity${params}`)
  }

  return (
    <Pressable style={s.fab} onPress={handlePress}>
      <Text style={s.fabText}>+</Text>
    </Pressable>
  )
}

const s = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 76,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#0f8a6e',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: { fontSize: 26, fontWeight: '300', color: '#fff', marginTop: -2 },
})
