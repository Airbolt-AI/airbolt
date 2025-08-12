import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { isDevelopment } from '@airbolt/config';
import {
  verifyExternalToken,
  extractUserIdFromPayload,
  AuthError,
  type JWTPayload,
} from '@airbolt/auth';

// Request schema for the exchange endpoint
const ExchangeRequestSchema = z.object({
  token: z.string().optional(), // Optional to support dev mode
});

// Response schema for successful token exchange
const ExchangeResponseSchema = z.object({
  sessionToken: z.string(),
  expiresIn: z.string(),
  tokenType: z.string(),
});

// Error response schema
const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  statusCode: z.number(),
});

const exchange: FastifyPluginAsync = async (fastify): Promise<void> => {
  fastify.post(
    '/exchange',
    {
      schema: {
        tags: ['Authentication'],
        summary: 'Exchange external JWT for session token',
        description:
          'Exchange an external JWT token (e.g., from Clerk, Firebase Auth) for an internal session token',
        body: {
          type: 'object',
          properties: {
            token: {
              type: 'string',
              description:
                'External JWT token to verify and exchange (optional in development)',
            },
          },
        },
        response: {
          200: {
            description: 'Token exchange successful',
            type: 'object',
            required: ['sessionToken', 'expiresIn', 'tokenType'],
            properties: {
              sessionToken: {
                type: 'string',
                description: 'Internal session token',
              },
              expiresIn: {
                type: 'string',
                description: 'Token expiration time',
              },
              tokenType: {
                type: 'string',
                description: 'Token type (Bearer)',
              },
            },
          },
          401: {
            description: 'Authentication failed',
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
              statusCode: { type: 'number' },
            },
          },
          400: {
            description: 'Bad Request',
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
              statusCode: { type: 'number' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        // Parse and validate request body
        const { token } = ExchangeRequestSchema.parse(request.body || {});

        let userId = 'dev-user';
        let userEmail: string | undefined;
        let verifiedClaims: JWTPayload = {};

        // Development mode: If no token provided, generate dev session
        if (!token && isDevelopment()) {
          request.log.warn(
            'No token provided in development mode - generating dev session token'
          );
        } else if (!token) {
          // Production: token is required
          throw fastify.httpErrors.badRequest(
            'Token is required for authentication'
          );
        } else {
          // Verify the external JWT token
          try {
            // Use the new verifyExternalToken utility
            verifiedClaims = await verifyExternalToken(token);

            // Extract user information from verified claims
            userId = extractUserIdFromPayload(verifiedClaims);
            userEmail = verifiedClaims.email;

            request.log.info(
              {
                userId,
                userEmail,
                issuer: verifiedClaims.iss,
                audience: verifiedClaims.aud,
              },
              'Token verification successful'
            );
          } catch (error: unknown) {
            if (error instanceof AuthError) {
              request.log.warn(
                { error: error.message, token: token.substring(0, 20) + '...' },
                'Token verification failed'
              );
              throw fastify.httpErrors.unauthorized(
                `Invalid token: ${error.message}`
              );
            } else {
              request.log.error(
                error,
                'Unexpected error during token verification'
              );
              throw fastify.httpErrors.unauthorized(
                'Token verification failed due to unexpected error'
              );
            }
          }
        }

        // Generate internal session token
        const sessionToken = fastify.jwt.sign(
          {
            userId,
            email: userEmail,
            role: 'user',
            // Include relevant claims from the external token
            ...(Object.keys(verifiedClaims).length > 0 && {
              externalClaims: {
                issuer: verifiedClaims.iss,
                audience: verifiedClaims.aud,
                subject: verifiedClaims.sub,
              },
            }),
          },
          {
            expiresIn: '15m',
            iss: 'airbolt-api',
          }
        );

        const response = {
          sessionToken,
          expiresIn: '15m',
          tokenType: 'Bearer',
        };

        // Validate response in development
        if (isDevelopment()) {
          ExchangeResponseSchema.parse(response);
        }

        request.log.info(
          {
            userId,
            userEmail,
            tokenProvided: !!token,
            isDev: isDevelopment(),
          },
          'Session token generated successfully'
        );

        return reply.code(200).send(response);
      } catch (error) {
        // Handle Zod validation errors
        if (error instanceof z.ZodError) {
          const validationErrors = error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          }));

          request.log.warn(
            { validationErrors },
            'Token exchange validation failed'
          );

          const errorResponse = {
            error: 'ValidationError',
            message: `Invalid request: ${validationErrors.map(e => `${e.field}: ${e.message}`).join(', ')}`,
            statusCode: 400,
          };

          if (isDevelopment()) {
            ErrorResponseSchema.parse(errorResponse);
          }

          return reply.code(400).send(errorResponse);
        }

        // Handle Fastify HTTP errors (401, 400, etc.)
        if (error && typeof error === 'object' && 'statusCode' in error) {
          const httpError = error as { statusCode: number; message: string };
          const errorResponse = {
            error: httpError.statusCode === 401 ? 'Unauthorized' : 'BadRequest',
            message: httpError.message,
            statusCode: httpError.statusCode,
          };

          if (isDevelopment()) {
            ErrorResponseSchema.parse(errorResponse);
          }

          return reply.code(httpError.statusCode).send(errorResponse);
        }

        // Handle unexpected errors
        request.log.error(error, 'Unexpected error in token exchange');

        const errorResponse = {
          error: 'InternalServerError',
          message: 'An unexpected error occurred during token exchange',
          statusCode: 500,
        };

        if (isDevelopment()) {
          ErrorResponseSchema.parse(errorResponse);
        }

        return reply.code(500).send(errorResponse);
      }
    }
  );
};

export default exchange;
