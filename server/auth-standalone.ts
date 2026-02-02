/**
 * Standalone Authentication System
 * Supports email/password, GitHub OAuth, Hugging Face OAuth, and Google OAuth
 * JWT token-based authentication
 *
 * Uses Prisma Client for PostgreSQL
 */

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "./db-prisma";
import { nanoid } from "nanoid";

// User type for API responses (without password)
interface SafeUser {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  avatar: string | null;
  role: string;
  loginMethod: string | null;
  emailVerified: boolean | null;
  lastSignedIn: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

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
  } catch {
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
  // Check if email already exists
  const existing = await prisma.user.findFirst({
    where: { email: params.email }
  });

  if (existing) {
    return { success: false, error: "Email already registered" };
  }

  // Hash password
  const passwordHash = await hashPassword(params.password);

  // Create user
  const newUser = await prisma.user.create({
    data: {
      email: params.email,
      password: passwordHash,
      name: params.name || params.email.split("@")[0],
      openId: nanoid(),
      loginMethod: "email",
      role: "consumer",
      emailVerified: false,
    }
  });

  // Generate tokens
  const accessToken = generateAccessToken(newUser);
  const refreshToken = generateRefreshToken(newUser);

  return { success: true, userId: newUser.id, accessToken, refreshToken };
}

/**
 * Login with email/password
 */
export async function loginWithEmail(params: {
  email: string;
  password: string;
}): Promise<{ success: boolean; user?: SafeUser; accessToken?: string; refreshToken?: string; error?: string }> {
  // Find user by email
  const user = await prisma.user.findFirst({
    where: { email: params.email }
  });

  if (!user) {
    return { success: false, error: "Invalid email or password" };
  }

  // Verify password
  if (!user.password) {
    return { success: false, error: "This account uses OAuth login" };
  }

  const isValid = await verifyPassword(params.password, user.password);
  if (!isValid) {
    return { success: false, error: "Invalid email or password" };
  }

  // Update last signed in
  await prisma.user.update({
    where: { id: user.id },
    data: { lastSignedIn: new Date() }
  });

  // Generate tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Return user without password
  const { password: _, ...userWithoutPassword } = user;
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

  // Verify user still exists
  const user = await prisma.user.findUnique({
    where: { id: payload.userId }
  });

  if (!user) {
    return { success: false, error: "User not found" };
  }

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
  // Generate openId from provider and providerId
  const openId = `${params.provider}:${params.providerId}`;

  // Try to find existing user
  let user = await prisma.user.findFirst({
    where: { openId }
  });

  if (user) {
    // Update last signed in
    await prisma.user.update({
      where: { id: user.id },
      data: { lastSignedIn: new Date() }
    });

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    const { password: _, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, accessToken, refreshToken };
  }

  // Create new user
  user = await prisma.user.create({
    data: {
      openId,
      email: params.email,
      name: params.name || params.email?.split("@")[0] || "User",
      avatar: params.avatar,
      loginMethod: params.provider,
      role: "consumer",
      emailVerified: true, // OAuth emails are pre-verified
    }
  });

  // Generate tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  const { password: _, ...userWithoutPassword } = user;
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

  const user = await prisma.user.findUnique({
    where: { id: payload.userId }
  });

  if (!user) {
    return { success: false, error: "User not found" };
  }

  const { password: _, ...userWithoutPassword } = user;
  return { success: true, user: userWithoutPassword };
}

/**
 * Request password reset - send verification code to email
 */
export async function requestPasswordReset(email: string): Promise<{ success: boolean; error?: string }> {
  // Check if user exists
  const user = await prisma.user.findFirst({
    where: { email }
  });

  if (!user) {
    // Don't reveal if email exists for security
    return { success: true };
  }

  const { generateVerificationCode, sendPasswordResetEmail } = await import("./email-service");

  // Generate 6-digit code
  const code = generateVerificationCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Store code in database using raw SQL (passwordResetCodes may not be in Prisma schema yet)
  await prisma.$executeRaw`
    INSERT INTO password_reset_codes (email, code, expires_at, created_at)
    VALUES (${email}, ${code}, ${expiresAt}, ${new Date()})
  `;

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
  // Find unused code for this email using raw SQL
  const codeList = await prisma.$queryRaw<{ id: number; expires_at: Date }[]>`
    SELECT id, expires_at FROM password_reset_codes
    WHERE email = ${email} AND code = ${code} AND used IS NULL
    LIMIT 1
  `;

  if (codeList.length === 0) {
    return { success: false, error: "Invalid or expired code" };
  }

  const resetCode = codeList[0];

  // Check if expired
  if (new Date() > new Date(resetCode.expires_at)) {
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
  // Verify code first
  const verifyResult = await verifyResetCode(email, code);
  if (!verifyResult.success) {
    return verifyResult;
  }

  // Hash new password
  const passwordHash = await hashPassword(newPassword);

  // Update user password
  await prisma.user.updateMany({
    where: { email },
    data: { password: passwordHash }
  });

  // Mark code as used
  await prisma.$executeRaw`
    UPDATE password_reset_codes
    SET used = ${new Date()}
    WHERE email = ${email} AND code = ${code} AND used IS NULL
  `;

  return { success: true };
}
