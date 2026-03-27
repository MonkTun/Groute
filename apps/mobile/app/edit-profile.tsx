import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
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
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system'
import { decode } from 'base64-arraybuffer'

import { useSession } from '../lib/AuthProvider'
import { supabase } from '../lib/supabase'

export default function EditProfileScreen() {
  const { user } = useSession()
  const router = useRouter()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [area, setArea] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)

  const fetchProfile = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('users')
      .select('display_name, first_name, last_name, bio, area, avatar_url')
      .eq('id', user.id)
      .single()

    if (data) {
      setDisplayName(data.display_name ?? '')
      setFirstName(data.first_name ?? '')
      setLastName(data.last_name ?? '')
      setBio(data.bio ?? '')
      setArea(data.area ?? '')
      setAvatarUrl(data.avatar_url)
    }
  }, [user])

  useEffect(() => {
    fetchProfile().finally(() => setIsLoading(false))
  }, [fetchProfile])

  async function handlePickAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    })

    if (result.canceled || !result.assets[0]) return

    const asset = result.assets[0]
    setIsUploadingAvatar(true)

    try {
      const ext = asset.uri.split('.').pop() ?? 'jpg'
      const filePath = `avatars/${user!.id}.${ext}`
      const mimeType = asset.mimeType ?? 'image/jpeg'

      // Use base64 from picker if available, otherwise read from file
      const base64 = asset.base64
        ?? await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        })

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, decode(base64), {
          upsert: true,
          contentType: mimeType,
        })

      if (uploadError) {
        Alert.alert('Error', uploadError.message)
        setIsUploadingAvatar(false)
        return
      }

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath)
      const freshUrl = `${publicUrl}?t=${Date.now()}`

      await supabase
        .from('users')
        .update({ avatar_url: freshUrl })
        .eq('id', user!.id)

      setAvatarUrl(freshUrl)
    } catch {
      Alert.alert('Error', 'Failed to upload photo')
    }
    setIsUploadingAvatar(false)
  }

  async function handleSave() {
    if (!displayName.trim()) {
      Alert.alert('Error', 'Display name is required')
      return
    }

    setIsSaving(true)
    const { error } = await supabase
      .from('users')
      .update({
        display_name: displayName.trim(),
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        bio: bio.trim() || null,
        area: area.trim() || null,
      })
      .eq('id', user!.id)

    if (error) {
      Alert.alert('Error', error.message)
    } else {
      Alert.alert('Saved', 'Your profile has been updated.', [
        { text: 'OK', onPress: () => router.back() },
      ])
    }
    setIsSaving(false)
  }

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <Stack.Screen options={{ title: 'Edit Profile' }} />
        <ActivityIndicator size="large" color="#fff" />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: 'Edit Profile', headerBackTitle: 'Back' }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Avatar */}
        <Pressable style={styles.avatarSection} onPress={handlePickAvatar} disabled={isUploadingAvatar}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial}>
                {(firstName?.[0] ?? displayName[0] ?? '?').toUpperCase()}
              </Text>
            </View>
          )}
          {isUploadingAvatar ? (
            <View style={styles.avatarOverlay}>
              <ActivityIndicator color="#fff" />
            </View>
          ) : (
            <View style={styles.avatarBadge}>
              <Text style={styles.avatarBadgeText}>Edit</Text>
            </View>
          )}
        </Pressable>
        <Text style={styles.avatarHint}>Tap to change photo</Text>

        {/* Fields */}
        <Text style={styles.label}>Display name</Text>
        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Display name"
          placeholderTextColor="#71717a"
        />

        <View style={styles.row}>
          <View style={styles.halfField}>
            <Text style={styles.label}>First name</Text>
            <TextInput
              style={styles.input}
              value={firstName}
              onChangeText={setFirstName}
              placeholder="First"
              placeholderTextColor="#71717a"
            />
          </View>
          <View style={styles.halfField}>
            <Text style={styles.label}>Last name</Text>
            <TextInput
              style={styles.input}
              value={lastName}
              onChangeText={setLastName}
              placeholder="Last"
              placeholderTextColor="#71717a"
            />
          </View>
        </View>

        <Text style={styles.label}>Area</Text>
        <TextInput
          style={styles.input}
          value={area}
          onChangeText={setArea}
          placeholder="e.g. Los Angeles, CA"
          placeholderTextColor="#71717a"
        />

        <Text style={styles.label}>Bio</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={bio}
          onChangeText={setBio}
          placeholder="Tell us about yourself..."
          placeholderTextColor="#71717a"
          multiline
          numberOfLines={3}
          maxLength={300}
        />

        <Pressable
          style={[styles.saveButton, isSaving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={isSaving}
        >
          <Text style={styles.saveText}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  scroll: { padding: 20, paddingBottom: 60 },
  avatarSection: { alignSelf: 'center', marginBottom: 4 },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarFallback: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#27272a', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 36, fontWeight: '700', color: '#fff' },
  avatarOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 48, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  avatarBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#3b82f6', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  avatarBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  avatarHint: { textAlign: 'center', fontSize: 12, color: '#71717a', marginBottom: 20 },
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
  row: { flexDirection: 'row', gap: 12 },
  halfField: { flex: 1 },
  saveButton: { backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 28 },
  saveText: { fontSize: 16, fontWeight: '600', color: '#000' },
})
