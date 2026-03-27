import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

import { users } from "./users";
import { activities } from "./activities";

export const activityParticipants = pgTable("activity_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  activityId: uuid("activity_id")
    .references(() => activities.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  status: text("status").notNull().default("requested"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
});

export type ActivityParticipant = typeof activityParticipants.$inferSelect;
export type NewActivityParticipant = typeof activityParticipants.$inferInsert;
