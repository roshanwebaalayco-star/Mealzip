import { pgTable, serial, integer, text, numeric, jsonb, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";
import { familiesTable } from "./families";

export const monthlyBudgetsTable = pgTable("monthly_budgets", {
  id: serial("id").primaryKey(),
  familyId: integer("family_id").notNull().references(() => familiesTable.id, { onDelete: "cascade" }),
  monthYear: text("month_year").notNull(),
  totalMonthlyBudget: numeric("total_monthly_budget", { precision: 10, scale: 2 }).notNull(),
  staplesBudget: numeric("staples_budget", { precision: 10, scale: 2 }).notNull(),
  perishablesBudget: numeric("perishables_budget", { precision: 10, scale: 2 }).notNull(),
  bufferBudget: numeric("buffer_budget", { precision: 10, scale: 2 }).notNull(),
  dailyPerishableLimit: numeric("daily_perishable_limit", { precision: 10, scale: 2 }).notNull(),
  regionalPriceSuggestion: numeric("regional_price_suggestion", { precision: 10, scale: 2 }),
  budgetBreakdown: jsonb("budget_breakdown").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("monthly_budgets_family_month_unique").on(table.familyId, table.monthYear),
]);

export const insertMonthlyBudgetSchema = createInsertSchema(monthlyBudgetsTable).omit({ id: true, createdAt: true });
export type InsertMonthlyBudget = z.infer<typeof insertMonthlyBudgetSchema>;
export type MonthlyBudget = typeof monthlyBudgetsTable.$inferSelect;
