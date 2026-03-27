import { StyleSheet, Text, View } from 'react-native'
import { SPORT_LABELS } from '@groute/shared'

export default function DiscoverScreen() {
  const sports = Object.values(SPORT_LABELS)

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Discover</Text>
      <Text style={styles.subtitle}>Find outdoor activities near you.</Text>
      <View style={styles.sportsList}>
        {sports.map((sport) => (
          <View key={sport} style={styles.sportBadge}>
            <Text style={styles.sportText}>{sport}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.placeholder}>Map and activity feed coming soon.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    padding: 24,
    paddingTop: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 16,
    color: '#a1a1aa',
    marginTop: 4,
    marginBottom: 24,
  },
  sportsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sportBadge: {
    backgroundColor: '#27272a',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sportText: {
    color: '#d4d4d8',
    fontSize: 14,
    fontWeight: '500',
  },
  placeholder: {
    fontSize: 14,
    color: '#71717a',
    marginTop: 32,
  },
})
