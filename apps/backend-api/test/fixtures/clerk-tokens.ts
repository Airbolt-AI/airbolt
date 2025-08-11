/**
 * Comprehensive Clerk JWT test fixtures for Phase 3b of JWT verification system
 *
 * This module provides:
 * - Real RSA key pair generation for cryptographically valid tokens
 * - Mock JWKS endpoints with proper key formatting
 * - Various Clerk token scenarios (valid, expired, invalid signature, etc.)
 * - Edge case tokens for comprehensive testing
 * - Mock HTTP server for integration testing
 * - Easy-to-use test utilities
 */

import { SignJWT, generateKeyPair, exportJWK, type JWK } from 'jose';
import { createServer, type Server } from 'http';
import { type ClerkJWTClaims } from '../../src/auth/clerk-verifier.js';

/**
 * Test RSA key pair for signing tokens
 * Generated once and reused for consistency
 */
interface TestKeyPair {
  privateKey: any; // jose KeyLike is internal, use any for compatibility
  publicKey: any; // jose KeyLike is internal, use any for compatibility
  publicJWK: JWK & { kid: string; alg: string; use: string };
  keyId: string;
}

let testKeyPair: TestKeyPair | null = null;

/**
 * Generates or retrieves the test RSA key pair
 * Uses a consistent key ID for all test tokens
 */
async function getTestKeyPair(): Promise<TestKeyPair> {
  if (testKeyPair) {
    return testKeyPair;
  }

  const { privateKey, publicKey } = await generateKeyPair('RS256', {
    modulusLength: 2048,
  });

  const publicJWK = await exportJWK(publicKey);
  const keyId = 'clerk-test-key-2024';

  testKeyPair = {
    privateKey,
    publicKey,
    publicJWK: {
      ...publicJWK,
      kid: keyId,
      alg: 'RS256',
      use: 'sig',
      kty: publicJWK.kty || 'RSA',
    } as JWK & { kid: string; alg: string; use: string },
    keyId,
  };

  return testKeyPair;
}

/**
 * Mock JWKS response that matches Clerk's format
 * Contains the public key for verifying test tokens
 */
export async function getMockClerkJWKS(): Promise<{
  keys: Array<JWK & { kid: string; alg: string; use: string }>;
}> {
  const keyPair = await getTestKeyPair();

  return {
    keys: [keyPair.publicJWK],
  };
}

/**
 * Standard Clerk claims sets for different scenarios
 */
export const clerkClaims = {
  /**
   * Basic user claims with minimal Clerk structure
   */
  basicUser: {
    sub: 'user_2NNEqL7nrIRjmAobmSdLOXChXxL',
    email: 'test@example.com',
    iss: 'https://test.clerk.accounts.dev',
    aud: 'https://test-app.com',
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    iat: Math.floor(Date.now() / 1000),
    nbf: Math.floor(Date.now() / 1000),
  },

  /**
   * User with organization membership
   */
  withOrganization: {
    sub: 'user_2NNEqL7nrIRjmAobmSdLOXChXxL',
    email: 'admin@acme-corp.com',
    iss: 'https://acme-corp.clerk.accounts.dev',
    aud: 'https://acme-app.com',
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    nbf: Math.floor(Date.now() / 1000),
    org_id: 'org_2NNEqM8nRiRHJCGcaLKvNQr9Qjh',
    org_slug: 'acme-corp',
    org_role: 'admin',
  },

  /**
   * Session token with session ID
   */
  withSessionId: {
    sub: 'user_2NNEqL7nrIRjmAobmSdLOXChXxL',
    email: 'session@example.com',
    iss: 'https://session-test.clerk.accounts.dev',
    aud: 'https://session-app.com',
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    nbf: Math.floor(Date.now() / 1000),
    session_id: 'sess_2NNEqN9nSiRJoDPdbMTwQsPHKk3',
  },

  /**
   * Token with authorized party (cross-origin)
   */
  withAuthorizedParty: {
    sub: 'user_2NNEqL7nrIRjmAobmSdLOXChXxL',
    email: 'azp@example.com',
    iss: 'https://azp-test.clerk.accounts.dev',
    aud: 'https://api.example.com',
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    nbf: Math.floor(Date.now() / 1000),
    azp: 'https://frontend.example.com',
  },

  /**
   * Actor token for impersonation scenarios
   */
  withActor: {
    sub: 'user_2NNEqL7nrIRjmAobmSdLOXChXxL',
    email: 'impersonated@example.com',
    iss: 'https://actor-test.clerk.accounts.dev',
    aud: 'https://actor-app.com',
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    nbf: Math.floor(Date.now() / 1000),
    session_id: 'sess_actor_token',
    act: {
      sub: 'user_admin_2OOFrN1nTjKLpEFgbNUzXwrQmn4',
      role: 'admin',
    },
  },

  /**
   * Complete token with all possible Clerk claims
   */
  complete: {
    sub: 'user_2NNEqL7nrIRjmAobmSdLOXChXxL',
    email: 'complete@example.com',
    email_verified: true,
    iss: 'https://complete-test.clerk.accounts.dev',
    aud: 'https://complete-app.com',
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    nbf: Math.floor(Date.now() / 1000),
    azp: 'https://frontend.complete.com',
    org_id: 'org_2NNEqM8nRiRHJCGcaLKvNQr9Qjh',
    org_slug: 'complete-corp',
    org_role: 'admin',
    session_id: 'sess_2NNEqN9nSiRJoDPdbMTwQsPHKk3',
    // Custom claims
    custom_claim: 'test-value',
    metadata: {
      plan: 'enterprise',
      features: ['feature-a', 'feature-b'],
    },
  },
};

/**
 * Creates a valid Clerk JWT token with the specified options
 * Uses real RSA signing for cryptographic validity
 */
export async function createValidClerkToken(
  options: {
    userId?: string;
    email?: string;
    sessionId?: string;
    orgId?: string;
    orgSlug?: string;
    orgRole?: string;
    azp?: string;
    issuer?: string;
    audience?: string;
    expiresIn?: string;
    customClaims?: Record<string, unknown>;
  } = {}
): Promise<string> {
  const keyPair = await getTestKeyPair();
  const now = Math.floor(Date.now() / 1000);

  // Parse expiresIn (default to 1 hour)
  let expirationTime = now + 3600;
  if (options.expiresIn) {
    const match = options.expiresIn.match(/^(\d+)([smhd])$/);
    if (match && match[1] && match[2]) {
      const value = parseInt(match[1]);
      const unit = match[2];
      const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
      expirationTime =
        now + value * multipliers[unit as keyof typeof multipliers];
    }
  }

  // Build claims
  const claims: Record<string, unknown> = {
    sub: options.userId || 'user_2NNEqL7nrIRjmAobmSdLOXChXxL',
    iss: options.issuer || 'https://test.clerk.accounts.dev',
    aud: options.audience || 'https://test-app.com',
    exp: expirationTime,
    iat: now,
    nbf: now,
    email: options.email || 'test@example.com',
    ...options.customClaims,
  };

  // Add optional Clerk-specific claims
  if (options.sessionId) claims['session_id'] = options.sessionId;
  if (options.orgId) claims['org_id'] = options.orgId;
  if (options.orgSlug) claims['org_slug'] = options.orgSlug;
  if (options.orgRole) claims['org_role'] = options.orgRole;
  if (options.azp) claims['azp'] = options.azp;

  // Create and sign JWT
  const jwt = new SignJWT(claims).setProtectedHeader({
    alg: 'RS256',
    typ: 'JWT',
    kid: keyPair.keyId,
  });

  return jwt.sign(keyPair.privateKey);
}

/**
 * Creates an expired Clerk JWT token
 * Expired 1 hour ago for reliable testing
 */
export async function createExpiredClerkToken(): Promise<string> {
  const keyPair = await getTestKeyPair();
  const now = Math.floor(Date.now() / 1000);

  const claims = {
    sub: 'user_expired_2NNEqL7nrIRjmAobmSdLOXChXxL',
    email: 'expired@example.com',
    iss: 'https://expired.clerk.accounts.dev',
    aud: 'https://expired-app.com',
    exp: now - 3600, // Expired 1 hour ago
    iat: now - 7200, // Issued 2 hours ago
    nbf: now - 7200, // Valid from 2 hours ago
  };

  return new SignJWT(claims)
    .setProtectedHeader({
      alg: 'RS256',
      typ: 'JWT',
      kid: keyPair.keyId,
    })
    .sign(keyPair.privateKey);
}

/**
 * Creates a Clerk token with invalid signature
 * Signs with a different key to ensure signature verification fails
 */
export async function createInvalidSignatureClerkToken(): Promise<string> {
  // Generate a different key pair for invalid signature
  const { privateKey } = await generateKeyPair('RS256', {
    modulusLength: 2048,
  });

  const testKeyPair = await getTestKeyPair();
  const now = Math.floor(Date.now() / 1000);

  const claims = {
    sub: 'user_invalid_2NNEqL7nrIRjmAobmSdLOXChXxL',
    email: 'invalid@example.com',
    iss: 'https://invalid.clerk.accounts.dev',
    aud: 'https://invalid-app.com',
    exp: now + 3600,
    iat: now,
    nbf: now,
  };

  // Sign with different private key but claim to use test key ID
  return new SignJWT(claims)
    .setProtectedHeader({
      alg: 'RS256',
      typ: 'JWT',
      kid: testKeyPair.keyId, // Correct key ID but wrong private key
    })
    .sign(privateKey); // Wrong private key
}

/**
 * Creates a token that's not yet valid (nbf in future)
 */
export async function createNotYetValidClerkToken(): Promise<string> {
  const keyPair = await getTestKeyPair();
  const now = Math.floor(Date.now() / 1000);

  const claims = {
    sub: 'user_future_2NNEqL7nrIRjmAobmSdLOXChXxL',
    email: 'future@example.com',
    iss: 'https://future.clerk.accounts.dev',
    aud: 'https://future-app.com',
    exp: now + 7200, // Valid for 2 hours once nbf passes
    iat: now,
    nbf: now + 3600, // Not valid for 1 hour
  };

  return new SignJWT(claims)
    .setProtectedHeader({
      alg: 'RS256',
      typ: 'JWT',
      kid: keyPair.keyId,
    })
    .sign(keyPair.privateKey);
}

/**
 * Edge case tokens for comprehensive testing
 */
export const edgeCaseTokens = {
  /**
   * Token with missing issuer claim
   */
  async missingIssuer(): Promise<string> {
    const keyPair = await getTestKeyPair();
    const now = Math.floor(Date.now() / 1000);

    const claims = {
      sub: 'user_no_iss_2NNEqL7nrIRjmAobmSdLOXChXxL',
      email: 'no-issuer@example.com',
      aud: 'https://no-issuer-app.com',
      exp: now + 3600,
      iat: now,
      nbf: now,
      // Missing 'iss' claim
    };

    return new SignJWT(claims)
      .setProtectedHeader({
        alg: 'RS256',
        typ: 'JWT',
        kid: keyPair.keyId,
      })
      .sign(keyPair.privateKey);
  },

  /**
   * Token with non-Clerk issuer
   */
  async nonClerkIssuer(): Promise<string> {
    const keyPair = await getTestKeyPair();
    const now = Math.floor(Date.now() / 1000);

    const claims = {
      sub: 'user_non_clerk_2NNEqL7nrIRjmAobmSdLOXChXxL',
      email: 'non-clerk@example.com',
      iss: 'https://evil.auth0.com/', // Not a Clerk issuer
      aud: 'https://non-clerk-app.com',
      exp: now + 3600,
      iat: now,
      nbf: now,
    };

    return new SignJWT(claims)
      .setProtectedHeader({
        alg: 'RS256',
        typ: 'JWT',
        kid: keyPair.keyId,
      })
      .sign(keyPair.privateKey);
  },

  /**
   * Token with multiple audiences
   */
  async multipleAudiences(): Promise<string> {
    const keyPair = await getTestKeyPair();
    const now = Math.floor(Date.now() / 1000);

    const claims = {
      sub: 'user_multi_aud_2NNEqL7nrIRjmAobmSdLOXChXxL',
      email: 'multi-aud@example.com',
      iss: 'https://multi-aud.clerk.accounts.dev',
      aud: [
        'https://app.example.com',
        'https://admin.example.com',
        'https://api.example.com',
      ],
      exp: now + 3600,
      iat: now,
      nbf: now,
    };

    return new SignJWT(claims)
      .setProtectedHeader({
        alg: 'RS256',
        typ: 'JWT',
        kid: keyPair.keyId,
      })
      .sign(keyPair.privateKey);
  },

  /**
   * Token with very long expiration (1 year)
   */
  async longExpiration(): Promise<string> {
    const keyPair = await getTestKeyPair();
    const now = Math.floor(Date.now() / 1000);

    const claims = {
      sub: 'user_long_exp_2NNEqL7nrIRjmAobmSdLOXChXxL',
      email: 'long-exp@example.com',
      iss: 'https://long-exp.clerk.accounts.dev',
      aud: 'https://long-exp-app.com',
      exp: now + 365 * 24 * 3600, // 1 year
      iat: now,
      nbf: now,
    };

    return new SignJWT(claims)
      .setProtectedHeader({
        alg: 'RS256',
        typ: 'JWT',
        kid: keyPair.keyId,
      })
      .sign(keyPair.privateKey);
  },

  /**
   * Token with unknown key ID
   */
  async unknownKeyId(): Promise<string> {
    const keyPair = await getTestKeyPair();
    const now = Math.floor(Date.now() / 1000);

    const claims = {
      sub: 'user_unknown_kid_2NNEqL7nrIRjmAobmSdLOXChXxL',
      email: 'unknown-kid@example.com',
      iss: 'https://unknown-kid.clerk.accounts.dev',
      aud: 'https://unknown-kid-app.com',
      exp: now + 3600,
      iat: now,
      nbf: now,
    };

    return new SignJWT(claims)
      .setProtectedHeader({
        alg: 'RS256',
        typ: 'JWT',
        kid: 'unknown-key-id-not-in-jwks',
      })
      .sign(keyPair.privateKey);
  },
};

/**
 * Mock HTTP server for JWKS endpoint
 * Serves the test JWKS at /.well-known/jwks.json
 */
export class MockJWKSServer {
  private server: Server | null = null;
  private port: number;

  constructor(port: number = 0) {
    this.port = port;
  }

  /**
   * Start the mock JWKS server
   * @returns Promise resolving to the server URL
   */
  async start(): Promise<string> {
    if (this.server) {
      throw new Error('Server is already running');
    }

    const jwks = await getMockClerkJWKS();

    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => {
        if (req.url === '/.well-known/jwks.json') {
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          });
          res.end(JSON.stringify(jwks));
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Not Found' }));
        }
      });

      this.server.listen(this.port, () => {
        if (this.server) {
          const address = this.server.address();
          if (address && typeof address === 'object') {
            this.port = address.port;
            resolve(`http://localhost:${this.port}`);
          } else {
            reject(new Error('Failed to get server address'));
          }
        }
      });

      this.server.on('error', reject);
    });
  }

  /**
   * Stop the mock JWKS server
   */
  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    return new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close(error => {
          this.server = null;
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get the JWKS URL for this server
   */
  getJWKSUrl(): string {
    if (!this.server) {
      throw new Error('Server is not running');
    }
    return `http://localhost:${this.port}/.well-known/jwks.json`;
  }
}

/**
 * Setup function that creates a complete mock environment for Clerk token testing
 * Returns tokens, JWKS, and cleanup function
 */
export async function setupClerkMocks(): Promise<{
  validToken: string;
  expiredToken: string;
  invalidToken: string;
  notYetValidToken: string;
  jwks: any;
  jwksServer: MockJWKSServer;
  cleanup: () => Promise<void>;
}> {
  // Generate all test tokens
  const validToken = await createValidClerkToken();
  const expiredToken = await createExpiredClerkToken();
  const invalidToken = await createInvalidSignatureClerkToken();
  const notYetValidToken = await createNotYetValidClerkToken();
  const jwks = await getMockClerkJWKS();

  // Start JWKS server
  const jwksServer = new MockJWKSServer();
  await jwksServer.start();

  const cleanup = async (): Promise<void> => {
    await jwksServer.stop();
  };

  return {
    validToken,
    expiredToken,
    invalidToken,
    notYetValidToken,
    jwks,
    jwksServer,
    cleanup,
  };
}

/**
 * Test utilities for common scenarios
 */
export const testUtils = {
  /**
   * Create a Clerk token for testing organization features
   */
  async createOrgToken(
    orgId: string,
    orgSlug: string,
    orgRole: string
  ): Promise<string> {
    return createValidClerkToken({
      userId: `user_org_${orgId}`,
      email: `${orgRole}@${orgSlug}.com`,
      issuer: `https://${orgSlug}.clerk.accounts.dev`,
      sessionId: `sess_org_${orgId}`,
      orgId,
      orgSlug,
      orgRole,
    });
  },

  /**
   * Create a Clerk token for testing authorized parties
   */
  async createAzpToken(azp: string): Promise<string> {
    return createValidClerkToken({
      userId: 'user_azp_test',
      email: 'azp-test@example.com',
      issuer: 'https://azp-test.clerk.accounts.dev',
      azp,
    });
  },

  /**
   * Create a Clerk token for testing impersonation
   */
  async createActorToken(actorSub: string, actorRole: string): Promise<string> {
    return createValidClerkToken({
      userId: 'user_impersonated',
      email: 'impersonated@example.com',
      issuer: 'https://actor-test.clerk.accounts.dev',
      sessionId: 'sess_actor_test',
      customClaims: {
        act: {
          sub: actorSub,
          role: actorRole,
        },
      },
    });
  },

  /**
   * Parse a JWT token without verification for testing
   */
  parseTokenUnsafe(token: string): any {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const payload = parts[1];
    if (!payload) {
      throw new Error('Invalid token: missing payload');
    }

    const payloadJson = Buffer.from(payload, 'base64url').toString('utf-8');
    return JSON.parse(payloadJson);
  },

  /**
   * Get current timestamp in JWT format (seconds)
   */
  getCurrentJWTTimestamp(): number {
    return Math.floor(Date.now() / 1000);
  },

  /**
   * Create a timestamp for testing relative to now
   */
  getRelativeTimestamp(offsetSeconds: number): number {
    return Math.floor(Date.now() / 1000) + offsetSeconds;
  },
};

/**
 * Type exports for test type safety
 */
export type { ClerkJWTClaims };
export type MockClerkToken = string;
export type ClerkClaimsSubset = Partial<ClerkJWTClaims>;
