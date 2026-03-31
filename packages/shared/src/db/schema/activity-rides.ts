import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";

import { users } from "./users";
import { activities } from "./activities";

export const activityRides = pgTable("activity_rides", {
  id: uuid("id").primaryKey().defaultRandom(),
  activityId: uuid("activity_id")
    .references(() => activities.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  type: text("type").notNull(), // 'offer' | 'request'
  availableSeats: integer("available_seats"),
  pickupLocationName: text("pickup_location_name"),
  pickupLat: text("pickup_lat"),
  pickupLng: text("pickup_lng"),
  departureTime: timestamp("departure_time", { withTimezone: true }),
  pickupAddress: text("pickup_address"),
  note: text("note"),
  status: text("status").notNull().default("open"), // 'open' | 'matched' | 'cancelled'
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type ActivityRide = typeof activityRides.$inferSelect;
export type NewActivityRide = typeof activityRides.$inferInsert;
