import { Stack } from 'expo-router'

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#fafafa' },
        headerTintColor: '#1a1a2e',
        contentStyle: { backgroundColor: '#fafafa' },
      }}
    />
  )
}
