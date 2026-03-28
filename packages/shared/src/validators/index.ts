import { z } from "zod";

export const sportTypeSchema = z.enum([
  "hiking",
  "trail_running",
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

export const createActivitySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  sportType: sportTypeSchema,
  skillLevel: skillLevelSchema,
  visibility: activityVisibilitySchema.default("public"),
  location: coordinatesSchema,
  locationName: z.string().min(1).max(200),
  maxParticipants: z.number().int().min(1).max(50),
  scheduledAt: z.string().datetime(),
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

export type OnboardingProfileInput = z.infer<typeof onboardingProfileSchema>;
export type UserSportInput = z.infer<typeof userSportSchema>;
