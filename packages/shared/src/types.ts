export type SportType =
  | "hiking"
  | "trail_running"
  | "running"
  | "cycling";

export type SkillLevel = "beginner" | "intermediate" | "advanced";

export type StravaVerifiedLevel =
  | "beginner"
  | "intermediate"
  | "advanced"
  | "expert";

export type StravaAiConfidence = "low" | "medium" | "high";

export interface StravaAiAnalysis {
  level: StravaVerifiedLevel;
  confidence: StravaAiConfidence;
  reasoning: string;
  highlights: string[];
}

export interface StravaStats {
  totalActivities: number;
  avgDistanceKm: number;
  avgElevationM: number;
  totalDistanceKm: number;
  lastSyncedAt: string;
  aiAnalysis: StravaAiAnalysis | null;
}

export type ActivityStatus = "open" | "full" | "completed" | "cancelled";

export type ParticipantStatus = "requested" | "accepted" | "declined";

export type ActivityVisibility = "public" | "discoverable" | "private";

export type ConnectionStatus = "pending" | "accepted" | "blocked";

export type TrailSacScale =
  | "hiking"
  | "mountain_hiking"
  | "demanding_mountain_hiking"
  | "alpine_hiking"
  | "demanding_alpine_hiking"
  | "difficult_alpine_hiking";

export type TrailSurface =
  | "ground"
  | "dirt"
  | "grass"
  | "gravel"
  | "sand"
  | "rock"
  | "paved"
  | "asphalt"
  | "concrete"
  | "wood"
  | "unknown";

export interface Trail {
  osmId: number;
  name: string;
  surface: TrailSurface;
  sacScale: TrailSacScale | null;
  distanceMeters: number;
  coordinates: [number, number][]; // [lat, lng] pairs
  centerLat: number;
  centerLng: number;
  trailheadLat: number;
  trailheadLng: number;
  distanceFromLocation: number; // straight-line meters from search origin to trailhead
}

export interface ApproachRoute {
  distanceMeters: number;
  durationSeconds: number;
  coordinates: [number, number][]; // [lng, lat] pairs (GeoJSON order, ready for Mapbox)
}

export type RideType = "offer" | "request";
export type RideStatus = "open" | "matched" | "cancelled";
export type RidePassengerStatus = "pending" | "confirmed" | "declined";

export interface DrivingDirections {
  distanceMeters: number;
  durationSeconds: number;
  coordinates: [number, number][]; // [lng, lat] GeoJSON order
}

// ── Transport planning types ──

export type TransportMode =
  | "driving"
  | "transit"
  | "rideshare"
  | "carpool_driver"
  | "carpool_passenger"
  | "walking";

export interface TransitStep {
  mode: string; // WALK | BUS | SUBWAY | RAIL | RIDESHARE
  lineName?: string;
  departureStop?: string;
  arrivalStop?: string;
  departureTime: string;
  arrivalTime: string;
  durationSeconds: number;
  distanceMeters?: number;
  numStops?: number;
  instructions?: string;
}

export interface TransitRoute {
  durationSeconds: number;
  departureTime: string;
  arrivalTime: string;
  steps: TransitStep[];
}

export interface CarpoolRouteDetails {
  rideId: string;
  driverName: string;
  pickupTime?: string;
  pickupLocation?: string;
  totalDurationSeconds: number;
}

export interface TransportOption {
  mode: TransportMode;
  durationSeconds: number;
  distanceMeters?: number;
  leaveAt: string;
  arriveBy: string;
  costEstimate?: string;
  details: DrivingDirections | TransitRoute | CarpoolRouteDetails;
}

// ── Equipment types ──

export type EquipmentStatus = "have" | "need" | "lending";

// ── Timeline Web types ──

export type TimelineNodeType =
  | "leave_home"
  | "pickup"
  | "arrive_meeting"
  | "arrive_trailhead"
  | "activity_start"
  | "transit_depart"
  | "get_ready";

export interface TimelineNode {
  type: TimelineNodeType;
  time: string;
  label: string;
  locationName?: string;
}

export interface ParticipantTimeline {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  role: "driver" | "passenger" | "solo";
  transportMode: TransportMode;
  carpoolGroupId?: string;
  nodes: TimelineNode[];
}

export interface CarpoolGroup {
  id: string;
  driverId: string;
  driverName: string;
  passengerIds: string[];
  vehicleCapacity: number;
  totalDurationSeconds: number;
  pickupOrder: Array<{
    userId: string;
    userName: string;
    pickupTime: string;
    pickupLocationName: string;
    legDurationSeconds: number;
  }>;
}

export interface ComputedTimeline {
  computedAt: string;
  activityStartTime: string;
  meetingPointName: string | null;
  carpoolGroups: CarpoolGroup[];
  participantTimelines: ParticipantTimeline[];
  convergencePoints: Array<{
    time: string;
    locationName: string;
    participantIds: string[];
    type: "pickup" | "meeting_point" | "trailhead";
  }>;
}

export interface MultiStopRouteResult {
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  coordinates: [number, number][];
  legs: Array<{
    distanceMeters: number;
    durationSeconds: number;
  }>;
}
