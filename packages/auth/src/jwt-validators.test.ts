import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import {
  InternalJWTValidator,
  ExternalJWTValidator,
} from './jwt-validators.js';
import type { FastifyInstance } from 'fastify';

describe('JWT Validators', () => {
  const testSecret = 'test-secret-at-least-32-chars-long';
  const testPublicKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu1SU1LfVLPHCozMxH2Mo
4lgOEePzNm0tRgeLezV6ffAt0gunVTLw7onLRnrq0/IzW7yWR7QkrmBL7jTKEn5u
+qKhbwKfBstIs+bMY2Zkp18gnTxKLxoS2tFczGkPLPgizskuemMghRniWaoLcyeh
kd3qqGElvW/VDL5AaWTg0nLVkjRo9z+40RQzuVaE8AkAFmxZzow3x+VJYKdjykkJ
0iT9wCS0DRTXu269V264Vf/3jvredZiKRkgwlL9xNAwxXFg0x/XFw005UWVRIkdg
cKWTjpBP2dPwVZ4WWC+9aGVd+Gyn1o0CLelf4rEjGoXbAAEgAqeGUxrcIlbjXfbc
mwIDAQAB
-----END PUBLIC KEY-----`;
  const testPrivateKey = `-----BEGIN PRIVATE KEY-----
MIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQC7VJTUt9Us8cKj
MzEfYyjiWA4R4/M2bS1GB4t7NXp98C3SC6dVMvDuictGeurT8jNbvJZHtCSuYEvu
NMoSfm76oqFvAp8Gy0iz5sxjZmSnXyCdPEovGhLa0VzMaQ8s+CLOyS56YyCFGeJZ
qgtzJ6GR3eqoYSW9b9UMvkBpZODSctWSNGj3P7jRFDO5VoTwCQAWbFnOjDfH5Ulg
p2PKSQnSJP3AJLQNFNe7br1XbrhV//eO+t51mIpGSDCUv3E0DDFcWDTH9cXDTTlR
ZVEiR2BwpZOOkE/Z0/BVnhZYL71oZV34bKfWjQIt6V/isSMahdsAASACp4ZTGtwi
VuNd9tybAgMBAAECggEBAKTmjaS6tkK8BlPXClTQ2vpz/N6uxDeS35mXpqasqskV
laAidgg/sWqpjXDbXr93otIMLlWsM+X0CqMDgSXKejLS2jx4GDjI1ZTXg++0AMJ8
sJ74pWzVDOfmCEQ/7wXs3+cbnXhKriO8Z036q92Qc1+N87SI38nkGa0ABH9CN83H
mQqt4fB7UdHzuIRe/me2PGhIq5ZBzj6h3BpoPGzEP+x3l9YmK8t/1cN0pqI+dQwY
dgfGjackLu/2qH80MCF7IyQaseZUOJyKrCLtSD/Iixv/hzDEUPfOCjFDgTpzf3cw
ta8+oE4wHCo1iI1/4TlPkwmXx4qSXtmw4aQPz7IDQvECgYEA8KNThCO2gsC2I9PQ
DM/8Cw0O983WCDY+oi+7JPiNAJwv5DYBqEZB1QYdj06YD16XlC/HAZMsMku1na2T
N0driwenQQWzoev3g2S7gRDoS/FCJSI3jJ+kjgtaA7Qmzlgk1TxODN+G1H91HW7t
0l7VnL27IWyYo2qRRK3jzxqUiPUCgYEAx0oQs2reBQGMVZnApD1jeq7n4MvNLcPv
t8b/eU9iUv6Y4Mj0Suo/AU8lYZXm8ubbqAlwz2VSVunD2tOplHyMUrtCtObAfVDU
AhCndKaA9gApgfb3xw1IKbuQ1u4IF1FJl3VtumfQn//LiH1B3rXhcdyo3/vIttEk
48RakUKClU8CgYEAzV7W3COOlDDcQd935DdtKBFRAPRPAlspQUnzMi5eSHMD/ISL
DY5IiQHbIH83D4bvXq0X7qQoSBSNP7Dvv3HYuqMhf0DaegrlBuJllFVVq9qPVRnK
xt1Il2HgxOBvbhOT+9in1BzA+YJ99UzC85O0Qz06A+CmtHEy4aZ2kj5hHjECgYEA
mNS4+A8Fkss8Js1RieK2LniBxMgmYml3pfVLKGnzmng7H2+cwPLhPIzIuwytXywh
2bzbsYEfYx3EoEVgMEpPhoarQnYPukrJO4gwE2o5Te6T5mJSZGlQJQj9q4ZB2Dfz
et6INsK0oG8XVGXSpQvQh3RUYekCZQkBBFcpqWpbIEsCgYAnM3DQf3FJoSnXaMhr
VBIovic5l0xFkEHskAjFTevO86Fsz1C2aSeRKSqGFoOQ0tmJzBEs1R6KqnHInicD
TQrKhArgLXX4v3CddjfTRJkFWDbE/CkvKZNOrcf1nhaGCPspRJj2KUkj1Fhl9Cnc
dn/RsYEONbwQSjIfMPkvxF+8HQ==
-----END PRIVATE KEY-----`;

  let mockFastify: any;

  beforeEach(() => {
    mockFastify = {
      jwt: {
        verify: vi.fn(),
      },
      httpErrors: {
        unauthorized: vi.fn((msg: string) => new Error(msg)),
      },
    };
  });

  describe('InternalJWTValidator', () => {
    let validator: InternalJWTValidator;

    beforeEach(() => {
      validator = new InternalJWTValidator(mockFastify as FastifyInstance);
    });

    it('should identify internal tokens', () => {
      const internalToken = jwt.sign({ userId: 'test-user' }, testSecret, {
        algorithm: 'HS256',
        issuer: 'airbolt-api',
      });
      expect(validator.canHandle(internalToken)).toBe(true);
    });

    it('should reject external tokens', () => {
      const externalToken = jwt.sign({ sub: 'user123' }, testSecret, {
        algorithm: 'HS256',
        issuer: 'https://clerk.example.com',
      });
      expect(validator.canHandle(externalToken)).toBe(false);
    });

    it('should extract userId from payload', () => {
      const payload = { userId: 'test-user-123', role: 'user' };
      expect(validator.extractUserId(payload)).toBe('test-user-123');
    });

    it('should return anonymous if no userId', () => {
      const payload = { role: 'user' };
      expect(validator.extractUserId(payload)).toBe('anonymous');
    });

    it('should verify token using fastify jwt', async () => {
      const token = 'test-token';
      const expectedPayload = { userId: 'test-user', role: 'user' };
      mockFastify.jwt.verify.mockResolvedValue(expectedPayload);

      const result = await validator.verify(token);
      expect(result).toEqual(expectedPayload);
      expect(mockFastify.jwt.verify).toHaveBeenCalledWith(token);
    });
  });

  describe('ExternalJWTValidator', () => {
    describe('with RS256', () => {
      const validator = new ExternalJWTValidator(testPublicKey, ['RS256']);

      it('should identify external tokens', () => {
        const externalToken = jwt.sign({ sub: 'user123' }, testPrivateKey, {
          algorithm: 'RS256',
          issuer: 'https://clerk.example.com',
        });
        expect(validator.canHandle(externalToken)).toBe(true);
      });

      it('should reject internal tokens', () => {
        const internalToken = jwt.sign({ userId: 'test-user' }, testSecret, {
          algorithm: 'HS256',
          issuer: 'airbolt-api',
        });
        expect(validator.canHandle(internalToken)).toBe(false);
      });

      it('should verify valid RS256 token', async () => {
        const payload = { sub: 'user123', email: 'test@example.com' };
        const token = jwt.sign(payload, testPrivateKey, {
          algorithm: 'RS256',
          issuer: 'https://clerk.example.com',
        });

        const result = await validator.verify(token);
        expect(result.sub).toBe('user123');
        expect(result.email).toBe('test@example.com');
      });

      it('should reject token with wrong signature', async () => {
        const wrongKey = 'wrong-key';
        const token = jwt.sign({ sub: 'user123' }, wrongKey, {
          algorithm: 'HS256',
        });

        await expect(validator.verify(token)).rejects.toThrow();
      });
    });

    describe('with HS256', () => {
      const validator = new ExternalJWTValidator(testSecret, ['HS256']);

      it('should verify valid HS256 token', async () => {
        const payload = { sub: 'user123', email: 'test@example.com' };
        const token = jwt.sign(payload, testSecret, {
          algorithm: 'HS256',
          issuer: 'https://supabase.example.com',
        });

        const result = await validator.verify(token);
        expect(result.sub).toBe('user123');
        expect(result.email).toBe('test@example.com');
      });
    });

    describe('userId extraction', () => {
      const validator = new ExternalJWTValidator(testSecret);

      it('should prioritize sub claim', () => {
        const payload = {
          sub: 'sub-id',
          user_id: 'user-id',
          userId: 'userId-value',
          email: 'test@example.com',
        };
        expect(validator.extractUserId(payload)).toBe('sub-id');
      });

      it('should use user_id if no sub', () => {
        const payload = {
          user_id: 'user-id',
          userId: 'userId-value',
          email: 'test@example.com',
        };
        expect(validator.extractUserId(payload)).toBe('user-id');
      });

      it('should use userId if no sub or user_id', () => {
        const payload = {
          userId: 'userId-value',
          email: 'test@example.com',
        };
        expect(validator.extractUserId(payload)).toBe('userId-value');
      });

      it('should use email as last resort', () => {
        const payload = {
          email: 'test@example.com',
        };
        expect(validator.extractUserId(payload)).toBe('test@example.com');
      });

      it('should return anonymous if no identifying claims', () => {
        const payload = {
          iat: 123456,
          exp: 234567,
        };
        expect(validator.extractUserId(payload)).toBe('anonymous');
      });
    });
  });
});
