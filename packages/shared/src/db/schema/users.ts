import {
  pgTable,
  uuid,
  text,
  boolean,
  bigint,
  timestamp,
  date,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique().notNull(),
  displayName: text("display_name").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  dateOfBirth: date("date_of_birth"),
  area: text("area"),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  preferredLanguage: text("preferred_language"),
  eduEmail: text("edu_email"),
  eduVerified: boolean("edu_verified").default(false).notNull(),
  profileCompleted: boolean("profile_completed").default(false).notNull(),
  lastLocationLat: text("last_location_lat"),
  lastLocationLng: text("last_location_lng"),
  lastLocationAt: timestamp("last_location_at", { withTimezone: true }),
  locationName: text("location_name"),
  stravaAthleteId: bigint("strava_athlete_id", { mode: "number" }),
  stravaConnected: boolean("strava_connected").default(false).notNull(),
  stravaAccessToken: text("strava_access_token"),
  stravaRefreshToken: text("strava_refresh_token"),
  stravaTokenExpiresAt: bigint("strava_token_expires_at", { mode: "number" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
