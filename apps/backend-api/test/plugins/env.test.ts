import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import { randomBytes } from 'node:crypto';
import { EnvSchema } from '../../src/plugins/env.js';

describe('Environment Schema Validation', () => {
  const validApiKey = 'sk-test1234567890abcdef';

  describe('Valid configurations', () => {
    it('should parse with default values and required OPENAI_API_KEY', () => {
      const originalEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'development';

      try {
        const result = EnvSchema.parse({
          OPENAI_API_KEY: validApiKey,
        });
        expect(result.NODE_ENV).toBe('development');
        expect(result.PORT).toBe(3000);
        expect(result.LOG_LEVEL).toBe('info');
        expect(result.ALLOWED_ORIGIN).toEqual(['*']);
        expect(result.SYSTEM_PROMPT).toBe('');
        expect(result.RATE_LIMIT_MAX).toBe(60);
        expect(result.RATE_LIMIT_TIME_WINDOW).toBe(60000);
        expect(result.JWT_SECRET).toBeDefined();
        expect(result.JWT_SECRET!.length).toBeGreaterThanOrEqual(64);
      } finally {
        if (originalEnv !== undefined) {
          process.env['NODE_ENV'] = originalEnv;
        } else {
          delete process.env['NODE_ENV'];
        }
      }
    });

    it('should parse custom PORT value', () => {
      const result = EnvSchema.parse({
        OPENAI_API_KEY: validApiKey,
        PORT: 8080,
        JWT_SECRET: randomBytes(32).toString('hex'),
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
          JWT_SECRET: randomBytes(32).toString('hex'),
        })
      ).toThrow();
    });

    it('should reject PORT with letters', () => {
      expect(() =>
        EnvSchema.parse({
          OPENAI_API_KEY: validApiKey,
          PORT: '80a0',
          JWT_SECRET: randomBytes(32).toString('hex'),
        })
      ).toThrow();
    });

    it('should reject PORT = 0', () => {
      expect(() =>
        EnvSchema.parse({
          OPENAI_API_KEY: validApiKey,
          PORT: '0',
          JWT_SECRET: randomBytes(32).toString('hex'),
        })
      ).toThrow();
    });

    it('should reject PORT > 65535', () => {
      expect(() =>
        EnvSchema.parse({
          OPENAI_API_KEY: validApiKey,
          PORT: '65536',
          JWT_SECRET: randomBytes(32).toString('hex'),
        })
      ).toThrow();
    });

    it('should accept PORT = 1', () => {
      const result = EnvSchema.parse({
        OPENAI_API_KEY: validApiKey,
        PORT: 1,
        JWT_SECRET: randomBytes(32).toString('hex'),
      });
      expect(result.PORT).toBe(1);
    });

    it('should accept PORT = 65535', () => {
      const result = EnvSchema.parse({
        OPENAI_API_KEY: validApiKey,
        PORT: 65535,
        JWT_SECRET: randomBytes(32).toString('hex'),
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
          JWT_SECRET: randomBytes(32).toString('hex'),
        })
      ).toThrow();
    });

    it('should accept test environment', () => {
      const result = EnvSchema.parse({
        OPENAI_API_KEY: validApiKey,
        NODE_ENV: 'test',
        JWT_SECRET: randomBytes(32).toString('hex'),
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
          JWT_SECRET: randomBytes(32).toString('hex'),
        })
      ).toThrow();
    });

    it('should accept all valid log levels', () => {
      const levels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'];
      const jwtSecret = randomBytes(32).toString('hex');

      for (const level of levels) {
        const result = EnvSchema.parse({
          OPENAI_API_KEY: validApiKey,
          LOG_LEVEL: level,
          JWT_SECRET: jwtSecret,
        });
        expect(result.LOG_LEVEL).toBe(level);
      }
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
      const jwtSecret = randomBytes(32).toString('hex');

      for (const key of validKeys) {
        const result = EnvSchema.parse({
          OPENAI_API_KEY: key,
          JWT_SECRET: jwtSecret,
        });
        expect(result.OPENAI_API_KEY).toBe(key);
      }
    });
  });

  describe('JWT_SECRET validation', () => {
    describe('auto-generation in non-production', () => {
      it('should auto-generate JWT_SECRET in development', () => {
        const result = EnvSchema.parse({
          OPENAI_API_KEY: validApiKey,
          NODE_ENV: 'development',
        });

        expect(result.JWT_SECRET).toBeDefined();
        expect(result.JWT_SECRET).toMatch(/^[a-f0-9]{64}$/);
      });

      it('should auto-generate JWT_SECRET when NODE_ENV is undefined', () => {
        const result = EnvSchema.parse({
          OPENAI_API_KEY: validApiKey,
          // NODE_ENV will default to 'development'
        });

        expect(result.JWT_SECRET).toBeDefined();
        expect(result.JWT_SECRET).toMatch(/^[a-f0-9]{64}$/);
        expect(result.NODE_ENV).toBe('development');
      });

      it('should auto-generate JWT_SECRET in test environment', () => {
        const result = EnvSchema.parse({
          OPENAI_API_KEY: validApiKey,
          NODE_ENV: 'test',
        });

        expect(result.JWT_SECRET).toBeDefined();
        expect(result.JWT_SECRET).toMatch(/^[a-f0-9]{64}$/);
      });
    });

    describe('production requirements', () => {
      it('should require JWT_SECRET in production', () => {
        expect(() =>
          EnvSchema.parse({
            OPENAI_API_KEY: validApiKey,
            NODE_ENV: 'production',
            // No JWT_SECRET provided
          })
        ).toThrow(
          'JWT_SECRET is required in production. Generate one with: openssl rand -hex 32'
        );
      });

      it('should accept valid JWT_SECRET in production', () => {
        const validSecret = randomBytes(32).toString('hex');
        const result = EnvSchema.parse({
          OPENAI_API_KEY: validApiKey,
          NODE_ENV: 'production',
          JWT_SECRET: validSecret,
        });

        expect(result.JWT_SECRET).toBe(validSecret);
      });
    });

    describe('validation rules', () => {
      it('should reject JWT_SECRET shorter than 32 characters', () => {
        expect(() =>
          EnvSchema.parse({
            OPENAI_API_KEY: validApiKey,
            JWT_SECRET: 'too-short',
          })
        ).toThrow('JWT_SECRET must be at least 32 characters');
      });

      it('should accept exactly 32 characters', () => {
        const secret32 = 'a'.repeat(32);
        const result = EnvSchema.parse({
          OPENAI_API_KEY: validApiKey,
          JWT_SECRET: secret32,
        });

        expect(result.JWT_SECRET).toBe(secret32);
      });

      it('should use provided JWT_SECRET over auto-generation', () => {
        const providedSecret = randomBytes(32).toString('hex');
        const result = EnvSchema.parse({
          OPENAI_API_KEY: validApiKey,
          NODE_ENV: 'development',
          JWT_SECRET: providedSecret,
        });

        expect(result.JWT_SECRET).toBe(providedSecret);
      });
    });
  });

  describe('ALLOWED_ORIGIN validation', () => {
    it('should use default wildcard origin in development', () => {
      const originalEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'development';

      try {
        const result = EnvSchema.parse({
          OPENAI_API_KEY: validApiKey,
          JWT_SECRET: randomBytes(32).toString('hex'),
        });
        expect(result.ALLOWED_ORIGIN).toEqual(['*']);
      } finally {
        if (originalEnv !== undefined) {
          process.env['NODE_ENV'] = originalEnv;
        } else {
          delete process.env['NODE_ENV'];
        }
      }
    });

    it('should parse single origin', () => {
      const result = EnvSchema.parse({
        OPENAI_API_KEY: validApiKey,
        ALLOWED_ORIGIN: 'https://example.com',
        JWT_SECRET: randomBytes(32).toString('hex'),
      });
      expect(result.ALLOWED_ORIGIN).toEqual(['https://example.com']);
    });

    it('should parse comma-separated origins', () => {
      const result = EnvSchema.parse({
        OPENAI_API_KEY: validApiKey,
        ALLOWED_ORIGIN:
          'https://example.com, http://localhost:3000, https://app.example.com',
        JWT_SECRET: randomBytes(32).toString('hex'),
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
        JWT_SECRET: randomBytes(32).toString('hex'),
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
          JWT_SECRET: randomBytes(32).toString('hex'),
        })
      ).toThrow('Invalid CORS configuration');
    });

    it('should reject non-HTTP(S) protocols', () => {
      expect(() =>
        EnvSchema.parse({
          OPENAI_API_KEY: validApiKey,
          ALLOWED_ORIGIN: 'ftp://example.com',
          JWT_SECRET: randomBytes(32).toString('hex'),
        })
      ).toThrow('Invalid CORS configuration');
    });

    it('should accept wildcard * for all origins', () => {
      const result = EnvSchema.parse({
        OPENAI_API_KEY: validApiKey,
        ALLOWED_ORIGIN: '*',
        JWT_SECRET: randomBytes(32).toString('hex'),
      });
      expect(result.ALLOWED_ORIGIN).toEqual(['*']);
    });

    it('should accept wildcard * with other origins', () => {
      const result = EnvSchema.parse({
        OPENAI_API_KEY: validApiKey,
        ALLOWED_ORIGIN: 'https://example.com, *, http://localhost:3000',
        JWT_SECRET: randomBytes(32).toString('hex'),
      });
      expect(result.ALLOWED_ORIGIN).toEqual([
        'https://example.com',
        '*',
        'http://localhost:3000',
      ]);
    });

    it('should accept only wildcard with spaces', () => {
      const result = EnvSchema.parse({
        OPENAI_API_KEY: validApiKey,
        ALLOWED_ORIGIN: '  *  ',
        JWT_SECRET: randomBytes(32).toString('hex'),
      });
      expect(result.ALLOWED_ORIGIN).toEqual(['*']);
    });
  });

  describe('SYSTEM_PROMPT validation', () => {
    it('should default to empty string', () => {
      const result = EnvSchema.parse({
        OPENAI_API_KEY: validApiKey,
        JWT_SECRET: randomBytes(32).toString('hex'),
      });
      expect(result.SYSTEM_PROMPT).toBe('');
    });

    it('should accept custom system prompt', () => {
      const result = EnvSchema.parse({
        OPENAI_API_KEY: validApiKey,
        SYSTEM_PROMPT: 'You are a helpful assistant.',
        JWT_SECRET: randomBytes(32).toString('hex'),
      });
      expect(result.SYSTEM_PROMPT).toBe('You are a helpful assistant.');
    });
  });

  describe('RATE_LIMIT_MAX validation', () => {
    it('should default to 60', () => {
      const result = EnvSchema.parse({
        OPENAI_API_KEY: validApiKey,
        JWT_SECRET: randomBytes(32).toString('hex'),
      });
      expect(result.RATE_LIMIT_MAX).toBe(60);
    });

    it('should accept custom rate limit', () => {
      const result = EnvSchema.parse({
        OPENAI_API_KEY: validApiKey,
        RATE_LIMIT_MAX: 120,
        JWT_SECRET: randomBytes(32).toString('hex'),
      });
      expect(result.RATE_LIMIT_MAX).toBe(120);
    });

    it('should reject non-numeric values', () => {
      expect(() =>
        EnvSchema.parse({
          OPENAI_API_KEY: validApiKey,
          RATE_LIMIT_MAX: 'abc',
          JWT_SECRET: randomBytes(32).toString('hex'),
        })
      ).toThrow();
    });

    it('should reject zero or negative values', () => {
      expect(() =>
        EnvSchema.parse({
          OPENAI_API_KEY: validApiKey,
          RATE_LIMIT_MAX: '0',
          JWT_SECRET: randomBytes(32).toString('hex'),
        })
      ).toThrow('greater than 0');
    });
  });

  describe('RATE_LIMIT_TIME_WINDOW validation', () => {
    it('should default to 60000 (1 minute)', () => {
      const result = EnvSchema.parse({
        OPENAI_API_KEY: validApiKey,
        JWT_SECRET: randomBytes(32).toString('hex'),
      });
      expect(result.RATE_LIMIT_TIME_WINDOW).toBe(60000);
    });

    it('should accept custom time window', () => {
      const result = EnvSchema.parse({
        OPENAI_API_KEY: validApiKey,
        RATE_LIMIT_TIME_WINDOW: 60000,
        JWT_SECRET: randomBytes(32).toString('hex'),
      });
      expect(result.RATE_LIMIT_TIME_WINDOW).toBe(60000);
    });

    it('should reject non-numeric values', () => {
      expect(() =>
        EnvSchema.parse({
          OPENAI_API_KEY: validApiKey,
          RATE_LIMIT_TIME_WINDOW: '1min',
          JWT_SECRET: randomBytes(32).toString('hex'),
        })
      ).toThrow();
    });
  });

  describe('Error message content', () => {
    it('should contain field names in error messages', () => {
      try {
        EnvSchema.parse({
          OPENAI_API_KEY: validApiKey,
          PORT: 'invalid',
          JWT_SECRET: randomBytes(32).toString('hex'),
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
          JWT_SECRET: randomBytes(32).toString('hex'),
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
