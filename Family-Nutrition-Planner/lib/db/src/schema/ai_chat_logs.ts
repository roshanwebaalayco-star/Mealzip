import { pgTable, serial, integer, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";
import { familiesTable } from "./families";

export const aiChatLogsTable = pgTable("ai_chat_logs", {
  id: serial("id").primaryKey(),
  familyId: integer("family_id").notNull().references(() => familiesTable.id, { onDelete: "cascade" }),
  sessionType: text("session_type").notNull(),
  messages: jsonb("messages").notNull().default(sql`'[]'::jsonb`),
  extractedData: jsonb("extracted_data").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("ai_chat_logs_family_id_idx").on(table.familyId),
  index("ai_chat_logs_session_type_idx").on(table.sessionType),
]);

export const insertAiChatLogSchema = createInsertSchema(aiChatLogsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAiChatLog = z.infer<typeof insertAiChatLogSchema>;
export type AiChatLog = typeof aiChatLogsTable.$inferSelect;
