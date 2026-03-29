import { pgTable, serial, integer, text, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { familiesTable } from "./families";

export const leftoverItemsTable = pgTable("leftover_items", {
  id: serial("id").primaryKey(),
  familyId: integer("family_id").notNull().references(() => familiesTable.id, { onDelete: "cascade" }),
  ingredientName: text("ingredient_name").notNull(),
  quantityEstimate: text("quantity_estimate"),
  loggedAt: timestamp("logged_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedUp: boolean("used_up").notNull().default(false),
}, (table) => [
  index("leftover_items_family_expires_idx").on(table.familyId, table.expiresAt),
]);

export const insertLeftoverItemSchema = createInsertSchema(leftoverItemsTable).omit({ id: true, loggedAt: true });
export type InsertLeftoverItem = z.infer<typeof insertLeftoverItemSchema>;
export type LeftoverItem = typeof leftoverItemsTable.$inferSelect;
