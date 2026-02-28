import { int, mysqlTable, timestamp, text, boolean } from "drizzle-orm/mysql-core";

/**
 * Trial usage tracking for free vector trials
 */
export const trialUsage = mysqlTable("trial_usage", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  vectorId: int("vector_id").notNull(),
  usedCalls: int("used_calls").default(0).notNull(),
  inputData: text("input_data"), // JSON string of input
  outputData: text("output_data"), // JSON string of output
  success: boolean("success").default(true).notNull(),
  errorMessage: text("error_message"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TrialUsage = typeof trialUsage.$inferSelect;
export type InsertTrialUsage = typeof trialUsage.$inferInsert;
