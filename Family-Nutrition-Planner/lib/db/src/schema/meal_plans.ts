import { pgTable, serial, integer, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";
import { familiesTable } from "./families";
import { weeklyContextsTable } from "./weekly_contexts";

export const mealPlansTable = pgTable("meal_plans", {
  id: serial("id").primaryKey(),
  weeklyContextId: integer("weekly_context_id").references(() => weeklyContextsTable.id, { onDelete: "cascade" }),
  familyId: integer("family_id").notNull().references(() => familiesTable.id, { onDelete: "cascade" }),
  harmonyScore: integer("harmony_score"),
  generationStatus: text("generation_status").notNull().default("pending"),
  harmonyScoreBreakdown: jsonb("harmony_score_breakdown").notNull().default(sql`'{}'::jsonb`),
  generationLog: jsonb("generation_log").notNull().default(sql`'[]'::jsonb`),
  days: jsonb("days").notNull().default(sql`'[]'::jsonb`),
  nutritionalSummary: jsonb("nutritional_summary").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("meal_plans_family_id_idx").on(table.familyId),
  index("meal_plans_weekly_context_id_idx").on(table.weeklyContextId),
  index("meal_plans_generation_status_idx").on(table.generationStatus),
]);

export const insertMealPlanSchema = createInsertSchema(mealPlansTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMealPlan = z.infer<typeof insertMealPlanSchema>;
export type MealPlan = typeof mealPlansTable.$inferSelect;
