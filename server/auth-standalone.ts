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

// JWT secret - MUST be set via environment variable
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("CRITICAL: JWT_SECRET environment variable is not set. Server cannot start without it.");
}
const JWT_EXPIRES_IN = "1h"; // Access token expires in 1 hour
const JWT_REFRESH_EXPIRES_IN = "7d"; // Refresh token expires in 7 days

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
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN, algorithm: 'HS256' });
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
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN, algorithm: 'HS256' });
}

/**
 * Verify JWT token
 * @param token - JWT token string
 * @param expectedType - Expected token type ('access' or 'refresh'). If provided, rejects mismatched types.
 */
export function verifyToken(token: string, expectedType?: "access" | "refresh"): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as JWTPayload;
    if (expectedType && decoded.type !== expectedType) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Hash password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
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
}): Promise<{ success: boolean; userId?: number; accessToken?: string; refreshToken?: string; error?: string; needsVerification?: boolean }> {
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

  // Send verification email
  await sendEmailVerificationCode(newUser.id, newUser.email!);

  // Generate tokens
  const accessToken = generateAccessToken(newUser);
  const refreshToken = generateRefreshToken(newUser);

  return {
    success: true,
    userId: newUser.id,
    accessToken,
    refreshToken,
    needsVerification: true,
  };
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
  const payload = verifyToken(refreshToken, "refresh");

  if (!payload) {
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
  const payload = verifyToken(token, "access");

  if (!payload) {
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
 * Generate and send email verification code
 */
export async function sendEmailVerificationCode(
  userId: number,
  email: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check rate limiting - only allow one code every 60 seconds
    const recentCode = await prisma.verificationCode.findFirst({
      where: {
        email,
        type: 'email_verification',
        createdAt: {
          gte: new Date(Date.now() - 60 * 1000), // Last 60 seconds
        },
      },
    });

    if (recentCode) {
      const waitTime = Math.ceil((60000 - (Date.now() - recentCode.createdAt.getTime())) / 1000);
      return {
        success: false,
        error: `Please wait ${waitTime} seconds before requesting another code`
      };
    }

    const { generateVerificationCode, sendVerificationCodeEmail } = await import("./email-service");

    // Generate 6-digit code
    const code = generateVerificationCode();
    const expiresInMinutes = 10;
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    // Save code to database
    await prisma.verificationCode.create({
      data: {
        userId,
        email,
        code,
        type: 'email_verification',
        expiresAt,
      },
    });

    // Send email
    const emailSent = await sendVerificationCodeEmail(email, code, expiresInMinutes);

    if (!emailSent) {
      return { success: false, error: 'Failed to send verification email' };
    }

    return { success: true };
  } catch (error) {
    console.error('[sendEmailVerificationCode] Error:', error);
    return { success: false, error: 'Internal server error' };
  }
}

/**
 * Verify email with code
 */
export async function verifyEmailWithCode(
  email: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Find valid code
    const verificationCode = await prisma.verificationCode.findFirst({
      where: {
        email,
        code,
        type: 'email_verification',
        used: false,
        expiresAt: {
          gt: new Date(), // Not expired
        },
      },
    });

    if (!verificationCode) {
      return { success: false, error: 'Invalid or expired verification code' };
    }

    // Mark code as used
    await prisma.verificationCode.update({
      where: { id: verificationCode.id },
      data: { used: true },
    });

    // Update user email verification status
    await prisma.user.update({
      where: { id: verificationCode.userId },
      data: { emailVerified: true },
    });

    return { success: true };
  } catch (error) {
    console.error('[verifyEmailWithCode] Error:', error);
    return { success: false, error: 'Internal server error' };
  }
}

/**
 * Get verification status
 */
export async function getVerificationStatus(
  email: string
): Promise<{
  hasPendingCode: boolean;
  expiresIn: number | null;
  canResend: boolean;
}> {
  const latestCode = await prisma.verificationCode.findFirst({
    where: {
      email,
      type: 'email_verification',
      used: false,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (!latestCode) {
    return {
      hasPendingCode: false,
      expiresIn: null,
      canResend: true,
    };
  }

  const now = Date.now();
  const expiresAt = latestCode.expiresAt.getTime();
  const createdAt = latestCode.createdAt.getTime();

  const expiresIn = Math.max(0, Math.floor((expiresAt - now) / 1000)); // seconds
  const canResend = (now - createdAt) >= 60 * 1000; // Can resend after 60 seconds

  return {
    hasPendingCode: expiresIn > 0,
    expiresIn: expiresIn > 0 ? expiresIn : null,
    canResend,
  };
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

  // Store code using VerificationCode model (type=password_reset)
  await prisma.verificationCode.create({
    data: {
      userId: user.id,
      email,
      code,
      type: "password_reset",
      expiresAt,
    },
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
  // Find unused code for this email using VerificationCode model
  const resetCode = await prisma.verificationCode.findFirst({
    where: {
      email,
      code,
      type: "password_reset",
      used: false,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!resetCode) {
    return { success: false, error: "Invalid or expired code" };
  }

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
  await prisma.verificationCode.updateMany({
    where: {
      email,
      code,
      type: "password_reset",
      used: false,
    },
    data: { used: true },
  });

  return { success: true };
}
