import {
  pgTable,
  uuid,
  text,
  bigint,
  doublePrecision,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";

import { users } from "./users";

export const stravaActivities = pgTable("strava_activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  stravaActivityId: bigint("strava_activity_id", { mode: "number" })
    .unique()
    .notNull(),
  sportType: text("sport_type").notNull(),
  name: text("name"),
  distanceMeters: doublePrecision("distance_meters"),
  elevationGainMeters: doublePrecision("elevation_gain_meters"),
  movingTimeSeconds: integer("moving_time_seconds"),
  startDate: timestamp("start_date", { withTimezone: true }),
  startLatlng: text("start_latlng"),
  syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow().notNull(),
});

export type StravaActivity = typeof stravaActivities.$inferSelect;
export type NewStravaActivity = typeof stravaActivities.$inferInsert;
