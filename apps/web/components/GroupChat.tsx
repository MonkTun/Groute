'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Send, Users } from 'lucide-react'

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

interface ParticipantData {
  id: string
  user: {
    id: string
    display_name: string
    first_name: string | null
    last_name: string | null
    avatar_url: string | null
    area: string | null
  } | null
}

interface GroupChatProps {
  activityId: string
  activityTitle: string
  sportType: string
  currentUserId: string
  initialMessages: MessageData[]
  participants: ParticipantData[]
  isCreator: boolean
}

export function GroupChat({
  activityId,
  activityTitle,
  currentUserId,
  initialMessages,
  participants,
}: GroupChatProps) {
  const [messages, setMessages] = useState(initialMessages)
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom
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
      const res = await fetch(`/api/messages/${activityId}`, {
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
      {/* Chat header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border/50 px-4 py-3">
        <Link
          href="/social"
          className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <Link
          href={`/activity/${activityId}`}
          className="min-w-0 flex-1 hover:opacity-80 transition-opacity"
        >
          <h2 className="truncate text-sm font-semibold">{activityTitle}</h2>
          <p className="text-xs text-muted-foreground">
            {participants.length + 1} members
          </p>
        </Link>
        <Link
          href={`/activity/${activityId}`}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Users className="size-4" />
        </Link>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-none">
        {messages.map((msg) => {
          const isMe = msg.sender?.id === currentUserId
          const senderName = msg.sender
            ? msg.sender.first_name && msg.sender.last_name
              ? `${msg.sender.first_name} ${msg.sender.last_name[0]}.`
              : msg.sender.display_name
            : 'Unknown'

          const isSystem = msg.content.endsWith('joined the group!') || msg.content.endsWith('Welcome to the group!')

          if (isSystem) {
            return (
              <div key={msg.id} className="flex justify-center">
                <p className="rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground">
                  {senderName} {msg.content}
                </p>
              </div>
            )
          }

          return (
            <div
              key={msg.id}
              className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                {!isMe && (
                  <p className="mb-0.5 px-1 text-[10px] font-medium text-muted-foreground">
                    {senderName}
                  </p>
                )}
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

      {/* Input */}
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
