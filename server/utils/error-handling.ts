/**
 * Type-safe error handling utilities
 */

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
