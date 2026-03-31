import { pgTable, uuid, text, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

import { users } from "./users";
import { activities } from "./activities";
import { activityRides } from "./activity-rides";

export const userTransitPlans = pgTable("user_transit_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  activityId: uuid("activity_id")
    .references(() => activities.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  transportMode: text("transport_mode").notNull(), // driving | transit | rideshare | carpool_driver | carpool_passenger | walking
  rideId: uuid("ride_id").references(() => activityRides.id, {
    onDelete: "set null",
  }),
  originLat: text("origin_lat"),
  originLng: text("origin_lng"),
  originName: text("origin_name"),
  estimatedTravelSeconds: integer("estimated_travel_seconds"),
  leaveAt: timestamp("leave_at", { withTimezone: true }),
  routeSummary: jsonb("route_summary"),
  vehicleCapacity: integer("vehicle_capacity"),
  needsRide: boolean("needs_ride").default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type UserTransitPlan = typeof userTransitPlans.$inferSelect;
export type NewUserTransitPlan = typeof userTransitPlans.$inferInsert;
