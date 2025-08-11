import type { FastifyRequest, FastifyLoggerInstance } from 'fastify';
import type { AuthProvider } from '../plugins/auth-gateway.js';

/**
 * Authentication event types for audit logging
 */
export enum AuditEventType {
  AUTH_TOKEN_EXCHANGE_SUCCESS = 'AUTH_TOKEN_EXCHANGE_SUCCESS',
  AUTH_TOKEN_EXCHANGE_FAILURE = 'AUTH_TOKEN_EXCHANGE_FAILURE',
  AUTH_RATE_LIMIT_EXCEEDED = 'AUTH_RATE_LIMIT_EXCEEDED',
  AUTH_JWT_VERIFICATION_FAILURE = 'AUTH_JWT_VERIFICATION_FAILURE',
  AUTH_PROVIDER_MISMATCH = 'AUTH_PROVIDER_MISMATCH',
  AUTH_DEVELOPMENT_TOKEN_GENERATED = 'AUTH_DEVELOPMENT_TOKEN_GENERATED',
}

/**
 * Base audit event structure
 */
interface BaseAuditEvent {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  event: AuditEventType;
  ip: string;
  userAgent?: string;
  correlationId?: string;
}

/**
 * Successful token exchange event
 */
export interface TokenExchangeSuccessEvent extends BaseAuditEvent {
  event: AuditEventType.AUTH_TOKEN_EXCHANGE_SUCCESS;
  level: 'info';
  userId: string;
  provider: AuthProvider | string;
  metadata: {
    rateLimitRemaining: number;
    sessionDurationMinutes: number;
    emailDomain?: string | undefined; // Only the domain part for privacy
  };
}

/**
 * Failed token exchange event
 */
export interface TokenExchangeFailureEvent extends BaseAuditEvent {
  event: AuditEventType.AUTH_TOKEN_EXCHANGE_FAILURE;
  level: 'warn';
  provider?: AuthProvider | string | undefined;
  metadata: {
    reason: string;
    errorType: string;
    rateLimitRemaining?: number | undefined;
  };
}

/**
 * Rate limit exceeded event
 */
export interface RateLimitExceededEvent extends BaseAuditEvent {
  event: AuditEventType.AUTH_RATE_LIMIT_EXCEEDED;
  level: 'warn';
  userId?: string | undefined;
  metadata: {
    totalHits: number;
    resetTimeSeconds: number;
    windowMs: number;
    maxRequests: number;
  };
}

/**
 * JWT verification failure event
 */
export interface JWTVerificationFailureEvent extends BaseAuditEvent {
  event: AuditEventType.AUTH_JWT_VERIFICATION_FAILURE;
  level: 'error';
  provider?: AuthProvider | string | undefined;
  metadata: {
    errorType: string;
    errorMessage: string;
  };
}

/**
 * Provider mismatch event
 */
export interface ProviderMismatchEvent extends BaseAuditEvent {
  event: AuditEventType.AUTH_PROVIDER_MISMATCH;
  level: 'warn';
  metadata: {
    expectedProvider: AuthProvider | string;
    detectedProvider: AuthProvider | string;
  };
}

/**
 * Development token generated event
 */
export interface DevelopmentTokenGeneratedEvent extends BaseAuditEvent {
  event: AuditEventType.AUTH_DEVELOPMENT_TOKEN_GENERATED;
  level: 'info';
  metadata: {
    identifier: string;
    mode: string;
    rateLimitRemaining: number;
  };
}

/**
 * Union type for all audit events
 */
export type AuditEvent =
  | TokenExchangeSuccessEvent
  | TokenExchangeFailureEvent
  | RateLimitExceededEvent
  | JWTVerificationFailureEvent
  | ProviderMismatchEvent
  | DevelopmentTokenGeneratedEvent;

/**
 * Extract request metadata for audit logging
 * Sanitizes and extracts relevant information from the request
 */
function extractRequestMetadata(request: FastifyRequest): {
  ip: string;
  userAgent?: string;
  correlationId?: string;
} {
  // Get client IP (handling proxy scenarios)
  const ip = request.ip || 'unknown';

  // Get user agent (sanitized)
  const userAgent = request.headers['user-agent']?.substring(0, 200); // Limit length

  // Get correlation ID if available (from headers or request ID)
  const correlationId =
    (request.headers['x-correlation-id'] as string) ||
    (request.headers['x-request-id'] as string) ||
    request.id;

  return {
    ip,
    ...(userAgent !== undefined && { userAgent }),
    ...(correlationId && { correlationId }),
  };
}

/**
 * Sanitize email for logging (extract domain only)
 * Returns only the domain part of an email for privacy
 */
function sanitizeEmail(email?: string): string | undefined {
  if (!email) return undefined;

  try {
    const domain = email.split('@')[1];
    return domain?.toLowerCase();
  } catch {
    return undefined;
  }
}

/**
 * Sanitize user ID for logging
 * Returns a truncated version with suffix for privacy
 */
function sanitizeUserId(userId: string): string {
  if (userId.length <= 8) return userId;
  return userId.substring(0, 8) + '...';
}

/**
 * Authentication audit logger
 * Provides structured logging for authentication events
 */
export class AuthAuditLogger {
  constructor(private readonly logger: FastifyLoggerInstance) {}

  /**
   * Log successful token exchange
   */
  logTokenExchangeSuccess(
    request: FastifyRequest,
    userId: string,
    provider: AuthProvider | string,
    email?: string,
    rateLimitRemaining: number = 0,
    sessionDurationMinutes: number = 15
  ): void {
    const metadata = extractRequestMetadata(request);

    const event: TokenExchangeSuccessEvent = {
      timestamp: new Date().toISOString(),
      level: 'info',
      event: AuditEventType.AUTH_TOKEN_EXCHANGE_SUCCESS,
      userId: sanitizeUserId(userId),
      provider,
      ...metadata,
      metadata: {
        rateLimitRemaining,
        sessionDurationMinutes,
        ...(sanitizeEmail(email) !== undefined && {
          emailDomain: sanitizeEmail(email),
        }),
      },
    };

    this.logger.info(event, 'Authentication token exchange successful');
  }

  /**
   * Log failed token exchange
   */
  logTokenExchangeFailure(
    request: FastifyRequest,
    reason: string,
    errorType: string,
    provider?: AuthProvider | string,
    rateLimitRemaining?: number
  ): void {
    const metadata = extractRequestMetadata(request);

    const event: TokenExchangeFailureEvent = {
      timestamp: new Date().toISOString(),
      level: 'warn',
      event: AuditEventType.AUTH_TOKEN_EXCHANGE_FAILURE,
      provider,
      ...metadata,
      metadata: {
        reason,
        errorType,
        ...(rateLimitRemaining !== undefined && { rateLimitRemaining }),
      },
    };

    this.logger.warn(event, 'Authentication token exchange failed');
  }

  /**
   * Log rate limit exceeded
   */
  logRateLimitExceeded(
    request: FastifyRequest,
    totalHits: number,
    resetTimeSeconds: number,
    windowMs: number,
    maxRequests: number,
    userId?: string
  ): void {
    const metadata = extractRequestMetadata(request);

    const event: RateLimitExceededEvent = {
      timestamp: new Date().toISOString(),
      level: 'warn',
      event: AuditEventType.AUTH_RATE_LIMIT_EXCEEDED,
      userId: userId ? sanitizeUserId(userId) : undefined,
      ...metadata,
      metadata: {
        totalHits,
        resetTimeSeconds,
        windowMs,
        maxRequests,
      },
    };

    this.logger.warn(event, 'Authentication rate limit exceeded');
  }

  /**
   * Log JWT verification failure
   */
  logJWTVerificationFailure(
    request: FastifyRequest,
    errorType: string,
    errorMessage: string,
    provider?: AuthProvider | string
  ): void {
    const metadata = extractRequestMetadata(request);

    const event: JWTVerificationFailureEvent = {
      timestamp: new Date().toISOString(),
      level: 'error',
      event: AuditEventType.AUTH_JWT_VERIFICATION_FAILURE,
      provider,
      ...metadata,
      metadata: {
        errorType,
        errorMessage: errorMessage.substring(0, 500), // Limit error message length
      },
    };

    this.logger.error(event, 'JWT verification failed');
  }

  /**
   * Log provider mismatch
   */
  logProviderMismatch(
    request: FastifyRequest,
    expectedProvider: AuthProvider | string,
    detectedProvider: AuthProvider | string
  ): void {
    const metadata = extractRequestMetadata(request);

    const event: ProviderMismatchEvent = {
      timestamp: new Date().toISOString(),
      level: 'warn',
      event: AuditEventType.AUTH_PROVIDER_MISMATCH,
      ...metadata,
      metadata: {
        expectedProvider,
        detectedProvider,
      },
    };

    this.logger.warn(event, 'Authentication provider mismatch detected');
  }

  /**
   * Log development token generation
   */
  logDevelopmentTokenGenerated(
    request: FastifyRequest,
    identifier: string,
    rateLimitRemaining: number
  ): void {
    const metadata = extractRequestMetadata(request);

    const event: DevelopmentTokenGeneratedEvent = {
      timestamp: new Date().toISOString(),
      level: 'info',
      event: AuditEventType.AUTH_DEVELOPMENT_TOKEN_GENERATED,
      ...metadata,
      metadata: {
        identifier: sanitizeUserId(identifier),
        mode: 'development',
        rateLimitRemaining,
      },
    };

    this.logger.info(
      event,
      'Development token generated for backwards compatibility'
    );
  }
}

/**
 * Create an audit logger instance
 * Factory function for creating audit logger with Fastify logger
 */
export function createAuthAuditLogger(
  logger: FastifyLoggerInstance
): AuthAuditLogger {
  return new AuthAuditLogger(logger);
}
