import React from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Text, View, ScrollView, StyleSheet } from 'react-native'

import { AuthProvider } from '../lib/AuthProvider'

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <View style={eb.container}>
          <Text style={eb.title}>App Crashed</Text>
          <ScrollView style={eb.scroll}>
            <Text style={eb.message}>{this.state.error.message}</Text>
            <Text style={eb.stack}>{this.state.error.stack}</Text>
          </ScrollView>
        </View>
      )
    }
    return this.props.children
  }
}

const eb = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fee2e2', paddingTop: 80, padding: 20 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#991b1b', marginBottom: 12 },
  scroll: { flex: 1 },
  message: { fontSize: 16, color: '#991b1b', marginBottom: 12 },
  stack: { fontSize: 11, color: '#7f1d1d', fontFamily: 'Courier' },
})

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: '#fafafa' },
            headerTintColor: '#1a1a2e',
            contentStyle: { backgroundColor: '#fafafa' },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="activity/[id]" options={{ title: 'Activity' }} />
          <Stack.Screen name="edit-activity" options={{ title: 'Edit Activity', presentation: 'modal' }} />
          <Stack.Screen name="edit-profile" options={{ title: 'Edit Profile', presentation: 'modal' }} />
          <Stack.Screen name="create-activity" options={{ title: 'New Activity', presentation: 'modal' }} />
          <Stack.Screen name="chat/[activityId]" options={{ title: 'Group Chat' }} />
          <Stack.Screen name="dm/[userId]" options={{ title: 'Chat' }} />
          <Stack.Screen name="user/[id]" options={{ title: 'Profile' }} />
        </Stack>
      </AuthProvider>
    </ErrorBoundary>
  )
}
