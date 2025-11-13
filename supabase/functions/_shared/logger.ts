/**
 * Structured Logger for Edge Functions
 * Provides consistent logging with metadata and context
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogContext {
  requestId?: string;
  userId?: string;
  tenantId?: string;
  ip?: string;
  userAgent?: string;
  functionName?: string;
  [key: string]: any;
}

export interface LogMetadata {
  level: LogLevel;
  timestamp: string;
  context?: LogContext;
  duration?: number;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

class Logger {
  private context: LogContext = {};
  private startTime: number;

  constructor(functionName?: string) {
    this.startTime = Date.now();
    if (functionName) {
      this.context.functionName = functionName;
    }
  }

  setContext(context: Partial<LogContext>) {
    this.context = { ...this.context, ...context };
  }

  private formatLog(level: LogLevel, message: string, metadata?: any): LogMetadata {
    const log: LogMetadata = {
      level,
      timestamp: new Date().toISOString(),
      context: this.context,
    };

    if (metadata) {
      Object.assign(log, metadata);
    }

    return log;
  }

  private log(level: LogLevel, message: string, metadata?: any) {
    const logData = this.formatLog(level, message, metadata);
    const prefix = `[${level.toUpperCase()}]`;
    
    if (level === 'error' || level === 'fatal') {
      console.error(prefix, message, JSON.stringify(logData, null, 2));
    } else if (level === 'warn') {
      console.warn(prefix, message, JSON.stringify(logData, null, 2));
    } else {
      console.log(prefix, message, JSON.stringify(logData, null, 2));
    }
  }

  debug(message: string, metadata?: any) {
    this.log('debug', message, metadata);
  }

  info(message: string, metadata?: any) {
    this.log('info', message, metadata);
  }

  warn(message: string, metadata?: any) {
    this.log('warn', message, metadata);
  }

  error(message: string, error?: Error | any, metadata?: any) {
    const errorData = error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      code: (error as any).code,
    } : error;

    this.log('error', message, {
      ...metadata,
      error: errorData,
    });
  }

  fatal(message: string, error?: Error | any, metadata?: any) {
    const errorData = error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      code: (error as any).code,
    } : error;

    this.log('fatal', message, {
      ...metadata,
      error: errorData,
    });
  }

  getDuration(): number {
    return Date.now() - this.startTime;
  }

  logRequest(req: Request) {
    const url = new URL(req.url);
    this.info('Incoming request', {
      method: req.method,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      headers: {
        contentType: req.headers.get('content-type'),
        authorization: req.headers.get('authorization') ? 'present' : 'missing',
        userAgent: req.headers.get('user-agent'),
      },
    });
  }

  logResponse(status: number, body?: any) {
    this.info('Sending response', {
      status,
      duration: this.getDuration(),
      bodySize: body ? JSON.stringify(body).length : 0,
    });
  }
}

export function createLogger(functionName: string): Logger {
  return new Logger(functionName);
}

export function extractRequestContext(req: Request): LogContext {
  return {
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
         req.headers.get('cf-connecting-ip') || 
         'unknown',
    userAgent: req.headers.get('user-agent') || 'unknown',
    requestId: req.headers.get('x-request-id') || crypto.randomUUID(),
  };
}
