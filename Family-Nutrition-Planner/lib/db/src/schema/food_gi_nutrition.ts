import { pgTable, serial, text, real, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const foodGiNutritionTable = pgTable("food_gi_nutrition", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameHindi: text("name_hindi"),
  category: text("category").notNull().default("grain"),
  glycemicIndex: integer("glycemic_index"),
  glycemicLoad: real("glycemic_load"),
  servingGrams: real("serving_grams").default(100),
  calories: real("calories"),
  proteinG: real("protein_g"),
  carbsG: real("carbs_g"),
  fatG: real("fat_g"),
  fiberG: real("fiber_g"),
  ironMg: real("iron_mg"),
  calciumMg: real("calcium_mg"),
  vitaminCMg: real("vitamin_c_mg"),
  vitaminAMcg: real("vitamin_a_mcg"),
  zincMg: real("zinc_mg"),
  source: text("source").default("ICMR-NIN 2024"),
  notes: text("notes"),
}, (table) => [
  index("food_gi_name_idx").on(table.name),
  index("food_gi_category_idx").on(table.category),
]);

export const insertFoodGiNutritionSchema = createInsertSchema(foodGiNutritionTable).omit({ id: true });
export type InsertFoodGiNutrition = z.infer<typeof insertFoodGiNutritionSchema>;
export type FoodGiNutrition = typeof foodGiNutritionTable.$inferSelect;
