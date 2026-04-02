import { pgTable, serial, integer, text, numeric, boolean, date, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";
import { familiesTable } from "./families";
import { mealPlansTable } from "./meal_plans";

export const groceryListsTable = pgTable("grocery_lists", {
  id: serial("id").primaryKey(),
  familyId: integer("family_id").notNull().references(() => familiesTable.id, { onDelete: "cascade" }),
  mealPlanId: integer("meal_plan_id").references(() => mealPlansTable.id, { onDelete: "set null" }),
  listType: text("list_type").notNull().default("weekly_perishables"),
  monthYear: text("month_year"),
  weekStartDate: date("week_start_date"),
  totalEstimatedCost: numeric("total_estimated_cost", { precision: 10, scale: 2 }),
  status: text("status").notNull().default("active"),
  items: jsonb("items").notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("grocery_lists_family_id_idx").on(table.familyId),
  index("grocery_lists_meal_plan_id_idx").on(table.mealPlanId),
]);

export const pantryItemsTable = pgTable("pantry_items", {
  id: serial("id").primaryKey(),
  familyId: integer("family_id").notNull().references(() => familiesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  quantity: text("quantity"),
  unit: text("unit"),
  expiryDate: text("expiry_date"),
  costPerUnit: numeric("cost_per_unit", { precision: 10, scale: 2 }),
  isAvailable: boolean("is_available").notNull().default(true),
  addedAt: timestamp("added_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("pantry_items_family_id_idx").on(table.familyId),
]);

export const insertGroceryListSchema = createInsertSchema(groceryListsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGroceryList = z.infer<typeof insertGroceryListSchema>;
export type GroceryList = typeof groceryListsTable.$inferSelect;

export const insertPantryItemSchema = createInsertSchema(pantryItemsTable).omit({ id: true, addedAt: true });
export type InsertPantryItem = z.infer<typeof insertPantryItemSchema>;
export type PantryItem = typeof pantryItemsTable.$inferSelect;
