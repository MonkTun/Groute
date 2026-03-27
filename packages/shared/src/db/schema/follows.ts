import { pgTable, uuid, timestamp } from "drizzle-orm/pg-core";

import { users } from "./users";

export const follows = pgTable("follows", {
  id: uuid("id").primaryKey().defaultRandom(),
  followerId: uuid("follower_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  followingId: uuid("following_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Follow = typeof follows.$inferSelect;
export type NewFollow = typeof follows.$inferInsert;
