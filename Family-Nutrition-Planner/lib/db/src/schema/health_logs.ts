import { pgTable, serial, integer, text, real, date, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { familiesTable } from "./families";
import { familyMembersTable } from "./family_members";

export const healthLogsTable = pgTable("health_logs", {
  id: serial("id").primaryKey(),
  familyId: integer("family_id").notNull().references(() => familiesTable.id, { onDelete: "cascade" }),
  memberId: integer("member_id").references(() => familyMembersTable.id, { onDelete: "cascade" }),
  logDate: text("log_date").notNull(),
  weightKg: real("weight_kg"),
  heightCm: real("height_cm"),
  bmi: real("bmi"),
  bloodSugar: real("blood_sugar"),
  bloodPressureSystolic: integer("blood_pressure_systolic"),
  bloodPressureDiastolic: integer("blood_pressure_diastolic"),
  symptoms: text("symptoms").array(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("health_logs_family_member_idx").on(table.familyId, table.memberId),
  index("health_logs_date_idx").on(table.logDate),
]);

export const insertHealthLogSchema = createInsertSchema(healthLogsTable).omit({ id: true, createdAt: true });
export type InsertHealthLog = z.infer<typeof insertHealthLogSchema>;
export type HealthLog = typeof healthLogsTable.$inferSelect;
