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
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'

import { useSession } from '../../lib/AuthProvider'
import { supabase } from '../../lib/supabase'

const C = {
  bg: '#fafafa',
  primary: '#0f8a6e',
  primaryMuted: 'rgba(15,138,110,0.1)',
  text: '#1a1a2e',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
}

// Invite messages contain "[invite:activityId]" tag
const INVITE_REGEX = /\[invite:([a-f0-9-]+)\]\s*(.*)/

interface Message {
  id: string
  content: string
  created_at: string
  sender_id: string
}

export default function DMScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>()
  const { user } = useSession()
  const router = useRouter()
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

  function renderMessage({ item }: { item: Message }) {
    const isMe = item.sender_id === user?.id
    const inviteMatch = item.content.match(INVITE_REGEX)

    // Invite card
    if (inviteMatch) {
      const activityId = inviteMatch[1]
      const activityTitle = inviteMatch[2]
      return (
        <View style={[s.inviteCard, isMe ? s.inviteCardMe : s.inviteCardOther]}>
          <Text style={s.inviteEmoji}>{'\u{1F3D5}'}</Text>
          <Text style={s.inviteLabel}>{isMe ? 'You sent an invite' : `${partnerName} invited you`}</Text>
          <Text style={s.inviteTitle} numberOfLines={2}>{activityTitle}</Text>
          <Pressable style={s.inviteBtn} onPress={() => router.push(`/activity/${activityId}`)}>
            <Text style={s.inviteBtnText}>View Activity</Text>
          </Pressable>
        </View>
      )
    }

    // Regular message
    return (
      <View style={[s.bubble, isMe ? s.bubbleMe : s.bubbleOther]}>
        <Text style={[s.messageText, isMe && s.messageTextMe]}>{item.content}</Text>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <Stack.Screen options={{ title: partnerName, headerBackTitle: 'Back' }} />

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        renderItem={renderMessage}
      />

      <View style={s.inputBar}>
        <TextInput
          style={s.input}
          placeholder="Type a message..."
          placeholderTextColor="#9ca3af"
          value={newMessage}
          onChangeText={setNewMessage}
          onSubmitEditing={handleSend}
          returnKeyType="send"
        />
        <Pressable style={s.sendButton} onPress={handleSend}>
          <Text style={s.sendText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  messageList: { paddingHorizontal: 16, paddingVertical: 12 },

  // Regular bubbles
  bubble: { maxWidth: '80%', borderRadius: 16, padding: 10, marginBottom: 8 },
  bubbleMe: { alignSelf: 'flex-end', backgroundColor: '#0f8a6e' },
  bubbleOther: { alignSelf: 'flex-start', backgroundColor: '#f0f0f0' },
  messageText: { fontSize: 15, color: '#1a1a2e', lineHeight: 20 },
  messageTextMe: { color: '#fff' },

  // Invite card
  inviteCard: { maxWidth: '80%', borderRadius: 16, padding: 16, marginBottom: 8, alignItems: 'center', borderWidth: 1 },
  inviteCardMe: { alignSelf: 'flex-end', backgroundColor: C.primaryMuted, borderColor: C.primary },
  inviteCardOther: { alignSelf: 'flex-start', backgroundColor: '#fff', borderColor: '#e5e5e5' },
  inviteEmoji: { fontSize: 28, marginBottom: 6 },
  inviteLabel: { fontSize: 11, color: C.textMuted, fontWeight: '500', marginBottom: 4 },
  inviteTitle: { fontSize: 14, fontWeight: '600', color: C.text, textAlign: 'center', marginBottom: 10 },
  inviteBtn: { backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 8 },
  inviteBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },

  // Input
  inputBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#e5e5e5', backgroundColor: '#fafafa' },
  input: { flex: 1, backgroundColor: '#ffffff', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: '#1a1a2e', borderWidth: 1, borderColor: '#e0e0e0' },
  sendButton: { backgroundColor: '#0f8a6e', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 },
  sendText: { fontSize: 15, fontWeight: '600', color: '#fff' },
})
