import { pgTable, serial, integer, text, real, boolean, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { familiesTable } from "./families";
import { mealPlansTable } from "./meal_plans";

export const groceryListsTable = pgTable("grocery_lists", {
  id: serial("id").primaryKey(),
  familyId: integer("family_id").notNull().references(() => familiesTable.id, { onDelete: "cascade" }),
  mealPlanId: integer("meal_plan_id").references(() => mealPlansTable.id, { onDelete: "cascade" }),
  weekOf: text("week_of").notNull(),
  items: jsonb("items"),
  totalEstimatedCost: integer("total_estimated_cost"),
  budgetStatus: text("budget_status").notNull().default("within"),
  acceptedSwaps: jsonb("accepted_swaps").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("grocery_lists_family_id_idx").on(table.familyId),
]);

export const pantryItemsTable = pgTable("pantry_items", {
  id: serial("id").primaryKey(),
  familyId: integer("family_id").notNull().references(() => familiesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  quantity: text("quantity"),
  unit: text("unit"),
  expiryDate: text("expiry_date"),
  costPerUnit: real("cost_per_unit"),
  isAvailable: boolean("is_available").notNull().default(true),
  addedAt: timestamp("added_at").defaultNow().notNull(),
}, (table) => [
  index("pantry_items_family_id_idx").on(table.familyId),
]);

export const insertGroceryListSchema = createInsertSchema(groceryListsTable).omit({ id: true, createdAt: true });
export type InsertGroceryList = z.infer<typeof insertGroceryListSchema>;
export type GroceryList = typeof groceryListsTable.$inferSelect;

export const insertPantryItemSchema = createInsertSchema(pantryItemsTable).omit({ id: true, addedAt: true });
export type InsertPantryItem = z.infer<typeof insertPantryItemSchema>;
export type PantryItem = typeof pantryItemsTable.$inferSelect;
