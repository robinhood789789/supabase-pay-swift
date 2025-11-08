/**
 * Secure Error Handling Utilities
 * 
 * SECURITY: Never expose internal error details to clients.
 * All detailed errors should be logged server-side only.
 */

export interface GenericError {
  error: string;
  error_id: string;
  code: string;
}

/**
 * Create a secure error response
 * - Logs detailed error server-side
 * - Returns generic message to client
 * - Includes error_id for support reference
 */
export function createSecureErrorResponse(
  error: any,
  context: string,
  corsHeaders: Record<string, string>
): Response {
  const errorId = crypto.randomUUID();
  
  // Log detailed error server-side only
  console.error(`[${context}] Error ID: ${errorId}`);
  console.error(`[${context}] Error type:`, error?.constructor?.name);
  console.error(`[${context}] Error message:`, error?.message);
  console.error(`[${context}] Error stack:`, error?.stack);
  
  // Return generic error to client
  const errorResponse: GenericError = {
    error: 'An error occurred processing your request. Please try again or contact support.',
    error_id: errorId,
    code: 'INTERNAL_ERROR'
  };
  
  return new Response(JSON.stringify(errorResponse), {
    status: 500,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Create a user-friendly error response for known error types
 */
export function createFriendlyErrorResponse(
  message: string,
  code: string,
  status: number,
  corsHeaders: Record<string, string>
): Response {
  return new Response(JSON.stringify({ error: message, code }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Log sensitive action with masked data
 */
export function logSecureAction(
  context: string,
  action: string,
  data: Record<string, any>
): void {
  const maskedData = { ...data };
  
  // Mask sensitive fields
  if (maskedData.email) {
    maskedData.email = maskEmail(maskedData.email);
  }
  if (maskedData.password) {
    maskedData.password = '***';
  }
  if (maskedData.temp_password) {
    maskedData.temp_password = '***';
  }
  if (maskedData.token) {
    maskedData.token = '***';
  }
  if (maskedData.secret) {
    maskedData.secret = '***';
  }
  
  console.log(`[${context}] ${action}:`, maskedData);
}

/**
 * Mask email address
 */
export function maskEmail(email: string): string {
  const [username, domain] = email.split('@');
  if (!domain) return email;
  
  const visibleChars = Math.min(3, Math.floor(username.length / 2));
  return username.substring(0, visibleChars) + '***@' + domain;
}

/**
 * Validate input length
 */
export function validateLength(
  value: string,
  fieldName: string,
  maxLength: number
): { valid: boolean; error?: string } {
  if (value.length > maxLength) {
    return {
      valid: false,
      error: `${fieldName} must be less than ${maxLength} characters`
    };
  }
  return { valid: true };
}

/**
 * Validate email format
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Invalid email format' };
  }
  if (email.length > 255) {
    return { valid: false, error: 'Email must be less than 255 characters' };
  }
  return { valid: true };
}