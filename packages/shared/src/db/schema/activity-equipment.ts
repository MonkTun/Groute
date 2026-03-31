import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

import { users } from "./users";
import { activities } from "./activities";

export const activityEquipment = pgTable("activity_equipment", {
  id: uuid("id").primaryKey().defaultRandom(),
  activityId: uuid("activity_id")
    .references(() => activities.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  itemName: text("item_name").notNull(),
  status: text("status").notNull(), // "have" | "need" | "lending"
  lenderId: uuid("lender_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type ActivityEquipment = typeof activityEquipment.$inferSelect;
export type NewActivityEquipment = typeof activityEquipment.$inferInsert;
