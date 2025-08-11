# Clerk JWT Test Fixtures

This directory contains comprehensive test fixtures for Clerk JWT token testing as part of Phase 3b of the JWT verification system.

## Overview

The `clerk-tokens.ts` file provides:

- **Real RSA key generation** for cryptographically valid test tokens
- **Mock JWKS endpoints** with proper key formatting
- **Token generators** for various Clerk scenarios
- **Edge case tokens** for comprehensive testing
- **Mock HTTP server** for integration testing
- **Test utilities** for common operations

## Quick Start

```typescript
import {
  createValidClerkToken,
  setupClerkMocks,
  testUtils,
} from './fixtures/clerk-tokens.js';

// Generate a valid Clerk token
const token = await createValidClerkToken({
  userId: 'user_test_123',
  email: 'test@example.com',
  sessionId: 'sess_test_456',
  orgId: 'org_test_789',
  orgRole: 'admin',
  expiresIn: '1h',
});

// Set up complete mock environment
const { validToken, jwksServer, cleanup } = await setupClerkMocks();
try {
  // Use tokens in your tests
  const claims = testUtils.parseTokenUnsafe(validToken);
  console.log(claims);
} finally {
  await cleanup();
}
```

## Token Generators

### Basic Token Creation

```typescript
// Valid token with default settings
const token = await createValidClerkToken();

// Expired token (1 hour ago)
const expiredToken = await createExpiredClerkToken();

// Token with invalid signature
const invalidToken = await createInvalidSignatureClerkToken();

// Token not yet valid (nbf in future)
const futureToken = await createNotYetValidClerkToken();
```

### Custom Token Options

```typescript
const customToken = await createValidClerkToken({
  userId: 'user_custom_123',
  email: 'custom@test.com',
  sessionId: 'sess_custom_456',
  orgId: 'org_custom_789',
  orgSlug: 'my-org',
  orgRole: 'member',
  azp: 'https://frontend.example.com',
  issuer: 'https://my-org.clerk.accounts.dev',
  audience: 'https://api.example.com',
  expiresIn: '2h', // Supports: s, m, h, d
  customClaims: {
    plan: 'enterprise',
    features: ['feature-a', 'feature-b'],
  },
});
```

## Edge Case Tokens

```typescript
// Token with missing issuer claim
const noIssuer = await edgeCaseTokens.missingIssuer();

// Token with non-Clerk issuer
const nonClerk = await edgeCaseTokens.nonClerkIssuer();

// Token with multiple audiences
const multiAud = await edgeCaseTokens.multipleAudiences();

// Token with very long expiration (1 year)
const longExp = await edgeCaseTokens.longExpiration();

// Token with unknown key ID
const unknownKid = await edgeCaseTokens.unknownKeyId();
```

## Predefined Claims Sets

Use predefined claims for consistent testing:

```typescript
// Basic user claims
const basicClaims = clerkClaims.basicUser;

// User with organization
const orgClaims = clerkClaims.withOrganization;

// Session token
const sessionClaims = clerkClaims.withSessionId;

// Token with authorized party
const azpClaims = clerkClaims.withAuthorizedParty;

// Actor token (impersonation)
const actorClaims = clerkClaims.withActor;

// Complete token with all fields
const completeClaims = clerkClaims.complete;
```

## Test Utilities

```typescript
// Create specialized tokens
const orgToken = await testUtils.createOrgToken(
  'org_123',
  'acme-corp',
  'admin'
);
const azpToken = await testUtils.createAzpToken('https://frontend.com');
const actorToken = await testUtils.createActorToken(
  'user_admin_456',
  'super-admin'
);

// Parse tokens safely (without verification)
const claims = testUtils.parseTokenUnsafe(token);

// Timestamp helpers
const now = testUtils.getCurrentJWTTimestamp();
const future = testUtils.getRelativeTimestamp(3600); // 1 hour from now
const past = testUtils.getRelativeTimestamp(-3600); // 1 hour ago
```

## JWKS and Mock Server

### Mock JWKS Response

```typescript
const jwks = await getMockClerkJWKS();
console.log(jwks.keys[0]); // RSA public key in JWKS format
```

### HTTP Server for Integration Tests

```typescript
const server = new MockJWKSServer();
const baseUrl = await server.start();
const jwksUrl = server.getJWKSUrl(); // http://localhost:port/.well-known/jwks.json

// Use in integration tests...

await server.stop();
```

### Complete Setup Helper

```typescript
const mockSetup = await setupClerkMocks();

// Available resources:
mockSetup.validToken; // Valid signed token
mockSetup.expiredToken; // Expired token
mockSetup.invalidToken; // Invalid signature
mockSetup.notYetValidToken; // nbf in future
mockSetup.jwks; // JWKS response
mockSetup.jwksServer; // Running HTTP server

// Always cleanup
await mockSetup.cleanup();
```

## Integration with Clerk Verifier

These fixtures are designed to work with the Clerk verifier:

```typescript
import { verifyClerkToken } from '../../src/auth/clerk-verifier.js';

// This will work with proper JWKS setup
const token = await createValidClerkToken();
const claims = await verifyClerkToken(token);

// This will fail signature verification
const invalidToken = await createInvalidSignatureClerkToken();
await expect(verifyClerkToken(invalidToken)).rejects.toThrow();

// This will fail expiration check
const expiredToken = await createExpiredClerkToken();
await expect(verifyClerkToken(expiredToken)).rejects.toThrow();
```

## Real Cryptographic Validation

Unlike simple mock JWTs, these fixtures generate:

- **Real RSA key pairs** using the `jose` library
- **Cryptographically valid signatures** that can be verified
- **Proper JWKS formatting** that matches Clerk's structure
- **Realistic token claims** that follow Clerk patterns

This ensures your tests validate actual JWT verification logic, not just parsing.

## Example Test Structure

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  setupClerkMocks,
  createValidClerkToken,
} from './fixtures/clerk-tokens.js';
import { verifyClerkToken } from '../src/auth/clerk-verifier.js';

describe('Clerk Integration', () => {
  let mockSetup: Awaited<ReturnType<typeof setupClerkMocks>>;

  beforeAll(async () => {
    mockSetup = await setupClerkMocks();
  });

  afterAll(async () => {
    await mockSetup.cleanup();
  });

  it('should verify valid tokens', async () => {
    const token = await createValidClerkToken({
      userId: 'user_test',
      orgId: 'org_test',
      orgRole: 'admin',
    });

    const claims = await verifyClerkToken(token);
    expect(claims.sub).toBe('user_test');
    expect(claims.org_id).toBe('org_test');
    expect(claims.org_role).toBe('admin');
  });

  it('should reject expired tokens', async () => {
    await expect(verifyClerkToken(mockSetup.expiredToken)).rejects.toThrow(
      'expired'
    );
  });
});
```

## Best Practices

1. **Use setupClerkMocks()** for integration tests that need complete environments
2. **Create custom tokens** for specific test scenarios using createValidClerkToken()
3. **Test edge cases** using the edgeCaseTokens collection
4. **Always cleanup** mock servers to prevent resource leaks
5. **Use testUtils.parseTokenUnsafe()** to inspect token claims without verification
6. **Leverage predefined claims** for consistency across tests

## Security Notes

- These fixtures generate real cryptographic keys for testing
- Private keys are only used in test environments
- Tokens are cryptographically valid but use test key pairs
- Never use these fixtures or keys in production
- Mock servers bind to localhost only for security

## Files

- `clerk-tokens.ts` - Main fixtures and utilities
- `clerk-tokens.test.ts` - Comprehensive test suite demonstrating usage
- `README.md` - This documentation file
