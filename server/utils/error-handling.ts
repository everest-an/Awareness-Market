/**
 * Type-safe error handling utilities
 */

import { TRPCError } from '@trpc/server';

// ============================================================================
// Common tRPC Error Helpers
// ============================================================================

/**
 * Throw database unavailable error
 * Eliminates repeated pattern across 15+ files
 */
export function throwDatabaseUnavailable(): never {
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Database unavailable',
  });
}

/**
 * Throw if database is unavailable
 * @param db - Database instance to check
 */
export function assertDatabaseAvailable<T>(db: T | null | undefined): asserts db is T {
  if (!db) {
    throwDatabaseUnavailable();
  }
}

/**
 * Throw package not found error
 * Eliminates repeated pattern across 3+ files
 */
export function throwPackageNotFound(packageType?: string): never {
  throw new TRPCError({
    code: 'NOT_FOUND',
    message: packageType ? `${packageType} package not found` : 'Package not found',
  });
}

/**
 * Throw if package is not found
 * @param pkg - Package instance to check
 * @param packageType - Optional package type for error message
 */
export function assertPackageExists<T>(pkg: T | null | undefined, packageType?: string): asserts pkg is T {
  if (!pkg) {
    throwPackageNotFound(packageType);
  }
}

/**
 * Throw validation failed error
 * Eliminates repeated validation error pattern
 */
export function throwValidationFailed(errors: string[]): never {
  throw new TRPCError({
    code: 'BAD_REQUEST',
    message: `Validation failed: ${errors.join(', ')}`,
  });
}

/**
 * Throw forbidden error
 */
export function throwForbidden(message = 'Access denied'): never {
  throw new TRPCError({
    code: 'FORBIDDEN',
    message,
  });
}

/**
 * Throw unauthorized error
 */
export function throwUnauthorized(message = 'Authentication required'): never {
  throw new TRPCError({
    code: 'UNAUTHORIZED',
    message,
  });
}

// ============================================================================
// Generic Error Utilities
// ============================================================================

/**
 * Safely extract error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return 'An unknown error occurred';
}

/**
 * Check if error is an instance of Error
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Safely get error stack trace
 */
export function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) return error.stack;
  return undefined;
}

/**
 * Create a standardized error response object
 */
export function createErrorResponse(error: unknown, defaultMessage = 'An error occurred') {
  return {
    error: getErrorMessage(error) || defaultMessage,
    stack: process.env.NODE_ENV === 'development' ? getErrorStack(error) : undefined
  };
}
