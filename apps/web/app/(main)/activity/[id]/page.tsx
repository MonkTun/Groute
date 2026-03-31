import { redirect } from 'next/navigation'

import { createServerClient } from '@/lib/supabase/server'
import { SPORT_LABELS, SKILL_LABELS, VISIBILITY_LABELS, SAC_SCALE_LABELS, SURFACE_LABELS } from '@groute/shared'
import { MapPin, Clock, Users, Crown, Mountain, Ruler, Footprints } from 'lucide-react'

import { FollowButton } from '@/components/FollowButton'
import { UserAvatar } from '@/components/UserAvatar'
import { DeleteActivityButton } from '@/components/DeleteActivityButton'
import { ActivityBanner } from '@/components/ActivityBanner'
import { TrailMapView } from '@/components/TrailMapView'
import { ActivityLogisticsSection } from './LogisticsSection'

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

  const [activityResult, participantsResult, followsResult, logisticsResult, ridesResult, transportPlansResult] = await Promise.all([
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

    supabase
      .from('activity_logistics')
      .select('*')
      .eq('activity_id', id)
      .maybeSingle(),

    supabase
      .from('activity_rides')
      .select(`
        id, activity_id, user_id, type, available_seats, pickup_location_name,
        pickup_lat, pickup_lng, departure_time, note, status, created_at,
        user:users!user_id ( id, display_name, first_name, last_name, avatar_url ),
        passengers:ride_passengers (
          id, passenger_id, status, created_at,
          user:users!passenger_id ( id, display_name, first_name, last_name, avatar_url )
        )
      `)
      .eq('activity_id', id)
      .order('created_at', { ascending: true }),

    supabase
      .from('user_transit_plans')
      .select('user_id, transport_mode, leave_at')
      .eq('activity_id', id),
  ])

  const activity = activityResult.data
  if (!activity) redirect('/rightnow')

  const creator = Array.isArray(activity.creator) ? activity.creator[0] : activity.creator
  const isCreator = activity.creator_id === user.id

  const participants = (participantsResult.data ?? []).map((p) => ({
    id: p.id,
    user: Array.isArray(p.user) ? p.user[0] : p.user,
  }))

  const followingSet = new Set(
    (followsResult.data ?? []).map((f) => f.following_id)
  )

  // Build participant list with transport plans for the logistics timeline
  const transportPlanMap = new Map(
    (transportPlansResult.data ?? []).map((tp) => [tp.user_id, tp])
  )

  const participantList = [
    // Creator first
    ...(creator ? [{
      id: creator.id,
      displayName: creator.first_name && creator.last_name
        ? `${creator.first_name} ${creator.last_name[0]}.`
        : creator.display_name,
      avatarUrl: creator.avatar_url,
      area: creator.area,
      transportMode: transportPlanMap.get(creator.id)?.transport_mode ?? null,
      leaveAt: transportPlanMap.get(creator.id)?.leave_at ?? null,
    }] : []),
    // Then participants
    ...participants
      .filter((p) => p.user && p.user.id !== activity.creator_id)
      .map((p) => ({
        id: p.user!.id,
        displayName: p.user!.first_name && p.user!.last_name
          ? `${p.user!.first_name} ${p.user!.last_name[0]}.`
          : p.user!.display_name,
        avatarUrl: p.user!.avatar_url,
        area: p.user!.area ?? null,
        transportMode: transportPlanMap.get(p.user!.id)?.transport_mode ?? null,
        leaveAt: transportPlanMap.get(p.user!.id)?.leave_at ?? null,
      })),
  ]

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
      {/* Banner */}
      <ActivityBanner
        activityId={id}
        bannerUrl={activity.banner_url}
        unsplashImageUrl={activity.unsplash_image_url}
        isCreator={isCreator}
        sportType={activity.sport_type}
      />

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

      {/* Trail info + map */}
      {activity.trail_name && (
        <section className="mb-6 space-y-3">
          <div className="flex items-center gap-2.5">
            <Mountain className="size-5 text-green-600" />
            <h2 className="text-base font-bold">{activity.trail_name}</h2>
          </div>

          {/* Map — only when all coordinates are available */}
          {activity.trail_osm_id != null && activity.location_lat && activity.location_lng && activity.trailhead_lat && activity.trailhead_lng && (
            <TrailMapView
              locationLat={parseFloat(activity.location_lat)}
              locationLng={parseFloat(activity.location_lng)}
              locationName={activity.location_name}
              trailOsmId={activity.trail_osm_id}
              trailName={activity.trail_name}
              trailheadLat={parseFloat(activity.trailhead_lat)}
              trailheadLng={parseFloat(activity.trailhead_lng)}
              hasApproachRoute={activity.trail_approach_duration_s != null}
              trailGeometry={activity.trail_geometry}
              approachGeometry={activity.approach_geometry}
              height={320}
            />
          )}

          {/* Trail text info — always shown */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
            {activity.trail_distance_meters != null && (
              <span className="inline-flex items-center gap-1.5">
                <Ruler className="size-4" />
                {activity.trail_distance_meters < 1000
                  ? `${activity.trail_distance_meters}m`
                  : `${(activity.trail_distance_meters / 1609.344).toFixed(1)} mi`} trail
              </span>
            )}
            {activity.trail_sac_scale && (
              <span className="inline-flex items-center gap-1.5">
                <Footprints className="size-4" />
                {SAC_SCALE_LABELS[activity.trail_sac_scale] ?? activity.trail_sac_scale}
              </span>
            )}
            {activity.trail_surface && (
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs">
                {SURFACE_LABELS[activity.trail_surface] ?? activity.trail_surface} surface
              </span>
            )}
            {activity.trail_approach_duration_s != null && (
              <span className="inline-flex items-center gap-1.5 text-orange-600 dark:text-orange-400">
                <Clock className="size-4" />
                {Math.ceil(activity.trail_approach_duration_s / 60)} min walk to trailhead
                {activity.trail_approach_distance_m != null && (
                  <> ({activity.trail_approach_distance_m < 1000
                    ? `${activity.trail_approach_distance_m}m`
                    : `${(activity.trail_approach_distance_m / 1609.344).toFixed(1)} mi`})</>
                )}
              </span>
            )}
          </div>
        </section>
      )}

      {/* Logistics — visible to creator and accepted participants */}
      <ActivityLogisticsSection
        activityId={id}
        currentUserId={user.id}
        isCreator={isCreator}
        isParticipant={participants.some((p) => p.user?.id === user.id) || isCreator}
        scheduledAt={activity.scheduled_at}
        locationName={activity.location_name}
        locationLat={activity.location_lat ? parseFloat(activity.location_lat) : 0}
        locationLng={activity.location_lng ? parseFloat(activity.location_lng) : 0}
        trailName={activity.trail_name}
        trailheadLat={activity.trailhead_lat}
        trailheadLng={activity.trailhead_lng}
        trailApproachDurationS={activity.trail_approach_duration_s}
        participantList={participantList}
        logistics={logisticsResult.data}
        rides={ridesResult.data ?? []}
      />

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
                  <UserAvatar src={member.avatar_url} name={name} />
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
