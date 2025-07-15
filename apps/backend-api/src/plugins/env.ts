import { randomBytes } from 'node:crypto';
import fp from 'fastify-plugin';
import { z } from 'zod';
import { COMMON_DEV_PORTS, DEFAULT_TEST_ORIGINS } from '../constants/cors.js';

export const EnvSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'production', 'test'], {
        errorMap: () => ({
          message: 'NODE_ENV must be one of: development, production, test',
        }),
      })
      .default('development'),

    PORT: z.coerce
      .number({
        required_error: 'PORT must be a valid number',
        invalid_type_error: 'PORT must be a number',
      })
      .int('PORT must be an integer')
      .min(1, 'PORT must be at least 1')
      .max(65535, 'PORT must be at most 65535')
      .default(3000),

    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'], {
        errorMap: () => ({
          message:
            'LOG_LEVEL must be one of: fatal, error, warn, info, debug, trace',
        }),
      })
      .default('info'),

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

    // CORS origins (environment-aware defaults, see constants/cors.ts for details)
    ALLOWED_ORIGIN: z.string().optional(),

    SYSTEM_PROMPT: z
      .string({
        invalid_type_error: 'SYSTEM_PROMPT must be a string',
      })
      .optional()
      .default(''),

    RATE_LIMIT_MAX: z.coerce
      .number({
        invalid_type_error: 'RATE_LIMIT_MAX must be a number',
      })
      .int('RATE_LIMIT_MAX must be an integer')
      .min(1, 'RATE_LIMIT_MAX must be greater than 0')
      .default(60),

    RATE_LIMIT_TIME_WINDOW: z.coerce
      .number({
        invalid_type_error: 'RATE_LIMIT_TIME_WINDOW must be a number',
      })
      .int('RATE_LIMIT_TIME_WINDOW must be an integer')
      .min(1000, 'RATE_LIMIT_TIME_WINDOW must be at least 1000ms (1 second)')
      .default(60000), // 1 minute default

    TRUST_PROXY: z.coerce
      .boolean({
        invalid_type_error: 'TRUST_PROXY must be a boolean',
      })
      .default(false),
  })
  .transform(data => {
    // Auto-generate JWT_SECRET in non-production environments when not provided
    if (!data.JWT_SECRET && data.NODE_ENV !== 'production') {
      data = {
        ...data,
        JWT_SECRET: randomBytes(32).toString('hex'),
      };
    }

    // Set ALLOWED_ORIGIN defaults and validate
    if (!data.ALLOWED_ORIGIN) {
      if (data.NODE_ENV === 'production') {
        throw new Error(
          'ALLOWED_ORIGIN required in production. Example: ALLOWED_ORIGIN=https://yourdomain.com'
        );
      }
      data.ALLOWED_ORIGIN =
        data.NODE_ENV === 'test' ? DEFAULT_TEST_ORIGINS : '*';
    }

    // Parse origins
    const origins = data.ALLOWED_ORIGIN.split(',')
      .map(s => s.trim())
      .filter(Boolean);

    // Validate origins
    for (const origin of origins) {
      if (origin !== '*') {
        try {
          const url = new URL(origin);
          if (data.NODE_ENV === 'production') {
            if (
              !url.protocol.startsWith('https:') ||
              url.hostname.includes('localhost')
            ) {
              throw new Error(
                `Production requires HTTPS origins (no localhost). Invalid: ${origin}`
              );
            }
          } else if (!['http:', 'https:'].includes(url.protocol)) {
            throw new Error(`Invalid origin protocol: ${origin}`);
          }
        } catch (err) {
          if (err instanceof TypeError) {
            throw new Error(`Invalid URL format: ${origin}`);
          }
          throw err;
        }
      } else if (data.NODE_ENV === 'production') {
        throw new Error('Wildcard (*) not allowed in production');
      }
    }

    // Auto-enhance development with common ports
    const finalOrigins =
      data.NODE_ENV === 'development' && !origins.includes('*')
        ? [...new Set([...origins, ...COMMON_DEV_PORTS])]
        : origins;

    return { ...data, ALLOWED_ORIGIN: finalOrigins };
  })
  .refine(
    data => {
      // In production, JWT_SECRET must be provided
      if (data.NODE_ENV === 'production' && !data.JWT_SECRET) {
        return false;
      }
      return true;
    },
    {
      message:
        'JWT_SECRET is required in production. Generate one with: openssl rand -hex 32',
      path: ['JWT_SECRET'],
    }
  );

// Use z.output to get the type after transformations
export type Env = z.output<typeof EnvSchema>;

// List of sensitive environment variable patterns to redact from logs
const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /key/i,
  /token/i,
  /auth/i,
  /credential/i,
  /database_url/i,
  /connection_string/i,
];

function createSafeConfig(config: Env): Record<string, unknown> {
  const safeConfig: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(config)) {
    const isSensitive = SENSITIVE_PATTERNS.some(pattern => pattern.test(key));
    // eslint-disable-next-line security/detect-object-injection
    safeConfig[key] = isSensitive ? '[REDACTED]' : value;
  }

  return safeConfig;
}

declare module 'fastify' {
  interface FastifyInstance {
    config?: Env;
  }
}

export default fp(
  async fastify => {
    try {
      const config = EnvSchema.parse(process.env);

      // Log if JWT_SECRET was auto-generated (check if it's the expected length and NODE_ENV is development)
      if (config.NODE_ENV === 'development' && !process.env['JWT_SECRET']) {
        fastify.log.warn(
          { JWT_SECRET: '[REDACTED - auto-generated]' },
          'JWT_SECRET not provided. Auto-generated for development use only. ' +
            'Set JWT_SECRET environment variable in production for stable tokens across restarts.'
        );
      }

      fastify.decorate('config', config);

      // Log safe config (sensitive fields redacted)
      const safeConfig = createSafeConfig(config);
      fastify.log.info(
        { config: safeConfig },
        'Environment configuration loaded'
      );
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formattedErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
          received: 'received' in err ? err.received : undefined,
        }));

        fastify.log.error(
          {
            validationErrors: formattedErrors,
          },
          'Environment validation failed'
        );

        throw new Error(
          `Environment validation failed: ${formattedErrors.map(e => `${e.field}: ${e.message}`).join(', ')}`
        );
      }

      fastify.log.error({ error }, 'Invalid environment configuration');
      throw error;
    }
  },
  {
    name: 'env-plugin',
  }
);
