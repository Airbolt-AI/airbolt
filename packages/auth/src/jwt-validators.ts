import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import '@fastify/jwt';

export interface JWTPayload {
  userId?: string;
  sub?: string;
  user_id?: string;
  email?: string;
  iss?: string;
  exp?: number;
  iat?: number;
  [key: string]: unknown;
}

export interface JWTValidator {
  name: string;
  canHandle(token: string): boolean;
  verify(token: string): Promise<JWTPayload>;
  extractUserId(payload: JWTPayload): string;
}

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

export class ExternalJWTValidator implements JWTValidator {
  name = 'external';

  constructor(
    private secret: string | Buffer,
    private algorithms: jwt.Algorithm[] = ['RS256']
  ) {}

  canHandle(token: string): boolean {
    try {
      const decoded = jwt.decode(token, { complete: true });
      return (
        decoded !== null &&
        typeof decoded.payload === 'object' &&
        decoded.payload.iss !== 'airbolt-api'
      );
    } catch {
      return false;
    }
  }

  async verify(token: string): Promise<JWTPayload> {
    return new Promise((resolve, reject) => {
      jwt.verify(
        token,
        this.secret,
        { algorithms: this.algorithms },
        (err, decoded) => {
          if (err) {
            reject(err);
          } else {
            resolve(decoded as JWTPayload);
          }
        }
      );
    });
  }

  extractUserId(payload: JWTPayload): string {
    // Standard claim priority: sub > user_id > userId > email
    return (
      payload.sub ||
      payload.user_id ||
      payload.userId ||
      payload.email ||
      'anonymous'
    );
  }
}
