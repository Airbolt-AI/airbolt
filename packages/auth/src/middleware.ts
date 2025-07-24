import type { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import type { JWTValidator } from './jwt-validators.js';
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

export function createAuthMiddleware(
  fastify: FastifyInstance,
  validators: JWTValidator[]
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async function verifyJWT(
    request: FastifyRequest,
    _reply: FastifyReply
  ): Promise<void> {
    const token = extractBearerToken(request);
    if (!token) {
      throw fastify.httpErrors.unauthorized('Missing authorization token');
    }

    // Try each validator in order
    for (const validator of validators) {
      if (validator.canHandle(token)) {
        try {
          const payload = await validator.verify(token);
          // Type assertion needed because Fastify request typing doesn't include custom properties
          const req = request as FastifyRequest & { user: AuthUser };
          req.user = {
            userId: validator.extractUserId(payload),
            authMethod: validator.name,
            ...payload,
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

    throw fastify.httpErrors.unauthorized('Invalid authorization token');
  };
}
