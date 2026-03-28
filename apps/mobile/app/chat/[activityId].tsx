import { useCallback, useEffect, useRef, useState } from 'react'
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useLocalSearchParams, Stack } from 'expo-router'

import { useSession } from '../../lib/AuthProvider'
import { supabase } from '../../lib/supabase'

interface Message {
  id: string
  content: string
  created_at: string
  sender_id: string
  sender: {
    display_name: string
    first_name: string | null
  } | null
}

export default function GroupChatScreen() {
  const { activityId } = useLocalSearchParams<{ activityId: string }>()
  const { user } = useSession()
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [title, setTitle] = useState('Group Chat')
  const flatListRef = useRef<FlatList>(null)

  const fetchMessages = useCallback(async () => {
    const [actResult, msgResult] = await Promise.all([
      supabase.from('activities').select('title').eq('id', activityId).single(),
      supabase
        .from('messages')
        .select(`
          id, content, created_at, sender_id,
          sender:users!sender_id ( display_name, first_name )
        `)
        .eq('activity_id', activityId)
        .order('created_at', { ascending: true })
        .limit(100),
    ])

    if (actResult.data) setTitle(actResult.data.title)
    setMessages(
      (msgResult.data ?? []).map((m) => ({
        ...m,
        sender: Array.isArray(m.sender) ? m.sender[0] ?? null : m.sender,
      }))
    )
  }, [activityId])

  useEffect(() => {
    fetchMessages()

    // Subscribe to realtime
    const channel = supabase
      .channel(`group-${activityId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `activity_id=eq.${activityId}` },
        () => fetchMessages()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [activityId, fetchMessages])

  async function handleSend() {
    const text = newMessage.trim()
    if (!text || !user) return

    setNewMessage('')
    await supabase.from('messages').insert({
      activity_id: activityId,
      sender_id: user.id,
      content: text,
    })
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <Stack.Screen options={{ title, headerBackTitle: 'Back' }} />

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const isMe = item.sender_id === user?.id
          const senderName = item.sender?.first_name ?? item.sender?.display_name ?? 'Unknown'
          return (
            <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
              {!isMe && <Text style={styles.senderName}>{senderName}</Text>}
              <Text style={[styles.messageText, isMe && styles.messageTextMe]}>{item.content}</Text>
            </View>
          )
        }}
      />

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor="#9ca3af"
          value={newMessage}
          onChangeText={setNewMessage}
          onSubmitEditing={handleSend}
          returnKeyType="send"
        />
        <Pressable style={styles.sendButton} onPress={handleSend}>
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  messageList: { paddingHorizontal: 16, paddingVertical: 12 },
  bubble: { maxWidth: '80%', borderRadius: 16, padding: 10, marginBottom: 8 },
  bubbleMe: { alignSelf: 'flex-end', backgroundColor: '#0f8a6e' },
  bubbleOther: { alignSelf: 'flex-start', backgroundColor: '#f0f0f0' },
  senderName: { fontSize: 11, fontWeight: '600', color: '#6b7280', marginBottom: 2 },
  messageText: { fontSize: 15, color: '#1a1a2e', lineHeight: 20 },
  messageTextMe: { color: '#fff' },
  inputBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#e5e5e5', backgroundColor: '#fafafa' },
  input: { flex: 1, backgroundColor: '#ffffff', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: '#1a1a2e', borderWidth: 1, borderColor: '#e0e0e0' },
  sendButton: { backgroundColor: '#0f8a6e', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 },
  sendText: { fontSize: 15, fontWeight: '600', color: '#fff' },
})
