import { Tabs } from 'expo-router'

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#000' },
        headerTintColor: '#fff',
        tabBarStyle: { backgroundColor: '#000', borderTopColor: '#27272a' },
        tabBarActiveTintColor: '#fff',
        tabBarInactiveTintColor: '#71717a',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Discover', headerTitle: 'Groute' }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile' }}
      />
    </Tabs>
  )
}
