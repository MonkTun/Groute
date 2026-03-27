import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'

import { useSession } from '../../lib/AuthProvider'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'expo-router'

export default function ProfileScreen() {
  const { user } = useSession()
  const router = useRouter()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.replace('/')
  }

  return (
    <View style={styles.container}>
      <Text style={styles.name}>
        {user?.user_metadata?.display_name ?? 'User'}
      </Text>
      <Text style={styles.email}>{user?.email}</Text>

      <Pressable style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  email: {
    fontSize: 16,
    color: '#a1a1aa',
    marginBottom: 32,
  },
  signOutButton: {
    borderWidth: 1,
    borderColor: '#3f3f46',
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  signOutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
})
