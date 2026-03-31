import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

import { users } from "./users";
import { activityRides } from "./activity-rides";

export const ridePassengers = pgTable("ride_passengers", {
  id: uuid("id").primaryKey().defaultRandom(),
  rideOfferId: uuid("ride_offer_id")
    .references(() => activityRides.id, { onDelete: "cascade" })
    .notNull(),
  passengerId: uuid("passenger_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  status: text("status").notNull().default("pending"), // 'pending' | 'confirmed' | 'declined'
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type RidePassenger = typeof ridePassengers.$inferSelect;
export type NewRidePassenger = typeof ridePassengers.$inferInsert;
