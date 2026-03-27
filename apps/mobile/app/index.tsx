import { StyleSheet, Text, View } from "react-native";
import { SPORT_LABELS } from "@groute/shared";

export default function HomeScreen() {
  const sports = Object.values(SPORT_LABELS);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Groute</Text>
      <Text style={styles.subtitle}>
        Find your outdoor crew. Verified skills, real people, spontaneous
        adventures.
      </Text>
      <View style={styles.sportsList}>
        {sports.map((sport) => (
          <View key={sport} style={styles.sportBadge}>
            <Text style={styles.sportText}>{sport}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.phase}>Phase 1: Discovery MVP — Coming to LA</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
    padding: 24,
  },
  title: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 18,
    color: "#a1a1aa",
    textAlign: "center",
    maxWidth: 300,
    marginBottom: 24,
  },
  sportsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginBottom: 32,
  },
  sportBadge: {
    backgroundColor: "#27272a",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sportText: {
    color: "#d4d4d8",
    fontSize: 14,
    fontWeight: "500",
  },
  phase: {
    fontSize: 12,
    color: "#71717a",
  },
});
