import { pgTable, serial, text, numeric, integer, boolean, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";
import { familiesTable } from "./families";

export const familyMembersTable = pgTable("family_members", {
  id: serial("id").primaryKey(),
  familyId: integer("family_id").notNull().references(() => familiesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  age: integer("age").notNull(),
  gender: text("gender").notNull(),
  heightCm: numeric("height_cm", { precision: 5, scale: 1 }),
  weightKg: numeric("weight_kg", { precision: 5, scale: 1 }),
  activityLevel: text("activity_level").notNull().default("lightly_active"),
  primaryGoal: text("primary_goal").notNull().default("no_specific_goal"),
  goalPace: text("goal_pace"),
  dailyCalorieTarget: integer("daily_calorie_target"),
  dietaryType: text("dietary_type").notNull().default("strictly_vegetarian"),
  spiceTolerance: text("spice_tolerance").notNull().default("medium"),
  tiffinNeeded: text("tiffin_needed").notNull().default("no"),
  festivalFastingAlerts: boolean("festival_fasting_alerts").notNull().default(false),
  displayOrder: integer("display_order").notNull().default(0),
  healthConditions: jsonb("health_conditions").notNull().default(sql`'[]'::jsonb`),
  allergies: jsonb("allergies").notNull().default(sql`'[]'::jsonb`),
  ingredientDislikes: jsonb("ingredient_dislikes").notNull().default(sql`'[]'::jsonb`),
  religiousCulturalRules: jsonb("religious_cultural_rules").notNull().default(sql`'{}'::jsonb`),
  occasionalNonvegConfig: jsonb("occasional_nonveg_config"),
  fastingConfig: jsonb("fasting_config").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("family_members_family_id_idx").on(table.familyId),
]);

export const insertFamilyMemberSchema = createInsertSchema(familyMembersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFamilyMember = z.infer<typeof insertFamilyMemberSchema>;
export type FamilyMember = typeof familyMembersTable.$inferSelect;
