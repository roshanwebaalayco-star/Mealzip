import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { familiesTable } from "./families";

export const chatMessagesTable = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  familyId: integer("family_id").notNull().references(() => familiesTable.id, { onDelete: "cascade" }),
  sessionId: text("session_id").notNull(),
  role: text("role").notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("chat_messages_family_session_idx").on(table.familyId, table.sessionId),
]);

export type ChatMessage = typeof chatMessagesTable.$inferSelect;
