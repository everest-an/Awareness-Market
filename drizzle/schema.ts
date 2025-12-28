import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, index } from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

/**
 * Core user table backing auth flow.
 * Extended with role field for Creator/Consumer distinction.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "creator", "consumer"]).default("consumer").notNull(),
  bio: text("bio"),
  avatar: text("avatar"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

/**
 * Latent vectors (AI capabilities) uploaded by creators
 */
export const latentVectors = mysqlTable("latent_vectors", {
  id: int("id").autoincrement().primaryKey(),
  creatorId: int("creator_id").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  category: varchar("category", { length: 100 }).notNull(), // e.g., "finance", "code-generation", "medical"
  vectorFileKey: text("vector_file_key").notNull(), // S3 key for encrypted vector file
  vectorFileUrl: text("vector_file_url").notNull(), // S3 URL
  modelArchitecture: varchar("model_architecture", { length: 100 }), // e.g., "GPT-4", "LLaMA-2"
  vectorDimension: int("vector_dimension"), // e.g., 768, 1024
  performanceMetrics: text("performance_metrics"), // JSON string of metrics
  basePrice: decimal("base_price", { precision: 10, scale: 2 }).notNull(), // Base price per call
  pricingModel: mysqlEnum("pricing_model", ["per-call", "subscription", "usage-based"]).default("per-call").notNull(),
  status: mysqlEnum("status", ["draft", "active", "inactive", "suspended"]).default("draft").notNull(),
  totalCalls: int("total_calls").default(0).notNull(),
  totalRevenue: decimal("total_revenue", { precision: 12, scale: 2 }).default("0.00").notNull(),
  averageRating: decimal("average_rating", { precision: 3, scale: 2 }).default("0.00"),
  reviewCount: int("review_count").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  creatorIdx: index("creator_idx").on(table.creatorId),
  categoryIdx: index("category_idx").on(table.category),
  statusIdx: index("status_idx").on(table.status),
}));

/**
 * Transactions for purchasing latent vector access
 */
export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  buyerId: int("buyer_id").notNull(),
  vectorId: int("vector_id").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  platformFee: decimal("platform_fee", { precision: 10, scale: 2 }).notNull(), // 15-25% of amount
  creatorEarnings: decimal("creator_earnings", { precision: 10, scale: 2 }).notNull(),
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
  status: mysqlEnum("status", ["pending", "completed", "failed", "refunded"]).default("pending").notNull(),
  transactionType: mysqlEnum("transaction_type", ["one-time", "subscription"]).default("one-time").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  buyerIdx: index("buyer_idx").on(table.buyerId),
  vectorIdx: index("vector_idx").on(table.vectorId),
  statusIdx: index("status_idx").on(table.status),
}));

/**
 * Access permissions for purchased latent vectors
 */
export const accessPermissions = mysqlTable("access_permissions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  vectorId: int("vector_id").notNull(),
  transactionId: int("transaction_id").notNull(),
  accessToken: varchar("access_token", { length: 255 }).notNull().unique(), // Encrypted token for API access
  expiresAt: timestamp("expires_at"), // NULL for lifetime access
  callsRemaining: int("calls_remaining"), // NULL for unlimited
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userVectorIdx: index("user_vector_idx").on(table.userId, table.vectorId),
  tokenIdx: index("token_idx").on(table.accessToken),
}));

/**
 * Reviews and ratings for latent vectors
 */
export const reviews = mysqlTable("reviews", {
  id: int("id").autoincrement().primaryKey(),
  vectorId: int("vector_id").notNull(),
  userId: int("user_id").notNull(),
  rating: int("rating").notNull(), // 1-5 stars
  comment: text("comment"),
  isVerifiedPurchase: boolean("is_verified_purchase").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  vectorIdx: index("vector_idx").on(table.vectorId),
  userIdx: index("user_idx").on(table.userId),
}));

/**
 * Subscription plans for the platform
 */
export const subscriptionPlans = mysqlTable("subscription_plans", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  billingCycle: mysqlEnum("billing_cycle", ["monthly", "yearly"]).notNull(),
  features: text("features"), // JSON string of features
  callLimit: int("call_limit"), // NULL for unlimited
  stripePriceId: varchar("stripe_price_id", { length: 255 }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * User subscriptions
 */
export const userSubscriptions = mysqlTable("user_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  planId: int("plan_id").notNull(),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
  status: mysqlEnum("status", ["active", "cancelled", "expired", "past_due"]).default("active").notNull(),
  currentPeriodStart: timestamp("current_period_start").notNull(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdx: index("user_idx").on(table.userId),
  statusIdx: index("status_idx").on(table.status),
}));

/**
 * API call logs for analytics
 */
export const apiCallLogs = mysqlTable("api_call_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  vectorId: int("vector_id").notNull(),
  permissionId: int("permission_id").notNull(),
  responseTime: int("response_time"), // milliseconds
  success: boolean("success").default(true).notNull(),
  errorMessage: text("error_message"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("user_idx").on(table.userId),
  vectorIdx: index("vector_idx").on(table.vectorId),
  createdAtIdx: index("created_at_idx").on(table.createdAt),
}));

/**
 * Notifications for users
 */
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  type: mysqlEnum("type", ["transaction", "review", "system", "subscription"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  relatedEntityId: int("related_entity_id"), // ID of related transaction/review/etc
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("user_idx").on(table.userId),
  isReadIdx: index("is_read_idx").on(table.isRead),
}));

/**
 * User preferences for recommendations
 */
export const userPreferences = mysqlTable("user_preferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull().unique(),
  preferredCategories: text("preferred_categories"), // JSON array
  priceRange: text("price_range"), // JSON object {min, max}
  lastRecommendationUpdate: timestamp("last_recommendation_update"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  createdVectors: many(latentVectors),
  transactions: many(transactions),
  accessPermissions: many(accessPermissions),
  reviews: many(reviews),
  subscriptions: many(userSubscriptions),
  notifications: many(notifications),
}));

export const latentVectorsRelations = relations(latentVectors, ({ one, many }) => ({
  creator: one(users, {
    fields: [latentVectors.creatorId],
    references: [users.id],
  }),
  transactions: many(transactions),
  accessPermissions: many(accessPermissions),
  reviews: many(reviews),
  apiCallLogs: many(apiCallLogs),
}));

export const transactionsRelations = relations(transactions, ({ one, many }) => ({
  buyer: one(users, {
    fields: [transactions.buyerId],
    references: [users.id],
  }),
  vector: one(latentVectors, {
    fields: [transactions.vectorId],
    references: [latentVectors.id],
  }),
  accessPermissions: many(accessPermissions),
}));

export const accessPermissionsRelations = relations(accessPermissions, ({ one }) => ({
  user: one(users, {
    fields: [accessPermissions.userId],
    references: [users.id],
  }),
  vector: one(latentVectors, {
    fields: [accessPermissions.vectorId],
    references: [latentVectors.id],
  }),
  transaction: one(transactions, {
    fields: [accessPermissions.transactionId],
    references: [transactions.id],
  }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  vector: one(latentVectors, {
    fields: [reviews.vectorId],
    references: [latentVectors.id],
  }),
  user: one(users, {
    fields: [reviews.userId],
    references: [users.id],
  }),
}));

export const userSubscriptionsRelations = relations(userSubscriptions, ({ one }) => ({
  user: one(users, {
    fields: [userSubscriptions.userId],
    references: [users.id],
  }),
  plan: one(subscriptionPlans, {
    fields: [userSubscriptions.planId],
    references: [subscriptionPlans.id],
  }),
}));

// Type exports
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type LatentVector = typeof latentVectors.$inferSelect;
export type InsertLatentVector = typeof latentVectors.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;
export type AccessPermission = typeof accessPermissions.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type ApiCallLog = typeof apiCallLogs.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type UserPreference = typeof userPreferences.$inferSelect;

/**
 * Browsing history table for tracking user interactions with vectors
 */
export const browsingHistory = mysqlTable("browsing_history", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  vectorId: int("vector_id").notNull(),
  action: mysqlEnum("action", ["view", "click", "search"]).notNull(),
  metadata: text("metadata"), // JSON string for additional context
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("user_idx").on(table.userId),
  vectorIdx: index("vector_idx").on(table.vectorId),
  createdAtIdx: index("created_at_idx").on(table.createdAt),
}));

export type BrowsingHistory = typeof browsingHistory.$inferSelect;
export type InsertBrowsingHistory = typeof browsingHistory.$inferInsert;
