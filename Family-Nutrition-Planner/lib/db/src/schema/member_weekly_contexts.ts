import { pgTable, serial, integer, text, numeric, boolean, jsonb, timestamp, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";
import { weeklyContextsTable } from "./weekly_contexts";
import { familyMembersTable } from "./family_members";

export const memberWeeklyContextsTable = pgTable("member_weekly_contexts", {
  id: serial("id").primaryKey(),
  weeklyContextId: integer("weekly_context_id").notNull().references(() => weeklyContextsTable.id, { onDelete: "cascade" }),
  familyMemberId: integer("family_member_id").notNull().references(() => familyMembersTable.id, { onDelete: "cascade" }),
  currentGoalOverride: text("current_goal_override"),
  currentWeightKg: numeric("current_weight_kg", { precision: 5, scale: 1 }),
  feelingThisWeek: text("feeling_this_week"),
  spiceToleranceOverride: text("spice_tolerance_override"),
  tiffinNeededOverride: text("tiffin_needed_override"),
  ekadashiThisWeek: boolean("ekadashi_this_week").notNull().default(false),
  festivalFastThisWeek: boolean("festival_fast_this_week").notNull().default(false),
  healthConditionsOverride: jsonb("health_conditions_override"),
  activeMedications: jsonb("active_medications").notNull().default(sql`'[]'::jsonb`),
  fastingDaysThisWeek: jsonb("fasting_days_this_week").notNull().default(sql`'[]'::jsonb`),
  nonvegDaysThisWeek: jsonb("nonveg_days_this_week").notNull().default(sql`'[]'::jsonb`),
  nonvegTypesThisWeek: jsonb("nonveg_types_this_week").notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("mwc_weekly_context_id_idx").on(table.weeklyContextId),
  unique("member_weekly_ctx_unique").on(table.weeklyContextId, table.familyMemberId),
]);

export const insertMemberWeeklyContextSchema = createInsertSchema(memberWeeklyContextsTable).omit({ id: true, createdAt: true });
export type InsertMemberWeeklyContext = z.infer<typeof insertMemberWeeklyContextSchema>;
export type MemberWeeklyContext = typeof memberWeeklyContextsTable.$inferSelect;
