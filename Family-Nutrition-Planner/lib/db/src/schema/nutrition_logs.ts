import { pgTable, serial, integer, text, real, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { familiesTable } from "./families";
import { familyMembersTable } from "./family_members";

export const nutritionLogsTable = pgTable("nutrition_logs", {
  id: serial("id").primaryKey(),
  familyId: integer("family_id").notNull().references(() => familiesTable.id, { onDelete: "cascade" }),
  memberId: integer("member_id").references(() => familyMembersTable.id, { onDelete: "cascade" }),
  logDate: text("log_date").notNull(),
  mealType: text("meal_type").notNull().default("lunch"),
  foodDescription: text("food_description"),
  calories: real("calories"),
  proteinG: real("protein_g"),
  carbsG: real("carbs_g"),
  fatG: real("fat_g"),
  fiberG: real("fiber_g"),
  ironMg: real("iron_mg"),
  calciumMg: real("calcium_mg"),
  vitaminCMg: real("vitamin_c_mg"),
  imageUrl: text("image_url"),
  source: text("source").notNull().default("manual"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("nutrition_logs_family_member_idx").on(table.familyId, table.memberId),
  index("nutrition_logs_date_idx").on(table.logDate),
]);

export const insertNutritionLogSchema = createInsertSchema(nutritionLogsTable).omit({ id: true, createdAt: true });
export type InsertNutritionLog = z.infer<typeof insertNutritionLogSchema>;
export type NutritionLog = typeof nutritionLogsTable.$inferSelect;
