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
    reply: FastifyReply
  ): Promise<void> {
    // Set BYOA mode header for transparency about auth configuration (if header method exists)
    if (typeof reply.header === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const config = (fastify as any).config;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const byoaMode = config?.EXTERNAL_JWT_ISSUER ? 'strict' : 'auto';
      reply.header('X-BYOA-Mode', byoaMode);
    }
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

    throw fastify.httpErrors.unauthorized('Invalid authorization token');
  };
}
