import { Tabs } from 'expo-router'
import { Text } from 'react-native'

function TabIcon({ emoji }: { emoji: string }) {
  return <Text style={{ fontSize: 22 }}>{emoji}</Text>
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#fafafa' },
        headerTintColor: '#1a1a2e',
        tabBarStyle: { backgroundColor: '#ffffff', borderTopColor: '#e5e5e5' },
        tabBarActiveTintColor: '#0f8a6e',
        tabBarInactiveTintColor: '#9ca3af',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Right Now',
          headerTitle: 'Groute',
          tabBarIcon: () => <TabIcon emoji={'\u{1F525}'} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: () => <TabIcon emoji={'\u{1F5FA}'} />,
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: 'My Trips',
          tabBarIcon: () => <TabIcon emoji={'\u{1F392}'} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Social',
          headerShown: false,
          tabBarIcon: () => <TabIcon emoji={'\u{1F4AC}'} />,
        }}
      />
      <Tabs.Screen
        name="social"
        options={{ href: null }}
      />
    </Tabs>
  )
}
