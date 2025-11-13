import { corsHeaders } from './cors.ts';

export type ErrorCategory = 
  | 'AUTHENTICATION'
  | 'AUTHORIZATION'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMIT'
  | 'EXTERNAL_SERVICE'
  | 'DATABASE'
  | 'INTERNAL';

export class AppError extends Error {
  public readonly category: ErrorCategory;
  public readonly isOperational: boolean;
  public readonly metadata?: Record<string, any>;

  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
    category: ErrorCategory = 'INTERNAL',
    isOperational = true,
    metadata?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
    this.category = category;
    this.isOperational = isOperational;
    this.metadata = metadata;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      category: this.category,
      ...(this.metadata && { details: this.metadata }),
    };
  }
}

// Predefined error factories
export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required', metadata?: Record<string, any>) {
    super(401, message, 'AUTH_REQUIRED', 'AUTHENTICATION', true, metadata);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions', metadata?: Record<string, any>) {
    super(403, message, 'FORBIDDEN', 'AUTHORIZATION', true, metadata);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, metadata?: Record<string, any>) {
    super(400, message, 'VALIDATION_ERROR', 'VALIDATION', true, metadata);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, metadata?: Record<string, any>) {
    super(404, `${resource} not found`, 'NOT_FOUND', 'NOT_FOUND', true, metadata);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, metadata?: Record<string, any>) {
    super(409, message, 'CONFLICT', 'CONFLICT', true, metadata);
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded', metadata?: Record<string, any>) {
    super(429, message, 'RATE_LIMIT', 'RATE_LIMIT', true, metadata);
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message?: string, metadata?: Record<string, any>) {
    super(
      502,
      message || `External service ${service} unavailable`,
      'EXTERNAL_SERVICE_ERROR',
      'EXTERNAL_SERVICE',
      true,
      { service, ...metadata }
    );
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, metadata?: Record<string, any>) {
    super(500, message, 'DATABASE_ERROR', 'DATABASE', true, metadata);
  }
}

export function handleEnhancedError(error: unknown, logger?: any): Response {
  // Log with structured logger if available
  if (logger) {
    if (error instanceof AppError) {
      logger.error('Application error', error, {
        category: error.category,
        code: error.code,
        statusCode: error.statusCode,
        metadata: error.metadata,
      });
    } else if (error instanceof Error) {
      logger.fatal('Unhandled error', error);
    } else {
      logger.fatal('Unknown error type', new Error(String(error)));
    }
  } else {
    // Fallback to console.error if no logger
    console.error('Error occurred:', error);
  }

  // Return appropriate response
  if (error instanceof AppError) {
    return new Response(
      JSON.stringify(error.toJSON()),
      {
        status: error.statusCode,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  if (error instanceof Error) {
    return new Response(
      JSON.stringify({
        error: error.message,
        code: 'INTERNAL_ERROR',
        category: 'INTERNAL',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  return new Response(
    JSON.stringify({
      error: 'An unexpected error occurred',
      code: 'UNKNOWN_ERROR',
      category: 'INTERNAL',
    }),
    {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}
