import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";

import { users } from "./users";

export const activities = pgTable("activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  creatorId: uuid("creator_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  title: text("title").notNull(),
  description: text("description"),
  sportType: text("sport_type").notNull(),
  skillLevel: text("skill_level").notNull(),
  locationLat: text("location_lat"),
  locationLng: text("location_lng"),
  bannerUrl: text("banner_url"),
  visibility: text("visibility").notNull().default("public"),
  locationName: text("location_name").notNull(),
  maxParticipants: integer("max_participants").notNull().default(4),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("open"),
  trailOsmId: integer("trail_osm_id"),
  trailName: text("trail_name"),
  trailDistanceMeters: integer("trail_distance_meters"),
  trailSurface: text("trail_surface"),
  trailSacScale: text("trail_sac_scale"),
  trailheadLat: text("trailhead_lat"),
  trailheadLng: text("trailhead_lng"),
  trailApproachDistanceM: integer("trail_approach_distance_m"),
  trailApproachDurationS: integer("trail_approach_duration_s"),
  trailGeometry: text("trail_geometry"),
  approachGeometry: text("approach_geometry"),
  unsplashImageUrl: text("unsplash_image_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;
