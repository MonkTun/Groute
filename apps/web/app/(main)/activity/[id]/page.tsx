import { redirect } from 'next/navigation'

import { createServerClient } from '@/lib/supabase/server'
import { SPORT_LABELS, SKILL_LABELS, VISIBILITY_LABELS } from '@groute/shared'
import { MapPin, Clock, Users, Crown } from 'lucide-react'

import { FollowButton } from '@/components/FollowButton'
import { DeleteActivityButton } from '@/components/DeleteActivityButton'

export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [activityResult, participantsResult, followsResult] = await Promise.all([
    supabase
      .from('activities')
      .select(`
        *, creator:users!creator_id ( id, display_name, first_name, last_name, avatar_url, area )
      `)
      .eq('id', id)
      .single(),

    supabase
      .from('activity_participants')
      .select(`
        id, status,
        user:users!user_id ( id, display_name, first_name, last_name, avatar_url, area )
      `)
      .eq('activity_id', id)
      .eq('status', 'accepted'),

    // Get who I'm following
    supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id),
  ])

  const activity = activityResult.data
  if (!activity) redirect('/discover')

  const creator = Array.isArray(activity.creator) ? activity.creator[0] : activity.creator
  const isCreator = activity.creator_id === user.id

  const participants = (participantsResult.data ?? []).map((p) => ({
    id: p.id,
    user: Array.isArray(p.user) ? p.user[0] : p.user,
  }))

  const followingSet = new Set(
    (followsResult.data ?? []).map((f) => f.following_id)
  )

  const scheduledDate = new Date(activity.scheduled_at)
  const dateStr = scheduledDate.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
  const timeStr = scheduledDate.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit',
  })

  // All members: creator + accepted participants
  const allMembers: Array<{
    id: string; display_name: string; first_name: string | null
    last_name: string | null; avatar_url: string | null; area: string | null
    isCreator: boolean
  }> = []

  if (creator) {
    allMembers.push({ ...creator, isCreator: true })
  }

  for (const p of participants) {
    if (p.user && p.user.id !== activity.creator_id) {
      allMembers.push({ ...p.user, isCreator: false })
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-8">
      {/* Activity header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-xl font-bold sm:text-2xl">{activity.title}</h1>
          <span className="shrink-0 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
            {SPORT_LABELS[activity.sport_type] ?? activity.sport_type}
          </span>
        </div>

        {activity.description && (
          <p className="mt-2 text-sm text-muted-foreground">{activity.description}</p>
        )}

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-4" /> {dateStr} at {timeStr}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-4" /> {activity.location_name}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-4" /> Max {activity.max_participants}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-md bg-muted px-2 py-1 text-xs">
            {SKILL_LABELS[activity.skill_level] ?? activity.skill_level}
          </span>
          <span className="rounded-md bg-muted px-2 py-1 text-xs">
            {VISIBILITY_LABELS[activity.visibility] ?? activity.visibility}
          </span>
        </div>
      </div>

      {/* Members */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Members ({allMembers.length})
        </h2>
        <div className="space-y-2">
          {allMembers.map((member) => {
            const name = member.first_name && member.last_name
              ? `${member.first_name} ${member.last_name}`
              : member.display_name
            const isMe = member.id === user.id
            const isFollowing = followingSet.has(member.id)

            return (
              <div
                key={member.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                    {(member.first_name?.[0] ?? member.display_name[0]).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-medium">{name}</p>
                      {member.isCreator && (
                        <Crown className="size-3 shrink-0 text-amber-500" />
                      )}
                      {isMe && (
                        <span className="text-[10px] text-muted-foreground">(you)</span>
                      )}
                    </div>
                    {member.area && (
                      <p className="text-xs text-muted-foreground">{member.area}</p>
                    )}
                  </div>
                </div>

                {!isMe && (
                  <FollowButton
                    userId={member.id}
                    isFollowing={isFollowing}
                  />
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Owner: delete activity */}
      {isCreator && (
        <section className="mt-8 border-t border-border pt-6">
          <h2 className="mb-3 text-sm font-semibold text-destructive uppercase tracking-wide">
            Danger Zone
          </h2>
          <DeleteActivityButton activityId={id} />
        </section>
      )}
    </div>
  )
}
