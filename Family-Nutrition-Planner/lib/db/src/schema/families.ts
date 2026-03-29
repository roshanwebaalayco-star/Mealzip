import { pgTable, serial, text, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const familiesTable = pgTable("families", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  state: text("state").notNull(),
  city: text("city"),
  monthlyBudget: integer("monthly_budget").notNull().default(5000),
  primaryLanguage: text("primary_language").notNull().default("hindi"),
  cuisinePreferences: text("cuisine_preferences").array(),
  isDemo: boolean("is_demo").notNull().default(false),
  mealsAreShared: boolean("meals_are_shared").notNull().default(true),
  sharedTypicalBreakfast: text("shared_typical_breakfast"),
  sharedTypicalLunch: text("shared_typical_lunch"),
  sharedTypicalDinner: text("shared_typical_dinner"),
  appliances: text("appliances").array().notNull().default(["tawa", "pressure_cooker", "kadai"]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("families_user_id_idx").on(table.userId),
]);

export const insertFamilySchema = createInsertSchema(familiesTable).omit({ id: true, createdAt: true });
export type InsertFamily = z.infer<typeof insertFamilySchema>;
export type Family = typeof familiesTable.$inferSelect;
