'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronDown, ChevronUp, Send } from 'lucide-react'

import { UserAvatar } from '@/components/UserAvatar'
import { Button } from '@/components/ui/button'

interface Message {
  id: string
  content: string
  created_at: string
  sender_id: string
  sender: {
    display_name: string
    first_name: string | null
    last_name: string | null
    avatar_url: string | null
  } | null
}

interface TripChatProps {
  activityId: string
  currentUserId: string
}

export function TripChat({ activityId, currentUserId }: TripChatProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    async function load() {
      setIsLoading(true)
      const res = await fetch(`/api/messages/${activityId}`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data.data ?? [])
      }
      setIsLoading(false)
    }
    load()

    // Poll for new messages every 5s while open
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [isOpen, activityId])

  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isOpen])

  async function handleSend() {
    const text = newMessage.trim()
    if (!text) return

    setNewMessage('')
    await fetch(`/api/messages/${activityId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text }),
    })

    // Refresh messages
    const res = await fetch(`/api/messages/${activityId}`)
    if (res.ok) {
      const data = await res.json()
      setMessages(data.data ?? [])
    }
  }

  return (
    <div className="mt-3 border-t border-border/50 pt-2">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>Group Chat</span>
        {isOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
      </button>

      {isOpen && (
        <div className="mt-2 rounded-lg border border-border/50 bg-muted/20">
          {/* Messages */}
          <div
            ref={scrollRef}
            className="max-h-52 overflow-y-auto p-3 space-y-2.5 scrollbar-none"
          >
            {isLoading && messages.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Loading...</p>
            )}
            {!isLoading && messages.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No messages yet</p>
            )}
            {messages.map((msg) => {
              const isMe = msg.sender_id === currentUserId
              const senderName = msg.sender
                ? msg.sender.first_name ?? msg.sender.display_name
                : 'Unknown'
              return (
                <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                  {!isMe && (
                    <UserAvatar
                      src={msg.sender?.avatar_url}
                      name={senderName}
                      size="xs"
                    />
                  )}
                  <div className={`max-w-[75%] ${isMe ? 'text-right' : ''}`}>
                    {!isMe && (
                      <p className="text-[10px] font-medium text-muted-foreground mb-0.5">{senderName}</p>
                    )}
                    <div className={`inline-block rounded-xl px-2.5 py-1.5 text-xs ${
                      isMe
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 border-t border-border/50 p-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              placeholder="Type a message..."
              className="flex-1 rounded-lg border border-border/50 bg-transparent px-2.5 py-1.5 text-xs outline-none placeholder:text-muted-foreground/50 focus-visible:border-ring"
            />
            <Button size="icon-sm" variant="ghost" onClick={handleSend} disabled={!newMessage.trim()}>
              <Send className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
