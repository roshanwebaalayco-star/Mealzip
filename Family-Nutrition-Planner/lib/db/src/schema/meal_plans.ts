import { pgTable, serial, text, real, integer, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { familiesTable } from "./families";

export const mealPlansTable = pgTable("meal_plans", {
  id: serial("id").primaryKey(),
  familyId: integer("family_id").notNull().references(() => familiesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  weekStartDate: text("week_start_date").notNull(),
  harmonyScore: real("harmony_score").notNull().default(0),
  totalBudgetEstimate: integer("total_budget_estimate"),
  plan: jsonb("plan"),
  nutritionSummary: jsonb("nutrition_summary"),
  aiInsights: text("ai_insights"),
  icmrCompliance: jsonb("icmr_compliance"),
  ragContextUsed: jsonb("rag_context_used"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("meal_plans_family_id_idx").on(table.familyId),
]);

export const insertMealPlanSchema = createInsertSchema(mealPlansTable).omit({ id: true, createdAt: true });
export type InsertMealPlan = z.infer<typeof insertMealPlanSchema>;
export type MealPlan = typeof mealPlansTable.$inferSelect;
