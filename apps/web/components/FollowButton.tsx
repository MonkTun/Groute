'use client'

import { useState } from 'react'
import { UserPlus, UserCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface FollowButtonProps {
  userId: string
  isFollowing: boolean
}

export function FollowButton({ userId, isFollowing: initialIsFollowing }: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing)
  const [isLoading, setIsLoading] = useState(false)

  async function handleToggle() {
    setIsLoading(true)

    try {
      const res = await fetch('/api/follow', {
        method: isFollowing ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followingId: userId }),
      })

      if (res.ok || res.status === 409) {
        setIsFollowing(!isFollowing)
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      size="xs"
      variant={isFollowing ? 'outline' : 'default'}
      onClick={handleToggle}
      disabled={isLoading}
      className="gap-1"
    >
      {isFollowing ? (
        <>
          <UserCheck className="size-3" />
          Following
        </>
      ) : (
        <>
          <UserPlus className="size-3" />
          Follow
        </>
      )}
    </Button>
  )
}
