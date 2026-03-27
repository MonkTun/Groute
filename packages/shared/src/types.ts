export type SportType =
  | "hiking"
  | "climbing"
  | "trail_running"
  | "surfing"
  | "cycling"
  | "mountain_biking"
  | "skiing"
  | "kayaking"
  | "yoga";

export type SkillLevel = "beginner" | "intermediate" | "advanced";

export type ActivityStatus = "open" | "full" | "completed" | "cancelled";

export type ParticipantStatus = "requested" | "accepted" | "declined";

export type ActivityVisibility = "public" | "discoverable" | "private";

export type ConnectionStatus = "pending" | "accepted" | "blocked";
