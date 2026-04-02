import { pgTable, serial, integer, text, numeric, date, jsonb, timestamp, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";
import { familiesTable } from "./families";

export const weeklyContextsTable = pgTable("weekly_contexts", {
  id: serial("id").primaryKey(),
  familyId: integer("family_id").notNull().references(() => familiesTable.id, { onDelete: "cascade" }),
  weekStartDate: date("week_start_date").notNull(),
  eatingOutFrequency: text("eating_out_frequency").notNull().default("none"),
  weekdayCookingTime: text("weekday_cooking_time").notNull().default("20_40_mins"),
  weekendCookingTime: text("weekend_cooking_time").notNull().default("no_preference"),
  weeklyPerishableBudgetOverride: numeric("weekly_perishable_budget_override", { precision: 10, scale: 2 }),
  specialRequest: text("special_request"),
  status: text("status").notNull().default("draft"),
  pantrySnapshot: jsonb("pantry_snapshot").notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("weekly_contexts_family_id_idx").on(table.familyId),
  index("weekly_contexts_week_start_idx").on(table.weekStartDate),
  unique("weekly_contexts_family_week_unique").on(table.familyId, table.weekStartDate),
]);

export const insertWeeklyContextSchema = createInsertSchema(weeklyContextsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWeeklyContext = z.infer<typeof insertWeeklyContextSchema>;
export type WeeklyContext = typeof weeklyContextsTable.$inferSelect;
