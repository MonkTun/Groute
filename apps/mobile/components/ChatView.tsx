import { useRef, useState } from 'react'
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useHeaderHeight } from '@react-navigation/elements'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface ChatMessage {
  id: string
}

interface ChatViewProps<T extends ChatMessage> {
  messages: T[]
  onSend: (text: string) => Promise<{ error?: string }>
  renderItem: (item: T) => React.ReactElement
  keyExtractor?: (item: T) => string
}

export default function ChatView<T extends ChatMessage>({
  messages,
  onSend,
  renderItem,
  keyExtractor = (item) => item.id,
}: ChatViewProps<T>) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const flatListRef = useRef<FlatList>(null)
  const headerHeight = useHeaderHeight()
  const { bottom } = useSafeAreaInsets()

  async function handleSend() {
    const trimmed = text.trim()
    if (!trimmed || sending) return

    setText('')
    setSending(true)
    const result = await onSend(trimmed)
    setSending(false)

    if (result.error) {
      setText(trimmed)
      Alert.alert('Send failed', result.error)
    }
  }

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight - bottom}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={keyExtractor}
        contentContainerStyle={s.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => renderItem(item)}
        keyboardShouldPersistTaps="handled"
      />

      <View style={[s.inputBar, { paddingBottom: Math.max(bottom, 8) }]}>
        <TextInput
          style={s.input}
          placeholder="Type a message..."
          placeholderTextColor="#9ca3af"
          value={text}
          onChangeText={setText}
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
          returnKeyType="send"
        />
        <Pressable
          style={[s.sendButton, sending && s.sendButtonDisabled]}
          onPress={handleSend}
          disabled={sending}
        >
          <Text style={s.sendText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  messageList: { paddingHorizontal: 16, paddingVertical: 12 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
    backgroundColor: '#fafafa',
  },
  input: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  sendButton: {
    backgroundColor: '#0f8a6e',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sendButtonDisabled: { opacity: 0.5 },
  sendText: { fontSize: 15, fontWeight: '600', color: '#fff' },
})
