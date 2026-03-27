'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface DeleteActivityButtonProps {
  activityId: string
}

export function DeleteActivityButton({ activityId }: DeleteActivityButtonProps) {
  const router = useRouter()
  const [isConfirming, setIsConfirming] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleDelete() {
    setIsDeleting(true)

    try {
      const res = await fetch(`/api/activities/${activityId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        router.push('/trips')
        router.refresh()
      }
    } catch {
      // ignore
    } finally {
      setIsDeleting(false)
    }
  }

  if (!isConfirming) {
    return (
      <Button
        variant="destructive"
        size="sm"
        onClick={() => setIsConfirming(true)}
        className="gap-1.5"
      >
        <Trash2 className="size-3.5" />
        Delete Activity
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <p className="text-sm text-destructive">
        This will permanently delete the activity, all messages, and remove all participants.
      </p>
      <div className="flex shrink-0 gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsConfirming(false)}
          disabled={isDeleting}
        >
          Cancel
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDelete}
          disabled={isDeleting}
        >
          {isDeleting ? 'Deleting...' : 'Confirm Delete'}
        </Button>
      </div>
    </div>
  )
}
