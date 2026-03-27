import { pgTable, serial, integer, text, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { familiesTable } from "./families";
import { mealPlansTable } from "./meal_plans";

export const mealFeedbackTable = pgTable("meal_feedback", {
  id: serial("id").primaryKey(),
  familyId: integer("family_id").notNull().references(() => familiesTable.id, { onDelete: "cascade" }),
  mealPlanId: integer("meal_plan_id").references(() => mealPlansTable.id, { onDelete: "cascade" }),
  dayIndex: integer("day_index").notNull(),
  mealType: text("meal_type").notNull(),
  rating: integer("rating").notNull().default(0),
  liked: boolean("liked").notNull().default(true),
  skipReason: text("skip_reason"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("meal_feedback_family_id_idx").on(table.familyId),
  index("meal_feedback_meal_plan_id_idx").on(table.mealPlanId),
]);

export const insertMealFeedbackSchema = createInsertSchema(mealFeedbackTable).omit({ id: true, createdAt: true });
export type InsertMealFeedback = z.infer<typeof insertMealFeedbackSchema>;
export type MealFeedback = typeof mealFeedbackTable.$inferSelect;
