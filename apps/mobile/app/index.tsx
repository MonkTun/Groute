import { Redirect } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'

import { useSession } from '../lib/AuthProvider'

export default function Index() {
  const { user, isLoading } = useSession()

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    )
  }

  if (user) {
    return <Redirect href="/(tabs)" />
  }

  return <Redirect href="/(auth)/login" />
}
