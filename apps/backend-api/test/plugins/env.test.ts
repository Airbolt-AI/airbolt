import { describe, it, expect } from 'vitest';
import { z, ZodError } from 'zod';
import { randomBytes } from 'node:crypto';

// Import the schema directly for unit testing
// This tests the validation logic without the Fastify plugin overhead
const EnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'], {
      errorMap: () => ({
        message: 'NODE_ENV must be one of: development, production, test',
      }),
    })
    .default('development'),
  PORT: z
    .string({
      required_error: 'PORT environment variable is required',
      invalid_type_error: 'PORT must be a string',
    })
    .regex(/^\d+$/, 'PORT must contain only numeric characters')
    .transform(Number)
    .refine(n => n > 0 && n < 65536, 'PORT must be between 1-65535')
    .default('3000'),
  HOST: z
    .string({
      invalid_type_error: 'HOST must be a string',
    })
    .min(1, 'HOST cannot be empty')
    .default('localhost'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'], {
      errorMap: () => ({
        message:
          'LOG_LEVEL must be one of: fatal, error, warn, info, debug, trace',
      }),
    })
    .default('info'),

  // MVP-specific environment variables
  OPENAI_API_KEY: z
    .string({
      required_error: 'OPENAI_API_KEY is required for AI functionality',
      invalid_type_error: 'OPENAI_API_KEY must be a string',
    })
    .min(1, 'OPENAI_API_KEY cannot be empty')
    .regex(
      /^sk-[A-Za-z0-9_-]+$/,
      'OPENAI_API_KEY must be a valid OpenAI API key format (sk-...)'
    ),

  JWT_SECRET: z
    .string({
      invalid_type_error: 'JWT_SECRET must be a string',
    })
    .min(32, 'JWT_SECRET must be at least 32 characters for security')
    .optional(),

  ALLOWED_ORIGIN: z
    .string({
      required_error: 'ALLOWED_ORIGIN is required for CORS configuration',
      invalid_type_error: 'ALLOWED_ORIGIN must be a string',
    })
    .min(1, 'ALLOWED_ORIGIN cannot be empty')
    .default('http://localhost:5173')
    .transform(origins => {
      // Support comma-separated origins and trim whitespace
      return origins.split(',').map(origin => origin.trim());
    })
    .refine(
      origins =>
        origins.every(origin => {
          try {
            // Validate each origin is a valid URL
            const url = new URL(origin);
            return url.protocol === 'http:' || url.protocol === 'https:';
          } catch {
            return false;
          }
        }),
      'ALLOWED_ORIGIN must contain valid HTTP(S) URLs (comma-separated if multiple)'
    ),

  SYSTEM_PROMPT: z
    .string({
      invalid_type_error: 'SYSTEM_PROMPT must be a string',
    })
    .optional()
    .default(''),

  RATE_LIMIT_MAX: z
    .string({
      invalid_type_error: 'RATE_LIMIT_MAX must be a string',
    })
    .regex(/^\d+$/, 'RATE_LIMIT_MAX must be a positive integer')
    .transform(Number)
    .refine(n => n > 0, 'RATE_LIMIT_MAX must be greater than 0')
    .default('60'),

  RATE_LIMIT_TIME_WINDOW: z
    .string({
      invalid_type_error: 'RATE_LIMIT_TIME_WINDOW must be a string',
    })
    .regex(
      /^\d+$/,
      'RATE_LIMIT_TIME_WINDOW must be a positive integer (milliseconds)'
    )
    .transform(Number)
    .refine(n => n > 0, 'RATE_LIMIT_TIME_WINDOW must be greater than 0')
    .default('60000'), // 1 minute default
}).refine(
  data => data.NODE_ENV !== 'production' || data.JWT_SECRET,
  {
    message:
      'JWT_SECRET is required in production. Generate one with: openssl rand -hex 32',
    path: ['JWT_SECRET'],
  }
);

describe('Environment Schema Validation', () => {
  const validApiKey = 'sk-test1234567890abcdef';

  describe('Valid configurations', () => {
    it('should parse with default values and required OPENAI_API_KEY', () => {
      const result = EnvSchema.parse({
        OPENAI_API_KEY: validApiKey,
      });
      expect(result.NODE_ENV).toBe('development');
      expect(result.PORT).toBe(3000);
      expect(result.HOST).toBe('localhost');
      expect(result.LOG_LEVEL).toBe('info');
      expect(result.ALLOWED_ORIGIN).toEqual(['http://localhost:5173']);
      expect(result.SYSTEM_PROMPT).toBe('');
      expect(result.RATE_LIMIT_MAX).toBe(60);
      expect(result.RATE_LIMIT_TIME_WINDOW).toBe(60000);
    });

    it('should parse custom PORT value', () => {
      const result = EnvSchema.parse({
        OPENAI_API_KEY: validApiKey,
        PORT: '8080',
      });
      expect(result.PORT).toBe(8080);
    });

    it('should accept valid NODE_ENV values', () => {
      const result = EnvSchema.parse({
        OPENAI_API_KEY: validApiKey,
        NODE_ENV: 'production',
        JWT_SECRET: 'a'.repeat(32), // Required in production
      });
      expect(result.NODE_ENV).toBe('production');
    });
  });

  describe('PORT validation', () => {
    it('should reject non-numeric PORT', () => {
      expect(() =>
        EnvSchema.parse({
          OPENAI_API_KEY: validApiKey,
          PORT: 'invalid',
        })
      ).toThrow();
    });

    it('should reject PORT with letters', () => {
      expect(() =>
        EnvSchema.parse({
          OPENAI_API_KEY: validApiKey,
          PORT: '80a0',
        })
      ).toThrow();
    });

    it('should reject PORT = 0', () => {
      expect(() =>
        EnvSchema.parse({
          OPENAI_API_KEY: validApiKey,
          PORT: '0',
        })
      ).toThrow();
    });

    it('should reject PORT > 65535', () => {
      expect(() =>
        EnvSchema.parse({
          OPENAI_API_KEY: validApiKey,
          PORT: '65536',
        })
      ).toThrow();
    });

    it('should accept PORT = 1', () => {
      const result = EnvSchema.parse({
        OPENAI_API_KEY: validApiKey,
        PORT: '1',
      });
      expect(result.PORT).toBe(1);
    });

    it('should accept PORT = 65535', () => {
      const result = EnvSchema.parse({
        OPENAI_API_KEY: validApiKey,
        PORT: '65535',
      });
      expect(result.PORT).toBe(65535);
    });
  });

  describe('NODE_ENV validation', () => {
    it('should reject invalid NODE_ENV', () => {
      expect(() =>
        EnvSchema.parse({
          OPENAI_API_KEY: validApiKey,
          NODE_ENV: 'invalid',
        })
      ).toThrow();
    });

    it('should accept test environment', () => {
      const result = EnvSchema.parse({
        OPENAI_API_KEY: validApiKey,
        NODE_ENV: 'test',
      });
      expect(result.NODE_ENV).toBe('test');
    });
  });

  describe('LOG_LEVEL validation', () => {
    it('should reject invalid LOG_LEVEL', () => {
      expect(() =>
        EnvSchema.parse({
          OPENAI_API_KEY: validApiKey,
          LOG_LEVEL: 'invalid',
        })
      ).toThrow();
    });

    it('should accept all valid log levels', () => {
      const levels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'];

      for (const level of levels) {
        const result = EnvSchema.parse({
          OPENAI_API_KEY: validApiKey,
          LOG_LEVEL: level,
        });
        expect(result.LOG_LEVEL).toBe(level);
      }
    });
  });

  describe('HOST validation', () => {
    it('should reject empty HOST', () => {
      expect(() =>
        EnvSchema.parse({
          OPENAI_API_KEY: validApiKey,
          HOST: '',
        })
      ).toThrow();
    });

    it('should accept custom HOST', () => {
      const result = EnvSchema.parse({
        OPENAI_API_KEY: validApiKey,
        HOST: '0.0.0.0',
      });
      expect(result.HOST).toBe('0.0.0.0');
    });
  });

  describe('OPENAI_API_KEY validation', () => {
    it('should require OPENAI_API_KEY', () => {
      expect(() => EnvSchema.parse({})).toThrow('OPENAI_API_KEY is required');
    });

    it('should reject empty OPENAI_API_KEY', () => {
      expect(() => EnvSchema.parse({ OPENAI_API_KEY: '' })).toThrow();
    });

    it('should reject invalid OPENAI_API_KEY format', () => {
      expect(() =>
        EnvSchema.parse({ OPENAI_API_KEY: 'invalid-key' })
      ).toThrow();
      expect(() => EnvSchema.parse({ OPENAI_API_KEY: 'sk_invalid' })).toThrow();
      expect(() => EnvSchema.parse({ OPENAI_API_KEY: 'sk-' })).toThrow();
    });

    it('should accept valid OPENAI_API_KEY formats', () => {
      const validKeys = [
        'sk-abc123',
        'sk-ABC123',
        'sk-aBc123_XYZ-789',
        'sk-1234567890abcdefghijklmnopqrstuvwxyz',
      ];

      for (const key of validKeys) {
        const result = EnvSchema.parse({ OPENAI_API_KEY: key });
        expect(result.OPENAI_API_KEY).toBe(key);
      }
    });
  });

  describe('JWT_SECRET validation', () => {
    it('should accept missing JWT_SECRET in development', () => {
      const result = EnvSchema.parse({
        OPENAI_API_KEY: validApiKey,
        NODE_ENV: 'development',
      });
      expect(result.JWT_SECRET).toBeUndefined();
    });

    it('should require JWT_SECRET in production', () => {
      expect(() =>
        EnvSchema.parse({
          OPENAI_API_KEY: validApiKey,
          NODE_ENV: 'production',
          // No JWT_SECRET provided
        })
      ).toThrow('JWT_SECRET is required in production. Generate one with: openssl rand -hex 32');
    });

    it('should reject JWT_SECRET shorter than 32 characters', () => {
      expect(() =>
        EnvSchema.parse({
          OPENAI_API_KEY: validApiKey,
          JWT_SECRET: 'too-short',
        })
      ).toThrow('JWT_SECRET must be at least 32 characters');
    });

    it('should accept valid JWT_SECRET', () => {
      const validSecret = randomBytes(32).toString('hex');
      const result = EnvSchema.parse({
        OPENAI_API_KEY: validApiKey,
        JWT_SECRET: validSecret,
      });
      expect(result.JWT_SECRET).toBe(validSecret);
    });
  });

  describe('ALLOWED_ORIGIN validation', () => {
    it('should use default localhost origin', () => {
      const result = EnvSchema.parse({
        OPENAI_API_KEY: validApiKey,
      });
      expect(result.ALLOWED_ORIGIN).toEqual(['http://localhost:5173']);
    });

    it('should parse single origin', () => {
      const result = EnvSchema.parse({
        OPENAI_API_KEY: validApiKey,
        ALLOWED_ORIGIN: 'https://example.com',
      });
      expect(result.ALLOWED_ORIGIN).toEqual(['https://example.com']);
    });

    it('should parse comma-separated origins', () => {
      const result = EnvSchema.parse({
        OPENAI_API_KEY: validApiKey,
        ALLOWED_ORIGIN:
          'https://example.com, http://localhost:3000, https://app.example.com',
      });
      expect(result.ALLOWED_ORIGIN).toEqual([
        'https://example.com',
        'http://localhost:3000',
        'https://app.example.com',
      ]);
    });

    it('should trim whitespace from origins', () => {
      const result = EnvSchema.parse({
        OPENAI_API_KEY: validApiKey,
        ALLOWED_ORIGIN: '  https://example.com  ,  http://localhost:3000  ',
      });
      expect(result.ALLOWED_ORIGIN).toEqual([
        'https://example.com',
        'http://localhost:3000',
      ]);
    });

    it('should reject invalid URLs', () => {
      expect(() =>
        EnvSchema.parse({
          OPENAI_API_KEY: validApiKey,
          ALLOWED_ORIGIN: 'not-a-url',
        })
      ).toThrow('valid HTTP(S) URLs');
    });

    it('should reject non-HTTP(S) protocols', () => {
      expect(() =>
        EnvSchema.parse({
          OPENAI_API_KEY: validApiKey,
          ALLOWED_ORIGIN: 'ftp://example.com',
        })
      ).toThrow('valid HTTP(S) URLs');
    });
  });

  describe('SYSTEM_PROMPT validation', () => {
    it('should default to empty string', () => {
      const result = EnvSchema.parse({
        OPENAI_API_KEY: validApiKey,
      });
      expect(result.SYSTEM_PROMPT).toBe('');
    });

    it('should accept custom system prompt', () => {
      const result = EnvSchema.parse({
        OPENAI_API_KEY: validApiKey,
        SYSTEM_PROMPT: 'You are a helpful assistant.',
      });
      expect(result.SYSTEM_PROMPT).toBe('You are a helpful assistant.');
    });
  });

  describe('RATE_LIMIT_MAX validation', () => {
    it('should default to 60', () => {
      const result = EnvSchema.parse({
        OPENAI_API_KEY: validApiKey,
      });
      expect(result.RATE_LIMIT_MAX).toBe(60);
    });

    it('should accept custom rate limit', () => {
      const result = EnvSchema.parse({
        OPENAI_API_KEY: validApiKey,
        RATE_LIMIT_MAX: '120',
      });
      expect(result.RATE_LIMIT_MAX).toBe(120);
    });

    it('should reject non-numeric values', () => {
      expect(() =>
        EnvSchema.parse({
          OPENAI_API_KEY: validApiKey,
          RATE_LIMIT_MAX: 'abc',
        })
      ).toThrow('positive integer');
    });

    it('should reject zero or negative values', () => {
      expect(() =>
        EnvSchema.parse({
          OPENAI_API_KEY: validApiKey,
          RATE_LIMIT_MAX: '0',
        })
      ).toThrow('greater than 0');
    });
  });

  describe('RATE_LIMIT_TIME_WINDOW validation', () => {
    it('should default to 60000 (1 minute)', () => {
      const result = EnvSchema.parse({
        OPENAI_API_KEY: validApiKey,
      });
      expect(result.RATE_LIMIT_TIME_WINDOW).toBe(60000);
    });

    it('should accept custom time window', () => {
      const result = EnvSchema.parse({
        OPENAI_API_KEY: validApiKey,
        RATE_LIMIT_TIME_WINDOW: '60000',
      });
      expect(result.RATE_LIMIT_TIME_WINDOW).toBe(60000);
    });

    it('should reject non-numeric values', () => {
      expect(() =>
        EnvSchema.parse({
          OPENAI_API_KEY: validApiKey,
          RATE_LIMIT_TIME_WINDOW: '1min',
        })
      ).toThrow('positive integer');
    });
  });

  describe('Error message content', () => {
    it('should contain field names in error messages', () => {
      try {
        EnvSchema.parse({
          OPENAI_API_KEY: validApiKey,
          PORT: 'invalid',
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ZodError);
        if (error instanceof ZodError) {
          expect(error.errors[0]?.path).toContain('PORT');
        }
      }
    });

    it('should format validation errors properly for multiple fields', () => {
      try {
        EnvSchema.parse({
          NODE_ENV: 'invalid',
          PORT: 'also-invalid',
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ZodError);
        if (error instanceof ZodError) {
          expect(error.errors.length).toBeGreaterThan(0);
          // Should have errors for missing OPENAI_API_KEY, invalid NODE_ENV, and invalid PORT
          expect(
            error.errors.some((e: any) => e.path.includes('OPENAI_API_KEY'))
          ).toBe(true);
          expect(
            error.errors.some((e: any) => e.path.includes('NODE_ENV'))
          ).toBe(true);
          expect(error.errors.some((e: any) => e.path.includes('PORT'))).toBe(
            true
          );
        }
      }
    });
  });
});
