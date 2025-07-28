import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import type { JWTValidator, JWTPayload } from '../types.js';
import '@fastify/jwt';

export class InternalJWTValidator implements JWTValidator {
  name = 'internal';

  constructor(private fastify: FastifyInstance) {}

  canHandle(token: string): boolean {
    try {
      const decoded = jwt.decode(token, { complete: true });
      return (
        decoded !== null &&
        typeof decoded.payload === 'object' &&
        decoded.payload.iss === 'airbolt-api'
      );
    } catch {
      return false;
    }
  }

  async verify(token: string): Promise<JWTPayload> {
    return this.fastify.jwt.verify(token);
  }

  extractUserId(payload: JWTPayload): string {
    return payload.userId || 'anonymous';
  }
}
