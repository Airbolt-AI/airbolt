import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { InternalJWTValidator } from '../src/validators/internal.js';

describe('InternalJWTValidator', () => {
  let mockFastify: FastifyInstance;
  let validator: InternalJWTValidator;
  const testSecret = 'test-secret';

  beforeEach(() => {
    mockFastify = {
      jwt: {
        verify: vi.fn(),
      },
    } as any;
    validator = new InternalJWTValidator(mockFastify);
  });

  describe('canHandle', () => {
    it('should handle tokens with airbolt-api issuer', () => {
      const token = jwt.sign({ iss: 'airbolt-api' }, testSecret);
      expect(validator.canHandle(token)).toBe(true);
    });

    it('should not handle tokens with other issuers', () => {
      const token = jwt.sign({ iss: 'other-issuer' }, testSecret);
      expect(validator.canHandle(token)).toBe(false);
    });

    it('should not handle tokens without issuer', () => {
      const token = jwt.sign({}, testSecret);
      expect(validator.canHandle(token)).toBe(false);
    });

    it('should handle malformed tokens gracefully', () => {
      expect(validator.canHandle('not-a-jwt')).toBe(false);
      expect(validator.canHandle('')).toBe(false);
    });
  });

  describe('verify', () => {
    it('should verify token using fastify jwt', async () => {
      const token = 'test-token';
      const payload = { userId: 'user-123', iss: 'airbolt-api' };

      mockFastify.jwt.verify = vi.fn().mockResolvedValue(payload);

      const result = await validator.verify(token);

      expect(mockFastify.jwt.verify).toHaveBeenCalledWith(token);
      expect(result).toEqual(payload);
    });

    it('should propagate verification errors', async () => {
      const token = 'invalid-token';
      const error = new Error('Invalid signature');

      mockFastify.jwt.verify = vi.fn().mockRejectedValue(error);

      await expect(validator.verify(token)).rejects.toThrow(error);
    });
  });

  describe('extractUserId', () => {
    it('should extract userId from payload', () => {
      expect(validator.extractUserId({ userId: 'user-123' })).toBe('user-123');
    });

    it('should return anonymous for missing userId', () => {
      expect(validator.extractUserId({})).toBe('anonymous');
      expect(validator.extractUserId({ userId: null as any })).toBe(
        'anonymous'
      );
      expect(validator.extractUserId({ userId: '' })).toBe('anonymous');
    });
  });
});
