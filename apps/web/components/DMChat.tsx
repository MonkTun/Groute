'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Send } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface MessageData {
  id: string
  content: string
  createdAt: string
  sender: {
    id: string
    display_name: string
    first_name: string | null
    last_name: string | null
    avatar_url: string | null
  } | null
}

interface DMChatProps {
  otherUserId: string
  otherUserName: string
  currentUserId: string
  initialMessages: MessageData[]
}

export function DMChat({
  otherUserId,
  otherUserName,
  currentUserId,
  initialMessages,
}: DMChatProps) {
  const [messages, setMessages] = useState(initialMessages)
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages.length])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const content = input.trim()
    if (!content || isSending) return

    setIsSending(true)
    setInput('')

    try {
      const res = await fetch(`/api/dm/${otherUserId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })

      if (res.ok) {
        const data = await res.json()
        const msg = data.data
        setMessages((prev) => [
          ...prev,
          {
            id: msg.id,
            content: msg.content,
            createdAt: msg.created_at,
            sender: Array.isArray(msg.sender) ? msg.sender[0] : msg.sender,
          },
        ])
      }
    } catch {
      // ignore
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-border/50 px-4 py-3">
        <Link
          href="/social"
          className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
            {otherUserName[0].toUpperCase()}
          </div>
          <h2 className="truncate text-sm font-semibold">{otherUserName}</h2>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-none">
        {messages.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">
              Start a conversation with {otherUserName}
            </p>
          </div>
        )}
        {messages.map((msg) => {
          const isMe = msg.sender?.id === currentUserId
          return (
            <div
              key={msg.id}
              className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[75%]`}>
                <div
                  className={`rounded-2xl px-3 py-2 text-sm ${
                    isMe
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  {msg.content}
                </div>
                <p className="mt-0.5 px-1 text-[10px] text-muted-foreground/60">
                  {new Date(msg.createdAt).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      <form
        onSubmit={handleSend}
        className="flex shrink-0 items-center gap-2 border-t border-border/50 px-4 py-3"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          maxLength={2000}
          className="h-9 flex-1 rounded-full border border-input bg-transparent px-4 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!input.trim() || isSending}
          className="rounded-full"
        >
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  )
}
