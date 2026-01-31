/**
 * PostgreSQL Schema for Awareness Network
 * Auto-converted from MySQL schema
 *
 * Key differences from MySQL:
 * - Uses serial instead of int().autoincrement()
 * - Uses pgEnum instead of mysqlEnum
 * - Removed .onUpdateNow() (use triggers or application logic)
 * - Uses numeric instead of decimal
 */

import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  timestamp,
  numeric,
  boolean,
  pgEnum,
  bigint,
  index,
  jsonb
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Define enums first (PostgreSQL requirement)
export const role_enum = pgEnum('role', ["user", "admin", "creator", "consumer"]);
export const user_type_enum = pgEnum('user_type', ["creator", "consumer", "both"]);
export const pricing_model_enum = pgEnum('pricing_model', ["per-call", "subscription", "usage-based"]);
export const status_enum = pgEnum('status', ["draft", "active", "inactive", "suspended"]);
export const vector_type_enum = pgEnum('vector_type', ["embedding", "kv_cache", "reasoning_chain"]);
export const w_matrix_standard_enum = pgEnum('w_matrix_standard', ["4096", "8192"]);
export const memory_type_enum = pgEnum('memory_type', ["kv_cache", "reasoning_chain", "latent_vector", "expert_knowledge"]);
export const transaction_type_enum = pgEnum('transaction_type', ["one-time", "subscription"]);
export const billing_cycle_enum = pgEnum('billing_cycle', ["monthly", "yearly"]);
export const action_enum = pgEnum('action', ["view", "click", "search"]);
export const reason_enum = pgEnum('reason', [
    "spam",
    "low_quality",
    "misleading",
    "copyright",
    "inappropriate",
    "other"
  ]);
export const check_type_enum = pgEnum('check_type', [
    "dimension_validation",
    "format_validation",
    "data_integrity",
    "performance_test",
    "manual_review"
  ]);
export const matrix_format_enum = pgEnum('matrix_format', ["numpy", "safetensors"]);
export const category_enum = pgEnum('category', ["nlp", "vision", "audio", "multimodal", "other"]);
export const package_type_enum = pgEnum('package_type', ["vector", "memory", "chain"]);

// Import Memory NFT and TBA tables
export * from './schema-memory-nft-pg';

// Import Workflow History tables
export * from './schema-workflow-pg';

// Import API Usage Logging tables
export * from './schema-api-usage-pg';

// Import Agent Collaboration Workflows tables
export * from './schema-workflows-pg';

// Import W-Matrix Compatibility tables
export * from './schema-w-matrix-compat-pg';

/**
 * Core user table backing auth flow.
 * Extended with role field for Creator/Consumer distinction.
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  password: varchar("password", { length: 255 }), // bcrypt hashed password
  emailVerified: boolean("email_verified").default(false),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: role_enum('role').default("consumer").notNull(),
  userType: user_type_enum('user_type'), // User's primary role
  onboardingCompleted: boolean("onboarding_completed").default(false).notNull(),
  bio: text("bio"),
  avatar: text("avatar"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow(),
});

/**
 * Latent vectors (AI capabilities) uploaded by creators
 */
export const latentVectors = pgTable("latent_vectors", {
  id: serial("id").primaryKey(),
  creatorId: integer("creator_id").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  category: varchar("category", { length: 100 }).notNull(), // e.g., "finance", "code-generation", "medical"
  vectorFileKey: text("vector_file_key").notNull(), // S3 key for encrypted vector file
  vectorFileUrl: text("vector_file_url").notNull(), // S3 URL
  modelArchitecture: varchar("model_architecture", { length: 100 }), // e.g., "GPT-4", "LLaMA-2"
  vectorDimension: integer("vector_dimension"), // e.g., 768, 1024
  performanceMetrics: text("performance_metrics"), // JSON string of metrics
  basePrice: numeric("base_price", { precision: 10, scale: 2 }).notNull(), // Base price per call
  pricingModel: pricing_model_enum('pricing_model').default("per-call").notNull(),
  status: status_enum('status').default("draft").notNull(),
  totalCalls: integer("total_calls").default(0).notNull(),
  totalRevenue: numeric("total_revenue", { precision: 12, scale: 2 }).default("0.00").notNull(),
  averageRating: numeric("average_rating", { precision: 3, scale: 2 }).default("0.00"),
  reviewCount: integer("review_count").default(0).notNull(),
  freeTrialCalls: integer("free_trial_calls").default(3).notNull(), // Number of free trial calls per user
  // V2.0: KV-cache support
  vectorType: vector_type_enum('vector_type').default("embedding").notNull(),
  kvCacheMetadata: text("kv_cache_metadata"), // JSON: {sourceModel, sequenceLength, tokenCount, contextDescription}
  wMatrixVersion: varchar("w_matrix_version", { length: 20 }).default("v1.0.0"), // e.g., "v1.0.0"
  wMatrixStandard: w_matrix_standard_enum('w_matrix_standard').default("8192").notNull(),
  alignmentLoss: numeric("alignment_loss", { precision: 10, scale: 8 }).default("0.0").notNull(), // ε value
  fidelityScore: numeric("fidelity_score", { precision: 5, scale: 4 }).default("0.0").notNull(), // 0.0000-1.0000
  sourceModel: varchar("source_model", { length: 50 }).default("unknown").notNull(), // "llama-3-70b"
  sourceArchitecture: varchar("source_architecture", { length: 30 }), // "transformer"
  hiddenDim: integer("hidden_dim"), // Original model dimension
  memoryType: memory_type_enum('memory_type').default("latent_vector").notNull(),
  nftTokenId: bigint("nft_token_id", { mode: "number", unsigned: true }), // ERC-6551 NFT ID
  tbaAddress: varchar("tba_address", { length: 42 }), // Token Bound Account
  memoryNftUri: text("memory_nft_uri"), // IPFS/Arweave CID
  usageCount: integer("usage_count").default(0).notNull(),
  avgUserRating: numeric("avg_user_rating", { precision: 3, scale: 2 }), // 0.00-5.00
  lastAccessedAt: timestamp("last_accessed_at"),
  dynamicKFactor: numeric("dynamic_k_factor", { precision: 6, scale: 4 }).default("1.0000").notNull(), // PID-adjusted multiplier
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  creatorIdx: index("creator_idx").on(table.creatorId),
  categoryIdx: index("category_idx").on(table.category),
  statusIdx: index("status_idx").on(table.status),
}));

/**
 * Transactions for purchasing latent vector access
 */
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  buyerId: integer("buyer_id").notNull(),
  vectorId: integer("vector_id").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  platformFee: numeric("platform_fee", { precision: 10, scale: 2 }).notNull(), // 15-25% of amount
  creatorEarnings: numeric("creator_earnings", { precision: 10, scale: 2 }).notNull(),
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
  status: status_enum('status').default("pending").notNull(),
  transactionType: transaction_type_enum('transaction_type').default("one-time").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  buyerIdx: index("buyer_idx").on(table.buyerId),
  vectorIdx: index("vector_idx").on(table.vectorId),
  statusIdx: index("status_idx").on(table.status),
}));

/**
 * Access permissions for purchased latent vectors
 */
export const accessPermissions = pgTable("access_permissions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  vectorId: integer("vector_id").notNull(),
  transactionId: integer("transaction_id").notNull(),
  accessToken: varchar("access_token", { length: 255 }).notNull().unique(), // Encrypted token for API access
  expiresAt: timestamp("expires_at"), // NULL for lifetime access
  callsRemaining: integer("calls_remaining"), // NULL for unlimited
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  userVectorIdx: index("user_vector_idx").on(table.userId, table.vectorId),
  tokenIdx: index("token_idx").on(table.accessToken),
}));

/**
 * Reviews and ratings for latent vectors
 */
export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  vectorId: integer("vector_id").notNull(),
  userId: integer("user_id").notNull(),
  rating: integer("rating").notNull(), // 1-5 stars
  comment: text("comment"),
  isVerifiedPurchase: boolean("is_verified_purchase").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  vectorIdx: index("vector_idx").on(table.vectorId),
  userIdx: index("user_idx").on(table.userId),
}));

/**
 * Subscription plans for the platform
 */
export const subscriptionPlans = pgTable("subscription_plans", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  billingCycle: billing_cycle_enum('billing_cycle').notNull(),
  features: text("features"), // JSON string of features
  callLimit: integer("call_limit"), // NULL for unlimited
  stripePriceId: varchar("stripe_price_id", { length: 255 }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

/**
 * User subscriptions
 */
export const userSubscriptions = pgTable("user_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  planId: integer("plan_id").notNull(),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
  status: status_enum('status').default("active").notNull(),
  currentPeriodStart: timestamp("current_period_start").notNull(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("user_idx").on(table.userId),
  statusIdx: index("status_idx").on(table.status),
}));

/**
 * API call logs for analytics
 */
export const apiCallLogs = pgTable("api_call_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  vectorId: integer("vector_id").notNull(),
  permissionId: integer("permission_id").notNull(),
  responseTime: integer("response_time"), // milliseconds
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
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  type: type_enum('type').notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  relatedEntityId: integer("related_entity_id"), // ID of related transaction/review/etc
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("user_idx").on(table.userId),
  isReadIdx: index("is_read_idx").on(table.isRead),
}));

/**
 * User preferences for recommendations
 */
export const userPreferences = pgTable("user_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  preferredCategories: text("preferred_categories"), // JSON array
  priceRange: text("price_range"), // JSON object {min, max}
  lastRecommendationUpdate: timestamp("last_recommendation_update"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
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
export const browsingHistory = pgTable("browsing_history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  vectorId: integer("vector_id").notNull(),
  action: action_enum('action').notNull(),
  metadata: text("metadata"), // JSON string for additional context
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("user_idx").on(table.userId),
  vectorIdx: index("vector_idx").on(table.vectorId),
  createdAtIdx: index("created_at_idx").on(table.createdAt),
}));

export type BrowsingHistory = typeof browsingHistory.$inferSelect;
export type InsertBrowsingHistory = typeof browsingHistory.$inferInsert;

/**
 * API Keys for AI agent authentication
 */
/**
 * API Usage Logs for tracking API key usage
 */
export const apiUsageLogs = pgTable("api_usage_logs", {
  id: serial("id").primaryKey(),
  apiKeyId: integer("api_key_id").notNull(),
  userId: integer("user_id").notNull(),
  endpoint: varchar("endpoint", { length: 255 }).notNull(),
  method: varchar("method", { length: 10 }).notNull(),
  statusCode: integer("status_code").notNull(),
  responseTimeMs: integer("response_time_ms").notNull(),
  requestSizeBytes: integer("request_size_bytes").default(0),
  responseSizeBytes: integer("response_size_bytes").default(0),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  apiKeyIdx: index("api_key_idx").on(table.apiKeyId),
  userIdx: index("user_idx").on(table.userId),
  endpointIdx: index("endpoint_idx").on(table.endpoint),
  createdAtIdx: index("created_at_idx").on(table.createdAt),
}));

/**
 * Rate Limit Configuration per API key
 */
export const rateLimitConfig = pgTable("rate_limit_config", {
  id: serial("id").primaryKey(),
  apiKeyId: integer("api_key_id").notNull().unique(),
  requestsPerHour: integer("requests_per_hour").default(1000).notNull(),
  requestsPerDay: integer("requests_per_day").default(10000).notNull(),
  requestsPerMonth: integer("requests_per_month").default(100000).notNull(),
  burstLimit: integer("burst_limit").default(100).notNull(),
  isEnabled: boolean("is_enabled").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  keyHash: varchar("key_hash", { length: 255 }).notNull().unique(), // SHA-256 hash of the API key
  keyPrefix: varchar("key_prefix", { length: 16 }).notNull(), // First 8 chars for identification
  name: varchar("name", { length: 255 }).notNull(), // User-defined name for the key
  permissions: text("permissions"), // JSON array of permissions
  lastUsedAt: timestamp("last_used_at"),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("user_idx").on(table.userId),
  keyHashIdx: index("key_hash_idx").on(table.keyHash),
}));

export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = typeof apiKeys.$inferInsert;

/**
 * AI Memory Storage - for AI agents to store and sync their state
 */
export const aiMemory = pgTable("ai_memory", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  memoryKey: varchar("memory_key", { length: 255 }).notNull(), // Namespace key like "preferences", "history", "context"
  memoryData: text("memory_data").notNull(), // JSON data
  version: integer("version").default(1).notNull(), // For conflict resolution
  expiresAt: timestamp("expires_at"), // Optional TTL
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  userKeyIdx: index("user_key_idx").on(table.userId, table.memoryKey),
}));

export type AiMemory = typeof aiMemory.$inferSelect;
export type InsertAIMemory = typeof aiMemory.$inferInsert;

/**
 * Trial usage tracking for free vector trials
 */
export const trialUsage = pgTable("trial_usage", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  vectorId: integer("vector_id").notNull(),
  usedCalls: integer("used_calls").default(0).notNull(),
  inputData: text("input_data"), // JSON string of input
  outputData: text("output_data"), // JSON string of output
  success: boolean("success").default(true).notNull(),
  errorMessage: text("error_message"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TrialUsage = typeof trialUsage.$inferSelect;
export type InsertTrialUsage = typeof trialUsage.$inferInsert;

/**
 * User behavior tracking for recommendation optimization
 */
export const userBehavior = pgTable("user_behavior", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  vectorId: integer("vector_id").notNull(),
  actionType: action_type_enum('action_type').notNull(),
  duration: integer("duration"), // Time spent in seconds
  metadata: text("metadata"), // JSON string for additional data
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("user_idx").on(table.userId),
  vectorIdx: index("vector_idx").on(table.vectorId),
  actionIdx: index("action_idx").on(table.actionType),
}));

export type UserBehavior = typeof userBehavior.$inferSelect;
export type InsertUserBehavior = typeof userBehavior.$inferInsert;

/**
 * A/B test experiments for recommendation algorithms
 */
export const abTestExperiments = pgTable("ab_test_experiments", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  algorithmA: varchar("algorithm_a", { length: 100 }).notNull(), // e.g., "llm_based"
  algorithmB: varchar("algorithm_b", { length: 100 }).notNull(), // e.g., "collaborative_filtering"
  trafficSplit: numeric("traffic_split", { precision: 3, scale: 2 }).default("0.50").notNull(), // 0.50 = 50/50 split
  status: status_enum('status').default("draft").notNull(),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type AbTestExperiment = typeof abTestExperiments.$inferSelect;
export type InsertAbTestExperiment = typeof abTestExperiments.$inferInsert;

/**
 * A/B test assignments tracking which users see which algorithm
 */
export const abTestAssignments = pgTable("ab_test_assignments", {
  id: serial("id").primaryKey(),
  experimentId: integer("experiment_id").notNull(),
  userId: integer("user_id").notNull(),
  assignedAlgorithm: varchar("assigned_algorithm", { length: 100 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  experimentUserIdx: index("experiment_user_idx").on(table.experimentId, table.userId),
}));

export type AbTestAssignment = typeof abTestAssignments.$inferSelect;
export type InsertAbTestAssignment = typeof abTestAssignments.$inferInsert;

/**
 * Blog posts for platform updates and AI technology articles
 */
export const blogPosts = pgTable("blog_posts", {
  id: serial("id").primaryKey(),
  authorId: integer("author_id").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  excerpt: text("excerpt"), // Short summary
  content: text("content").notNull(), // Markdown content
  coverImage: text("cover_image"), // S3 URL
  tags: text("tags"), // JSON array of tags
  category: varchar("category", { length: 100 }), // e.g., "platform-updates", "ai-technology", "tutorials"
  status: status_enum('status').default("draft").notNull(),
  viewCount: integer("view_count").default(0).notNull(),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  slugIdx: index("slug_idx").on(table.slug),
  statusIdx: index("status_idx").on(table.status),
  publishedAtIdx: index("published_at_idx").on(table.publishedAt),
}));

export const blogPostsRelations = relations(blogPosts, ({ one }) => ({
  author: one(users, {
    fields: [blogPosts.authorId],
    references: [users.id],
  }),
}));

export type BlogPost = typeof blogPosts.$inferSelect;
export type InsertBlogPost = typeof blogPosts.$inferInsert;

/**
 * Detailed vector invocation records with input/output data
 */
export const vectorInvocations = pgTable("vector_invocations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  vectorId: integer("vector_id").notNull(),
  permissionId: integer("permission_id").notNull(),
  inputData: text("input_data"), // JSON string of input parameters
  outputData: text("output_data"), // JSON string of output results
  tokensUsed: integer("tokens_used"), // For LLM-based vectors
  executionTime: integer("execution_time"), // milliseconds
  status: status_enum('status').default("success").notNull(),
  errorMessage: text("error_message"),
  cost: numeric("cost", { precision: 10, scale: 4 }), // Actual cost for this invocation
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("user_idx").on(table.userId),
  vectorIdx: index("vector_idx").on(table.vectorId),
  createdAtIdx: index("created_at_idx").on(table.createdAt),
  statusIdx: index("status_idx").on(table.status),
}));

export const vectorInvocationsRelations = relations(vectorInvocations, ({ one }) => ({
  user: one(users, {
    fields: [vectorInvocations.userId],
    references: [users.id],
  }),
  vector: one(latentVectors, {
    fields: [vectorInvocations.vectorId],
    references: [latentVectors.id],
  }),
  permission: one(accessPermissions, {
    fields: [vectorInvocations.permissionId],
    references: [accessPermissions.id],
  }),
}));

export type VectorInvocation = typeof vectorInvocations.$inferSelect;
export type InsertVectorInvocation = typeof vectorInvocations.$inferInsert;

/**
 * Vector quality reports and user complaints
 */
export const vectorReports = pgTable("vector_reports", {
  id: serial("id").primaryKey(),
  vectorId: integer("vector_id").notNull(),
  reporterId: integer("reporter_id").notNull(),
  reason: reason_enum('reason').notNull(),
  description: text("description"),
  status: status_enum('status').default("pending").notNull(),
  adminNotes: text("admin_notes"),
  resolvedBy: integer("resolved_by"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  vectorIdx: index("vector_idx").on(table.vectorId),
  reporterIdx: index("reporter_idx").on(table.reporterId),
  statusIdx: index("status_idx").on(table.status),
  createdAtIdx: index("created_at_idx").on(table.createdAt),
}));

export const vectorReportsRelations = relations(vectorReports, ({ one }) => ({
  vector: one(latentVectors, {
    fields: [vectorReports.vectorId],
    references: [latentVectors.id],
  }),
  reporter: one(users, {
    fields: [vectorReports.reporterId],
    references: [users.id],
  }),
  resolver: one(users, {
    fields: [vectorReports.resolvedBy],
    references: [users.id],
  }),
}));

export type VectorReport = typeof vectorReports.$inferSelect;
export type InsertVectorReport = typeof vectorReports.$inferInsert;

/**
 * Creator reputation scores
 */
export const creatorReputations = pgTable("creator_reputations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").unique().notNull(),
  reputationScore: numeric("reputation_score", { precision: 5, scale: 2 }).default("100.00").notNull(),
  totalVectors: integer("total_vectors").default(0).notNull(),
  totalSales: integer("total_sales").default(0).notNull(),
  totalReports: integer("total_reports").default(0).notNull(),
  resolvedReports: integer("resolved_reports").default(0).notNull(),
  averageRating: numeric("average_rating", { precision: 3, scale: 2 }),
  lastCalculatedAt: timestamp("last_calculated_at").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("user_idx").on(table.userId),
  reputationIdx: index("reputation_idx").on(table.reputationScore),
}));

export const creatorReputationsRelations = relations(creatorReputations, ({ one }) => ({
  user: one(users, {
    fields: [creatorReputations.userId],
    references: [users.id],
  }),
}));

export type CreatorReputation = typeof creatorReputations.$inferSelect;
export type InsertCreatorReputation = typeof creatorReputations.$inferInsert;

/**
 * Vector quality checks
 */
export const vectorQualityChecks = pgTable("vector_quality_checks", {
  id: serial("id").primaryKey(),
  vectorId: integer("vector_id").notNull(),
  checkType: check_type_enum('check_type').notNull(),
  status: status_enum('status').notNull(),
  score: numeric("score", { precision: 5, scale: 2 }),
  details: text("details"), // JSON string with check results
  checkedBy: integer("checked_by"), // NULL for automated checks
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  vectorIdx: index("vector_idx").on(table.vectorId),
  statusIdx: index("status_idx").on(table.status),
  checkTypeIdx: index("check_type_idx").on(table.checkType),
  createdAtIdx: index("created_at_idx").on(table.createdAt),
}));

export const vectorQualityChecksRelations = relations(vectorQualityChecks, ({ one }) => ({
  vector: one(latentVectors, {
    fields: [vectorQualityChecks.vectorId],
    references: [latentVectors.id],
  }),
  checker: one(users, {
    fields: [vectorQualityChecks.checkedBy],
    references: [users.id],
  }),
}));

export type VectorQualityCheck = typeof vectorQualityChecks.$inferSelect;
export type InsertVectorQualityCheck = typeof vectorQualityChecks.$inferInsert;

/**
 * LatentMAS V2.0: Memory exchanges (KV-cache trading records)
 */
export const memoryExchanges = pgTable("memory_exchanges", {
  id: serial("id").primaryKey(),
  sellerId: integer("seller_id").notNull(),
  buyerId: integer("buyer_id").notNull(),
  memoryType: memory_type_enum('memory_type').notNull(),
  kvCacheData: text("kv_cache_data"), // JSON: serialized KVCache object
  wMatrixVersion: varchar("w_matrix_version", { length: 20 }), // e.g., "1.0.0"
  sourceModel: varchar("source_model", { length: 50 }), // e.g., "gpt-4", "llama-3-8b"
  targetModel: varchar("target_model", { length: 50 }), // Model it was aligned to
  contextLength: integer("context_length"),
  tokenCount: integer("token_count"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  qualityScore: numeric("quality_score", { precision: 3, scale: 2 }), // 0.00-1.00
  alignmentQuality: text("alignment_quality"), // JSON: {cosineSimilarity, euclideanDistance, informationRetention, confidence}
  status: status_enum('status').default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  sellerIdx: index("seller_idx").on(table.sellerId),
  buyerIdx: index("buyer_idx").on(table.buyerId),
  memoryTypeIdx: index("memory_type_idx").on(table.memoryType),
  statusIdx: index("status_idx").on(table.status),
}));

export const memoryExchangesRelations = relations(memoryExchanges, ({ one }) => ({
  seller: one(users, {
    fields: [memoryExchanges.sellerId],
    references: [users.id],
  }),
  buyer: one(users, {
    fields: [memoryExchanges.buyerId],
    references: [users.id],
  }),
}));

export type MemoryExchange = typeof memoryExchanges.$inferSelect;
export type InsertMemoryExchange = typeof memoryExchanges.$inferInsert;

/**
 * LatentMAS V2.0: Reasoning chains marketplace
 */
export const reasoningChains = pgTable("reasoning_chains", {
  id: serial("id").primaryKey(),
  creatorId: integer("creator_id").notNull(),
  chainName: varchar("chain_name", { length: 255 }).notNull(),
  description: text("description").notNull(),
  category: varchar("category", { length: 100 }).notNull(), // e.g., "math", "coding", "analysis"
  inputExample: text("input_example"), // JSON: example input that triggers this chain
  outputExample: text("output_example"), // JSON: example output produced
  kvCacheSnapshot: text("kv_cache_snapshot"), // JSON: serialized KVCache of the reasoning process
  sourceModel: varchar("source_model", { length: 50 }).notNull(), // Model that generated this chain
  wMatrixVersion: varchar("w_matrix_version", { length: 20 }), // Compatible W-Matrix version
  stepCount: integer("step_count"), // Number of reasoning steps
  avgQuality: numeric("avg_quality", { precision: 3, scale: 2 }).default("0.00"), // Average user rating
  reviewCount: integer("review_count").default(0).notNull(),
  pricePerUse: numeric("price_per_use", { precision: 10, scale: 2 }).notNull(),
  usageCount: integer("usage_count").default(0).notNull(),
  totalRevenue: numeric("total_revenue", { precision: 12, scale: 2 }).default("0.00").notNull(),
  status: status_enum('status').default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  creatorIdx: index("creator_idx").on(table.creatorId),
  categoryIdx: index("category_idx").on(table.category),
  statusIdx: index("status_idx").on(table.status),
}));

export const reasoningChainsRelations = relations(reasoningChains, ({ one }) => ({
  creator: one(users, {
    fields: [reasoningChains.creatorId],
    references: [users.id],
  }),
}));

export type ReasoningChain = typeof reasoningChains.$inferSelect;
export type InsertReasoningChain = typeof reasoningChains.$inferInsert;

/**
 * LatentMAS V2.0: W-Matrix versions registry
 */
export const wMatrixVersions = pgTable("w_matrix_versions", {
  id: serial("id").primaryKey(),
  version: varchar("version", { length: 20 }).notNull().unique(), // e.g., "v1.0.0"
  standardDim: integer("standard_dim").notNull(), // 4096 or 8192
  
  // Matrix Storage (compressed)
  matrixData: text("matrix_data"), // Serialized numpy array or safetensors
  matrixFormat: matrix_format_enum('matrix_format').default("safetensors").notNull(),
  
  // Metadata
  sourceModels: text("source_models"), // JSON array: ["llama-3-70b", "mistral-7b"]
  alignmentPairsCount: integer("alignment_pairs_count"), // Number of anchor points used
  avgReconstructionError: numeric("avg_reconstruction_error", { precision: 10, scale: 8 }),
  
  // Versioning
  isActive: boolean("is_active").default(true).notNull(),
  deprecatedAt: timestamp("deprecated_at"),
  
  // Governance
  maintainerAddress: varchar("maintainer_address", { length: 42 }), // Node operator TBA
  totalUsageCount: bigint("total_usage_count", { mode: "number", unsigned: true }).default(0),
  totalRewardsEarned: numeric("total_rewards_earned", { precision: 18, scale: 8 }).default("0.0"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  versionIdx: index("version_idx").on(table.version),
  standardDimIdx: index("standard_dim_idx").on(table.standardDim),
  isActiveIdx: index("is_active_idx").on(table.isActive),
}));

export type WMatrixVersion = typeof wMatrixVersions.$inferSelect;
export type InsertWMatrixVersion = typeof wMatrixVersions.$inferInsert;

/**
 * Password reset verification codes
 * Stores temporary codes sent via email for password reset
 */
export const passwordResetCodes = pgTable("password_reset_codes", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  code: varchar("code", { length: 6 }).notNull(), // 6-digit verification code
  expiresAt: timestamp("expires_at").notNull(), // Expires after 10 minutes
  used: timestamp("used"), // NULL if not used yet
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  emailIdx: index("email_idx").on(table.email),
  codeIdx: index("code_idx").on(table.code),
}));

export type PasswordResetCode = typeof passwordResetCodes.$inferSelect;
export type InsertPasswordResetCode = typeof passwordResetCodes.$inferInsert;

/**
 * Alignment calculations history
 * Records each W-matrix alignment computation for auditing and analytics
 */
export const alignmentCalculations = pgTable("alignment_calculations", {
  id: bigint("id", { mode: "number", unsigned: true }).primaryKey(),
  vectorId: integer("vector_id").notNull(),
  wMatrixVersion: varchar("w_matrix_version", { length: 20 }).notNull(),
  
  // Calculation Results
  epsilonValue: numeric("epsilon_value", { precision: 10, scale: 8 }).notNull(), // ||ω·z_A - z̄_std||²
  fidelityBoostEstimate: numeric("fidelity_boost_estimate", { precision: 5, scale: 2 }), // Predicted improvement %
  
  // Computation Metadata
  computedAt: timestamp("computed_at").defaultNow().notNull(),
  computationTimeMs: integer("computation_time_ms"),
  gpuUsed: varchar("gpu_used", { length: 50 }),
}, (table) => ({
  vectorVersionIdx: index("vector_version_idx").on(table.vectorId, table.wMatrixVersion),
  computedAtIdx: index("computed_at_idx").on(table.computedAt),
}));

export type AlignmentCalculation = typeof alignmentCalculations.$inferSelect;
export type InsertAlignmentCalculation = typeof alignmentCalculations.$inferInsert;

// Force recompile Fri Jan  3 00:00:00 EST 2026

/**
 * W-Matrix storage for cross-model vector alignment
 * Stores serialized W-Matrix data for reuse across sessions
 */
export const wMatrices = pgTable("w_matrices", {
  id: serial("id").primaryKey(),
  matrixId: varchar("matrix_id", { length: 255 }).unique().notNull(), // e.g., "user123-1704268800000"
  userId: integer("user_id").notNull(), // Owner of the matrix
  sourceModel: varchar("source_model", { length: 100 }).notNull(), // e.g., "gpt-3.5-turbo"
  targetModel: varchar("target_model", { length: 100 }).notNull(), // e.g., "gpt-4"
  sourceDim: integer("source_dim").notNull(), // e.g., 1536
  targetDim: integer("target_dim").notNull(), // e.g., 3072
  architecture: text("architecture").notNull(), // e.g., "1536 → 1920 → 2688 → 3072"
  serializedData: text("serialized_data").notNull(), // JSON serialized matrix weights
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  usageCount: integer("usage_count").default(0).notNull(), // Number of times used
  lastUsedAt: timestamp("last_used_at"),
});

/**
 * Anti-poisoning verification challenges
 * Stores active challenges for vector verification
 */
export const challenges = pgTable("challenges", {
  id: serial("id").primaryKey(),
  challengeId: varchar("challenge_id", { length: 255 }).unique().notNull(), // Hex string
  nonce: varchar("nonce", { length: 255 }).notNull(), // Cryptographic nonce
  testPrompts: text("test_prompts").notNull(), // JSON array of prompts
  expectedPatterns: text("expected_patterns").notNull(), // JSON array of patterns
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(), // Challenge expiration
  config: text("config"), // JSON: {fidelityThreshold, anomalyThreshold, challengeSize, timeoutMs}
  status: status_enum('status').default("active").notNull(),
  verificationResult: text("verification_result"), // JSON: stored after verification
});

// Relations for wMatrices
export const wMatricesRelations = relations(wMatrices, ({ one }) => ({
  user: one(users, {
    fields: [wMatrices.userId],
    references: [users.id],
  }),
}));

/**
 * W-Matrix Marketplace Listings
 * Pre-trained W-Matrices for popular model pairs that can be bought and sold
 */
export const wMatrixListings = pgTable("w_matrix_listings", {
  id: serial("id").primaryKey(),
  sellerId: integer("seller_id").notNull(), // Creator who trained the matrix
  title: varchar("title", { length: 255 }).notNull(), // e.g., "GPT-3.5 → GPT-4 Alignment Matrix"
  description: text("description").notNull(),
  sourceModel: varchar("source_model", { length: 100 }).notNull(), // e.g., "gpt-3.5-turbo"
  targetModel: varchar("target_model", { length: 100 }).notNull(), // e.g., "gpt-4"
  sourceDim: integer("source_dim").notNull(),
  targetDim: integer("target_dim").notNull(),
  matrixId: varchar("matrix_id", { length: 255 }).notNull(), // Reference to wMatrices table
  price: numeric("price", { precision: 10, scale: 2 }).notNull(), // One-time purchase price
  alignmentLoss: numeric("alignment_loss", { precision: 10, scale: 8 }).notNull(), // Quality metric
  trainingDataSize: integer("training_data_size"), // Number of training samples
  performanceMetrics: text("performance_metrics"), // JSON: {accuracy, latency, etc.}
  status: status_enum('status').default("draft").notNull(),
  totalSales: integer("total_sales").default(0).notNull(),
  totalRevenue: numeric("total_revenue", { precision: 12, scale: 2 }).default("0.00").notNull(),
  averageRating: numeric("average_rating", { precision: 3, scale: 2 }).default("0.00"),
  reviewCount: integer("review_count").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  sellerIdx: index("seller_idx").on(table.sellerId),
  modelPairIdx: index("model_pair_idx").on(table.sourceModel, table.targetModel),
  statusIdx: index("status_idx").on(table.status),
}));

/**
 * W-Matrix Purchases
 * Track user purchases of W-Matrix listings
 */
export const wMatrixPurchases = pgTable("w_matrix_purchases", {
  id: serial("id").primaryKey(),
  listingId: integer("listing_id").notNull(),
  buyerId: integer("buyer_id").notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
  status: status_enum('status').default("pending").notNull(),
  purchasedAt: timestamp("purchasedAt").defaultNow().notNull(),
}, (table) => ({
  listingIdx: index("listing_idx").on(table.listingId),
  buyerIdx: index("buyer_idx").on(table.buyerId),
}));

// Relations for wMatrixListings
export const wMatrixListingsRelations = relations(wMatrixListings, ({ one, many }) => ({
  seller: one(users, {
    fields: [wMatrixListings.sellerId],
    references: [users.id],
  }),
  purchases: many(wMatrixPurchases),
}));

// Relations for wMatrixPurchases
export const wMatrixPurchasesRelations = relations(wMatrixPurchases, ({ one }) => ({
  listing: one(wMatrixListings, {
    fields: [wMatrixPurchases.listingId],
    references: [wMatrixListings.id],
  }),
  buyer: one(users, {
    fields: [wMatrixPurchases.buyerId],
    references: [users.id],
  }),
}));

// ============================================================================
// Three Product Lines: Vector / Memory / Chain Packages
// ============================================================================

/**
 * Vector Packages - Product Line 1
 * Static vectors for capability learning (互相推导)
 * Each package contains: vector + W-Matrix + metadata
 */
export const vectorPackages = pgTable("vector_packages", {
  id: serial("id").primaryKey(),
  packageId: varchar("package_id", { length: 64 }).notNull().unique(), // e.g., "vpkg_abc123"
  userId: integer("user_id").notNull(), // Creator
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description").notNull(),
  
  // Package files (S3 URLs)
  vectorUrl: text("vector_url").notNull(), // .safetensors file
  wMatrixUrl: text("w_matrix_url").notNull(), // W-Matrix .safetensors
  packageUrl: text("package_url").notNull(), // Complete .vectorpkg file
  
  // Model info
  sourceModel: varchar("source_model", { length: 50 }).notNull(), // e.g., "gpt-4"
  targetModel: varchar("target_model", { length: 50 }).notNull(), // e.g., "claude-3"
  dimension: integer("dimension").notNull(), // Vector dimension
  
  // Quality metrics
  epsilon: numeric("epsilon", { precision: 10, scale: 8 }).notNull(), // Alignment loss
  informationRetention: numeric("information_retention", { precision: 5, scale: 4 }).notNull(), // 0.0000-1.0000
  qualityScore: numeric("quality_score", { precision: 5, scale: 4 }).default("0.0000"), // Overall quality score 0.0000-1.0000

  // Category
  category: category_enum('category').default("nlp").notNull(),
  
  // Pricing and stats
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  downloads: integer("downloads").default(0).notNull(),
  rating: numeric("rating", { precision: 3, scale: 2 }).default("0.00"),
  reviewCount: integer("review_count").default(0).notNull(),
  
  // Status
  status: status_enum('status').default("draft").notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("user_idx").on(table.userId),
  categoryIdx: index("category_idx").on(table.category),
  statusIdx: index("status_idx").on(table.status),
  modelPairIdx: index("model_pair_idx").on(table.sourceModel, table.targetModel),
}));

/**
 * Memory Packages - Product Line 2
 * KV-Cache snapshots for memory transplant (直接移植记忆)
 * Each package contains: KV-Cache + W-Matrix + metadata
 */
export const memoryPackages = pgTable("memory_packages", {
  id: serial("id").primaryKey(),
  packageId: varchar("package_id", { length: 64 }).notNull().unique(), // e.g., "mpkg_abc123"
  userId: integer("user_id").notNull(), // Creator
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description").notNull(),
  
  // Memory type
  memoryType: memory_type_enum('memory_type').default("kv_cache").notNull(),
  
  // Package files (S3 URLs)
  kvCacheUrl: text("kv_cache_url").notNull(), // KV-Cache .safetensors
  wMatrixUrl: text("w_matrix_url").notNull(), // W-Matrix .safetensors
  packageUrl: text("package_url").notNull(), // Complete .memorypkg file
  
  // Model info
  sourceModel: varchar("source_model", { length: 50 }).notNull(),
  targetModel: varchar("target_model", { length: 50 }).notNull(),
  
  // KV-Cache metadata
  tokenCount: integer("token_count").notNull(), // Number of tokens in KV-Cache
  compressionRatio: numeric("compression_ratio", { precision: 5, scale: 4 }).notNull(), // 0.0000-1.0000
  contextDescription: text("context_description").notNull(), // What was the model thinking about
  
  // Quality metrics
  epsilon: numeric("epsilon", { precision: 10, scale: 8 }).notNull(),
  informationRetention: numeric("information_retention", { precision: 5, scale: 4 }).notNull(),
  
  // Pricing and stats
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  downloads: integer("downloads").default(0).notNull(),
  rating: numeric("rating", { precision: 3, scale: 2 }).default("0.00"),
  reviewCount: integer("review_count").default(0).notNull(),
  
  // Status
  status: status_enum('status').default("draft").notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("user_idx").on(table.userId),
  statusIdx: index("status_idx").on(table.status),
  modelPairIdx: index("model_pair_idx").on(table.sourceModel, table.targetModel),
}));

/**
 * Chain Packages - Product Line 3
 * Complete reasoning chains for solution reuse (直接移植 + 可学习)
 * Each package contains: Reasoning Chain (multiple KV snapshots) + W-Matrix + metadata
 */
export const chainPackages = pgTable("chain_packages", {
  id: serial("id").primaryKey(),
  packageId: varchar("package_id", { length: 64 }).notNull().unique(), // e.g., "cpkg_abc123"
  userId: integer("user_id").notNull(), // Creator
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description").notNull(),
  
  // Package files (S3 URLs)
  chainUrl: text("chain_url").notNull(), // Reasoning chain .safetensors
  wMatrixUrl: text("w_matrix_url").notNull(), // W-Matrix .safetensors
  packageUrl: text("package_url").notNull(), // Complete .chainpkg file
  
  // Model info
  sourceModel: varchar("source_model", { length: 50 }).notNull(),
  targetModel: varchar("target_model", { length: 50 }).notNull(),
  
  // Chain metadata
  stepCount: integer("step_count").notNull(), // Number of reasoning steps
  problemType: varchar("problem_type", { length: 100 }).notNull(), // e.g., "math-proof", "legal-analysis"
  solutionQuality: numeric("solution_quality", { precision: 5, scale: 4 }).notNull(), // 0.0000-1.0000
  
  // Quality metrics
  epsilon: numeric("epsilon", { precision: 10, scale: 8 }).notNull(),
  informationRetention: numeric("information_retention", { precision: 5, scale: 4 }).notNull(),
  
  // Pricing and stats
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  downloads: integer("downloads").default(0).notNull(),
  rating: numeric("rating", { precision: 3, scale: 2 }).default("0.00"),
  reviewCount: integer("review_count").default(0).notNull(),
  
  // Status
  status: status_enum('status').default("draft").notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("user_idx").on(table.userId),
  problemTypeIdx: index("problem_type_idx").on(table.problemType),
  statusIdx: index("status_idx").on(table.status),
  modelPairIdx: index("model_pair_idx").on(table.sourceModel, table.targetModel),
}));

/**
 * Package Downloads - Unified download tracking for all three product lines
 */
export const packageDownloads = pgTable("package_downloads", {
  id: serial("id").primaryKey(),
  packageType: package_type_enum('package_type').notNull(),
  packageId: varchar("package_id", { length: 64 }).notNull(), // vpkg_xxx / mpkg_xxx / cpkg_xxx
  userId: integer("user_id").notNull(), // Downloader
  downloadUrl: text("download_url").notNull(), // Temporary S3 signed URL
  expiresAt: timestamp("expires_at").notNull(), // URL expiration (7 days)
  downloaded: boolean("downloaded").default(false).notNull(),
  downloadedAt: timestamp("downloaded_at"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  packageIdx: index("package_idx").on(table.packageType, table.packageId),
  userIdx: index("user_idx").on(table.userId),
  expiresIdx: index("expires_idx").on(table.expiresAt),
}));

/**
 * Package Purchases - Unified purchase tracking for all three product lines
 */
export const packagePurchases = pgTable("package_purchases", {
  id: serial("id").primaryKey(),
  packageType: package_type_enum('package_type').notNull(),
  packageId: varchar("package_id", { length: 64 }).notNull(),
  buyerId: integer("buyer_id").notNull(),
  sellerId: integer("seller_id").notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  platformFee: numeric("platform_fee", { precision: 10, scale: 2 }).notNull(),
  sellerEarnings: numeric("seller_earnings", { precision: 10, scale: 2 }).notNull(),
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
  status: status_enum('status').default("pending").notNull(),
  purchasedAt: timestamp("purchasedAt").defaultNow().notNull(),
}, (table) => ({
  packageIdx: index("package_idx").on(table.packageType, table.packageId),
  buyerIdx: index("buyer_idx").on(table.buyerId),
  sellerIdx: index("seller_idx").on(table.sellerId),
  statusIdx: index("status_idx").on(table.status),
}));

// Relations for vectorPackages
export const vectorPackagesRelations = relations(vectorPackages, ({ one }) => ({
  user: one(users, {
    fields: [vectorPackages.userId],
    references: [users.id],
  }),
}));

// Relations for memoryPackages
export const memoryPackagesRelations = relations(memoryPackages, ({ one }) => ({
  user: one(users, {
    fields: [memoryPackages.userId],
    references: [users.id],
  }),
}));

// Relations for chainPackages
export const chainPackagesRelations = relations(chainPackages, ({ one }) => ({
  user: one(users, {
    fields: [chainPackages.userId],
    references: [users.id],
  }),
}));

// Type exports
export type VectorPackage = typeof vectorPackages.$inferSelect;
export type InsertVectorPackage = typeof vectorPackages.$inferInsert;
export type MemoryPackage = typeof memoryPackages.$inferSelect;
export type InsertMemoryPackage = typeof memoryPackages.$inferInsert;
export type ChainPackage = typeof chainPackages.$inferSelect;
export type InsertChainPackage = typeof chainPackages.$inferInsert;
export type PackageDownload = typeof packageDownloads.$inferSelect;
export type InsertPackageDownload = typeof packageDownloads.$inferInsert;
export type PackagePurchase = typeof packagePurchases.$inferSelect;
export type InsertPackagePurchase = typeof packagePurchases.$inferInsert;

// Import storage tier tables for intelligent cost optimization
export * from './schema-storage-tiers';

// Import LatentMAS package extension tables for latent working memory support
export * from './schema-latentmas-packages';
