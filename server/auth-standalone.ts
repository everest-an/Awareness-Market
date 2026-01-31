/**
 * Standalone Authentication System
 * Supports email/password, GitHub OAuth, Hugging Face OAuth, and Google OAuth
 * JWT token-based authentication
 */

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq, type InferSelectModel } from "drizzle-orm";
import { nanoid } from "nanoid";

// User type from database schema
type User = InferSelectModel<typeof users>;
// User type without password for API responses
type SafeUser = Omit<User, 'password'>;

// JWT secret from environment or fallback
const JWT_SECRET = process.env.JWT_SECRET || "awareness-market-secret-change-in-production";
const JWT_EXPIRES_IN = "7d"; // Token expires in 7 days
const JWT_REFRESH_EXPIRES_IN = "30d"; // Refresh token expires in 30 days

export interface JWTPayload {
  userId: number;
  email: string;
  role: string;
  type: "access" | "refresh";
}

/**
 * Generate JWT access token
 */
export function generateAccessToken(user: { id: number; email: string | null; role: string }): string {
  const payload: JWTPayload = {
    userId: user.id,
    email: user.email || "",
    role: user.role,
    type: "access",
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Generate JWT refresh token
 */
export function generateRefreshToken(user: { id: number; email: string | null; role: string }): string {
  const payload: JWTPayload = {
    userId: user.id,
    email: user.email || "",
    role: user.role,
    type: "refresh",
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Hash password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * Verify password against hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Register new user with email/password
 */
export async function registerWithEmail(params: {
  email: string;
  password: string;
  name?: string;
}): Promise<{ success: boolean; userId?: number; accessToken?: string; refreshToken?: string; error?: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Check if email already exists
  const existing = await db.select().from(users).where(eq(users.email, params.email)).limit(1);
  if (existing.length > 0) {
    return { success: false, error: "Email already registered" };
  }

  // Hash password
  const passwordHash = await hashPassword(params.password);

  // Create user
  const result = await db.insert(users).values({
    email: params.email,
    password: passwordHash,
    name: params.name || params.email.split("@")[0],
    openId: nanoid(), // Generate unique openId for compatibility
    loginMethod: "email",
    role: "consumer",
    emailVerified: false,
  });

  const userId = Number((result as any).insertId);
  
  // Generate tokens
  const user = { id: userId, email: params.email, role: "consumer" };
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  return { success: true, userId, accessToken, refreshToken };
}

/**
 * Login with email/password
 */
export async function loginWithEmail(params: {
  email: string;
  password: string;
}): Promise<{ success: boolean; user?: SafeUser; accessToken?: string; refreshToken?: string; error?: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Find user by email
  const userList = await db.select().from(users).where(eq(users.email, params.email)).limit(1);
  if (userList.length === 0) {
    return { success: false, error: "Invalid email or password" };
  }

  const user = userList[0];

  // Verify password
  if (!user.password) {
    return { success: false, error: "This account uses OAuth login" };
  }

  const isValid = await verifyPassword(params.password, user.password);
  if (!isValid) {
    return { success: false, error: "Invalid email or password" };
  }

  // Update last signed in
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));

  // Generate tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Return user without password
  const { password, ...userWithoutPassword } = user;
  return { success: true, user: userWithoutPassword, accessToken, refreshToken };
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<{ success: boolean; accessToken?: string; error?: string }> {
  const payload = verifyToken(refreshToken);
  
  if (!payload || payload.type !== "refresh") {
    return { success: false, error: "Invalid refresh token" };
  }

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Verify user still exists
  const userList = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);
  if (userList.length === 0) {
    return { success: false, error: "User not found" };
  }

  const user = userList[0];
  const accessToken = generateAccessToken(user);

  return { success: true, accessToken };
}

/**
 * Find or create user from OAuth provider
 */
export async function findOrCreateOAuthUser(params: {
  provider: "github" | "google" | "huggingface";
  providerId: string;
  email?: string;
  name?: string;
  avatar?: string;
}): Promise<{ user: SafeUser; accessToken: string; refreshToken: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Generate openId from provider and providerId
  const openId = `${params.provider}:${params.providerId}`;

  // Try to find existing user
  const existing = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  
  if (existing.length > 0) {
    const user = existing[0];
    // Update last signed in
    await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));
    
    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    
    const { password, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, accessToken, refreshToken };
  }

  // Create new user
  const result = await db.insert(users).values({
    openId,
    email: params.email,
    name: params.name || params.email?.split("@")[0] || "User",
    avatar: params.avatar,
    loginMethod: params.provider,
    role: "consumer",
    emailVerified: true, // OAuth emails are pre-verified
  });

  const newUserList = await db.select().from(users).where(eq(users.id, Number((result as any).insertId))).limit(1);
  const newUser = newUserList[0];
  
  // Generate tokens
  const accessToken = generateAccessToken(newUser);
  const refreshToken = generateRefreshToken(newUser);
  
  const { password, ...userWithoutPassword } = newUser;
  return { user: userWithoutPassword, accessToken, refreshToken };
}

/**
 * Get user from JWT token
 */
export async function getUserFromToken(token: string): Promise<{ success: boolean; user?: SafeUser; error?: string }> {
  const payload = verifyToken(token);
  
  if (!payload || payload.type !== "access") {
    return { success: false, error: "Invalid token" };
  }

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const userList = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);
  if (userList.length === 0) {
    return { success: false, error: "User not found" };
  }

  const { password, ...userWithoutPassword } = userList[0];
  return { success: true, user: userWithoutPassword };
}

/**
 * Request password reset - send verification code to email
 */
export async function requestPasswordReset(email: string): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check if user exists
  const userList = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (userList.length === 0) {
    // Don't reveal if email exists for security
    return { success: true };
  }

  const { generateVerificationCode, sendPasswordResetEmail } = await import("./email-service");
  const { passwordResetCodes } = await import("../drizzle/schema");

  // Generate 6-digit code
  const code = generateVerificationCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Store code in database
  await db.insert(passwordResetCodes).values({
    email,
    code,
    expiresAt,
  });

  // Send email
  const emailSent = await sendPasswordResetEmail(email, code, 10);
  
  if (!emailSent) {
    return { success: false, error: "Failed to send email" };
  }

  return { success: true };
}

/**
 * Verify reset code
 */
export async function verifyResetCode(email: string, code: string): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { passwordResetCodes } = await import("../drizzle/schema");
  const { and, isNull } = await import("drizzle-orm");

  // Find unused code for this email
  const codeList = await db
    .select()
    .from(passwordResetCodes)
    .where(
      and(
        eq(passwordResetCodes.email, email),
        eq(passwordResetCodes.code, code),
        isNull(passwordResetCodes.used)
      )
    )
    .limit(1);

  if (codeList.length === 0) {
    return { success: false, error: "Invalid or expired code" };
  }

  const resetCode = codeList[0];

  // Check if expired
  if (new Date() > new Date(resetCode.expiresAt)) {
    return { success: false, error: "Code has expired" };
  }

  return { success: true };
}

/**
 * Reset password using verification code
 */
export async function resetPassword(
  email: string,
  code: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Verify code first
  const verifyResult = await verifyResetCode(email, code);
  if (!verifyResult.success) {
    return verifyResult;
  }

  // Hash new password
  const passwordHash = await hashPassword(newPassword);

  // Update user password
  await db.update(users).set({ password: passwordHash }).where(eq(users.email, email));

  // Mark code as used
  const { passwordResetCodes } = await import("../drizzle/schema");
  const { and, isNull } = await import("drizzle-orm");
  
  await db
    .update(passwordResetCodes)
    .set({ used: new Date() })
    .where(
      and(
        eq(passwordResetCodes.email, email),
        eq(passwordResetCodes.code, code),
        isNull(passwordResetCodes.used)
      )
    );

  return { success: true };
}
