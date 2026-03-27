import { pgTable, serial, text, real, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const icmrNinRdaTable = pgTable("icmr_nin_rda", {
  id: serial("id").primaryKey(),
  ageGroup: text("age_group").notNull(),
  ageMin: integer("age_min").notNull(),
  ageMax: integer("age_max").notNull(),
  gender: text("gender").notNull(),
  activityLevel: text("activity_level").notNull().default("moderate"),
  calories: real("calories").notNull(),
  proteinG: real("protein_g").notNull(),
  fatG: real("fat_g").notNull(),
  carbsG: real("carbs_g").notNull(),
  fiberG: real("fiber_g").notNull(),
  calciumMg: real("calcium_mg").notNull(),
  ironMg: real("iron_mg").notNull(),
  vitaminCMg: real("vitamin_c_mg").notNull(),
  vitaminAMcg: real("vitamin_a_mcg").notNull(),
  vitaminD3Mcg: real("vitamin_d3_mcg").notNull(),
  zincMg: real("zinc_mg").notNull(),
});

export const insertIcmrNinRdaSchema = createInsertSchema(icmrNinRdaTable).omit({ id: true });
export type InsertIcmrNinRda = z.infer<typeof insertIcmrNinRdaSchema>;
export type IcmrNinRda = typeof icmrNinRdaTable.$inferSelect;
