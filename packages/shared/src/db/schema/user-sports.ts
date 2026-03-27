import { pgTable, uuid, text, jsonb } from "drizzle-orm/pg-core";

import { users } from "./users";

export const userSports = pgTable("user_sports", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  sportType: text("sport_type").notNull(),
  selfReportedLevel: text("self_reported_level").notNull(),
  stravaVerifiedLevel: text("strava_verified_level"),
  stravaStats: jsonb("strava_stats"),
});

export type UserSport = typeof userSports.$inferSelect;
export type NewUserSport = typeof userSports.$inferInsert;
