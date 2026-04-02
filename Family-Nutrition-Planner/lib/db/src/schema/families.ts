import { pgTable, serial, integer, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";
import { usersTable } from "./users";

export const familiesTable = pgTable("families", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  stateRegion: text("state_region").notNull(),
  languagePreference: text("language_preference").notNull().default("hindi"),
  householdDietaryBaseline: text("household_dietary_baseline").notNull().default("mixed"),
  mealsPerDay: text("meals_per_day").notNull().default("3_meals"),
  cookingSkillLevel: text("cooking_skill_level").notNull().default("intermediate"),
  appliances: jsonb("appliances").notNull().default(sql`'[]'::jsonb`),
  pincode: text("pincode"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("families_user_id_idx").on(table.userId),
]);

export const insertFamilySchema = createInsertSchema(familiesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFamily = z.infer<typeof insertFamilySchema>;
export type Family = typeof familiesTable.$inferSelect;
