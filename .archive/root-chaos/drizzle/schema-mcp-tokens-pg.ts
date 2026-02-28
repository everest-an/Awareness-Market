import {
  integer,
  serial,
  pgTable,
  varchar,
  text,
  timestamp,
  boolean,
  index,
} from "drizzle-orm/pg-core";

/**
 * MCP Sync Tokens for multi-agent collaboration
 */
export const mcpTokens = pgTable("mcp_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  tokenHash: varchar("token_hash", { length: 255 }).notNull().unique(),
  tokenPrefix: varchar("token_prefix", { length: 16 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  permissions: text("permissions"),
  lastUsedAt: timestamp("last_used_at"),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("mcp_token_user_idx").on(table.userId),
  tokenHashIdx: index("mcp_token_hash_idx").on(table.tokenHash),
}));

export type McpToken = typeof mcpTokens.$inferSelect;
export type InsertMcpToken = typeof mcpTokens.$inferInsert;
