'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { GettingTherePanel } from '@/components/GettingTherePanel'
import { CarpoolBoard } from '@/components/CarpoolBoard'
import { LogisticsTab } from '@/components/LogisticsTab'

interface ParticipantData {
  id: string
  displayName: string
  avatarUrl: string | null
  area: string | null
}

interface ActivityLogisticsSectionProps {
  activityId: string
  currentUserId: string
  isCreator: boolean
  isParticipant: boolean
  scheduledAt: string
  locationName: string
  locationLat: number
  locationLng: number
  trailName?: string | null
  trailheadLat?: string | null
  trailheadLng?: string | null
  trailApproachDurationS?: number | null
  participantList: ParticipantData[]
  logistics: {
    meeting_point_name: string | null
    meeting_point_lat: string | null
    meeting_point_lng: string | null
    meeting_time: string | null
    estimated_return_time: string | null
    parking_name: string | null
    parking_paid: boolean | null
    parking_cost: string | null
    parking_notes: string | null
    transport_notes: string | null
    checklist_items: string[] | null
    notes: string | null
  } | null
  rides: Array<{
    id: string
    user_id: string
    type: string
    available_seats: number | null
    pickup_location_name: string | null
    departure_time: string | null
    note: string | null
    status: string
    user: { id: string; display_name: string; first_name: string | null; last_name: string | null; avatar_url: string | null } | Array<{ id: string; display_name: string; first_name: string | null; last_name: string | null; avatar_url: string | null }>
    passengers: Array<{
      id: string
      passenger_id: string
      status: string
      user: { id: string; display_name: string; first_name: string | null; last_name: string | null; avatar_url: string | null } | Array<{ id: string; display_name: string; first_name: string | null; last_name: string | null; avatar_url: string | null }>
    }>
  }>
}

export function ActivityLogisticsSection({
  activityId,
  currentUserId,
  isCreator,
  isParticipant,
  scheduledAt,
  locationName,
  locationLat,
  locationLng,
  trailName,
  trailheadLat,
  trailheadLng,
  trailApproachDurationS,
  participantList,
  logistics,
  rides,
}: ActivityLogisticsSectionProps) {
  const router = useRouter()
  const [key, setKey] = useState(0)

  if (!isParticipant) return null

  // Determine destination for directions
  const destLat = trailheadLat ? parseFloat(trailheadLat) : locationLat
  const destLng = trailheadLng ? parseFloat(trailheadLng) : locationLng

  function handleRefresh() {
    setKey((k) => k + 1)
    router.refresh()
  }

  return (
    <section className="mb-6 space-y-3" key={key}>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Logistics
      </h2>

      <GettingTherePanel
        activityId={activityId}
        scheduledAt={scheduledAt}
        currentUserId={currentUserId}
        destinationLat={destLat}
        destinationLng={destLng}
        destinationName={locationName}
        meetingPointName={logistics?.meeting_point_name}
        meetingPointLat={logistics?.meeting_point_lat}
        meetingPointLng={logistics?.meeting_point_lng}
        meetingTime={logistics?.meeting_time}
        trailApproachDurationS={trailApproachDurationS}
        rides={rides}
        isParticipant={isParticipant}
        onRefresh={handleRefresh}
      />

      <LogisticsTab
        activityId={activityId}
        scheduledAt={scheduledAt}
        locationName={locationName}
        trailName={trailName}
        trailApproachDurationS={trailApproachDurationS}
        logistics={logistics}
        isCreator={isCreator}
        participants={participantList}
        currentUserId={currentUserId}
        onRefresh={handleRefresh}
      />

      {/* CarpoolBoard shown for creator as management view */}
      {isCreator && (
        <CarpoolBoard
          activityId={activityId}
          currentUserId={currentUserId}
          rides={rides}
          isParticipant={isParticipant}
          onRefresh={handleRefresh}
        />
      )}
    </section>
  )
}
