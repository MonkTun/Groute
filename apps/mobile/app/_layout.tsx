import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'

import { AuthProvider } from '../lib/AuthProvider'

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#000' },
          headerTintColor: '#fff',
          contentStyle: { backgroundColor: '#000' },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="activity/[id]" options={{ title: 'Activity' }} />
        <Stack.Screen name="edit-profile" options={{ title: 'Edit Profile', presentation: 'modal' }} />
        <Stack.Screen name="create-activity" options={{ title: 'New Activity', presentation: 'modal' }} />
        <Stack.Screen name="chat/[activityId]" options={{ title: 'Group Chat' }} />
        <Stack.Screen name="dm/[userId]" options={{ title: 'Chat' }} />
      </Stack>
    </AuthProvider>
  )
}
