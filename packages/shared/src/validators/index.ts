import { z } from "zod";

export const sportTypeSchema = z.enum([
  "hiking",
  "climbing",
  "trail_running",
  "surfing",
  "cycling",
  "mountain_biking",
  "skiing",
]);

export const skillLevelSchema = z.enum([
  "beginner",
  "intermediate",
  "advanced",
  "expert",
]);

export const coordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const createActivitySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  sportType: sportTypeSchema,
  skillLevelMin: skillLevelSchema,
  skillLevelMax: skillLevelSchema,
  location: coordinatesSchema,
  locationName: z.string().min(1).max(200),
  maxParticipants: z.number().int().min(1).max(50),
  scheduledAt: z.string().datetime(),
});
