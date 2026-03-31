'use client'

import { useState, useEffect } from 'react'
import { Backpack, Check, X, Plus, Sparkles, HandHelping, CircleCheck, CircleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { UserAvatar } from '@/components/UserAvatar'

interface EquipmentUser {
  id: string
  display_name: string
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
}

interface EquipmentItem {
  id: string
  activity_id: string
  user_id: string
  item_name: string
  status: string // have | need | lending
  lender_id: string | null
  user: EquipmentUser | EquipmentUser[]
  lender: EquipmentUser | EquipmentUser[] | null
}

interface EquipmentSectionProps {
  activityId: string
  currentUserId: string
  isParticipant: boolean
  sportType: string
  trailName?: string | null
  trailSacScale?: string | null
  trailSurface?: string | null
  scheduledAt: string
  locationName: string
}

export function EquipmentSection({
  activityId,
  currentUserId,
  isParticipant,
  sportType,
  trailName,
  trailSacScale,
  trailSurface,
  scheduledAt,
  locationName,
}: EquipmentSectionProps) {
  const [items, setItems] = useState<EquipmentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [suggestions, setSuggestions] = useState<{ essential: string[]; recommended: string[]; groupShared: string[] } | null>(null)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [newItemName, setNewItemName] = useState('')
  const [saving, setSaving] = useState(false)

  // Fetch equipment on mount
  useEffect(() => {
    fetchEquipment()
  }, [activityId])

  async function fetchEquipment() {
    try {
      const res = await fetch(`/api/activities/${activityId}/equipment`)
      if (res.ok) {
        const data = await res.json()
        setItems(data.data ?? [])
      }
    } finally {
      setLoading(false)
    }
  }

  async function fetchSuggestions() {
    setLoadingSuggestions(true)
    try {
      const res = await fetch('/api/activities/suggest-equipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sportType,
          trailName: trailName ?? undefined,
          trailSacScale: trailSacScale ?? undefined,
          trailSurface: trailSurface ?? undefined,
          scheduledAt,
          locationName,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.data) {
          setSuggestions(data.data)
          // Auto-select all essential items
          setSelectedItems(new Set(data.data.essential ?? []))
        }
      }
    } finally {
      setLoadingSuggestions(false)
    }
  }

  async function saveSelectedEquipment() {
    if (selectedItems.size === 0) return
    setSaving(true)
    try {
      const allSuggested = [...(suggestions?.essential ?? []), ...(suggestions?.recommended ?? []), ...(suggestions?.groupShared ?? [])]
      const equipItems = allSuggested.map((item) => ({
        itemName: item,
        status: selectedItems.has(item) ? 'have' : 'need',
      })).filter((item) => selectedItems.has(item.itemName) || suggestions?.essential?.includes(item.itemName))

      await fetch(`/api/activities/${activityId}/equipment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: equipItems }),
      })
      setSuggestions(null)
      fetchEquipment()
    } finally {
      setSaving(false)
    }
  }

  async function addCustomItem() {
    if (!newItemName.trim()) return
    await fetch(`/api/activities/${activityId}/equipment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ itemName: newItemName.trim(), status: 'have' }] }),
    })
    setNewItemName('')
    fetchEquipment()
  }

  async function toggleItemStatus(itemId: string, currentStatus: string) {
    const newStatus = currentStatus === 'have' ? 'need' : 'have'
    await fetch(`/api/activities/${activityId}/equipment`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, status: newStatus }),
    })
    fetchEquipment()
  }

  async function lendItem(itemId: string) {
    await fetch(`/api/activities/${activityId}/equipment`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, lenderId: currentUserId }),
    })
    fetchEquipment()
  }

  function resolveUser(u: EquipmentUser | EquipmentUser[]): EquipmentUser {
    return Array.isArray(u) ? u[0] : u
  }

  function userName(u: EquipmentUser): string {
    if (u.first_name && u.last_name) return `${u.first_name} ${u.last_name[0]}.`
    return u.display_name
  }

  if (!isParticipant) return null

  // Separate items
  const myItems = items.filter((i) => i.user_id === currentUserId)
  const askPool = items.filter((i) => i.status === 'need' && !i.lender_id)
  const hasMyItems = myItems.length > 0

  // Participant readiness
  const participantMap = new Map<string, { user: EquipmentUser; items: EquipmentItem[] }>()
  for (const item of items) {
    const u = resolveUser(item.user)
    const existing = participantMap.get(item.user_id)
    if (existing) {
      existing.items.push(item)
    } else {
      participantMap.set(item.user_id, { user: u, items: [item] })
    }
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Backpack className="size-4 text-primary" />
          Equipment
        </div>
        {!hasMyItems && !suggestions && (
          <Button size="xs" variant="ghost" onClick={fetchSuggestions} disabled={loadingSuggestions}>
            <Sparkles className="size-3" data-icon="inline-start" />
            {loadingSuggestions ? 'Loading...' : 'Get suggestions'}
          </Button>
        )}
      </div>

      {loading && <p className="mt-3 text-sm text-muted-foreground">Loading...</p>}

      {/* AI Suggestions */}
      {suggestions && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            Select what you have. Unselected essentials will be added to the ask pool.
          </p>

          {suggestions.essential.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Essential</p>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.essential.map((item) => (
                  <EquipmentPill
                    key={item}
                    name={item}
                    selected={selectedItems.has(item)}
                    onToggle={() => {
                      setSelectedItems((prev) => {
                        const next = new Set(prev)
                        next.has(item) ? next.delete(item) : next.add(item)
                        return next
                      })
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {suggestions.recommended.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Recommended</p>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.recommended.map((item) => (
                  <EquipmentPill
                    key={item}
                    name={item}
                    selected={selectedItems.has(item)}
                    onToggle={() => {
                      setSelectedItems((prev) => {
                        const next = new Set(prev)
                        next.has(item) ? next.delete(item) : next.add(item)
                        return next
                      })
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {suggestions.groupShared.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Group shared (1-2 people bring)</p>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.groupShared.map((item) => (
                  <EquipmentPill
                    key={item}
                    name={item}
                    selected={selectedItems.has(item)}
                    onToggle={() => {
                      setSelectedItems((prev) => {
                        const next = new Set(prev)
                        next.has(item) ? next.delete(item) : next.add(item)
                        return next
                      })
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button size="sm" onClick={saveSelectedEquipment} disabled={saving}>
              {saving ? 'Saving...' : 'Save my equipment'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSuggestions(null)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* My Equipment */}
      {hasMyItems && !suggestions && (
        <div className="mt-3 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">My Equipment</p>
          <div className="flex flex-wrap gap-1.5">
            {myItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleItemStatus(item.id, item.status)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  item.status === 'have'
                    ? 'bg-emerald-100/80 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-amber-100/80 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                }`}
              >
                {item.status === 'have' ? <Check className="inline size-2.5 mr-0.5" /> : <X className="inline size-2.5 mr-0.5" />}
                {item.item_name}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            <Input
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCustomItem()}
              placeholder="Add item..."
              className="flex-1"
            />
            <Button size="icon-sm" variant="outline" onClick={addCustomItem}>
              <Plus className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Ask Pool */}
      {askPool.length > 0 && !suggestions && (
        <div className="mt-4 border-t border-border/30 pt-3 space-y-2">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <HandHelping className="size-3" />
            Equipment Ask Pool
          </p>
          <div className="space-y-1.5">
            {/* Group by item name */}
            {Array.from(new Set(askPool.map((i) => i.item_name))).map((itemName) => {
              const needers = askPool.filter((i) => i.item_name === itemName)
              return (
                <div key={itemName} className="flex items-center gap-2 rounded-lg bg-amber-50/50 px-3 py-2 dark:bg-amber-950/10">
                  <span className="flex-1 text-sm font-medium">{itemName}</span>
                  <div className="flex -space-x-1">
                    {needers.map((n) => {
                      const u = resolveUser(n.user)
                      return <UserAvatar key={n.id} src={u.avatar_url} name={u.display_name} size="xs" className="ring-1 ring-card" />
                    })}
                  </div>
                  <span className="text-xs text-muted-foreground">{needers.length} need</span>
                  {needers[0].user_id !== currentUserId && (
                    <Button size="xs" variant="outline" onClick={() => lendItem(needers[0].id)}>
                      I have this
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Participant Readiness */}
      {participantMap.size > 0 && !suggestions && (
        <div className="mt-4 border-t border-border/30 pt-3 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Readiness</p>
          <div className="space-y-1">
            {Array.from(participantMap.entries()).map(([userId, { user, items: userItems }]) => {
              const unmetNeeds = userItems.filter((i) => i.status === 'need' && !i.lender_id)
              const isReady = unmetNeeds.length === 0
              return (
                <div key={userId} className="flex items-center gap-2 text-sm">
                  <UserAvatar src={user.avatar_url} name={user.display_name} size="xs" />
                  <span className="flex-1 truncate">{userName(user)}</span>
                  {isReady ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-600">
                      <CircleCheck className="size-3" /> Ready
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-amber-600">
                      <CircleAlert className="size-3" /> Needs {unmetNeeds.length} item{unmetNeeds.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!hasMyItems && !suggestions && !loading && (
        <p className="mt-3 text-sm text-muted-foreground">
          No equipment tracked yet. Click &ldquo;Get suggestions&rdquo; to get started.
        </p>
      )}
    </div>
  )
}

function EquipmentPill({ name, selected, onToggle }: { name: string; selected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
        selected
          ? 'bg-primary/10 text-primary ring-1 ring-primary/30'
          : 'bg-muted text-muted-foreground hover:bg-muted/80'
      }`}
    >
      {selected && <Check className="inline size-2.5 mr-0.5" />}
      {name}
    </button>
  )
}
