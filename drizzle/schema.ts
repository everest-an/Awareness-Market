import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Subscription plans and status for users
 */
export const subscriptions = mysqlTable("subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  plan: varchar("plan", { length: 50 }).notNull(), // 'free_trial', 'monthly', 'yearly', 'lifetime'
  status: mysqlEnum("status", ["trialing", "active", "past_due", "canceled", "expired"]).default("trialing").notNull(),
  currentPeriodStart: timestamp("currentPeriodStart").notNull(),
  currentPeriodEnd: timestamp("currentPeriodEnd").notNull(),
  trialEndsAt: timestamp("trialEndsAt"),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  cryptoPaymentTxHash: varchar("cryptoPaymentTxHash", { length: 255 }),
  paymentMethod: varchar("paymentMethod", { length: 50 }), // 'stripe', 'web3_usdt'
  amount: int("amount"), // Payment amount in cents
  currency: varchar("currency", { length: 10 }).default("usd"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

/**
 * Files uploaded by users (images, documents, etc.)
 */
export const files = mysqlTable("files", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileType: varchar("fileType", { length: 100 }).notNull(), // 'image/jpeg', 'application/pdf', etc.
  fileSize: int("fileSize").notNull(), // in bytes
  status: mysqlEnum("status", ["uploading", "processing", "completed", "error"]).default("uploading").notNull(),
  r2ObjectKey: varchar("r2ObjectKey", { length: 1024 }), // Cloudflare R2 key
  ipfsCid: varchar("ipfsCid", { length: 255 }), // IPFS Content Identifier
  ipfsUrl: varchar("ipfsUrl", { length: 500 }), // IPFS Gateway URL
  arweaveTxId: varchar("arweaveTxId", { length: 64 }), // Arweave transaction ID
  storageType: mysqlEnum("storageType", ["r2", "ipfs", "arweave", "multi"]).default("r2").notNull(),
  thumbnailUrl: text("thumbnailUrl"), // For image previews
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type File = typeof files.$inferSelect;
export type InsertFile = typeof files.$inferInsert;

/**
 * AI-generated knowledge documents
 */
export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  sourceFileId: int("sourceFileId"), // Reference to the original file
  title: varchar("title", { length: 255 }).notNull(),
  contentMd: text("contentMd"), // Markdown content
  summary: text("summary"), // AI-generated summary
  extractedText: text("extractedText"), // OCR extracted text
  metadata: text("metadata"), // JSON string for additional metadata
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

/**
 * Tags for organizing documents
 */
export const tags = mysqlTable("tags", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 7 }), // Hex color code
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Tag = typeof tags.$inferSelect;
export type InsertTag = typeof tags.$inferInsert;

/**
 * Many-to-many relationship between documents and tags
 */
export const documentTags = mysqlTable("documentTags", {
  documentId: int("documentId").notNull(),
  tagId: int("tagId").notNull(),
});

export type DocumentTag = typeof documentTags.$inferSelect;
export type InsertDocumentTag = typeof documentTags.$inferInsert;

/**
 * Contacts extracted from business cards or manually added
 */
export const contacts = mysqlTable("contacts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  sourceFileId: int("sourceFileId"), // Reference to the business card image
  name: varchar("name", { length: 255 }).notNull(),
  title: varchar("title", { length: 255 }),
  company: varchar("company", { length: 255 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 50 }),
  address: text("address"),
  website: text("website"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = typeof contacts.$inferInsert;

/**
 * Company information enriched from external APIs
 */
export const companies = mysqlTable("companies", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  industry: varchar("industry", { length: 255 }),
  description: text("description"),
  website: text("website"),
  employeeCount: int("employeeCount"),
  foundedYear: int("foundedYear"),
  headquarters: varchar("headquarters", { length: 255 }),
  logoUrl: text("logoUrl"),
  enrichedAt: timestamp("enrichedAt").defaultNow().notNull(),
});

export type Company = typeof companies.$inferSelect;
export type InsertCompany = typeof companies.$inferInsert;