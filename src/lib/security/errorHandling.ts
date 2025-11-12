/**
 * Client-side error sanitization utility
 * Prevents exposure of internal system details through error messages
 */

export function sanitizeClientError(error: unknown): string {
  if (!error) {
    return 'An error occurred. Please try again or contact support.';
  }

  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  
  // Map technical errors to user-friendly messages
  const errorMap: Record<string, string> = {
    'duplicate key': 'This item already exists',
    'foreign key': 'Invalid reference to related data',
    'violates check': 'Invalid input provided',
    'permission denied': "You don't have permission to perform this action",
    'row-level security': 'Access denied',
    'null value': 'Required field is missing',
    'not found': 'The requested item was not found',
    'violates unique': 'This value is already in use',
    'invalid input': 'Invalid input provided',
    'authentication': 'Authentication failed. Please try logging in again',
    'unauthorized': 'You are not authorized to perform this action',
    'timeout': 'Request timed out. Please try again',
    'network': 'Network error. Please check your connection',
    'column': 'Invalid data format',
    'syntax error': 'Invalid request format',
  };
  
  // Check for matching error patterns
  for (const [pattern, userMessage] of Object.entries(errorMap)) {
    if (message.includes(pattern)) {
      return userMessage;
    }
  }
  
  // Default generic message for unmatched errors
  return 'An error occurred. Please try again or contact support.';
}

/**
 * Logs detailed error information for debugging while showing sanitized message to user
 * @param error - The error object
 * @param context - Additional context about where the error occurred
 */
export function logAndSanitizeError(error: unknown, context: string): string {
  // Log full error details for debugging (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.error(`[${context}]`, error);
  }
  
  return sanitizeClientError(error);
}
