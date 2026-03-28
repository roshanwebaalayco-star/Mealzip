import { pgTable, serial, text, real, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { familiesTable } from "./families";

export const familyMembersTable = pgTable("family_members", {
  id: serial("id").primaryKey(),
  familyId: integer("family_id").notNull().references(() => familiesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  role: text("role").notNull().default("other"),
  age: integer("age").notNull(),
  gender: text("gender").notNull().default("male"),
  weightKg: real("weight_kg"),
  heightCm: real("height_cm"),
  activityLevel: text("activity_level").notNull().default("moderate"),
  healthConditions: text("health_conditions").array(),
  dietaryRestrictions: text("dietary_restrictions").array(),
  allergies: text("allergies").array(),
  primaryGoal: text("primary_goal_override"),
  calorieTarget: integer("calorie_target"),
  icmrCaloricTarget: integer("icmr_caloric_target"),
  goalPace: text("goal_pace").default("none"),
  tiffinType: text("tiffin_type").default("none"),
  religiousRules: text("religious_rules").default("none"),
  ingredientDislikes: text("ingredient_dislikes").array(),
  nonVegDays: text("non_veg_days").array(),
  nonVegTypes: text("non_veg_types").array(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("family_members_family_id_idx").on(table.familyId),
]);

export const insertFamilyMemberSchema = createInsertSchema(familyMembersTable).omit({ id: true, createdAt: true });
export type InsertFamilyMember = z.infer<typeof insertFamilyMemberSchema>;
export type FamilyMember = typeof familyMembersTable.$inferSelect;
