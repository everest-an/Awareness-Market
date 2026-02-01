import * as crypto from "crypto";
import { prisma } from './db-prisma';
import type {
  User,
  LatentVector,
  Transaction,
  AccessPermission,
  Review,
  SubscriptionPlan,
  UserSubscription,
  ApiKey,
  McpToken,
  ApiCallLog,
  AiMemory,
  Notification,
  UserPreference,
  BrowsingHistory,
  VectorPackage,
  MemoryPackage,
  PackagePurchase,
  Prisma,
} from '@prisma/client';
import { ENV } from './_core/env';
import { createLogger } from './utils/logger';

const logger = createLogger('Database:Operations');

// Type aliases for backward compatibility
export type InsertUser = Prisma.UserCreateInput;
export type InsertBrowsingHistory = Prisma.BrowsingHistoryCreateInput;
export type InsertVectorPackage = Prisma.VectorPackageCreateInput;
export type InsertMemoryPackage = Prisma.MemoryPackageCreateInput;

export async function getDb() {
  return prisma;
}

export {
  User,
  LatentVector,
  Transaction,
  AccessPermission,
  Review,
  SubscriptionPlan,
  UserSubscription,
  ApiKey,
  McpToken,
  ApiCallLog,
  AiMemory,
  Notification,
  UserPreference,
  BrowsingHistory,
  VectorPackage,
  MemoryPackage,
  PackagePurchase,
};

// ===== User Management =====

export async function upsertUser(user: Partial<User> & { openId: string }): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  try {
    const createData: Prisma.UserCreateInput = {
      openId: user.openId,
      name: user.name ?? null,
      email: user.email ?? null,
      loginMethod: user.loginMethod ?? null,
      bio: user.bio ?? null,
      avatar: user.avatar ?? null,
      role: user.role ?? (user.openId === ENV.ownerOpenId ? 'admin' : 'user'),
      lastSignedIn: user.lastSignedIn ?? new Date(),
    };

    const updateData: Prisma.UserUpdateInput = {
      ...(user.name !== undefined && { name: user.name }),
      ...(user.email !== undefined && { email: user.email }),
      ...(user.loginMethod !== undefined && { loginMethod: user.loginMethod }),
      ...(user.bio !== undefined && { bio: user.bio }),
      ...(user.avatar !== undefined && { avatar: user.avatar }),
      ...(user.role !== undefined && { role: user.role }),
      lastSignedIn: user.lastSignedIn ?? new Date(),
    };

    await prisma.user.upsert({
      where: { openId: user.openId },
      create: createData,
      update: updateData,
    });
  } catch (error) {
    logger.error('Failed to upsert user', { error, openId: user.openId });
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  try {
    return await prisma.user.findUnique({
      where: { openId },
    });
  } catch (error) {
    logger.warn('Cannot get user: database error', { openId, error });
    return undefined;
  }
}

export async function getUserById(id: number) {
  try {
    return await prisma.user.findUnique({
      where: { id },
    });
  } catch (error) {
    logger.warn('Cannot get user by id', { id, error });
    return undefined;
  }
}

export async function updateUserRole(userId: number, role: "user" | "admin" | "creator" | "consumer") {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { role },
    });
    return true;
  } catch (error) {
    logger.error('Failed to update user role', { userId, role, error });
    return false;
  }
}

export async function updateUserProfile(userId: number, updates: {
  name?: string | null;
  email?: string | null;
  bio?: string | null;
  avatar?: string | null;
}) {
  try {
    return await prisma.user.update({
      where: { id: userId },
      data: {
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.email !== undefined && { email: updates.email }),
        ...(updates.bio !== undefined && { bio: updates.bio }),
        ...(updates.avatar !== undefined && { avatar: updates.avatar }),
      },
    });
  } catch (error) {
    logger.error('Failed to update user profile', { userId, error });
    return undefined;
  }
}

// ===== Latent Vectors Management =====

export async function createLatentVector(vector: {
  creatorId: number;
  title: string;
  description: string;
  category: string;
  vectorFileKey: string;
  vectorFileUrl: string;
  modelArchitecture?: string | null;
  vectorDimension?: number | null;
  performanceMetrics?: string | null;
  basePrice: string;
  pricingModel?: string;
  status?: string;
}) {
  try {
    return await prisma.latentVector.create({
      data: {
        creator: { connect: { id: vector.creatorId } },
        title: vector.title,
        description: vector.description,
        category: vector.category,
        vectorFileKey: vector.vectorFileKey,
        vectorFileUrl: vector.vectorFileUrl,
        modelArchitecture: vector.modelArchitecture,
        vectorDimension: vector.vectorDimension,
        performanceMetrics: vector.performanceMetrics,
        basePrice: vector.basePrice,
        pricingModel: vector.pricingModel ?? 'per-call',
        status: vector.status ?? 'draft',
      },
    });
  } catch (error) {
    logger.error('Failed to create latent vector', { error });
    throw new Error("Database not available");
  }
}

export async function getLatentVectorById(id: number) {
  try {
    return await prisma.latentVector.findUnique({
      where: { id },
    });
  } catch (error) {
    logger.error('Failed to get latent vector', { id, error });
    return undefined;
  }
}

export async function getLatentVectorsByCreator(creatorId: number) {
  try {
    return await prisma.latentVector.findMany({
      where: { creatorId },
      orderBy: { createdAt: 'desc' },
    });
  } catch (error) {
    logger.error('Failed to get vectors by creator', { creatorId, error });
    return [];
  }
}

export async function searchLatentVectors(params: {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  searchTerm?: string;
  sortBy?: "newest" | "oldest" | "price_low" | "price_high" | "rating" | "popular";
  status?: "active" | "inactive";
  limit?: number;
  offset?: number;
}) {
  try {
    const where: Prisma.LatentVectorWhereInput = {
      ...(params.category && { category: params.category }),
      ...(params.minPrice !== undefined && { basePrice: { gte: params.minPrice } }),
      ...(params.maxPrice !== undefined && { basePrice: { ...({} as any), lte: params.maxPrice } }),
      ...(params.minRating !== undefined && { averageRating: { gte: params.minRating } }),
      ...(params.searchTerm && {
        OR: [
          { title: { contains: params.searchTerm, mode: 'insensitive' } },
          { description: { contains: params.searchTerm, mode: 'insensitive' } },
        ],
      }),
      status: params.status || "active",
    };

    // Combine min and max price if both exist
    if (params.minPrice !== undefined && params.maxPrice !== undefined) {
      where.basePrice = { gte: params.minPrice, lte: params.maxPrice };
    }

    // Apply sorting
    const sortBy = params.sortBy || "newest";
    let orderBy: Prisma.LatentVectorOrderByWithRelationInput = {};
    switch (sortBy) {
      case "newest":
        orderBy = { createdAt: 'desc' };
        break;
      case "oldest":
        orderBy = { createdAt: 'asc' };
        break;
      case "price_low":
        orderBy = { basePrice: 'asc' };
        break;
      case "price_high":
        orderBy = { basePrice: 'desc' };
        break;
      case "rating":
        orderBy = { averageRating: 'desc' };
        break;
      case "popular":
        orderBy = { totalCalls: 'desc' };
        break;
    }

    return await prisma.latentVector.findMany({
      where,
      orderBy,
      ...(params.limit && { take: params.limit }),
      ...(params.offset && { skip: params.offset }),
    });
  } catch (error) {
    logger.error('Failed to search latent vectors', { error, params });
    return [];
  }
}

export async function getAllCategories() {
  try {
    const result = await prisma.latentVector.findMany({
      where: { status: "active" },
      select: { category: true },
      distinct: ['category'],
    });
    return result.map(r => r.category);
  } catch (error) {
    logger.error('Failed to get categories', { error });
    return [];
  }
}

export async function updateLatentVector(id: number, updates: Prisma.LatentVectorUpdateInput) {
  try {
    await prisma.latentVector.update({
      where: { id },
      data: updates,
    });
    return true;
  } catch (error) {
    logger.error('Failed to update latent vector', { id, error });
    throw new Error("Database not available");
  }
}

export async function incrementVectorStats(vectorId: number, revenue: number) {
  try {
    await prisma.latentVector.update({
      where: { id: vectorId },
      data: {
        totalCalls: { increment: 1 },
        totalRevenue: { increment: revenue },
      },
    });
  } catch (error) {
    logger.error('Failed to increment vector stats', { vectorId, revenue, error });
  }
}

// ===== Transactions =====

export async function createTransaction(transaction: {
  buyerId: number;
  vectorId: number;
  amount: string;
  platformFee: string;
  creatorEarnings: string;
  status?: string;
  transactionType?: string;
  stripePaymentIntentId?: string | null;
}) {
  try {
    return await prisma.transaction.create({
      data: {
        buyer: { connect: { id: transaction.buyerId } },
        vector: { connect: { id: transaction.vectorId } },
        amount: transaction.amount,
        platformFee: transaction.platformFee,
        creatorEarnings: transaction.creatorEarnings,
        status: transaction.status ?? 'pending',
        transactionType: transaction.transactionType ?? 'one-time',
        stripePaymentIntentId: transaction.stripePaymentIntentId,
      },
    });
  } catch (error) {
    logger.error('Failed to create transaction', { error });
    throw new Error("Database not available");
  }
}

export async function getTransactionById(id: number) {
  try {
    return await prisma.transaction.findUnique({
      where: { id },
    });
  } catch (error) {
    logger.error('Failed to get transaction', { id, error });
    return undefined;
  }
}

export async function getUserTransactions(userId: number, role: "buyer" | "creator") {
  try {
    if (role === "buyer") {
      return await prisma.transaction.findMany({
        where: { buyerId: userId },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      // Get transactions for vectors created by this user
      return await prisma.transaction.findMany({
        where: {
          vector: {
            creatorId: userId,
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }
  } catch (error) {
    logger.error('Failed to get user transactions', { userId, role, error });
    return [];
  }
}

export async function updateTransactionStatus(id: number, status: "pending" | "completed" | "failed" | "refunded") {
  try {
    await prisma.transaction.update({
      where: { id },
      data: { status },
    });
    return true;
  } catch (error) {
    logger.error('Failed to update transaction status', { id, status, error });
    return false;
  }
}

export async function updateTransactionPaymentInfo(params: {
  id: number;
  status?: "pending" | "completed" | "failed" | "refunded";
  stripePaymentIntentId?: string | null;
}) {
  try {
    const updates: Prisma.TransactionUpdateInput = {};
    if (params.status) updates.status = params.status;
    if (params.stripePaymentIntentId !== undefined) {
      updates.stripePaymentIntentId = params.stripePaymentIntentId;
    }

    if (Object.keys(updates).length === 0) return false;

    await prisma.transaction.update({
      where: { id: params.id },
      data: updates,
    });
    return true;
  } catch (error) {
    logger.error('Failed to update transaction payment info', { params, error });
    return false;
  }
}

// ===== API Keys =====

export async function getUserApiKeys(userId: number) {
  try {
    return await prisma.apiKey.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        permissions: true,
        lastUsedAt: true,
        expiresAt: true,
        isActive: true,
        createdAt: true,
      },
    });
  } catch (error) {
    logger.error('Failed to get user API keys', { userId, error });
    return [];
  }
}

export async function createApiKey(params: {
  userId: number;
  name: string;
  keyHash: string;
  keyPrefix: string;
  permissions?: string | null;
  expiresAt?: Date | null;
}) {
  try {
    return await prisma.apiKey.create({
      data: {
        userId: params.userId,
        name: params.name,
        keyHash: params.keyHash,
        keyPrefix: params.keyPrefix,
        permissions: params.permissions ?? null,
        expiresAt: params.expiresAt ?? null,
        isActive: true,
      },
    });
  } catch (error) {
    logger.error('Failed to create API key', { params, error });
    throw new Error("Database not available");
  }
}

export async function revokeApiKey(params: { userId: number; keyId: number }) {
  try {
    await prisma.apiKey.updateMany({
      where: {
        id: params.keyId,
        userId: params.userId,
      },
      data: { isActive: false },
    });
    return true;
  } catch (error) {
    logger.error('Failed to revoke API key', { params, error });
    return false;
  }
}

// ===== MCP Tokens =====

const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export async function createMcpToken(params: {
  userId: number;
  name: string;
  permissions?: string[];
  expiresInDays?: number;
}) {
  try {
    const rawToken = `mcp_${crypto.randomBytes(32).toString("hex")}`;
    const tokenHash = hashToken(rawToken);
    const tokenPrefix = rawToken.substring(0, 12);
    const expiresAt = params.expiresInDays
      ? new Date(Date.now() + params.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    await prisma.mcpToken.create({
      data: {
        userId: params.userId,
        tokenHash,
        tokenPrefix,
        name: params.name,
        permissions: JSON.stringify(params.permissions || ["sync", "memory"]),
        expiresAt,
        isActive: true,
      },
    });

    return {
      token: rawToken,
      tokenPrefix,
      expiresAt,
    };
  } catch (error) {
    logger.error('Failed to create MCP token', { params, error });
    throw new Error("Database not available");
  }
}

export async function listMcpTokens(userId: number) {
  try {
    return await prisma.mcpToken.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        tokenPrefix: true,
        permissions: true,
        lastUsedAt: true,
        expiresAt: true,
        isActive: true,
        createdAt: true,
      },
    });
  } catch (error) {
    logger.error('Failed to list MCP tokens', { userId, error });
    return [];
  }
}

export async function revokeMcpToken(params: { userId: number; tokenId: number }) {
  try {
    await prisma.mcpToken.updateMany({
      where: {
        id: params.tokenId,
        userId: params.userId,
      },
      data: { isActive: false },
    });
    return true;
  } catch (error) {
    logger.error('Failed to revoke MCP token', { params, error });
    return false;
  }
}

export async function getMcpTokenByToken(token: string) {
  try {
    const tokenHash = hashToken(token);
    const record = await prisma.mcpToken.findFirst({
      where: {
        tokenHash,
        isActive: true,
      },
    });

    if (!record) return undefined;

    if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
      return undefined;
    }

    await prisma.mcpToken.update({
      where: { id: record.id },
      data: { lastUsedAt: new Date() },
    });

    return record;
  } catch (error) {
    logger.error('Failed to get MCP token by token', { error });
    return undefined;
  }
}

// ===== Access Permissions =====

export async function createAccessPermission(permission: {
  userId: number;
  vectorId: number;
  transactionId: number;
  accessToken: string;
  expiresAt?: Date | null;
  callsRemaining?: number | null;
  isActive?: boolean;
}) {
  try {
    const result = await prisma.accessPermission.create({
      data: {
        user: { connect: { id: permission.userId } },
        vector: { connect: { id: permission.vectorId } },
        transaction: { connect: { id: permission.transactionId } },
        accessToken: permission.accessToken,
        expiresAt: permission.expiresAt,
        callsRemaining: permission.callsRemaining,
        isActive: permission.isActive ?? true,
      },
    });
    return result;
  } catch (error) {
    logger.error('Failed to create access permission', { error });
    throw error;
  }
}

export async function getAccessPermissionByToken(token: string) {
  try {
    return await prisma.accessPermission.findUnique({
      where: { accessToken: token },
    });
  } catch (error) {
    logger.error('Failed to get access permission by token', { error });
    return undefined;
  }
}

export async function getUserAccessPermissions(userId: number) {
  try {
    const permissions = await prisma.accessPermission.findMany({
      where: {
        userId,
        isActive: true,
      },
      include: {
        vector: {
          select: {
            title: true,
          },
        },
      },
    });

    return permissions.map(p => ({
      id: p.id,
      userId: p.userId,
      vectorId: p.vectorId,
      transactionId: p.transactionId,
      accessToken: p.accessToken,
      expiresAt: p.expiresAt,
      callsRemaining: p.callsRemaining,
      isActive: p.isActive,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      vectorTitle: p.vector.title,
    }));
  } catch (error) {
    logger.error('Failed to get user access permissions', { error, userId });
    return [];
  }
}

export async function getAccessPermissionById(permissionId: number) {
  try {
    return await prisma.accessPermission.findUnique({
      where: { id: permissionId },
    });
  } catch (error) {
    logger.error('Failed to get access permission by ID', { error, permissionId });
    return undefined;
  }
}

export async function renewAccessPermission(params: {
  permissionId: number;
  extendDays?: number;
}) {
  try {
    const permission = await getAccessPermissionById(params.permissionId);
    if (!permission) return undefined;

    const newToken = crypto.randomBytes(24).toString("hex");
    const updates: Prisma.AccessPermissionUpdateInput = {
      accessToken: newToken,
      isActive: true,
    };

    if (permission.expiresAt) {
      const extendDays = params.extendDays ?? 30;
      updates.expiresAt = new Date(permission.expiresAt.getTime() + extendDays * 24 * 60 * 60 * 1000);
    }

    await prisma.accessPermission.update({
      where: { id: params.permissionId },
      data: updates,
    });

    return {
      accessToken: newToken,
      expiresAt: (updates.expiresAt as Date | undefined) ?? permission.expiresAt,
    };
  } catch (error) {
    logger.error('Failed to renew access permission', { error, permissionId: params.permissionId });
    return undefined;
  }
}

export async function decrementCallsRemaining(permissionId: number) {
  try {
    await prisma.accessPermission.update({
      where: { id: permissionId },
      data: {
        callsRemaining: {
          decrement: 1,
        },
      },
    });
  } catch (error) {
    logger.error('Failed to decrement calls remaining', { error, permissionId });
  }
}

// ===== AI Memory =====

export async function getAIMemoryByKey(params: { userId: number; memoryKey: string }) {
  try {
    return await prisma.aiMemory.findFirst({
      where: {
        userId: params.userId,
        memoryKey: params.memoryKey,
      },
    });
  } catch (error) {
    logger.error('Failed to get AI memory by key', { error, ...params });
    return undefined;
  }
}

export async function upsertAIMemory(params: {
  userId: number;
  memoryKey: string;
  data: Record<string, unknown>;
  ttlDays?: number;
}) {
  try {
    const existing = await getAIMemoryByKey({ userId: params.userId, memoryKey: params.memoryKey });
    const expiresAt = params.ttlDays
      ? new Date(Date.now() + params.ttlDays * 24 * 60 * 60 * 1000)
      : null;

    if (existing) {
      await prisma.aiMemory.update({
        where: { id: existing.id },
        data: {
          memoryData: JSON.stringify(params.data),
          version: existing.version + 1,
          expiresAt,
        },
      });

      return {
        key: params.memoryKey,
        version: existing.version + 1,
        expiresAt,
      };
    }

    await prisma.aiMemory.create({
      data: {
        userId: params.userId,
        memoryKey: params.memoryKey,
        memoryData: JSON.stringify(params.data),
        version: 1,
        expiresAt,
      },
    });

    return {
      key: params.memoryKey,
      version: 1,
      expiresAt,
    };
  } catch (error) {
    logger.error('Failed to upsert AI memory', { error, ...params });
    return undefined;
  }
}

// ===== Reviews =====

export async function createReview(review: {
  vectorId: number;
  userId: number;
  rating: number;
  comment?: string | null;
  isVerifiedPurchase?: boolean;
}) {
  try {
    const result = await prisma.review.create({
      data: {
        vector: { connect: { id: review.vectorId } },
        user: { connect: { id: review.userId } },
        rating: review.rating,
        comment: review.comment,
        isVerifiedPurchase: review.isVerifiedPurchase ?? false,
      },
    });

    // Update vector's average rating
    const allReviews = await prisma.review.findMany({
      where: { vectorId: review.vectorId },
    });
    const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;

    await prisma.latentVector.update({
      where: { id: review.vectorId },
      data: {
        averageRating: avgRating.toFixed(2),
        reviewCount: allReviews.length,
      },
    });

    return result;
  } catch (error) {
    logger.error('Failed to create review', { error });
    throw error;
  }
}

export async function getVectorReviews(vectorId: number) {
  try {
    const reviews = await prisma.review.findMany({
      where: { vectorId },
      include: {
        user: {
          select: {
            name: true,
            avatar: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return reviews.map(r => ({
      id: r.id,
      vectorId: r.vectorId,
      userId: r.userId,
      rating: r.rating,
      comment: r.comment,
      isVerifiedPurchase: r.isVerifiedPurchase,
      createdAt: r.createdAt,
      reviewerName: r.user.name,
      reviewerAvatar: r.user.avatar,
    }));
  } catch (error) {
    logger.error('Failed to get vector reviews', { error, vectorId });
    return [];
  }
}

// ===== Subscriptions =====

export async function getSubscriptionPlans() {
  try {
    return await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
    });
  } catch (error) {
    logger.error('Failed to get subscription plans', { error });
    return [];
  }
}

export async function getUserSubscription(userId: number) {
  try {
    return await prisma.userSubscription.findFirst({
      where: {
        userId,
        status: "active",
      },
    });
  } catch (error) {
    logger.error('Failed to get user subscription', { error, userId });
    return undefined;
  }
}

export async function createUserSubscription(subscription: {
  userId: number;
  planId: number;
  stripeSubscriptionId?: string | null;
  status?: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd?: boolean;
}) {
  try {
    const result = await prisma.userSubscription.create({
      data: {
        user: { connect: { id: subscription.userId } },
        plan: { connect: { id: subscription.planId } },
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        status: subscription.status ?? 'active',
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd ?? false,
      },
    });
    return result;
  } catch (error) {
    logger.error('Failed to create user subscription', { error });
    throw error;
  }
}

export async function updateUserSubscription(id: number, updates: Prisma.UserSubscriptionUpdateInput) {
  try {
    await prisma.userSubscription.update({
      where: { id },
      data: updates,
    });
    return true;
  } catch (error) {
    logger.error('Failed to update user subscription', { error, id });
    return false;
  }
}

// ===== API Call Logs =====

export async function logApiCall(log: {
  userId: number;
  vectorId: number;
  permissionId: number;
  responseTime?: number | null;
  success?: boolean;
  errorMessage?: string | null;
}) {
  try {
    await prisma.apiCallLog.create({
      data: {
        userId: log.userId,
        vector: { connect: { id: log.vectorId } },
        permissionId: log.permissionId,
        responseTime: log.responseTime,
        success: log.success ?? true,
        errorMessage: log.errorMessage,
      },
    });
  } catch (error) {
    logger.error('Failed to log API call', { error });
  }
}

export async function getVectorCallStats(vectorId: number, days: number = 30) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return await prisma.apiCallLog.findMany({
      where: {
        vectorId,
        createdAt: {
          gte: startDate,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  } catch (error) {
    logger.error('Failed to get vector call stats', { error, vectorId });
    return [];
  }
}

export async function getCreatorRevenueTrend(userId: number, days: number = 30) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days + 1);

    const rows = await prisma.$queryRaw<Array<{ date: Date; revenue: number }>>`
      SELECT DATE("createdAt") as date,
             SUM("creator_earnings") as revenue
      FROM transactions t
      INNER JOIN latent_vectors v ON t.vector_id = v.id
      WHERE v.creator_id = ${userId}
        AND t.status = 'completed'
        AND t."createdAt" >= ${startDate}
      GROUP BY DATE("createdAt")
      ORDER BY DATE("createdAt")
    `;

    return rows.map(row => ({
      date: row.date.toISOString().split('T')[0],
      revenue: Number(row.revenue),
    }));
  } catch (error) {
    logger.error('Failed to get creator revenue trend', { error, userId });
    return [];
  }
}

export async function getCreatorCallTrend(userId: number, days: number = 30) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days + 1);

    const rows = await prisma.$queryRaw<Array<{ date: Date; calls: bigint }>>`
      SELECT DATE("createdAt") as date,
             COUNT(*) as calls
      FROM api_call_logs a
      INNER JOIN latent_vectors v ON a.vector_id = v.id
      WHERE v.creator_id = ${userId}
        AND a."createdAt" >= ${startDate}
      GROUP BY DATE("createdAt")
      ORDER BY DATE("createdAt")
    `;

    return rows.map(row => ({
      date: row.date.toISOString().split('T')[0],
      calls: Number(row.calls),
    }));
  } catch (error) {
    logger.error('Failed to get creator call trend', { error, userId });
    return [];
  }
}

export async function getConsumerUsageStats(userId: number, days: number = 30) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days + 1);

    const rows = await prisma.$queryRaw<Array<{
      totalCalls: bigint;
      avgResponseTime: number;
      successRate: number;
    }>>`
      SELECT COUNT(*) as "totalCalls",
             AVG(response_time) as "avgResponseTime",
             AVG(CASE WHEN success THEN 1 ELSE 0 END) as "successRate"
      FROM api_call_logs
      WHERE user_id = ${userId}
        AND "createdAt" >= ${startDate}
    `;

    const row = rows[0];
    if (!row) {
      return { totalCalls: 0, avgResponseTime: 0, successRate: 0 };
    }
    return {
      totalCalls: Number(row.totalCalls || 0),
      avgResponseTime: Number(row.avgResponseTime || 0),
      successRate: Number(row.successRate || 0),
    };
  } catch (error) {
    logger.error('Failed to get consumer usage stats', { error, userId });
    return { totalCalls: 0, avgResponseTime: 0, successRate: 0 };
  }
}

export async function getConsumerAverageRating(userId: number) {
  try {
    const result = await prisma.review.aggregate({
      where: { userId },
      _avg: {
        rating: true,
      },
    });

    return result._avg.rating || 0;
  } catch (error) {
    logger.error('Failed to get consumer average rating', { error, userId });
    return 0;
  }
}

// ===== Notifications =====

export async function createNotification(notification: {
  userId: number;
  type: string;
  title: string;
  message: string;
  relatedEntityId?: number | null;
}) {
  try {
    const result = await prisma.notification.create({
      data: {
        user: { connect: { id: notification.userId } },
        type: notification.type,
        title: notification.title,
        message: notification.message,
        relatedEntityId: notification.relatedEntityId,
      },
    });
    return result;
  } catch (error) {
    logger.error('Failed to create notification', { error });
    throw error;
  }
}

export async function getUserNotifications(userId: number, unreadOnly: boolean = false) {
  try {
    const where: Prisma.NotificationWhereInput = { userId };
    if (unreadOnly) {
      where.isRead = false;
    }

    return await prisma.notification.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });
  } catch (error) {
    logger.error('Failed to get user notifications', { error, userId });
    return [];
  }
}

export async function markNotificationAsRead(id: number) {
  try {
    await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
    return true;
  } catch (error) {
    logger.error('Failed to mark notification as read', { error, id });
    return false;
  }
}

// ===== User Preferences =====

export async function getUserPreferences(userId: number) {
  try {
    return await prisma.userPreference.findUnique({
      where: { userId },
    });
  } catch (error) {
    logger.error('Failed to get user preferences', { error, userId });
    return undefined;
  }
}

export async function upsertUserPreferences(userId: number, prefs: Prisma.UserPreferenceUpdateInput) {
  try {
    await prisma.userPreference.upsert({
      where: { userId },
      create: {
        userId,
        ...prefs,
      } as Prisma.UserPreferenceCreateInput,
      update: prefs,
    });
    return true;
  } catch (error) {
    logger.error('Failed to upsert user preferences', { error, userId });
    throw error;
  }
}

// ===== Browsing History =====

export async function insertBrowsingHistory(history: InsertBrowsingHistory) {
  try {
    await prisma.browsingHistory.create({
      data: history,
    });
  } catch (error) {
    logger.error('Failed to insert browsing history', { error, userId: history.userId });
  }
}

export async function getBrowsingHistory(userId: number, since?: Date) {
  try {
    const where: Prisma.BrowsingHistoryWhereInput = { userId };
    if (since) {
      where.createdAt = { gte: since };
    }

    return await prisma.browsingHistory.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    });
  } catch (error) {
    logger.error('Failed to get browsing history', { error, userId });
    return [];
  }
}

// ===== Vector Packages (LatentMAS Marketplace) =====

export async function createVectorPackage(packageData: InsertVectorPackage) {
  try {
    const result = await prisma.vectorPackage.create({
      data: packageData,
    });
    return result;
  } catch (error) {
    logger.error('Failed to create vector package', { error, name: packageData.name });
    throw error;
  }
}

export async function getVectorPackageById(id: number): Promise<VectorPackage | null> {
  try {
    return await prisma.vectorPackage.findUnique({
      where: { id },
    });
  } catch (error) {
    logger.error('Failed to get vector package by ID', { error, id });
    return null;
  }
}

export async function getVectorPackageByPackageId(packageId: string): Promise<VectorPackage | null> {
  try {
    return await prisma.vectorPackage.findUnique({
      where: { packageId },
    });
  } catch (error) {
    logger.error('Failed to get vector package by packageId', { error, packageId });
    return null;
  }
}

export async function browseVectorPackages(filters: {
  sourceModel?: string;
  targetModel?: string;
  maxEpsilon?: number;
  category?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<VectorPackage[]> {
  try {
    const where: Prisma.VectorPackageWhereInput = {
      status: filters.status || 'active',
    };

    if (filters.sourceModel) {
      where.sourceModel = filters.sourceModel;
    }
    if (filters.targetModel) {
      where.targetModel = filters.targetModel;
    }
    if (filters.maxEpsilon !== undefined) {
      where.epsilon = { lte: filters.maxEpsilon };
    }
    if (filters.category) {
      where.category = filters.category;
    }

    return await prisma.vectorPackage.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      take: filters.limit || 20,
      skip: filters.offset || 0,
    });
  } catch (error) {
    logger.error('Failed to browse vector packages', { error, filters });
    return [];
  }
}

export async function updateVectorPackageStats(id: number, updates: {
  downloads?: number;
  rating?: string;
  reviewCount?: number;
}) {
  try {
    await prisma.vectorPackage.update({
      where: { id },
      data: updates,
    });
    return true;
  } catch (error) {
    logger.error('Failed to update vector package stats', { error, id, updates });
    return false;
  }
}

export async function incrementVectorPackageDownloads(id: number) {
  try {
    await prisma.vectorPackage.update({
      where: { id },
      data: {
        downloads: {
          increment: 1,
        },
      },
    });
    return true;
  } catch (error) {
    logger.error('Failed to increment downloads', { error, id });
    return false;
  }
}

// ===== Memory Packages (LatentMAS Marketplace) =====

export async function createMemoryPackage(packageData: InsertMemoryPackage) {
  try {
    const result = await prisma.memoryPackage.create({
      data: packageData,
    });
    return result;
  } catch (error) {
    logger.error('Failed to create memory package', { error, name: packageData.name });
    throw error;
  }
}

export async function getMemoryPackageById(id: number): Promise<MemoryPackage | null> {
  try {
    return await prisma.memoryPackage.findUnique({
      where: { id },
    });
  } catch (error) {
    logger.error('Failed to get memory package', { error, id });
    return null;
  }
}

export async function browseMemoryPackages(filters: {
  sourceModel?: string;
  targetModel?: string;
  memoryType?: string;
  maxEpsilon?: number;
  minTokenCount?: number;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<MemoryPackage[]> {
  try {
    const where: Prisma.MemoryPackageWhereInput = {
      status: filters.status || 'active',
    };

    if (filters.sourceModel) {
      where.sourceModel = filters.sourceModel;
    }
    if (filters.targetModel) {
      where.targetModel = filters.targetModel;
    }
    if (filters.memoryType) {
      where.memoryType = filters.memoryType;
    }
    if (filters.maxEpsilon !== undefined) {
      where.epsilon = { lte: filters.maxEpsilon };
    }
    if (filters.minTokenCount !== undefined) {
      where.tokenCount = { gte: filters.minTokenCount };
    }

    return await prisma.memoryPackage.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      take: filters.limit || 20,
      skip: filters.offset || 0,
    });
  } catch (error) {
    logger.error('Failed to browse memory packages', { error, filters });
    return [];
  }
}

export async function getVectorPackagesStatistics() {
  try {
    const result = await prisma.vectorPackage.aggregate({
      where: { status: 'active' },
      _count: true,
      _sum: {
        downloads: true,
      },
      _avg: {
        epsilon: true,
        rating: true,
      },
    });

    return {
      totalPackages: result._count || 0,
      totalDownloads: Number(result._sum.downloads || 0),
      averageEpsilon: Number(result._avg.epsilon || 0),
      averageRating: Number(result._avg.rating || 0),
    };
  } catch (error) {
    logger.error('Failed to get vector packages statistics', { error });
    return {
      totalPackages: 0,
      totalDownloads: 0,
      averageEpsilon: 0,
      averageRating: 0,
    };
  }
}

// ============================================================================
// Package Purchase Functions
// ============================================================================

export async function createPackagePurchase(data: {
  userId: number;
  packageId: number;
  amount: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
}): Promise<number> {
  try {
    // Get package details to determine seller
    const pkg = await getVectorPackageById(data.packageId);
    if (!pkg) throw new Error('Package not found');

    const price = parseFloat(data.amount);
    const platformFeeRate = 0.15;
    const platformFee = price * platformFeeRate;
    const sellerEarnings = price - platformFee;

    const result = await prisma.packagePurchase.create({
      data: {
        packageType: 'vector',
        packageId: pkg.packageId,
        buyerId: data.userId,
        sellerId: pkg.userId,
        price: data.amount,
        platformFee: platformFee.toFixed(2),
        sellerEarnings: sellerEarnings.toFixed(2),
        status: data.status,
      },
    });

    return result.id;
  } catch (error) {
    logger.error('Failed to create package purchase', { error, data });
    throw error;
  }
}

export async function getUserPackagePurchaseByPackageId(
  userId: number,
  packageId: string
): Promise<any | null> {
  try {
    return await prisma.packagePurchase.findFirst({
      where: {
        buyerId: userId,
        packageId,
      },
    });
  } catch (error) {
    logger.error('Failed to get package purchase', { error, userId, packageId });
    return null;
  }
}

export async function updatePackagePurchaseStatus(data: {
  userId: number;
  packageId: number;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  completedAt?: Date;
}): Promise<void> {
  try {
    // Get package ID string
    const pkg = await getVectorPackageById(data.packageId);
    if (!pkg) throw new Error('Package not found');

    await prisma.packagePurchase.updateMany({
      where: {
        buyerId: data.userId,
        packageId: pkg.packageId,
      },
      data: {
        status: data.status,
        purchasedAt: data.completedAt || new Date(),
      },
    });

    logger.info('Package purchase status updated', {
      userId: data.userId,
      packageId: data.packageId,
      status: data.status
    });
  } catch (error) {
    logger.error('Failed to update package purchase status', { error, data });
    throw error;
  }
}

export async function incrementPackageDownloads(packageId: number): Promise<void> {
  // Reuse existing function
  await incrementVectorPackageDownloads(packageId);
}
