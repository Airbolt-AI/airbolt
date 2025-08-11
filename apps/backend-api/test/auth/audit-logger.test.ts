import { describe, it, expect } from 'vitest';
import type { FastifyRequest, FastifyLoggerInstance } from 'fastify';
import {
  createAuthAuditLogger,
  AuditEventType,
} from '../../src/auth/audit-logger.js';
import { AuthProvider } from '../../src/plugins/auth-gateway.js';

/**
 * Mock logger for capturing log events
 */
class MockLogger implements FastifyLoggerInstance {
  public logs: Array<{
    level: string;
    event: any;
    message: string | undefined;
  }> = [];

  info(obj: any, msg?: string, ..._args: any[]): void {
    this.logs.push({ level: 'info', event: obj, message: msg });
  }

  warn(obj: any, msg?: string, ..._args: any[]): void {
    this.logs.push({ level: 'warn', event: obj, message: msg });
  }

  error(obj: any, msg?: string, ..._args: any[]): void {
    this.logs.push({ level: 'error', event: obj, message: msg });
  }

  // Required FastifyLoggerInstance methods (not used in tests)
  trace(_obj: any, _msg?: string, ..._args: any[]): void {}
  debug(_obj: any, _msg?: string, ..._args: any[]): void {}
  fatal(_obj: any, _msg?: string, ..._args: any[]): void {}
  silent(_obj: any, _msg?: string, ..._args: any[]): void {}
  child(): FastifyLoggerInstance {
    return this;
  }
  level: string = 'info';
}

/**
 * Create a mock Fastify request for testing
 */
function createMockRequest(
  overrides: Partial<FastifyRequest> = {}
): FastifyRequest {
  return {
    ip: '192.168.1.100',
    id: 'req-123',
    headers: {
      'user-agent': 'Mozilla/5.0 (Test Browser)',
      'x-correlation-id': 'corr-456',
    },
    ...overrides,
  } as FastifyRequest;
}

describe('auth audit logger', () => {
  it('logTokenExchangeSuccess creates properly structured event', () => {
    const mockLogger = new MockLogger();
    const auditLogger = createAuthAuditLogger(mockLogger);
    const request = createMockRequest();

    auditLogger.logTokenExchangeSuccess(
      request,
      'user123456789012345',
      AuthProvider.CLERK,
      'test@example.com',
      5,
      15
    );

    expect(mockLogger.logs.length).toBe(1);

    const logEntry = mockLogger.logs[0]!;
    expect(logEntry.level).toBe('info');
    expect(logEntry.message).toBe('Authentication token exchange successful');

    const event = logEntry.event;
    expect(event.event).toBe(AuditEventType.AUTH_TOKEN_EXCHANGE_SUCCESS);
    expect(event.level).toBe('info');
    expect(event.userId).toBe('user1234...'); // Should be sanitized
    expect(event.provider).toBe(AuthProvider.CLERK);
    expect(event.ip).toBe('192.168.1.100');
    expect(event.userAgent).toBe('Mozilla/5.0 (Test Browser)');
    expect(event.correlationId).toBe('corr-456');

    // Check metadata
    expect(event.metadata.rateLimitRemaining).toBe(5);
    expect(event.metadata.sessionDurationMinutes).toBe(15);
    expect(event.metadata.emailDomain).toBe('example.com'); // Only domain, not full email

    // Should have timestamp
    expect(event.timestamp).toBeDefined();
    expect(new Date(event.timestamp).getTime()).toBeGreaterThan(0);
  });

  it('logTokenExchangeFailure creates properly structured event', () => {
    const mockLogger = new MockLogger();
    const auditLogger = createAuthAuditLogger(mockLogger);
    const request = createMockRequest();

    auditLogger.logTokenExchangeFailure(
      request,
      'Token signature verification failed',
      'INVALID_SIGNATURE',
      AuthProvider.AUTH0,
      3
    );

    expect(mockLogger.logs.length).toBe(1);

    const logEntry = mockLogger.logs[0]!;
    expect(logEntry.level).toBe('warn');
    expect(logEntry.message).toBe('Authentication token exchange failed');

    const event = logEntry.event;
    expect(event.event).toBe(AuditEventType.AUTH_TOKEN_EXCHANGE_FAILURE);
    expect(event.level).toBe('warn');
    expect(event.provider).toBe(AuthProvider.AUTH0);
    expect(event.ip).toBe('192.168.1.100');

    // Check metadata
    expect(event.metadata.reason).toBe('Token signature verification failed');
    expect(event.metadata.errorType).toBe('INVALID_SIGNATURE');
    expect(event.metadata.rateLimitRemaining).toBe(3);
  });

  it('logRateLimitExceeded creates properly structured event', () => {
    const mockLogger = new MockLogger();
    const auditLogger = createAuthAuditLogger(mockLogger);
    const request = createMockRequest();

    auditLogger.logRateLimitExceeded(
      request,
      15,
      300,
      900000,
      10,
      'user987654321'
    );

    expect(mockLogger.logs.length).toBe(1);

    const logEntry = mockLogger.logs[0]!;
    expect(logEntry.level).toBe('warn');
    expect(logEntry.message).toBe('Authentication rate limit exceeded');

    const event = logEntry.event;
    expect(event.event).toBe(AuditEventType.AUTH_RATE_LIMIT_EXCEEDED);
    expect(event.level).toBe('warn');
    expect(event.userId).toBe('user9876...'); // Should be sanitized
    expect(event.ip).toBe('192.168.1.100');

    // Check metadata
    expect(event.metadata.totalHits).toBe(15);
    expect(event.metadata.resetTimeSeconds).toBe(300);
    expect(event.metadata.windowMs).toBe(900000);
    expect(event.metadata.maxRequests).toBe(10);
  });

  it('logJWTVerificationFailure creates properly structured event', () => {
    const mockLogger = new MockLogger();
    const auditLogger = createAuthAuditLogger(mockLogger);
    const request = createMockRequest();

    auditLogger.logJWTVerificationFailure(
      request,
      'TOKEN_EXPIRED',
      'JWT expired at 2024-01-01T00:00:00Z',
      AuthProvider.FIREBASE
    );

    expect(mockLogger.logs.length).toBe(1);

    const logEntry = mockLogger.logs[0]!;
    expect(logEntry.level).toBe('error');
    expect(logEntry.message).toBe('JWT verification failed');

    const event = logEntry.event;
    expect(event.event).toBe(AuditEventType.AUTH_JWT_VERIFICATION_FAILURE);
    expect(event.level).toBe('error');
    expect(event.provider).toBe(AuthProvider.FIREBASE);
    expect(event.ip).toBe('192.168.1.100');

    // Check metadata
    expect(event.metadata.errorType).toBe('TOKEN_EXPIRED');
    expect(event.metadata.errorMessage).toBe(
      'JWT expired at 2024-01-01T00:00:00Z'
    );
  });

  it('logProviderMismatch creates properly structured event', () => {
    const mockLogger = new MockLogger();
    const auditLogger = createAuthAuditLogger(mockLogger);
    const request = createMockRequest();

    auditLogger.logProviderMismatch(
      request,
      AuthProvider.CLERK,
      AuthProvider.AUTH0
    );

    expect(mockLogger.logs.length).toBe(1);

    const logEntry = mockLogger.logs[0]!;
    expect(logEntry.level).toBe('warn');
    expect(logEntry.message).toBe('Authentication provider mismatch detected');

    const event = logEntry.event;
    expect(event.event).toBe(AuditEventType.AUTH_PROVIDER_MISMATCH);
    expect(event.level).toBe('warn');
    expect(event.ip).toBe('192.168.1.100');

    // Check metadata
    expect(event.metadata.expectedProvider).toBe(AuthProvider.CLERK);
    expect(event.metadata.detectedProvider).toBe(AuthProvider.AUTH0);
  });

  it('logDevelopmentTokenGenerated creates properly structured event', () => {
    const mockLogger = new MockLogger();
    const auditLogger = createAuthAuditLogger(mockLogger);
    const request = createMockRequest();

    auditLogger.logDevelopmentTokenGenerated(
      request,
      'dev-user-identifier-12345',
      7
    );

    expect(mockLogger.logs.length).toBe(1);

    const logEntry = mockLogger.logs[0]!;
    expect(logEntry.level).toBe('info');
    expect(logEntry.message).toBe(
      'Development token generated for backwards compatibility'
    );

    const event = logEntry.event;
    expect(event.event).toBe(AuditEventType.AUTH_DEVELOPMENT_TOKEN_GENERATED);
    expect(event.level).toBe('info');
    expect(event.ip).toBe('192.168.1.100');

    // Check metadata
    expect(event.metadata.identifier).toBe('dev-user...'); // Should be sanitized
    expect(event.metadata.mode).toBe('development');
    expect(event.metadata.rateLimitRemaining).toBe(7);
  });

  it('sanitizes sensitive data properly', () => {
    const mockLogger = new MockLogger();
    const auditLogger = createAuthAuditLogger(mockLogger);
    const request = createMockRequest();

    // Test user ID sanitization
    auditLogger.logTokenExchangeSuccess(
      request,
      'very-long-user-id-that-should-be-truncated-for-privacy',
      AuthProvider.CLERK,
      'sensitive@private-domain.com',
      5,
      15
    );

    const event = mockLogger.logs[0]!.event;
    expect(event.userId).toBe('very-lon...');
    expect(event.metadata.emailDomain).toBe('private-domain.com');
  });

  it('handles missing optional fields gracefully', () => {
    const mockLogger = new MockLogger();
    const auditLogger = createAuthAuditLogger(mockLogger);

    // Request without user agent and correlation ID
    const request = createMockRequest({
      headers: {},
    });

    auditLogger.logTokenExchangeSuccess(
      request,
      'user123',
      AuthProvider.CLERK,
      undefined, // no email
      5,
      15
    );

    const event = mockLogger.logs[0]!.event;
    expect(event.userAgent).toBeUndefined();
    expect(event.correlationId).toBe('req-123'); // Falls back to request ID
    expect(event.metadata.emailDomain).toBeUndefined();
  });

  it('limits error message length', () => {
    const mockLogger = new MockLogger();
    const auditLogger = createAuthAuditLogger(mockLogger);
    const request = createMockRequest();

    const longErrorMessage = 'A'.repeat(1000); // 1000 character error message

    auditLogger.logJWTVerificationFailure(
      request,
      'LONG_ERROR',
      longErrorMessage,
      AuthProvider.SUPABASE
    );

    const event = mockLogger.logs[0]!.event;
    expect(event.metadata.errorMessage.length).toBeLessThanOrEqual(500);
    expect(event.metadata.errorMessage.startsWith('A')).toBe(true);
  });

  it('limits user agent length', () => {
    const mockLogger = new MockLogger();
    const auditLogger = createAuthAuditLogger(mockLogger);

    const longUserAgent = 'Mozilla/5.0 ' + 'A'.repeat(300);
    const request = createMockRequest({
      headers: {
        'user-agent': longUserAgent,
      },
    });

    auditLogger.logTokenExchangeSuccess(
      request,
      'user123',
      AuthProvider.CLERK,
      'test@example.com',
      5,
      15
    );

    const event = mockLogger.logs[0]!.event;
    expect(event.userAgent?.length || 0).toBeLessThanOrEqual(200);
  });

  it('handles unknown IP gracefully', () => {
    const mockLogger = new MockLogger();
    const auditLogger = createAuthAuditLogger(mockLogger);

    const request = createMockRequest({
      ip: undefined,
    } as any);

    auditLogger.logTokenExchangeSuccess(
      request,
      'user123',
      AuthProvider.CLERK,
      'test@example.com',
      5,
      15
    );

    const event = mockLogger.logs[0]!.event;
    expect(event.ip).toBe('unknown');
  });

  it('structured log format is consistent', () => {
    const mockLogger = new MockLogger();
    const auditLogger = createAuthAuditLogger(mockLogger);
    const request = createMockRequest();

    // Test all event types have consistent base structure
    auditLogger.logTokenExchangeSuccess(
      request,
      'user123',
      AuthProvider.CLERK,
      'test@example.com',
      5,
      15
    );
    auditLogger.logTokenExchangeFailure(
      request,
      'test error',
      'TEST_ERROR',
      AuthProvider.AUTH0
    );
    auditLogger.logRateLimitExceeded(request, 10, 300, 900000, 10, 'user123');

    for (const logEntry of mockLogger.logs) {
      const event = logEntry.event;

      // All events should have these base fields
      expect(event.timestamp).toBeDefined();
      expect(event.level).toBeDefined();
      expect(event.event).toBeDefined();
      expect(event.ip).toBeDefined();
      expect(event.metadata).toBeDefined();

      // Timestamp should be valid ISO string
      expect(new Date(event.timestamp).getTime()).toBeGreaterThan(0);
    }
  });
});
