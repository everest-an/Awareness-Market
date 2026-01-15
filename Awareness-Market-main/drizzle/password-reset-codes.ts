import { mysqlTable, varchar, timestamp, int } from "drizzle-orm/mysql-core";

/**
 * Password reset verification codes
 * Stores temporary codes sent via email for password reset
 */
export const passwordResetCodes = mysqlTable("password_reset_codes", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  code: varchar("code", { length: 6 }).notNull(), // 6-digit verification code
  expiresAt: timestamp("expires_at").notNull(), // Expires after 10 minutes
  used: timestamp("used"), // NULL if not used yet
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
