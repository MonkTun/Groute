import { pgTable, uuid, text, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";

import { activities } from "./activities";

export const activityLogistics = pgTable("activity_logistics", {
  id: uuid("id").primaryKey().defaultRandom(),
  activityId: uuid("activity_id")
    .references(() => activities.id, { onDelete: "cascade" })
    .unique()
    .notNull(),
  meetingPointName: text("meeting_point_name"),
  meetingPointLat: text("meeting_point_lat"),
  meetingPointLng: text("meeting_point_lng"),
  meetingTime: timestamp("meeting_time", { withTimezone: true }),
  estimatedReturnTime: timestamp("estimated_return_time", { withTimezone: true }),
  parkingName: text("parking_name"),
  parkingLat: text("parking_lat"),
  parkingLng: text("parking_lng"),
  parkingPaid: boolean("parking_paid"),
  parkingCost: text("parking_cost"), // e.g. "$10/day", "Free"
  parkingNotes: text("parking_notes"), // e.g. "Fill at 8am on weekends"
  transportNotes: text("transport_notes"),
  checklistItems: jsonb("checklist_items").$type<string[]>().default([]),
  computedTimeline: jsonb("computed_timeline"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type ActivityLogistics = typeof activityLogistics.$inferSelect;
export type NewActivityLogistics = typeof activityLogistics.$inferInsert;
