import { useCallback, useEffect, useState } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'

import { useSession } from '../../lib/AuthProvider'
import { supabase } from '../../lib/supabase'
import ChatView from '../../components/ChatView'

const C = {
  primary: '#0f8a6e',
  primaryMuted: 'rgba(15,138,110,0.1)',
  text: '#1a1a2e',
  textMuted: '#9ca3af',
}

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
  const [partnerName, setPartnerName] = useState('Chat')
  const [partnerAvatar, setPartnerAvatar] = useState<string | null>(null)

  const fetchMessages = useCallback(async () => {
    if (!user) return

    const [partnerResult, msgResult] = await Promise.all([
      supabase.from('users').select('display_name, first_name, last_name, avatar_url').eq('id', userId).single(),
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
      setPartnerAvatar(p.avatar_url)
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
            setMessages((prev) => {
              const withoutPending = prev.filter((m) => !m.id.startsWith('pending-') || m.sender_id !== msg.sender_id)
              if (withoutPending.some((m) => m.id === msg.id)) return withoutPending
              return [...withoutPending, msg]
            })
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, user, fetchMessages])

  async function handleSend(text: string) {
    if (!user) return { error: 'Not signed in' }

    const optimistic: Message = {
      id: `pending-${Date.now()}`,
      content: text,
      created_at: new Date().toISOString(),
      sender_id: user.id,
    }
    setMessages((prev) => [...prev, optimistic])

    const { error } = await supabase.from('messages').insert({
      sender_id: user.id,
      receiver_id: userId,
      content: text,
    })
    if (error) {
      console.error('Failed to send DM:', error)
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      return { error: error.message }
    }
    return {}
  }

  function renderMessage(item: Message) {
    const isMe = item.sender_id === user?.id
    const inviteMatch = item.content.match(INVITE_REGEX)

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

    if (isMe) {
      return (
        <View style={[s.bubble, s.bubbleMe]}>
          <Text style={[s.messageText, s.messageTextMe]}>{item.content}</Text>
        </View>
      )
    }

    return (
      <View style={s.otherRow}>
        {partnerAvatar ? (
          <Pressable onPress={() => router.push(`/user/${userId}`)}>
            <Image source={{ uri: partnerAvatar }} style={s.msgAvatar} />
          </Pressable>
        ) : (
          <Pressable style={s.msgAvatarFallback} onPress={() => router.push(`/user/${userId}`)}>
            <Text style={s.msgAvatarInitial}>{partnerName[0]?.toUpperCase()}</Text>
          </Pressable>
        )}
        <View style={[s.bubble, s.bubbleOther]}>
          <Text style={s.messageText}>{item.content}</Text>
        </View>
      </View>
    )
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerBackTitle: 'Back',
          headerTitle: () => (
            <Pressable onPress={() => router.push(`/user/${userId}`)}>
              <Text style={{ fontSize: 17, fontWeight: '600', color: '#1a1a2e' }}>{partnerName}</Text>
            </Pressable>
          ),
        }}
      />
      <ChatView
        messages={messages}
        onSend={handleSend}
        renderItem={renderMessage}
      />
    </>
  )
}

const s = StyleSheet.create({
  // Messages
  otherRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 8 },
  msgAvatar: { width: 28, height: 28, borderRadius: 14 },
  msgAvatarFallback: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#e5e5e5', alignItems: 'center', justifyContent: 'center' },
  msgAvatarInitial: { fontSize: 11, fontWeight: '700', color: '#1a1a2e' },
  bubble: { maxWidth: '75%', borderRadius: 16, padding: 10 },
  bubbleMe: { alignSelf: 'flex-end', backgroundColor: '#0f8a6e', marginBottom: 8 },
  bubbleOther: { backgroundColor: '#f0f0f0' },
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
})
