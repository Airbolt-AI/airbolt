import type { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { isProduction } from '@airbolt/config';
import type { JWTValidator, AuthConfig } from './types.js';
import { AuthValidatorFactory } from './factory.js';
import '@fastify/sensible';

export interface AuthUser {
  userId: string;
  authMethod: string;
  [key: string]: unknown;
}

function extractBearerToken(request: FastifyRequest): string | null {
  const auth = request.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return null;
  }
  return auth.slice(7);
}

// Simplified API - single function call
export function createAuthMiddleware(
  fastify: FastifyInstance,
  config?: AuthConfig
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  // Auto-detect config from fastify if not provided
  const authConfig =
    config ||
    (fastify as FastifyInstance & { config?: AuthConfig }).config ||
    {};
  const validators = AuthValidatorFactory.create(authConfig, fastify);

  return createMiddleware(fastify, validators, authConfig);
}

// Internal function for creating middleware with validators
function createMiddleware(
  fastify: FastifyInstance,
  validators: JWTValidator[],
  config: AuthConfig
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async function verifyJWT(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    // Set BYOA mode header for transparency about auth configuration
    const byoaMode = config.EXTERNAL_JWT_ISSUER ? 'strict' : 'auto';
    reply.header('X-BYOA-Mode', byoaMode);

    const token = extractBearerToken(request);
    if (!token) {
      throw fastify.httpErrors.unauthorized(
        'Missing authorization token. Include "Authorization: Bearer <token>" header'
      );
    }

    // Try each validator in order
    for (const validator of validators) {
      const canHandle = validator.canHandle(token);
      fastify.log.debug(
        { validator: validator.name, canHandle },
        'Checking validator'
      );
      if (canHandle) {
        try {
          const payload = await validator.verify(token);
          // Type assertion needed because Fastify request typing doesn't include custom properties
          const req = request as FastifyRequest & { user: AuthUser };

          // Log auto-discovery warnings with structured logging
          if (validator.name === 'auto-discovery' && payload.iss) {
            const isProd = isProduction();
            const hasConfiguredIssuer = config.EXTERNAL_JWT_ISSUER;

            if (!hasConfiguredIssuer) {
              fastify.log.warn(
                {
                  issuer: payload.iss,
                  isProduction: isProd,
                  authMethod: 'auto-discovery',
                },
                isProd
                  ? 'Production auto-discovery: accepting external JWT. Configure EXTERNAL_JWT_ISSUER for enhanced security'
                  : 'Development auto-discovery: accepting external JWT. Set NODE_ENV=production and configure EXTERNAL_JWT_ISSUER for production'
              );
            }
          }

          // Extract userId separately to prevent JWT payload from overwriting our normalized userId
          // Some JWTs may contain userId: null which would override our extracted value
          const { userId: _userId, ...restPayload } = payload;

          req.user = {
            ...restPayload,
            userId: validator.extractUserId(payload),
            authMethod: validator.name,
          };
          return;
        } catch (error) {
          fastify.log.debug(
            { validator: validator.name, error },
            'JWT validation failed'
          );
        }
      }
    }

    fastify.log.debug(
      { validatorCount: validators.length },
      'No validators could handle token'
    );
    throw fastify.httpErrors.unauthorized(
      'Invalid authorization token. For anonymous access, get a token from /api/tokens'
    );
  };
}
