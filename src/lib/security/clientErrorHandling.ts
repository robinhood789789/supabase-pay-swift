/**
 * Client-side error sanitization utility
 * 
 * Sanitizes error messages before displaying them to users to prevent
 * information leakage about database structure and system internals.
 */

export function sanitizeClientError(error: unknown): string {
  // Handle non-Error objects
  if (!error || typeof error !== 'object') {
    return 'An error occurred. Please try again or contact support.';
  }

  const message = ('message' in error && typeof error.message === 'string') 
    ? error.message.toLowerCase() 
    : '';

  // Map technical errors to user-friendly messages
  const errorMap: Record<string, string> = {
    'duplicate key': 'This item already exists',
    'foreign key': 'Invalid reference',
    'violates check': 'Invalid input provided',
    'permission denied': "You don't have permission to perform this action",
    'row-level security': 'Access denied',
    'null value': 'Required field is missing',
    'violates unique': 'This item already exists',
    'violates not-null': 'Required field is missing',
    'invalid input': 'Invalid input provided',
    'connection': 'Connection error. Please check your network and try again',
    'timeout': 'Request timed out. Please try again',
    'network': 'Network error. Please check your connection',
    'unauthorized': 'You are not authorized to perform this action',
    'forbidden': 'This action is forbidden',
    'not found': 'The requested resource was not found',
  };

  // Check for matching patterns
  for (const [pattern, userMessage] of Object.entries(errorMap)) {
    if (message.includes(pattern)) {
      return userMessage;
    }
  }

  // Default safe message
  return 'An error occurred. Please try again or contact support.';
}

/**
 * Logs the full error for debugging purposes (development only)
 * In production, this should be sent to a server-side logging service
 */
export function logErrorForDebugging(error: unknown, context?: string): void {
  if (import.meta.env.DEV) {
    console.error(context ? `[${context}]` : '[Error]', error);
  }
}
