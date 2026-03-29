import { useCallback, useEffect, useState } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'

import { useSession } from '../../lib/AuthProvider'
import { supabase } from '../../lib/supabase'
import { apiFetch, apiPost } from '../../lib/api'
import ChatView from '../../components/ChatView'

interface Message {
  id: string
  content: string
  created_at: string
  sender_id: string
  sender: {
    id: string
    display_name: string
    first_name: string | null
    avatar_url: string | null
  } | null
}

export default function GroupChatScreen() {
  const { activityId } = useLocalSearchParams<{ activityId: string }>()
  const { user } = useSession()
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [title, setTitle] = useState('Group Chat')

  const fetchMessages = useCallback(async () => {
    const [actResult, msgResult] = await Promise.all([
      apiFetch<{ title: string }>(`/api/activities/${activityId}`),
      apiFetch<Array<{ id: string; content: string; created_at: string; sender: { id: string; display_name: string; first_name: string | null; last_name: string | null; avatar_url: string | null } | null }>>(`/api/messages/${activityId}`),
    ])

    if (actResult.data) setTitle(actResult.data.title)
    setMessages(
      (msgResult.data ?? []).map((m) => ({
        id: m.id,
        content: m.content,
        created_at: m.created_at,
        sender_id: m.sender?.id ?? '',
        sender: m.sender ? { id: m.sender.id, display_name: m.sender.display_name, first_name: m.sender.first_name, avatar_url: m.sender.avatar_url } : null,
      }))
    )
  }, [activityId])

  useEffect(() => {
    fetchMessages()

    const channel = supabase
      .channel(`group-${activityId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `activity_id=eq.${activityId}` },
        (payload) => {
          const msg = payload.new as Message & { activity_id: string }
          setMessages((prev) => {
            const withoutPending = prev.filter((m) => !m.id.startsWith('pending-') || m.sender_id !== msg.sender_id)
            if (withoutPending.some((m) => m.id === msg.id)) return withoutPending
            return [...withoutPending, { ...msg, sender: null }]
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [activityId, fetchMessages])

  async function handleSend(text: string) {
    if (!user) return { error: 'Not signed in' }

    const optimistic: Message = {
      id: `pending-${Date.now()}`,
      content: text,
      created_at: new Date().toISOString(),
      sender_id: user.id,
      sender: null,
    }
    setMessages((prev) => [...prev, optimistic])

    const { error } = await apiPost(`/api/messages/${activityId}`, { content: text })
    if (error) {
      console.error('Failed to send group message:', error)
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      return { error }
    }
    return {}
  }

  function renderMessage(item: Message) {
    const isMe = item.sender_id === user?.id
    const senderName = item.sender?.first_name ?? item.sender?.display_name ?? 'Unknown'

    if (isMe) {
      return (
        <View style={[s.bubble, s.bubbleMe]}>
          <Text style={[s.messageText, s.messageTextMe]}>{item.content}</Text>
        </View>
      )
    }

    return (
      <View style={s.otherRow}>
        <Pressable onPress={() => item.sender?.id && router.push(`/user/${item.sender.id}`)}>
          {item.sender?.avatar_url ? (
            <Image source={{ uri: item.sender.avatar_url }} style={s.msgAvatar} />
          ) : (
            <View style={s.msgAvatarFallback}>
              <Text style={s.msgAvatarInitial}>{senderName[0]?.toUpperCase()}</Text>
            </View>
          )}
        </Pressable>
        <View style={[s.bubble, s.bubbleOther]}>
          <Text style={s.senderName}>{senderName}</Text>
          <Text style={s.messageText}>{item.content}</Text>
        </View>
      </View>
    )
  }

  return (
    <>
      <Stack.Screen options={{ title, headerBackTitle: 'Back' }} />
      <ChatView
        messages={messages}
        onSend={handleSend}
        renderItem={renderMessage}
      />
    </>
  )
}

const s = StyleSheet.create({
  otherRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 8 },
  msgAvatar: { width: 28, height: 28, borderRadius: 14 },
  msgAvatarFallback: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#e5e5e5', alignItems: 'center', justifyContent: 'center' },
  msgAvatarInitial: { fontSize: 11, fontWeight: '700', color: '#1a1a2e' },
  bubble: { maxWidth: '75%', borderRadius: 16, padding: 10 },
  bubbleMe: { alignSelf: 'flex-end', backgroundColor: '#0f8a6e', marginBottom: 8 },
  bubbleOther: { backgroundColor: '#f0f0f0' },
  senderName: { fontSize: 11, fontWeight: '600', color: '#6b7280', marginBottom: 2 },
  messageText: { fontSize: 15, color: '#1a1a2e', lineHeight: 20 },
  messageTextMe: { color: '#fff' },
})
