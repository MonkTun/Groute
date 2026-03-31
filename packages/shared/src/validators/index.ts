import { z } from "zod";

export const sportTypeSchema = z.enum([
  "hiking",
  "trail_running",
  "running",
  "cycling",
]);

export const skillLevelSchema = z.enum([
  "beginner",
  "intermediate",
  "advanced",
]);

export const coordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const activityVisibilitySchema = z.enum([
  "public",
  "discoverable",
  "private",
]);

export const trailSacScaleSchema = z.enum([
  "hiking",
  "mountain_hiking",
  "demanding_mountain_hiking",
  "alpine_hiking",
  "demanding_alpine_hiking",
  "difficult_alpine_hiking",
]);

export const trailSurfaceSchema = z.enum([
  "ground",
  "dirt",
  "grass",
  "gravel",
  "sand",
  "rock",
  "paved",
  "asphalt",
  "concrete",
  "wood",
  "unknown",
]);

export const trailSelectionSchema = z.object({
  osmId: z.number().int(),
  name: z.string().min(1).max(500),
  surface: trailSurfaceSchema,
  sacScale: trailSacScaleSchema.nullable(),
  distanceMeters: z.number().min(0),
  trailheadLat: z.number().min(-90).max(90),
  trailheadLng: z.number().min(-180).max(180),
  approachDistanceMeters: z.number().min(0).optional(),
  approachDurationSeconds: z.number().min(0).optional(),
});

export const searchTrailsSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusMeters: z.number().int().min(500).max(50_000).default(8_000),
});

export const createActivitySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  sportType: sportTypeSchema,
  skillLevel: skillLevelSchema,
  visibility: activityVisibilitySchema.default("public"),
  location: coordinatesSchema,
  locationName: z.string().min(1).max(200),
  maxParticipants: z.number().int().min(1).max(50),
  scheduledAt: z.string().datetime(),
  trail: trailSelectionSchema.optional(),
});

export const userSportSchema = z.object({
  sportType: sportTypeSchema,
  selfReportedLevel: skillLevelSchema,
});

export const onboardingProfileSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(50),
  lastName: z.string().min(1, "Last name is required").max(50),
  dateOfBirth: z
    .string()
    .min(1, "Date of birth is required")
    .refine((val) => {
      const date = new Date(val);
      const now = new Date();
      const age = now.getFullYear() - date.getFullYear();
      return age >= 18 && age <= 100;
    }, "You must be between 18 and 100 years old"),
  area: z.string().min(1, "Area is required"),
  preferredLanguage: z.string().optional(),
  eduEmail: z
    .string()
    .email("Must be a valid email")
    .refine((val) => val.endsWith(".edu"), "Must be a .edu email address")
    .optional()
    .or(z.literal("")),
  sports: z
    .array(userSportSchema)
    .min(1, "Select at least one activity"),
});

// ── Experience (per sport) ──

export const terrainComfortSchema = z.enum([
  "trail",
  "off_trail",
  "scramble",
  "technical",
  "snow_ice",
]);

export const waterComfortSchema = z.enum([
  "flatwater",
  "class_i_ii",
  "class_iii_iv",
  "class_v",
  "open_ocean",
]);

export const certificationSchema = z.enum([
  "wilderness_first_aid",
  "wilderness_first_responder",
  "belay_certified",
  "lead_climbing",
  "avalanche_level_1",
  "avalanche_level_2",
  "dive_certified",
  "swift_water_rescue",
  "lifeguard",
  "cpr_aed",
]);

export const userExperienceSchema = z.object({
  sportType: sportTypeSchema,
  highestAltitudeFt: z.number().int().min(0).max(30_000).optional(),
  longestDistanceMi: z.number().int().min(0).max(500).optional(),
  tripsLast12Months: z.number().int().min(0).max(365).optional(),
  yearsExperience: z.number().int().min(0).max(80).optional(),
  certifications: z.array(certificationSchema).default([]),
  terrainComfort: z.array(terrainComfortSchema).default([]),
  waterComfort: waterComfortSchema.optional(),
});

// ── Preferences (logistics, gear, social) ──

export const hasCarSchema = z.enum(["yes", "no", "sometimes"]);
export const willingToCarpoolSchema = z.enum(["yes", "no", "within_radius"]);
export const preferredGroupSizeSchema = z.enum(["duo", "small", "medium", "large"]);
export const preferredTimeOfDaySchema = z.enum(["early_morning", "morning", "afternoon", "evening"]);
export const gearLevelSchema = z.enum(["none", "basic", "full"]);
export const overnightComfortSchema = z.enum(["day_only", "car_camping", "backcountry"]);
export const fitnessLevelSchema = z.enum(["casual", "active", "athletic", "competitive"]);
export const comfortWithStrangersSchema = z.enum(["friends_only", "friends_of_friends", "open"]);

export const userPreferencesSchema = z.object({
  hasCar: hasCarSchema.optional(),
  willingToCarpool: willingToCarpoolSchema.optional(),
  maxDriveDistanceMi: z.number().int().min(5).max(500).optional(),
  preferredGroupSize: preferredGroupSizeSchema.optional(),
  preferredTimeOfDay: z.array(preferredTimeOfDaySchema).default([]),
  weekdayAvailability: z.boolean().default(false),
  weekendAvailability: z.boolean().default(true),
  gearLevel: gearLevelSchema.optional(),
  overnightComfort: overnightComfortSchema.optional(),
  fitnessLevel: fitnessLevelSchema.optional(),
  comfortWithStrangers: comfortWithStrangersSchema.optional(),
  accessibilityNotes: z.string().max(500).optional(),
});

// ── Extended onboarding schema (includes experience + preferences) ──

export const onboardingProfileExtendedSchema = onboardingProfileSchema.extend({
  experience: z.array(userExperienceSchema).optional(),
  preferences: userPreferencesSchema.optional(),
});

// ── Strava verification schemas ──

export const stravaVerifiedLevelSchema = z.enum([
  "beginner",
  "intermediate",
  "advanced",
  "expert",
]);

export const stravaAiAnalysisSchema = z.object({
  level: stravaVerifiedLevelSchema,
  confidence: z.enum(["low", "medium", "high"]),
  reasoning: z.string().max(500),
  highlights: z.array(z.string().max(100)).max(5),
});

export type OnboardingProfileInput = z.infer<typeof onboardingProfileSchema>;
export type OnboardingProfileExtendedInput = z.infer<typeof onboardingProfileExtendedSchema>;
export type UserSportInput = z.infer<typeof userSportSchema>;
export type UserExperienceInput = z.infer<typeof userExperienceSchema>;
export type UserPreferencesInput = z.infer<typeof userPreferencesSchema>;
export type StravaAiAnalysisInput = z.infer<typeof stravaAiAnalysisSchema>;

// ── Logistics schemas ──

export const rideTypeSchema = z.enum(["offer", "request"]);
export const rideStatusSchema = z.enum(["open", "matched", "cancelled"]);
export const ridePassengerStatusSchema = z.enum(["pending", "confirmed", "declined"]);

export const createRideSchema = z.object({
  type: rideTypeSchema,
  availableSeats: z.number().int().min(1).max(10).optional(),
  pickupLocationName: z.string().max(200).optional(),
  pickupLat: z.number().min(-90).max(90).optional(),
  pickupLng: z.number().min(-180).max(180).optional(),
  pickupAddress: z.string().max(500).optional(),
  departureTime: z.string().datetime().optional(),
  note: z.string().max(500).optional(),
});

export const updateRidePassengerStatusSchema = z.object({
  status: ridePassengerStatusSchema,
});

export const upsertActivityLogisticsSchema = z.object({
  meetingPointName: z.string().max(200).optional(),
  meetingPointLat: z.number().min(-90).max(90).optional(),
  meetingPointLng: z.number().min(-180).max(180).optional(),
  meetingTime: z.string().datetime().optional(),
  estimatedReturnTime: z.string().datetime().optional(),
  parkingName: z.string().max(200).optional(),
  parkingLat: z.number().min(-90).max(90).optional(),
  parkingLng: z.number().min(-180).max(180).optional(),
  parkingPaid: z.boolean().optional(),
  parkingCost: z.string().max(50).optional(),
  parkingNotes: z.string().max(500).optional(),
  transportNotes: z.string().max(2000).optional(),
  checklistItems: z.array(z.string().max(100)).max(20).optional(),
  notes: z.string().max(2000).optional(),
});

export const drivingDirectionsQuerySchema = z.object({
  fromLat: z.number().min(-90).max(90),
  fromLng: z.number().min(-180).max(180),
  toLat: z.number().min(-90).max(90),
  toLng: z.number().min(-180).max(180),
});

// ── Transport planning schemas ──

export const transportModeSchema = z.enum([
  "driving",
  "transit",
  "rideshare",
  "carpool_driver",
  "carpool_passenger",
  "walking",
]);

export const transitDirectionsQuerySchema = z.object({
  fromLat: z.number().min(-90).max(90),
  fromLng: z.number().min(-180).max(180),
  toLat: z.number().min(-90).max(90),
  toLng: z.number().min(-180).max(180),
  arrivalTime: z.string().datetime().optional(),
});

export const multiStopRouteQuerySchema = z.object({
  waypoints: z
    .array(
      z.object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        name: z.string().max(200).optional(),
      })
    )
    .min(2)
    .max(10),
});

export const createTransitPlanSchema = z.object({
  transportMode: transportModeSchema,
  rideId: z.string().uuid().optional(),
  originLat: z.number().min(-90).max(90),
  originLng: z.number().min(-180).max(180),
  originName: z.string().max(200).optional(),
  estimatedTravelSeconds: z.number().int().min(0).optional(),
  leaveAt: z.string().datetime().optional(),
  routeSummary: z.any().optional(),
});

export type CreateRideInput = z.infer<typeof createRideSchema>;
export type UpsertActivityLogisticsInput = z.infer<typeof upsertActivityLogisticsSchema>;
export type CreateTransitPlanInput = z.infer<typeof createTransitPlanSchema>;
