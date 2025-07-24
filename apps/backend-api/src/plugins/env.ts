import { randomBytes } from 'node:crypto';
import fp from 'fastify-plugin';
import { z } from 'zod';
import { PROVIDER_CONFIG } from '../services/provider-config.js';
// CORS constants inlined for simplicity
const COMMON_DEV_PORTS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4200',
  'http://localhost:8080',
  'http://localhost:61000', // Ladle development server
] as const;

const DEFAULT_TEST_ORIGINS = 'http://localhost:3000,http://localhost:3001';

const providerNames = Object.keys(PROVIDER_CONFIG) as [
  keyof typeof PROVIDER_CONFIG,
  ...Array<keyof typeof PROVIDER_CONFIG>,
];

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

    // AI Provider Configuration - now dynamic!
    AI_PROVIDER: z
      .enum(providerNames, {
        errorMap: () => ({
          message: `AI_PROVIDER must be one of: ${providerNames.join(', ')}`,
        }),
      })
      .default('openai'),

    AI_MODEL: z
      .string({
        invalid_type_error: 'AI_MODEL must be a string',
      })
      .optional(),

    // Keep these for backward compatibility - will be validated dynamically
    OPENAI_API_KEY: z
      .string({
        invalid_type_error: 'OPENAI_API_KEY must be a string',
      })
      .min(1, 'OPENAI_API_KEY cannot be empty')
      .regex(
        PROVIDER_CONFIG.openai.keyRegex,
        `OPENAI_API_KEY must be a valid OpenAI API key format (${PROVIDER_CONFIG.openai.keyFormat})`
      )
      .optional(),

    ANTHROPIC_API_KEY: z
      .string({
        invalid_type_error: 'ANTHROPIC_API_KEY must be a string',
      })
      .min(1, 'ANTHROPIC_API_KEY cannot be empty')
      .regex(
        PROVIDER_CONFIG.anthropic.keyRegex,
        `ANTHROPIC_API_KEY must be a valid Anthropic API key format (${PROVIDER_CONFIG.anthropic.keyFormat})`
      )
      .optional(),

    JWT_SECRET: z
      .string({
        invalid_type_error: 'JWT_SECRET must be a string',
      })
      .min(32, 'JWT_SECRET must be at least 32 characters for security')
      .optional(),

    // CORS allowed origins (comma-separated list or * for all origins)
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

    // Token-based rate limiting
    TOKEN_LIMIT_MAX: z.coerce
      .number({
        invalid_type_error: 'TOKEN_LIMIT_MAX must be a number',
      })
      .int('TOKEN_LIMIT_MAX must be an integer')
      .min(1000, 'TOKEN_LIMIT_MAX must be at least 1000')
      .default(100000), // 100k tokens default

    TOKEN_LIMIT_TIME_WINDOW: z.coerce
      .number({
        invalid_type_error: 'TOKEN_LIMIT_TIME_WINDOW must be a number',
      })
      .int('TOKEN_LIMIT_TIME_WINDOW must be an integer')
      .min(60000, 'TOKEN_LIMIT_TIME_WINDOW must be at least 60000ms (1 minute)')
      .default(3600000), // 1 hour default

    // Request-based rate limiting for authenticated users
    REQUEST_LIMIT_MAX: z.coerce
      .number({
        invalid_type_error: 'REQUEST_LIMIT_MAX must be a number',
      })
      .int('REQUEST_LIMIT_MAX must be an integer')
      .min(1, 'REQUEST_LIMIT_MAX must be greater than 0')
      .default(100), // 100 requests default

    REQUEST_LIMIT_TIME_WINDOW: z.coerce
      .number({
        invalid_type_error: 'REQUEST_LIMIT_TIME_WINDOW must be a number',
      })
      .int('REQUEST_LIMIT_TIME_WINDOW must be an integer')
      .min(
        60000,
        'REQUEST_LIMIT_TIME_WINDOW must be at least 60000ms (1 minute)'
      )
      .default(3600000), // 1 hour default
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

    // Parse and validate origins
    const origins = data.ALLOWED_ORIGIN.split(',')
      .map(s => s.trim())
      .filter(Boolean);

    for (const origin of origins) {
      if (origin === '*') {
        // Wildcard is allowed in all environments for SDK deployment model
        // Security is handled via JWT tokens and rate limiting
      } else {
        try {
          const url = new URL(origin);
          if (data.NODE_ENV === 'production') {
            if (
              url.protocol !== 'https:' ||
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
  )
  .refine(
    data => {
      // Ensure the appropriate API key is provided for the selected provider
      const providerConfig = PROVIDER_CONFIG[data.AI_PROVIDER];
      if (providerConfig) {
        const apiKey = data[providerConfig.envKey as keyof typeof data];
        if (!apiKey) {
          return false;
        }
      }
      return true;
    },
    {
      message: 'API key for the selected AI provider is required',
      path: ['AI_PROVIDER'],
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

      // Warn about auto-generated JWT_SECRET in development
      if (config.NODE_ENV === 'development' && !process.env['JWT_SECRET']) {
        fastify.log.warn(
          { JWT_SECRET: '[REDACTED - auto-generated]' },
          'JWT_SECRET auto-generated for development. Set JWT_SECRET for stable tokens.'
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
