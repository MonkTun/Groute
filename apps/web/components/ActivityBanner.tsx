'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Camera } from 'lucide-react'

const SPORT_EMOJIS: Record<string, string> = {
  hiking: '\u{1F97E}', climbing: '\u{1FA78}', trail_running: '\u{1F3C3}',
  surfing: '\u{1F3C4}', cycling: '\u{1F6B4}', mountain_biking: '\u{1F6B5}',
  skiing: '\u{26F7}', kayaking: '\u{1F6F6}', yoga: '\u{1F9D8}',
}

interface ActivityBannerProps {
  activityId: string
  bannerUrl: string | null
  unsplashImageUrl?: string | null
  isCreator: boolean
  sportType: string
}

export function ActivityBanner({ activityId, bannerUrl, unsplashImageUrl, isCreator, sportType }: ActivityBannerProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const displayUrl = preview ?? bannerUrl ?? unsplashImageUrl

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type) || file.size > 5 * 1024 * 1024) return

    setPreview(URL.createObjectURL(file))
    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/activities/${activityId}/photo`, {
        method: 'POST',
        body: formData,
      })
      if (res.ok) {
        router.refresh()
      }
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="relative mb-6 overflow-hidden rounded-xl">
      {displayUrl ? (
        <div className="relative h-48 w-full bg-muted">
          <img src={displayUrl} alt="" className="size-full object-cover" />
          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <span className="text-sm font-medium text-white">Uploading...</span>
            </div>
          )}
        </div>
      ) : (
        <div className="flex h-36 w-full items-center justify-center bg-linear-to-br from-primary/15 via-primary/8 to-accent/10">
          <span className="text-5xl drop-shadow-sm">{SPORT_EMOJIS[sportType] ?? '\u{1F3DE}'}</span>
        </div>
      )}

      {isCreator && (
        <>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg bg-black/50 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm hover:bg-black/70 transition-colors disabled:opacity-50"
          >
            <Camera className="size-3.5" />
            {displayUrl ? 'Change photo' : 'Add photo'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
        </>
      )}
    </div>
  )
}
