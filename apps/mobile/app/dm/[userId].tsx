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
}

export default function DMScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>()
  const { user } = useSession()
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [partnerName, setPartnerName] = useState('Chat')
  const flatListRef = useRef<FlatList>(null)

  const fetchMessages = useCallback(async () => {
    if (!user) return

    const [partnerResult, msgResult] = await Promise.all([
      supabase.from('users').select('display_name, first_name, last_name').eq('id', userId).single(),
      supabase
        .from('messages')
        .select('id, content, created_at, sender_id')
        .is('activity_id', null)
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user.id})`
        )
        .order('created_at', { ascending: true })
        .limit(100),
    ])

    if (partnerResult.data) {
      const p = partnerResult.data
      setPartnerName(
        p.first_name && p.last_name
          ? `${p.first_name} ${p.last_name}`
          : p.display_name
      )
    }
    setMessages(msgResult.data ?? [])
  }, [userId, user])

  useEffect(() => {
    fetchMessages()

    const channel = supabase
      .channel(`dm-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new as Message & { receiver_id: string | null; activity_id: string | null }
          if (
            !msg.activity_id &&
            ((msg.sender_id === userId && msg.receiver_id === user?.id) ||
             (msg.sender_id === user?.id && msg.receiver_id === userId))
          ) {
            fetchMessages()
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, user, fetchMessages])

  async function handleSend() {
    const text = newMessage.trim()
    if (!text || !user) return

    setNewMessage('')
    await supabase.from('messages').insert({
      sender_id: user.id,
      receiver_id: userId,
      content: text,
    })
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <Stack.Screen options={{ title: partnerName, headerBackTitle: 'Back' }} />

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const isMe = item.sender_id === user?.id
          return (
            <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
              <Text style={styles.messageText}>{item.content}</Text>
            </View>
          )
        }}
      />

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor="#71717a"
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
  container: { flex: 1, backgroundColor: '#000' },
  messageList: { paddingHorizontal: 16, paddingVertical: 12 },
  bubble: { maxWidth: '80%', borderRadius: 16, padding: 10, marginBottom: 8 },
  bubbleMe: { alignSelf: 'flex-end', backgroundColor: '#3b82f6' },
  bubbleOther: { alignSelf: 'flex-start', backgroundColor: '#27272a' },
  messageText: { fontSize: 15, color: '#fff', lineHeight: 20 },
  inputBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#27272a', backgroundColor: '#000' },
  input: { flex: 1, backgroundColor: '#18181b', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: '#fff', borderWidth: 1, borderColor: '#27272a' },
  sendButton: { backgroundColor: '#3b82f6', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 },
  sendText: { fontSize: 15, fontWeight: '600', color: '#fff' },
})
