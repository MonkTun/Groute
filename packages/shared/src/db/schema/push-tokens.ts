import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

import { users } from "./users";

export const pushTokens = pgTable("push_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  token: text("token").notNull().unique(),
  platform: text("platform").notNull(), // 'ios' | 'android'
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type PushToken = typeof pushTokens.$inferSelect;
export type NewPushToken = typeof pushTokens.$inferInsert;
