import { pgTable, uuid, text, integer, boolean, jsonb } from "drizzle-orm/pg-core";

import { users } from "./users";

export const userPreferences = pgTable("user_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .unique()
    .notNull(),
  hasCar: text("has_car"),
  willingToCarpool: text("willing_to_carpool"),
  maxDriveDistanceMi: integer("max_drive_distance_mi"),
  preferredGroupSize: text("preferred_group_size"),
  preferredTimeOfDay: jsonb("preferred_time_of_day").$type<string[]>().default([]),
  weekdayAvailability: boolean("weekday_availability").default(false),
  weekendAvailability: boolean("weekend_availability").default(true),
  gearLevel: text("gear_level"),
  overnightComfort: text("overnight_comfort"),
  fitnessLevel: text("fitness_level"),
  comfortWithStrangers: text("comfort_with_strangers"),
  accessibilityNotes: text("accessibility_notes"),
  showActivityHistory: boolean("show_activity_history").default(true).notNull(),
});

export type UserPreferences = typeof userPreferences.$inferSelect;
export type NewUserPreferences = typeof userPreferences.$inferInsert;
