'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Users,
  MessageCircle,
  Bell,
  UserPlus,
  UserCheck,
  MessageSquare,
} from 'lucide-react'

import { SPORT_LABELS } from '@groute/shared'

import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/UserAvatar'
import { cn } from '@/lib/utils'

type Tab = 'friends' | 'chats' | 'notifications'

interface UserInfo {
  id: string
  display_name: string
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  area?: string | null
}

interface NotificationData {
  id: string
  type: string
  read: boolean
  createdAt: string
  activityId: string | null
  fromUser: UserInfo | null
}

interface SocialViewProps {
  friends: UserInfo[]
  incomingFollows: UserInfo[]
  groupChats: Array<{ id: string; title: string; sport_type: string; scheduled_at: string }>
  dmConversations: Array<{ user: UserInfo; lastMessage: string; lastAt: string }>
  notifications: NotificationData[]
  unreadCount: number
  currentUserId: string
}

const TABS: { key: Tab; label: string; icon: typeof Users }[] = [
  { key: 'friends', label: 'Friends', icon: Users },
  { key: 'chats', label: 'Chats', icon: MessageCircle },
  { key: 'notifications', label: 'Notifications', icon: Bell },
]

export function SocialView({
  friends,
  incomingFollows,
  groupChats,
  dmConversations,
  notifications,
  unreadCount,
  currentUserId,
}: SocialViewProps) {
  const [tab, setTab] = useState<Tab>('friends')

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-8">
      <h1 className="mb-4 text-xl font-bold sm:text-2xl">Social</h1>

      {/* Sub-tabs */}
      <div className="mb-6 flex gap-1 rounded-xl bg-muted/60 p-1 ring-1 ring-border/30">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'relative flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
              tab === key
                ? 'bg-card text-foreground shadow-sm ring-1 ring-border/50'
                : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
            )}
          >
            <Icon className="size-4" />
            <span className="hidden sm:inline">{label}</span>
            {key === 'notifications' && unreadCount > 0 && (
              <span className="flex size-4.5 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-accent-foreground">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'friends' && (
        <FriendsTab friends={friends} incomingFollows={incomingFollows} />
      )}
      {tab === 'chats' && (
        <ChatsTab groupChats={groupChats} dmConversations={dmConversations} friends={friends} />
      )}
      {tab === 'notifications' && (
        <NotificationsTab notifications={notifications} currentUserId={currentUserId} />
      )}
    </div>
  )
}

// ── Friends Tab ──
function FriendsTab({
  friends,
  incomingFollows,
}: {
  friends: UserInfo[]
  incomingFollows: UserInfo[]
}) {
  const router = useRouter()
  const [followedBack, setFollowedBack] = useState<Set<string>>(new Set())

  async function handleFollowBack(userId: string) {
    try {
      const res = await fetch('/api/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followingId: userId }),
      })
      if (res.ok || res.status === 409) {
        setFollowedBack((prev) => new Set(prev).add(userId))
        router.refresh()
      }
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-6">
      {incomingFollows.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Wants to follow you ({incomingFollows.length})
          </h2>
          <div className="space-y-2">
            {incomingFollows.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
              >
                <UserRow user={u} />
                {followedBack.has(u.id) ? (
                  <span className="flex items-center gap-1 text-xs text-green-600">
                    <UserCheck className="size-3" /> Friends
                  </span>
                ) : (
                  <Button size="xs" onClick={() => handleFollowBack(u.id)} className="gap-1">
                    <UserPlus className="size-3" /> Follow Back
                  </Button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Friends ({friends.length})
        </h2>
        {friends.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No friends yet. Follow people from activity groups!
          </p>
        ) : (
          <div className="space-y-2">
            {friends.map((u) => (
              <Link
                key={u.id}
                href={`/social/dm/${u.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors"
              >
                <UserRow user={u} />
                <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

// ── Chats Tab ──
function ChatsTab({
  groupChats,
  dmConversations,
  friends,
}: {
  groupChats: Array<{ id: string; title: string; sport_type: string; scheduled_at: string }>
  dmConversations: Array<{ user: UserInfo; lastMessage: string; lastAt: string }>
  friends: UserInfo[]
}) {
  return (
    <div className="space-y-6">
      {/* DM conversations */}
      {dmConversations.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Direct Messages
          </h2>
          <div className="space-y-1">
            {dmConversations.map((dm) => {
              const name = dm.user.first_name && dm.user.last_name
                ? `${dm.user.first_name} ${dm.user.last_name}`
                : dm.user.display_name

              return (
                <Link
                  key={dm.user.id}
                  href={`/social/dm/${dm.user.id}`}
                  className="flex items-center gap-3 rounded-lg px-3 py-3 hover:bg-muted/50 transition-colors"
                >
                  <UserAvatar src={dm.user.avatar_url} name={name} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{name}</p>
                    <p className="truncate text-xs text-muted-foreground">{dm.lastMessage}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* Group chats */}
      <section>
        <h2 className="mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Group Chats ({groupChats.length})
        </h2>
        {groupChats.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No group chats yet. Join an activity to start chatting!
          </p>
        ) : (
          <div className="space-y-1">
            {groupChats.map((chat) => {
              const date = new Date(chat.scheduled_at)
              const dateStr = date.toLocaleDateString('en-US', {
                month: 'short', day: 'numeric',
              })

              return (
                <Link
                  key={chat.id}
                  href={`/social/chat/${chat.id}`}
                  className="flex items-center gap-3 rounded-lg px-3 py-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm">
                    {getSportEmoji(chat.sport_type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{chat.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {SPORT_LABELS[chat.sport_type] ?? chat.sport_type} &middot; {dateStr}
                    </p>
                  </div>
                  <MessageCircle className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

// ── Notifications Tab ──
function NotificationsTab({
  notifications,
  currentUserId,
}: {
  notifications: NotificationData[]
  currentUserId: string
}) {
  const router = useRouter()
  const [handledInvites, setHandledInvites] = useState<Map<string, string>>(new Map())
  const [processingInvites, setProcessingInvites] = useState<Set<string>>(new Set())

  async function markAllRead() {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id)
    if (unreadIds.length === 0) return

    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: unreadIds }),
    })
    router.refresh()
  }

  async function handleInviteAction(notificationId: string, action: 'accept' | 'decline') {
    setProcessingInvites((prev) => new Set(prev).add(notificationId))

    try {
      const res = await fetch(`/api/invites/${notificationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (res.ok) {
        setHandledInvites((prev) => new Map(prev).set(notificationId, action === 'accept' ? 'accepted' : 'declined'))
        if (action === 'accept') {
          const { fireConfetti } = await import('@/hooks/useConfetti')
          fireConfetti()
        }
        router.refresh()
      }
    } catch {
      // ignore
    } finally {
      setProcessingInvites((prev) => {
        const next = new Set(prev)
        next.delete(notificationId)
        return next
      })
    }
  }

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <div className="mb-3 text-3xl">{'\u{1F514}'}</div>
        <p className="text-sm font-medium text-muted-foreground">No notifications yet</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Recent
        </h2>
        <button
          onClick={markAllRead}
          className="text-xs text-primary hover:underline"
        >
          Mark all read
        </button>
      </div>
      <div className="space-y-1">
        {notifications.map((n) => {
          const name = n.fromUser
            ? n.fromUser.first_name && n.fromUser.last_name
              ? `${n.fromUser.first_name} ${n.fromUser.last_name}`
              : n.fromUser.display_name
            : 'Someone'

          const message =
            n.type === 'follow'
              ? 'started following you'
              : n.type === 'invite'
                ? 'invited you to an activity'
                : n.type === 'join_accepted'
                  ? 'accepted your join request'
                  : n.type === 'join_request'
                    ? 'requested to join your activity'
                    : 'interacted with you'

          const timeAgo = getTimeAgo(new Date(n.createdAt))
          const isInvite = n.type === 'invite' && n.activityId
          const inviteHandled = handledInvites.get(n.id)
          const isProcessing = processingInvites.has(n.id)

          return (
            <div
              key={n.id}
              className={cn(
                'flex items-start gap-3 rounded-xl px-3 py-3',
                !n.read && 'bg-primary/5'
              )}
            >
              <UserAvatar
                src={n.fromUser?.avatar_url}
                name={n.fromUser ? (n.fromUser.first_name ?? n.fromUser.display_name) : '?'}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-medium">{name}</span>{' '}
                  <span className="text-muted-foreground">{message}</span>
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground/60">{timeAgo}</p>

                {/* Invite action buttons */}
                {isInvite && !inviteHandled && !n.read && (
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="xs"
                      onClick={() => handleInviteAction(n.id, 'accept')}
                      disabled={isProcessing}
                      className="gap-1"
                    >
                      Join
                    </Button>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => handleInviteAction(n.id, 'decline')}
                      disabled={isProcessing}
                    >
                      Decline
                    </Button>
                  </div>
                )}
                {inviteHandled === 'accepted' && (
                  <p className="mt-1.5 text-xs font-medium text-green-600">Joined!</p>
                )}
                {inviteHandled === 'declined' && (
                  <p className="mt-1.5 text-xs text-muted-foreground">Declined</p>
                )}
              </div>
              {!n.read && !isInvite && (
                <div className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Helpers ──
function UserRow({ user }: { user: UserInfo }) {
  const name = user.first_name && user.last_name
    ? `${user.first_name} ${user.last_name}`
    : user.display_name

  return (
    <div className="flex items-center gap-3 min-w-0">
      <UserAvatar src={user.avatar_url} name={name} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{name}</p>
        {user.area && (
          <p className="text-xs text-muted-foreground">{user.area}</p>
        )}
      </div>
    </div>
  )
}

function getSportEmoji(sport: string): string {
  const emojis: Record<string, string> = {
    hiking: '\u{1F97E}', climbing: '\u{1FA78}', trail_running: '\u{1F3C3}',
    surfing: '\u{1F3C4}', cycling: '\u{1F6B4}', mountain_biking: '\u{1F6B5}',
    skiing: '\u{26F7}', kayaking: '\u{1F6F6}', yoga: '\u{1F9D8}',
  }
  return emojis[sport] ?? '\u{1F3DE}'
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
