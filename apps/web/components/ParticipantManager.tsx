'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface ParticipantRequest {
  id: string
  activityId: string
  user: {
    id: string
    display_name: string
    first_name: string | null
    last_name: string | null
    avatar_url: string | null
    area: string | null
  }
}

interface ParticipantManagerProps {
  activityId: string
  requests: ParticipantRequest[]
}

export function ParticipantManager({ activityId, requests }: ParticipantManagerProps) {
  const router = useRouter()
  const [processing, setProcessing] = useState<Set<string>>(new Set())
  const [handled, setHandled] = useState<Set<string>>(new Set())

  async function handleAction(participantId: string, status: 'accepted' | 'declined') {
    setProcessing((prev) => new Set(prev).add(participantId))

    try {
      const res = await fetch(
        `/api/activities/${activityId}/participants/${participantId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        }
      )
      if (res.ok) {
        setHandled((prev) => new Set(prev).add(participantId))
        router.refresh()
      }
    } catch {
      // ignore
    } finally {
      setProcessing((prev) => {
        const next = new Set(prev)
        next.delete(participantId)
        return next
      })
    }
  }

  return (
    <div className="space-y-2">
      {requests.map((req) => {
        if (handled.has(req.id)) return null
        const isProcessing = processing.has(req.id)
        const name = req.user.first_name && req.user.last_name
          ? `${req.user.first_name} ${req.user.last_name}`
          : req.user.display_name

        return (
          <div
            key={req.id}
            className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{name}</p>
              {req.user.area && (
                <p className="text-[11px] text-muted-foreground">{req.user.area}</p>
              )}
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={() => handleAction(req.id, 'accepted')}
                disabled={isProcessing}
                className="text-green-600 hover:bg-green-100 hover:text-green-700"
              >
                <Check className="size-3.5" />
              </Button>
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={() => handleAction(req.id, 'declined')}
                disabled={isProcessing}
                className="text-destructive hover:bg-destructive/10"
              >
                <X className="size-3.5" />
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
