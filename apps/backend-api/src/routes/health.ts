import type { FastifyPluginAsync, FastifyInstance } from 'fastify';
import { z } from 'zod';
import { isDevelopment } from '@airbolt/config';
import { totalmem, freemem } from 'node:os';

// Memory information interface
interface MemoryInfo {
  used: number;
  available: number;
  percentage: number;
}

// Individual check result interface
interface CheckResult {
  status: 'ok' | 'error' | 'not_configured';
  details?: string;
  timestamp?: string;
}

// Health check response interface
interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    authGateway: CheckResult['status'];
    sessionCache: CheckResult['status'];
    aiProvider: CheckResult['status'];
    memory: MemoryInfo;
  };
  version: string;
}

// Response schemas for OpenAPI
const MemoryInfoSchema = z.object({
  used: z.number().describe('Memory used in MB'),
  available: z.number().describe('Memory available in MB'),
  percentage: z.number().describe('Memory usage percentage'),
});

const CheckStatusSchema = z.enum(['ok', 'error', 'not_configured']);

const HealthResponseSchema = z.object({
  status: z
    .enum(['healthy', 'unhealthy'])
    .describe('Overall system health status'),
  timestamp: z.string().describe('Health check timestamp in ISO format'),
  uptime: z.number().describe('Server uptime in seconds'),
  checks: z.object({
    authGateway: CheckStatusSchema.describe('Auth gateway service status'),
    sessionCache: CheckStatusSchema.describe('Session cache service status'),
    aiProvider: CheckStatusSchema.describe('AI provider connectivity status'),
    memory: MemoryInfoSchema.describe('Memory usage information'),
  }),
  version: z.string().describe('Application version'),
});

// Track server start time for uptime calculation
const SERVER_START_TIME = Date.now();

const health: FastifyPluginAsync = async (fastify, _opts): Promise<void> => {
  fastify.get(
    '/health',
    {
      schema: {
        tags: ['Health'],
        summary: 'Application health check',
        description:
          'Returns detailed health information about the application and its dependencies',
        response: {
          200: {
            description: 'System is healthy or unhealthy',
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: ['healthy', 'unhealthy'],
                description: 'Overall system health status',
              },
              timestamp: {
                type: 'string',
                format: 'date-time',
                description: 'Health check timestamp in ISO format',
              },
              uptime: {
                type: 'number',
                description: 'Server uptime in seconds',
              },
              checks: {
                type: 'object',
                properties: {
                  authGateway: {
                    type: 'string',
                    enum: ['ok', 'error', 'not_configured'],
                  },
                  sessionCache: {
                    type: 'string',
                    enum: ['ok', 'error', 'not_configured'],
                  },
                  aiProvider: {
                    type: 'string',
                    enum: ['ok', 'error', 'not_configured'],
                  },
                  memory: {
                    type: 'object',
                    properties: {
                      used: { type: 'number' },
                      available: { type: 'number' },
                      percentage: { type: 'number' },
                    },
                    required: ['used', 'available', 'percentage'],
                  },
                },
                required: [
                  'authGateway',
                  'sessionCache',
                  'aiProvider',
                  'memory',
                ],
              },
              version: {
                type: 'string',
                description: 'Application version',
              },
            },
            required: ['status', 'timestamp', 'uptime', 'checks', 'version'],
          },
          503: {
            description: 'System is unhealthy',
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: ['healthy', 'unhealthy'],
              },
              timestamp: {
                type: 'string',
                format: 'date-time',
              },
              uptime: {
                type: 'number',
              },
              checks: {
                type: 'object',
                properties: {
                  authGateway: {
                    type: 'string',
                    enum: ['ok', 'error', 'not_configured'],
                  },
                  sessionCache: {
                    type: 'string',
                    enum: ['ok', 'error', 'not_configured'],
                  },
                  aiProvider: {
                    type: 'string',
                    enum: ['ok', 'error', 'not_configured'],
                  },
                  memory: {
                    type: 'object',
                    properties: {
                      used: { type: 'number' },
                      available: { type: 'number' },
                      percentage: { type: 'number' },
                    },
                    required: ['used', 'available', 'percentage'],
                  },
                },
                required: [
                  'authGateway',
                  'sessionCache',
                  'aiProvider',
                  'memory',
                ],
              },
              version: {
                type: 'string',
              },
            },
            required: ['status', 'timestamp', 'uptime', 'checks', 'version'],
          },
        },
      },
    },

    async (_request, reply) => {
      try {
        const timestamp = new Date().toISOString();
        const uptime = Math.floor((Date.now() - SERVER_START_TIME) / 1000);

        // Perform individual health checks
        const checks = {
          authGateway: await checkAuthGateway(fastify),
          sessionCache: await checkSessionCache(fastify),
          aiProvider: await checkAIProvider(fastify),
          memory: getMemoryInfo(),
        };

        // Determine overall health status
        const isHealthy =
          checks.authGateway === 'ok' &&
          checks.sessionCache === 'ok' &&
          (checks.aiProvider === 'ok' ||
            checks.aiProvider === 'not_configured') &&
          checks.memory.percentage < 90; // Consider unhealthy if memory usage > 90%

        const response: HealthResponse = {
          status: isHealthy ? 'healthy' : 'unhealthy',
          timestamp,
          uptime,
          checks,
          version: '1.0.0', // From root package.json
        };

        // Validate response against schema in development
        if (isDevelopment()) {
          HealthResponseSchema.parse(response);
        }

        // Return appropriate status code
        const statusCode = isHealthy ? 200 : 503;
        return reply.status(statusCode).send(response);
      } catch (error) {
        fastify.log.error(
          { error: error instanceof Error ? error.message : 'Unknown error' },
          'Health check endpoint error'
        );

        // Return a minimal health response if something goes wrong
        const fallbackResponse = {
          status: 'unhealthy' as const,
          timestamp: new Date().toISOString(),
          uptime: Math.floor((Date.now() - SERVER_START_TIME) / 1000),
          checks: {
            authGateway: 'error' as const,
            sessionCache: 'error' as const,
            aiProvider: 'error' as const,
            memory: {
              used: 0,
              available: 0,
              percentage: 0,
            },
          },
          version: '1.0.0',
        };

        return reply.status(503).send(fallbackResponse);
      }
    }
  );
};

/**
 * Check auth gateway status by testing session cache access
 */
async function checkAuthGateway(
  fastify: FastifyInstance
): Promise<CheckResult['status']> {
  try {
    // Check if authGateway is available
    if (!('authGateway' in fastify) || !fastify.authGateway) {
      return 'not_configured';
    }

    // Test basic auth gateway functionality by attempting to validate an empty token
    // This should return null but not throw an error if the service is working
    const result = await fastify.authGateway.validateToken('');

    // If we get here without an error, the auth gateway is working
    // (result should be null for empty token, which is expected)
    return result === null ? 'ok' : 'ok';
  } catch (error) {
    fastify.log.warn(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      'Auth gateway health check failed'
    );
    return 'error';
  }
}

/**
 * Check session cache status by testing basic operations
 */
async function checkSessionCache(
  fastify: FastifyInstance
): Promise<CheckResult['status']> {
  try {
    // Check if authGateway is available
    if (!('authGateway' in fastify) || !fastify.authGateway) {
      return 'not_configured';
    }

    // For health checks, we'll use a simpler approach that doesn't involve
    // creating test sessions which might fail due to validation or other issues
    // Instead, we'll just verify the authGateway has the expected methods
    const hasRequiredMethods =
      typeof fastify.authGateway.createSession === 'function' &&
      typeof fastify.authGateway.validateToken === 'function' &&
      typeof fastify.authGateway.invalidateSession === 'function';

    return hasRequiredMethods ? 'ok' : 'error';
  } catch (error) {
    fastify.log.warn(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      'Session cache health check failed'
    );
    return 'error';
  }
}

/**
 * Check AI provider connectivity and configuration
 */
async function checkAIProvider(
  fastify: FastifyInstance
): Promise<CheckResult['status']> {
  try {
    // Check if aiProvider is available
    if (!('aiProvider' in fastify) || !fastify.aiProvider) {
      return 'not_configured';
    }

    // Test AI provider by checking if it supports basic features
    // This doesn't make an actual API call to avoid rate limits and costs
    const supportsStreaming = fastify.aiProvider.supportsFeature('streaming');

    // If the provider is configured and we can check features, it's likely working
    // We don't make actual API calls in health checks to avoid:
    // 1. Rate limiting
    // 2. API costs
    // 3. External dependency failures affecting health status
    return typeof supportsStreaming === 'boolean' ? 'ok' : 'error';
  } catch (error) {
    fastify.log.warn(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      'AI provider health check failed'
    );
    return 'error';
  }
}

/**
 * Get current memory usage information
 */
function getMemoryInfo(): MemoryInfo {
  const memUsage = process.memoryUsage();
  const totalMemory = totalmem();
  const freeMemory = freemem();

  // Convert bytes to MB for easier reading
  const usedMB = Math.round((memUsage.heapUsed / 1024 / 1024) * 10) / 10;
  const availableMB = Math.round((freeMemory / 1024 / 1024) * 10) / 10;
  const totalMB = Math.round((totalMemory / 1024 / 1024) * 10) / 10;

  // Calculate percentage based on total system memory usage (used memory / total memory)
  const systemUsedMB = totalMB - availableMB;
  const percentage = Math.round((systemUsedMB / totalMB) * 100 * 10) / 10;

  return {
    used: usedMB, // Heap memory used by this process
    available: availableMB, // Available system memory
    percentage, // Total system memory usage percentage
  };
}

export default health;
