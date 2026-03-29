import { pgTable, uuid, text, integer, jsonb } from "drizzle-orm/pg-core";

import { users } from "./users";

export const userExperience = pgTable("user_experience", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  sportType: text("sport_type").notNull(),
  highestAltitudeFt: integer("highest_altitude_ft"),
  longestDistanceMi: integer("longest_distance_mi"),
  tripsLast12Months: integer("trips_last_12_months"),
  yearsExperience: integer("years_experience"),
  certifications: jsonb("certifications").$type<string[]>().default([]),
  terrainComfort: jsonb("terrain_comfort").$type<string[]>().default([]),
  waterComfort: text("water_comfort"),
});

export type UserExperience = typeof userExperience.$inferSelect;
export type NewUserExperience = typeof userExperience.$inferInsert;
