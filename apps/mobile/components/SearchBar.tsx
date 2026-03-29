import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

interface SearchBarProps {
  value: string
  onChangeText: (text: string) => void
  placeholder?: string
  /** Render with transparent background (for overlaying on maps) */
  overlay?: boolean
}

export default function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search activities, locations...',
  overlay,
}: SearchBarProps) {
  return (
    <View style={[s.container, overlay && s.containerOverlay]}>
      <TextInput
        style={[s.input, overlay && s.inputOverlay]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        returnKeyType="search"
      />
      {value ? (
        <Pressable style={s.clear} onPress={() => onChangeText('')}>
          <Text style={s.clearText}>{'\u2715'}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const s = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    position: 'relative',
  },
  containerOverlay: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingRight: 36,
    fontSize: 15,
    color: '#1a1a2e',
  },
  inputOverlay: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  clear: { position: 'absolute', right: 32, top: 0, bottom: 8, justifyContent: 'center' },
  clearText: { fontSize: 14, color: '#9ca3af' },
})
