import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { randomBytes } from 'node:crypto';

// Direct import to ensure mutation coverage
import envPlugin from '../../src/plugins/env.js';

describe('Environment Plugin Direct Tests', () => {
  const validApiKey = 'sk-test1234567890abcdef';

  it('should successfully register with valid environment', async () => {
    const app = Fastify({ logger: false });
    // Ensure clean environment
    const env = {
      NODE_ENV: 'test',
      PORT: '3001',
      LOG_LEVEL: 'info',
      OPENAI_API_KEY: validApiKey,
      JWT_SECRET: randomBytes(32).toString('hex'),
      ALLOWED_ORIGIN: 'http://localhost:5173',
      SYSTEM_PROMPT: 'Test prompt',
      RATE_LIMIT_MAX: '100',
      RATE_LIMIT_TIME_WINDOW: '60000',
    };

    // Temporarily override process.env
    const originalEnv = process.env;
    process.env = { ...originalEnv, ...env };

    try {
      await app.register(envPlugin);
      await app.ready();

      // Verify config was set
      expect(app.config).toBeDefined();
      expect(app.config?.NODE_ENV).toBe('test');
      expect(app.config?.PORT).toBe(3001);
      expect(app.config?.OPENAI_API_KEY).toBe(validApiKey);
      expect(app.config?.JWT_SECRET).toBeDefined();
      expect(app.config?.ALLOWED_ORIGIN).toEqual(['http://localhost:5173']);
      expect(app.config?.SYSTEM_PROMPT).toBe('Test prompt');
      expect(app.config?.RATE_LIMIT_MAX).toBe(100);
      expect(app.config?.RATE_LIMIT_TIME_WINDOW).toBe(60000);
    } finally {
      process.env = originalEnv;
      await app.close();
    }
  });

  it('should provide config after successful registration', async () => {
    const app = Fastify({ logger: false });
    // Test with valid environment to exercise the success path
    const env = {
      NODE_ENV: 'development',
      PORT: '3000',
      LOG_LEVEL: 'info',
      OPENAI_API_KEY: validApiKey,
      // JWT_SECRET will be auto-generated in development
    };

    const originalEnv = process.env;
    process.env = { ...originalEnv, ...env };

    try {
      await app.register(envPlugin);
      await app.ready();

      // Exercise config access paths
      expect(app.config).toBeDefined();
      expect(app.config?.NODE_ENV).toBe('development');
      expect(app.config?.PORT).toBe(3000);
      expect(app.config?.LOG_LEVEL).toBe('info');
      expect(app.config?.OPENAI_API_KEY).toBe(validApiKey);
      expect(app.config?.JWT_SECRET).toBeDefined(); // Auto-generated
      expect(app.config?.ALLOWED_ORIGIN).toEqual(['http://localhost:5173']);
    } finally {
      process.env = originalEnv;
      await app.close();
    }
  });

  it('should use default values when env vars not set', async () => {
    const app = Fastify({ logger: false });
    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      NODE_ENV: 'development', // Set explicitly for JWT auto-generation
      OPENAI_API_KEY: validApiKey, // Required
    };

    // Remove optional env vars to test defaults
    delete process.env['PORT'];
    delete process.env['LOG_LEVEL'];
    delete process.env['JWT_SECRET'];
    delete process.env['ALLOWED_ORIGIN'];
    delete process.env['SYSTEM_PROMPT'];
    delete process.env['RATE_LIMIT_MAX'];
    delete process.env['RATE_LIMIT_TIME_WINDOW'];

    try {
      await app.register(envPlugin);
      await app.ready();

      // Check defaults are applied
      expect(app.config).toBeDefined();
      expect(app.config?.NODE_ENV).toBe('development');
      expect(app.config?.PORT).toBe(3000);
      expect(app.config?.LOG_LEVEL).toBe('info');
      expect(app.config?.JWT_SECRET).toBeDefined(); // Auto-generated in dev
      expect(app.config?.ALLOWED_ORIGIN).toEqual(['http://localhost:5173']);
      expect(app.config?.SYSTEM_PROMPT).toBe('');
      expect(app.config?.RATE_LIMIT_MAX).toBe(60);
      expect(app.config?.RATE_LIMIT_TIME_WINDOW).toBe(60000);
    } finally {
      process.env = originalEnv;
      await app.close();
    }
  });

  it('should accept all valid NODE_ENV values', async () => {
    const originalEnv = process.env;
    const validValues = ['development', 'production', 'test'];

    for (const value of validValues) {
      const testApp = Fastify({ logger: false });
      process.env = {
        ...originalEnv,
        NODE_ENV: value,
        OPENAI_API_KEY: validApiKey,
        // Provide JWT_SECRET for production and test, let development auto-generate
        ...(value !== 'development' && {
          JWT_SECRET: randomBytes(32).toString('hex'),
        }),
      };

      try {
        await testApp.register(envPlugin);
        await testApp.ready();
        expect(testApp.config).toBeDefined();
        expect(testApp.config?.NODE_ENV).toBe(value);
      } finally {
        await testApp.close();
      }
    }

    process.env = originalEnv;
  });

  it('should handle production environment correctly', async () => {
    const app = Fastify({ logger: false });
    const jwtSecret = randomBytes(32).toString('hex');
    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      PORT: '8080',
      LOG_LEVEL: 'warn',
      OPENAI_API_KEY: validApiKey,
      JWT_SECRET: jwtSecret, // Required in production
      ALLOWED_ORIGIN: 'https://example.com,https://app.example.com',
    };

    try {
      await app.register(envPlugin);
      await app.ready();

      expect(app.config).toBeDefined();
      expect(app.config?.NODE_ENV).toBe('production');
      expect(app.config?.PORT).toBe(8080);
      expect(app.config?.LOG_LEVEL).toBe('warn');
      expect(app.config?.JWT_SECRET).toBe(jwtSecret);
      expect(app.config?.ALLOWED_ORIGIN).toEqual([
        'https://example.com',
        'https://app.example.com',
      ]);
    } finally {
      process.env = originalEnv;
      await app.close();
    }
  });

  it('should auto-generate JWT_SECRET in development mode', async () => {
    const app = Fastify({ logger: false });
    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      NODE_ENV: 'development',
      OPENAI_API_KEY: validApiKey,
      // No JWT_SECRET provided
    };
    delete process.env['JWT_SECRET'];

    try {
      await app.register(envPlugin);
      await app.ready();

      expect(app.config).toBeDefined();
      expect(app.config?.JWT_SECRET).toBeDefined();
      expect(app.config?.JWT_SECRET?.length).toBeGreaterThanOrEqual(64); // 32 bytes hex = 64 chars
    } finally {
      process.env = originalEnv;
      await app.close();
    }
  });

  it('should require JWT_SECRET in production mode', async () => {
    const app = Fastify({ logger: false });
    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      OPENAI_API_KEY: validApiKey,
      // No JWT_SECRET provided
    };
    delete process.env['JWT_SECRET'];

    await expect(app.register(envPlugin).ready()).rejects.toThrow(
      'JWT_SECRET is required in production. Generate one with: openssl rand -hex 32'
    );

    process.env = originalEnv;
  });

  it('should parse comma-separated allowed origins', async () => {
    const app = Fastify({ logger: false });
    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      OPENAI_API_KEY: validApiKey,
      ALLOWED_ORIGIN:
        'https://example.com, http://localhost:3000, https://app.example.com',
    };

    try {
      await app.register(envPlugin);
      await app.ready();

      expect(app.config?.ALLOWED_ORIGIN).toEqual([
        'https://example.com',
        'http://localhost:3000',
        'https://app.example.com',
      ]);
    } finally {
      process.env = originalEnv;
      await app.close();
    }
  });

  it('should validate OPENAI_API_KEY format', async () => {
    const app = Fastify({ logger: false });
    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      OPENAI_API_KEY: 'invalid-key-format',
    };

    await expect(app.register(envPlugin).ready()).rejects.toThrow(
      'OPENAI_API_KEY'
    );

    process.env = originalEnv;
  });

  it('should redact sensitive configuration values in logs', async () => {
    // Create a logger that captures output
    const logs: any[] = [];
    const stream = {
      write(msg: string) {
        logs.push(JSON.parse(msg));
      },
    };

    const app = Fastify({
      logger: {
        level: 'info',
        stream,
      },
    });
    const jwtSecret = randomBytes(32).toString('hex');
    const originalEnv = process.env;

    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      OPENAI_API_KEY: validApiKey,
      JWT_SECRET: jwtSecret,
    };

    try {
      await app.register(envPlugin);
      await app.ready();

      // Find the log entry with config
      const configLog = logs.find(
        log => log.msg === 'Environment configuration loaded' && log.config
      );

      expect(configLog).toBeDefined();
      expect(configLog.config.OPENAI_API_KEY).toBe('[REDACTED]');
      expect(configLog.config.JWT_SECRET).toBe('[REDACTED]');
      expect(configLog.config.NODE_ENV).toBe('test'); // Non-sensitive should not be redacted
      expect(configLog.config.PORT).toBe(3000); // Non-sensitive should not be redacted
    } finally {
      process.env = originalEnv;
      await app.close();
    }
  });

  it('should validate ALLOWED_ORIGIN contains valid URLs', async () => {
    const originalEnv = process.env;

    const invalidOrigins = [
      'not-a-url',
      'ftp://invalid-protocol.com',
      'javascript:alert(1)',
      'file:///etc/passwd',
      'http://,https://example.com', // Empty origin
      'http://example.com, , https://app.com', // Contains empty
    ];

    for (const invalidOrigin of invalidOrigins) {
      const app = Fastify({ logger: false });
      process.env = {
        ...originalEnv,
        OPENAI_API_KEY: validApiKey,
        ALLOWED_ORIGIN: invalidOrigin,
      };

      await expect(app.register(envPlugin).ready()).rejects.toThrow(
        /ALLOWED_ORIGIN.*valid HTTP\(S\) URLs/
      );

      await app.close();
    }

    process.env = originalEnv;
  });

  it('should validate JWT_SECRET minimum length', async () => {
    const app = Fastify({ logger: false });
    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test', // Not development, so no auto-generation
      OPENAI_API_KEY: validApiKey,
      JWT_SECRET: 'too-short-secret', // Less than 32 characters
    };

    await expect(app.register(envPlugin).ready()).rejects.toThrow(
      /JWT_SECRET.*at least 32 characters/
    );

    process.env = originalEnv;
  });

  it('should validate PORT is within valid range', async () => {
    const originalEnv = process.env;

    const invalidPorts = ['0', '65536', '-1', '99999', 'abc', '12.34'];

    for (const invalidPort of invalidPorts) {
      const app = Fastify({ logger: false });
      process.env = {
        ...originalEnv,
        OPENAI_API_KEY: validApiKey,
        PORT: invalidPort,
      };

      await expect(app.register(envPlugin).ready()).rejects.toThrow();
      await app.close();
    }

    process.env = originalEnv;
  });

  it('should validate RATE_LIMIT_MAX is positive integer', async () => {
    const originalEnv = process.env;

    const invalidValues = ['0', '-1', 'abc', '12.34', ''];

    for (const invalidValue of invalidValues) {
      const app = Fastify({ logger: false });
      process.env = {
        ...originalEnv,
        OPENAI_API_KEY: validApiKey,
        RATE_LIMIT_MAX: invalidValue,
      };

      await expect(app.register(envPlugin).ready()).rejects.toThrow();
      await app.close();
    }

    process.env = originalEnv;
  });

  it('should validate RATE_LIMIT_TIME_WINDOW is positive integer', async () => {
    const originalEnv = process.env;

    const invalidValues = ['0', '-1000', 'abc', '12.34', ''];

    for (const invalidValue of invalidValues) {
      const app = Fastify({ logger: false });
      process.env = {
        ...originalEnv,
        OPENAI_API_KEY: validApiKey,
        RATE_LIMIT_TIME_WINDOW: invalidValue,
      };

      await expect(app.register(envPlugin).ready()).rejects.toThrow();
      await app.close();
    }

    process.env = originalEnv;
  });

  it('should reject empty values for required fields', async () => {
    const originalEnv = process.env;

    // Test empty OPENAI_API_KEY
    const app1 = Fastify({ logger: false });
    process.env = {
      ...originalEnv,
      OPENAI_API_KEY: '',
    };

    await expect(app1.register(envPlugin).ready()).rejects.toThrow(
      /OPENAI_API_KEY.*empty/
    );
    await app1.close();

    // Test empty ALLOWED_ORIGIN
    const app2 = Fastify({ logger: false });
    process.env = {
      ...originalEnv,
      OPENAI_API_KEY: validApiKey,
      ALLOWED_ORIGIN: '',
    };

    await expect(app2.register(envPlugin).ready()).rejects.toThrow(
      /ALLOWED_ORIGIN.*empty/
    );
    await app2.close();

    process.env = originalEnv;
  });

  it('should provide detailed validation error messages', async () => {
    const app = Fastify({ logger: false });
    const originalEnv = process.env;

    process.env = {
      ...originalEnv,
      NODE_ENV: 'invalid-env',
      PORT: 'not-a-number',
      OPENAI_API_KEY: 'wrong-format',
      JWT_SECRET: 'short',
      ALLOWED_ORIGIN: 'not-a-url',
      RATE_LIMIT_MAX: '-10',
    };

    try {
      await app.register(envPlugin).ready();
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      // Verify error contains information about multiple validation failures
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      expect(errorMessage).toContain('NODE_ENV');
      expect(errorMessage).toContain('PORT');
      expect(errorMessage).toContain('OPENAI_API_KEY');
      expect(errorMessage).toContain('JWT_SECRET');
      expect(errorMessage).toContain('ALLOWED_ORIGIN');
      expect(errorMessage).toContain('RATE_LIMIT_MAX');
    }

    process.env = originalEnv;
  });

  it('should handle JWT_SECRET auto-generation with proper logging', async () => {
    // Create a logger that captures output
    const logs: any[] = [];
    const stream = {
      write(msg: string) {
        logs.push(JSON.parse(msg));
      },
    };

    const app = Fastify({
      logger: {
        level: 'warn', // Set to warn to capture warning
        stream,
      },
    });
    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      NODE_ENV: 'development',
      OPENAI_API_KEY: validApiKey,
      // No JWT_SECRET
    };
    delete process.env['JWT_SECRET'];

    try {
      await app.register(envPlugin);
      await app.ready();

      // Find the warning log about auto-generation
      // Pino uses numeric levels: 30 = warn
      const warningLog = logs.find(
        log => log.msg && log.msg.includes('JWT_SECRET not provided')
      );

      expect(warningLog).toBeDefined();
      expect(warningLog.JWT_SECRET).toBe('[REDACTED - auto-generated]');
      expect(warningLog.msg).toContain('development use only');
      expect(warningLog.msg).toContain('stable tokens across restarts');
    } finally {
      process.env = originalEnv;
      await app.close();
    }
  });

  it('should generate cryptographically secure JWT_SECRET', async () => {
    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      NODE_ENV: 'development',
      OPENAI_API_KEY: validApiKey,
      // No JWT_SECRET provided
    };
    delete process.env['JWT_SECRET'];

    // Create two separate apps to test uniqueness
    const app1 = Fastify({ logger: false });
    const app2 = Fastify({ logger: false });

    try {
      await app1.register(envPlugin);
      await app1.ready();
      await app2.register(envPlugin);
      await app2.ready();

      // Both should have JWT_SECRET
      expect(app1.config?.JWT_SECRET).toBeDefined();
      expect(app2.config?.JWT_SECRET).toBeDefined();

      // They should be different (cryptographically secure random)
      expect(app1.config?.JWT_SECRET).not.toBe(app2.config?.JWT_SECRET);

      // They should be the correct length (32 bytes = 64 hex chars)
      expect(app1.config?.JWT_SECRET?.length).toBe(64);
      expect(app2.config?.JWT_SECRET?.length).toBe(64);
    } finally {
      process.env = originalEnv;
      await app1.close();
      await app2.close();
    }
  });

  it('should accept valid edge case values', async () => {
    const app = Fastify({ logger: false });
    const originalEnv = process.env;

    process.env = {
      NODE_ENV: 'test',
      PORT: '1', // Minimum valid port
      LOG_LEVEL: 'info',
      OPENAI_API_KEY: validApiKey,
      JWT_SECRET: 'a'.repeat(32), // Exactly 32 chars
      ALLOWED_ORIGIN: 'http://localhost', // No port
      RATE_LIMIT_MAX: '1', // Minimum as string (will be coerced)
      RATE_LIMIT_TIME_WINDOW: '1000', // Minimum (1 second) as string
      SYSTEM_PROMPT: '', // Empty is valid
    };

    try {
      await app.register(envPlugin);
      await app.ready();

      expect(app.config).toBeDefined();
      expect(app.config?.PORT).toBe(1);
      expect(app.config?.JWT_SECRET).toBe('a'.repeat(32));
      expect(app.config?.RATE_LIMIT_MAX).toBe(1);
      expect(app.config?.RATE_LIMIT_TIME_WINDOW).toBe(1000);
    } finally {
      process.env = originalEnv;
      await app.close();
    }

    // Test maximum valid port
    process.env = {
      NODE_ENV: 'test',
      PORT: '65535', // Maximum valid port
      LOG_LEVEL: 'info',
      OPENAI_API_KEY: validApiKey,
      JWT_SECRET: 'b'.repeat(32),
      ALLOWED_ORIGIN: 'http://localhost:5173',
      RATE_LIMIT_MAX: '60',
      RATE_LIMIT_TIME_WINDOW: '100000',
      SYSTEM_PROMPT: '',
    };

    const app2 = Fastify({ logger: false });
    try {
      await app2.register(envPlugin);
      await app2.ready();
      expect(app2.config?.PORT).toBe(65535);
    } finally {
      process.env = originalEnv;
      await app2.close();
    }
  });
});
