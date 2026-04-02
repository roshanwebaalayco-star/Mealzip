import { relations } from "drizzle-orm";
import { familiesTable } from "./families";
import { familyMembersTable } from "./family_members";
import { monthlyBudgetsTable } from "./monthly_budgets";
import { weeklyContextsTable } from "./weekly_contexts";
import { memberWeeklyContextsTable } from "./member_weekly_contexts";
import { mealPlansTable } from "./meal_plans";
import { groceryListsTable } from "./grocery_lists";
import { aiChatLogsTable } from "./ai_chat_logs";

export const familiesRelations = relations(familiesTable, ({ many }) => ({
  members: many(familyMembersTable),
  weeklyContexts: many(weeklyContextsTable),
  monthlyBudgets: many(monthlyBudgetsTable),
  mealPlans: many(mealPlansTable),
  groceryLists: many(groceryListsTable),
  aiChatLogs: many(aiChatLogsTable),
}));

export const familyMembersRelations = relations(familyMembersTable, ({ one, many }) => ({
  family: one(familiesTable, {
    fields: [familyMembersTable.familyId],
    references: [familiesTable.id],
  }),
  weeklyContexts: many(memberWeeklyContextsTable),
}));

export const monthlyBudgetsRelations = relations(monthlyBudgetsTable, ({ one }) => ({
  family: one(familiesTable, {
    fields: [monthlyBudgetsTable.familyId],
    references: [familiesTable.id],
  }),
}));

export const weeklyContextsRelations = relations(weeklyContextsTable, ({ one, many }) => ({
  family: one(familiesTable, {
    fields: [weeklyContextsTable.familyId],
    references: [familiesTable.id],
  }),
  memberWeeklyContexts: many(memberWeeklyContextsTable),
  mealPlans: many(mealPlansTable),
}));

export const memberWeeklyContextsRelations = relations(memberWeeklyContextsTable, ({ one }) => ({
  weeklyContext: one(weeklyContextsTable, {
    fields: [memberWeeklyContextsTable.weeklyContextId],
    references: [weeklyContextsTable.id],
  }),
  familyMember: one(familyMembersTable, {
    fields: [memberWeeklyContextsTable.familyMemberId],
    references: [familyMembersTable.id],
  }),
}));

export const mealPlansRelations = relations(mealPlansTable, ({ one, many }) => ({
  weeklyContext: one(weeklyContextsTable, {
    fields: [mealPlansTable.weeklyContextId],
    references: [weeklyContextsTable.id],
  }),
  family: one(familiesTable, {
    fields: [mealPlansTable.familyId],
    references: [familiesTable.id],
  }),
  groceryLists: many(groceryListsTable),
}));

export const groceryListsRelations = relations(groceryListsTable, ({ one }) => ({
  family: one(familiesTable, {
    fields: [groceryListsTable.familyId],
    references: [familiesTable.id],
  }),
  mealPlan: one(mealPlansTable, {
    fields: [groceryListsTable.mealPlanId],
    references: [mealPlansTable.id],
  }),
}));

export const aiChatLogsRelations = relations(aiChatLogsTable, ({ one }) => ({
  family: one(familiesTable, {
    fields: [aiChatLogsTable.familyId],
    references: [familiesTable.id],
  }),
}));
