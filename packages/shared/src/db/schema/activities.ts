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
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;
