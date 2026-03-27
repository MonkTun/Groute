import { useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Stack, useRouter } from 'expo-router'

import { SPORT_LABELS, SKILL_LABELS } from '@groute/shared'
import { useSession } from '../lib/AuthProvider'
import { supabase } from '../lib/supabase'

export default function CreateActivityScreen() {
  const { user } = useSession()
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [sportType, setSportType] = useState('')
  const [skillLevel, setSkillLevel] = useState('beginner')
  const [locationName, setLocationName] = useState('')
  const [maxParticipants, setMaxParticipants] = useState('4')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleCreate() {
    if (!title.trim()) return Alert.alert('Error', 'Title is required')
    if (!sportType) return Alert.alert('Error', 'Select an activity type')
    if (!locationName.trim()) return Alert.alert('Error', 'Location is required')
    if (!date || !time) return Alert.alert('Error', 'Date and time are required')

    setIsSubmitting(true)

    const scheduledAt = new Date(`${date}T${time}`).toISOString()

    const { data, error } = await supabase
      .from('activities')
      .insert({
        creator_id: user!.id,
        title: title.trim(),
        description: description.trim() || null,
        sport_type: sportType,
        skill_level: skillLevel,
        visibility: 'public',
        location_name: locationName.trim(),
        location_lat: '34.0522',
        location_lng: '-118.2437',
        max_participants: parseInt(maxParticipants, 10) || 4,
        scheduled_at: scheduledAt,
      })
      .select()
      .single()

    if (error) {
      Alert.alert('Error', error.message)
      setIsSubmitting(false)
      return
    }

    // Create initial group chat message
    if (data) {
      await supabase.from('messages').insert({
        activity_id: data.id,
        sender_id: user!.id,
        content: 'created this activity. Welcome to the group!',
      })
    }

    Alert.alert('Created!', 'Your activity has been posted.', [
      { text: 'OK', onPress: () => router.back() },
    ])
    setIsSubmitting(false)
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: 'New Activity', headerBackTitle: 'Back' }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          placeholder="Morning hike at Griffith Park"
          placeholderTextColor="#71717a"
          value={title}
          onChangeText={setTitle}
          maxLength={200}
        />

        <Text style={styles.label}>Description (optional)</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="What should people know?"
          placeholderTextColor="#71717a"
          value={description}
          onChangeText={setDescription}
          maxLength={2000}
          multiline
          numberOfLines={3}
        />

        <Text style={styles.label}>Activity type</Text>
        <View style={styles.chips}>
          {Object.entries(SPORT_LABELS).map(([key, label]) => (
            <Pressable
              key={key}
              style={[styles.chip, sportType === key && styles.chipActive]}
              onPress={() => setSportType(key)}
            >
              <Text style={[styles.chipText, sportType === key && styles.chipTextActive]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Skill level</Text>
        <View style={styles.chips}>
          {Object.entries(SKILL_LABELS).map(([key, label]) => (
            <Pressable
              key={key}
              style={[styles.chip, skillLevel === key && styles.chipActive]}
              onPress={() => setSkillLevel(key)}
            >
              <Text style={[styles.chipText, skillLevel === key && styles.chipTextActive]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Location name</Text>
        <TextInput
          style={styles.input}
          placeholder="Griffith Observatory"
          placeholderTextColor="#71717a"
          value={locationName}
          onChangeText={setLocationName}
        />

        <View style={styles.row}>
          <View style={styles.halfField}>
            <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              placeholder="2026-04-01"
              placeholderTextColor="#71717a"
              value={date}
              onChangeText={setDate}
              keyboardType="numbers-and-punctuation"
            />
          </View>
          <View style={styles.halfField}>
            <Text style={styles.label}>Time (HH:MM)</Text>
            <TextInput
              style={styles.input}
              placeholder="08:00"
              placeholderTextColor="#71717a"
              value={time}
              onChangeText={setTime}
              keyboardType="numbers-and-punctuation"
            />
          </View>
        </View>

        <Text style={styles.label}>Max participants</Text>
        <TextInput
          style={styles.input}
          value={maxParticipants}
          onChangeText={setMaxParticipants}
          keyboardType="number-pad"
        />

        <Pressable
          style={[styles.createButton, isSubmitting && { opacity: 0.6 }]}
          onPress={handleCreate}
          disabled={isSubmitting}
        >
          <Text style={styles.createText}>
            {isSubmitting ? 'Creating...' : 'Create Activity'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  scroll: { padding: 20, paddingBottom: 60 },
  label: { fontSize: 13, fontWeight: '600', color: '#a1a1aa', marginTop: 16, marginBottom: 6 },
  input: {
    backgroundColor: '#18181b',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: '#27272a',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipActive: { backgroundColor: '#fff' },
  chipText: { color: '#a1a1aa', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#000' },
  row: { flexDirection: 'row', gap: 12 },
  halfField: { flex: 1 },
  createButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 28,
  },
  createText: { fontSize: 16, fontWeight: '600', color: '#000' },
})
