export type SportType =
  | "hiking"
  | "climbing"
  | "trail_running"
  | "surfing"
  | "cycling"
  | "mountain_biking"
  | "skiing";

export type SkillLevel = "beginner" | "intermediate" | "advanced" | "expert";

export type ActivityStatus = "open" | "full" | "completed" | "cancelled";

export type ParticipantStatus = "requested" | "accepted" | "declined";

export type ConnectionStatus = "pending" | "accepted" | "blocked";
