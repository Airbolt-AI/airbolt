# Security Guide for Airbolt

This document outlines security considerations, best practices, and requirements for deploying Airbolt in production environments.

## Current Security Status

### Development vs Production

**Current Implementation**: Production-ready with comprehensive JWT verification
**Production Requirements**: ✅ All critical security measures implemented

### Security Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Client App    │    │  Airbolt API     │    │ Auth Providers  │
│                 │    │                  │    │                 │
│ Provider Token  │───▶│ Token Exchange   │───▶│ Auth0/Clerk/    │
│ (55min cache)   │    │ & Validation     │    │ Supabase/       │
│                 │    │                  │    │ Firebase        │
│ Session Token   │◀───│ Session Cache    │    │                 │
│ (1hr expiry)    │    │ (LRU, 1hr TTL)   │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Security Implementation Status

### ✅ PRODUCTION READY

#### 1. JWT Signature Verification

**Status**: ✅ **IMPLEMENTED** - Production-ready JWT signature verification is active

**Implementation**: Complete JWT verification system using the `jose` library with:

- Cryptographic signature validation for all providers
- JWKS key fetching and caching (24-hour cache)
- Support for RS256 and HS256 algorithms
- Proper error handling and security validation

**Key Files**:

- `/apps/backend-api/src/auth/jwt-verifier.ts` - Main verification logic
- `/apps/backend-api/src/auth/jwks-cache.ts` - Key caching system
- `/apps/backend-api/src/auth/clerk-verifier.ts` - Clerk-specific verification
- `/apps/backend-api/src/auth/oidc-verifier.ts` - Generic OIDC verification

**Features**:

- Single-flight coalescing prevents duplicate verifications
- Rate limiting (10 requests/15 minutes per IP/user)
- Comprehensive audit logging
- Development mode with backwards compatibility

#### 2. Token Expiration Validation

**Status**: ✅ **IMPLEMENTED** - Token expiration validation for all providers

```typescript
// ✅ Required implementation
if (!claims.exp || claims.exp < Date.now() / 1000) {
  throw new Error('Token has expired');
}

// Consider clock skew (typically 30-60 seconds tolerance)
const clockSkew = 60; // seconds
if (claims.exp < Date.now() / 1000 - clockSkew) {
  throw new Error('Token has expired');
}
```

#### 3. Issuer and Audience Validation

**Status**: ✅ **IMPLEMENTED** - Provider-specific issuer and audience validation

```typescript
// ✅ Required for each provider
const expectedIssuers = {
  auth0: 'https://your-domain.auth0.com/',
  clerk: 'https://your-domain.clerk.accounts.dev',
  supabase: 'https://your-project.supabase.co/auth/v1',
  firebase: 'https://securetoken.google.com/your-project-id',
};

if (claims.iss !== expectedIssuers[provider]) {
  throw new Error('Invalid token issuer');
}
```

#### 4. Secure JWT_SECRET Management

**Status**: ✅ **IMPLEMENTED** - Environment-based cryptographically secure secret management

```bash
# Generate secure secret
openssl rand -base64 64

# Minimum requirements:
# - 256 bits (32 characters) minimum
# - Cryptographically random
# - Stored in secure environment variables
# - Rotation plan for production
```

## JWT Verification Architecture

### Overview

The JWT verification system provides secure, production-ready authentication with comprehensive validation:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Client Token  │    │  JWT Verifier    │    │ Auth Providers  │
│                 │    │                  │    │                 │
│ Bearer Token    │───▶│ • Signature      │───▶│ • JWKS Endpoints│
│ (from provider) │    │   Verification   │    │ • Public Keys   │
│                 │    │ • Claims Valid.  │    │ • Issuer URLs   │
│ Session Token   │◀───│ • Rate Limiting  │    │                 │
│ (10min expiry)  │    │ • Audit Logging  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Key Components

#### JWT Verifier (`/apps/backend-api/src/auth/jwt-verifier.ts`)

- **Primary verification engine** using `jose` library
- **Single-flight coalescing** prevents duplicate token verifications
- **Development mode** support for backwards compatibility
- **Comprehensive error handling** with specific error types

#### JWKS Cache (`/apps/backend-api/src/auth/jwks-cache.ts`)

- **24-hour key caching** with automatic refresh
- **Cooldown protection** prevents excessive key fetching
- **Multi-provider support** with provider-specific key handling

#### Provider-Specific Verifiers

- **Clerk Verifier** (`/apps/backend-api/src/auth/clerk-verifier.ts`) - Handles Clerk's dynamic JWKS
- **OIDC Verifier** (`/apps/backend-api/src/auth/oidc-verifier.ts`) - Generic OIDC compliance
- **Auth0/Supabase/Firebase** - Integrated through the main verifier

### Verification Flow

1. **Token Extraction** - Extract JWT from Authorization header
2. **Issuer Validation** - Validate issuer before network calls
3. **JWKS Resolution** - Fetch and cache appropriate public keys
4. **Signature Verification** - Cryptographic validation using `jose`
5. **Claims Validation** - Check expiration, issuer, audience
6. **Audit Logging** - Record verification events

## Supported Auth Providers

### Clerk

**Configuration**: Auto-detected from environment variables

```bash
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_AUTHORIZED_PARTIES=comma,separated,list  # Optional
```

**Features**: Dynamic JWKS resolution, authorized parties validation
**Algorithm**: RS256
**Issuer Pattern**: Contains `clerk.accounts.dev`, `clerk.dev`, or `clerk-`

### Auth0

**Configuration**: Domain-based setup

```bash
AUTH0_DOMAIN=your-domain.auth0.com
AUTH0_AUDIENCE=your-api-identifier  # Optional
AUTH0_ISSUER=https://your-domain.auth0.com/  # Optional, computed from domain
```

**Features**: Standard OIDC compliance, audience validation
**Algorithm**: RS256
**JWKS**: `https://{domain}/.well-known/jwks.json`

### Supabase

**Configuration**: URL and JWT secret

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_JWT_SECRET=your-jwt-secret-key  # Minimum 32 characters
```

**Features**: HMAC signature validation
**Algorithm**: HS256
**Issuer Pattern**: Contains `.supabase.co` or `supabase.`

### Firebase

**Configuration**: Project-based setup

```bash
FIREBASE_PROJECT_ID=your-firebase-project-id
```

**Features**: Google's public key validation
**Algorithm**: RS256
**JWKS**: Google's robot service account endpoint
**Issuer Pattern**: Contains `securetoken.google.com`, `firebaseapp.com`, or `firebase.com`

### Custom OIDC

**Configuration**: Full OIDC compliance

```bash
EXTERNAL_JWT_ISSUER=https://your-oidc-provider.com
EXTERNAL_JWT_JWKS_URI=https://your-provider.com/.well-known/jwks.json  # Optional
EXTERNAL_JWT_AUDIENCE=your-audience  # Optional
EXTERNAL_JWT_PUBLIC_KEY=-----BEGIN CERTIFICATE-----...  # Optional
EXTERNAL_JWT_SECRET=your-hmac-secret  # Optional for HS256
```

**Features**: Maximum flexibility, supports both RS256 and HS256
**Algorithm**: RS256, ES256, or HS256 based on configuration

## Security Features

### Rate Limiting

**Exchange Endpoint**: 10 requests per 15 minutes per IP+User

- **Implementation**: `/apps/backend-api/src/auth/exchange-rate-limiter.ts`
- **Key Generation**: Combines client IP and user ID for accurate limiting
- **Memory Management**: Automatic cleanup of expired entries
- **Development Mode**: Rate limiting disabled in development

**Configuration**:

```bash
AUTH_RATE_LIMIT_MAX=10  # Max requests per window
AUTH_RATE_LIMIT_WINDOW_MS=900000  # 15 minutes in milliseconds
```

### Single-Flight Coalescing

**Purpose**: Prevents duplicate concurrent verification of identical tokens

- **Implementation**: `/apps/backend-api/src/auth/single-flight.ts`
- **Key Strategy**: Hash-based keys to protect token privacy
- **Memory Safety**: Automatic cleanup after completion
- **Performance**: Reduces redundant verification work

### Security Headers

**Applied Automatically**:

- `Content-Security-Policy`: Strict CSP with nonce support
- `Strict-Transport-Security`: HSTS with includeSubDomains
- `X-Frame-Options`: DENY
- `X-Content-Type-Options`: nosniff
- `Referrer-Policy`: strict-origin-when-cross-origin
- `Permissions-Policy`: Restrictive feature policy

### Audit Logging

**Comprehensive Event Tracking**:

- **Token Exchange Success/Failure** - With provider and user info
- **Rate Limit Exceeded** - With hit count and reset time
- **JWT Verification Failures** - With error type and context
- **Provider Mismatches** - When expected vs detected providers differ
- **Development Token Generation** - For backwards compatibility

**Implementation**: `/apps/backend-api/src/auth/audit-logger.ts`
**Data Sanitization**: User IDs truncated, emails show domain only
**Correlation IDs**: Request tracking across log entries

## Development vs Production

### Development Mode

**When Active**:

- `NODE_ENV` is not 'production' AND
- `AUTH_REQUIRED` environment variable is not set

**Features**:

- **Zero-config authentication** - No provider setup required
- **Automatic token generation** - Creates dev tokens for any request
- **Rate limiting disabled** - No request restrictions
- **Backwards compatibility** - Existing users can continue without auth setup

**Development Token**:

```typescript
// Generated automatically for requests without valid tokens
{
  sub: 'dev-user-{request-ip}',
  email: 'dev-{request-ip}@localhost',
  iss: 'airbolt-development',
  exp: Date.now() + 600 // 10 minutes
}
```

### Production Mode

**When Active**:

- `NODE_ENV` is 'production' OR
- `AUTH_REQUIRED` environment variable is set

**Requirements**:

- **Provider configuration mandatory** - At least one auth provider must be configured
- **Full JWT verification** - Cryptographic signature validation required
- **Rate limiting active** - All security features enabled
- **Audit logging comprehensive** - All events tracked

**Transition Steps**:

1. Configure at least one auth provider (environment variables)
2. Set `AUTH_REQUIRED=true` to enable verification in development
3. Test authentication flow with your provider
4. Deploy with `NODE_ENV=production`

## Provider-Specific Security Implementation

### Auth0 Security

```typescript
// Required implementation for Auth0
import jwksClient from 'jwks-rsa';

const client = jwksClient({
  jwksUri: 'https://your-domain.auth0.com/.well-known/jwks.json',
  cache: true,
  cacheMaxAge: 86400000, // 24 hours
  rateLimit: true,
  jwksRequestsPerMinute: 5,
});

async function validateAuth0Token(token: string) {
  const decoded = jwt.decode(token, { complete: true });
  const kid = decoded.header.kid;

  const key = await client.getSigningKey(kid);
  const signingKey = key.getPublicKey();

  return jwt.verify(token, signingKey, {
    audience: 'your-api-identifier',
    issuer: 'https://your-domain.auth0.com/',
    algorithms: ['RS256'],
  });
}
```

### Clerk Security

```typescript
// Required implementation for Clerk
import { verifyToken } from '@clerk/backend';

async function validateClerkToken(token: string) {
  return await verifyToken(token, {
    secretKey: process.env.CLERK_SECRET_KEY,
    // Additional options as needed
  });
}
```

### Supabase Security

```typescript
// Required implementation for Supabase
import jwt from 'jsonwebtoken';

function validateSupabaseToken(token: string) {
  return jwt.verify(token, process.env.SUPABASE_JWT_SECRET, {
    issuer: process.env.SUPABASE_URL + '/auth/v1',
    algorithms: ['HS256'],
  });
}
```

### Firebase Security

```typescript
// Required implementation for Firebase
import { getAuth } from 'firebase-admin/auth';

async function validateFirebaseToken(token: string) {
  return await getAuth().verifyIdToken(token);
}
```

## Environment Security

### Required Environment Variables

#### JWT Verification Configuration

```bash
# JWT session token configuration (generate with openssl rand -base64 64)
JWT_SECRET=your-cryptographically-secure-secret
JWT_EXPIRES_IN=10m  # Session token expiry (default: 10 minutes)
JWT_ALGORITHM=HS256  # Signing algorithm (HS256 or RS256)

# Authentication mode
AUTH_REQUIRED=true  # Enable auth in development (optional)
VALIDATE_JWT=true  # Enable JWT validation (default: true)
```

#### Provider-Specific Configuration

**Clerk**:

```bash
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_AUTHORIZED_PARTIES=comma,separated,parties  # Optional
```

**Auth0**:

```bash
AUTH0_DOMAIN=your-domain.auth0.com
AUTH0_AUDIENCE=your-api-identifier  # Optional
AUTH0_ISSUER=https://your-domain.auth0.com/  # Optional
```

**Supabase**:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_JWT_SECRET=your-supabase-jwt-secret  # Min 32 chars
```

**Firebase**:

```bash
FIREBASE_PROJECT_ID=your-firebase-project-id
```

**Custom OIDC**:

```bash
EXTERNAL_JWT_ISSUER=https://your-oidc-provider.com
EXTERNAL_JWT_JWKS_URI=https://provider.com/.well-known/jwks.json  # Optional
EXTERNAL_JWT_AUDIENCE=your-audience  # Optional
EXTERNAL_JWT_PUBLIC_KEY=-----BEGIN CERTIFICATE-----...  # Optional
EXTERNAL_JWT_SECRET=your-hmac-secret  # Optional for HS256
```

#### Rate Limiting Configuration

```bash
AUTH_RATE_LIMIT_MAX=10  # Max requests per window (default: 10)
AUTH_RATE_LIMIT_WINDOW_MS=900000  # Window in ms (default: 15 minutes)
```

### Environment Security Best Practices

1. **Never commit secrets to version control**
2. **Use secure secret management in production** (AWS Secrets Manager, HashiCorp Vault, etc.)
3. **Rotate secrets regularly** (at least annually)
4. **Use different secrets per environment** (dev/staging/prod)
5. **Implement secret scanning** in CI/CD pipeline

## Production Security Checklist

### Core Security Features - Production Ready

- [x] **JWT signature verification implemented** ✅ Using `jose` library with cryptographic validation
- [x] **Token expiration validation** ✅ Built into `jose` verification process
- [x] **Issuer and audience validation** ✅ Provider-specific validation implemented
- [x] **Cryptographically secure JWT_SECRET** ✅ Required by environment validation
- [x] **Environment variables secured** ✅ Zod schema validation for all auth config
- [x] **Security headers configured** ✅ Comprehensive header middleware active
- [x] **Rate limiting implemented** ✅ 10 requests/15 minutes on auth endpoints
- [x] **Audit logging enabled** ✅ Structured logging for all auth events
- [x] **Error messages sanitized** ✅ No sensitive data in error responses
- [x] **Input validation comprehensive** ✅ Zod validation on all endpoints

### Additional Deployment Considerations

- [ ] **HTTPS enforced** ⚠️ Configure TLS termination in production
- [ ] **Session invalidation** ⚠️ Implement logout endpoint for session cleanup
- [ ] **Security testing completed** ⚠️ Run security audit before production deployment

### Infrastructure Security

- [ ] **TLS 1.2+ only** for all communications
- [ ] **Network segmentation** implemented
- [ ] **WAF configured** if using cloud providers
- [ ] **DDoS protection** enabled
- [ ] **Intrusion detection** monitoring in place
- [ ] **Regular security updates** automated
- [ ] **Backup and recovery** procedures tested
- [ ] **Incident response plan** documented

### Monitoring and Alerting

- [ ] **Failed authentication attempts** monitored
- [ ] **Token validation failures** alerted
- [ ] **Unusual traffic patterns** detected
- [ ] **Security events logged** centrally
- [ ] **Compliance reporting** automated if required

## Rate Limiting

### Authentication Endpoints

**Current Implementation**: Custom rate limiter with IP+User tracking

```typescript
// Active rate limits (configured in /apps/backend-api/src/auth/exchange-rate-limiter.ts)
const authRateLimits = {
  '/api/auth/exchange': {
    max: 10, // 10 requests per IP+User per window
    windowMs: 15 * 60 * 1000, // 15 minutes
    keyGenerator: req => `${extractIP(req)}:${extractUserId(req)}`,
    cleanupInterval: 5 * 60 * 1000, // 5 minutes
  },
};
```

### Implementation Details

```typescript
// Rate limiter features:
// 1. IP + User ID combination for accurate limiting
// 2. Automatic cleanup of expired entries
// 3. Development mode bypass
// 4. Memory usage monitoring

import { ExchangeRateLimiter } from './auth/exchange-rate-limiter.js';

const rateLimiter = new ExchangeRateLimiter({
  max: 10,
  windowMs: 15 * 60 * 1000,
});

// Usage in route handler:
const key = rateLimiter.generateKey(request);
const result = rateLimiter.checkLimit(key);

if (!result.allowed) {
  // Rate limit exceeded - return 429
  return reply.code(429).send({
    error: 'Rate limit exceeded',
    resetTime: result.resetTime,
    remaining: result.remaining,
  });
}

// Record the request attempt
rateLimiter.recordRequest(key, success);
```

## Session Management Security

### Session Token Security

```typescript
// Secure session token configuration
const sessionConfig = {
  // Short expiration for security
  expiresIn: '1h',

  // Strong algorithm
  algorithm: 'HS256',

  // Include security claims
  issuer: 'your-app-domain',
  audience: 'your-app-users',

  // Optional: Include session context
  jti: generateUniqueId(), // JWT ID for revocation
};
```

### Cache Security

```typescript
// Secure LRU cache configuration
const sessionCache = new LRU({
  max: 2000,
  ttl: 1000 * 60 * 60, // 1 hour

  // Security enhancements
  updateAgeOnGet: true, // Refresh active sessions
  stale: false, // Never return stale sessions

  // Memory protection
  maxSize: 10 * 1024 * 1024, // 10MB max
});

// Secure session cleanup
process.on('exit', () => {
  sessionCache.clear();
});
```

## Troubleshooting

### Common JWT Verification Errors

#### "Token signature verification failed"

**Cause**: Invalid signature or wrong signing key
**Solutions**:

1. Verify provider configuration matches token issuer
2. Check JWKS endpoint is accessible: `curl https://your-provider/.well-known/jwks.json`
3. Ensure provider's signing key hasn't rotated
4. Validate token format: should have 3 parts separated by dots

#### "Token has expired"

**Cause**: Token `exp` claim is in the past
**Solutions**:

1. Check token expiration with JWT decoder (jwt.io)
2. Ensure client and server clocks are synchronized
3. Consider clock skew tolerance (currently 5 seconds)

#### "Token issuer validation failed"

**Cause**: Token `iss` claim doesn't match expected issuer
**Solutions**:

1. Verify provider configuration issuer matches token
2. Check environment variables for typos
3. Ensure external issuer is correctly configured

#### "Rate limit exceeded"

**Cause**: Too many authentication requests from same IP+User
**Solutions**:

1. Check rate limit configuration: `AUTH_RATE_LIMIT_MAX` and `AUTH_RATE_LIMIT_WINDOW_MS`
2. Review audit logs for request patterns
3. Consider increasing limits for high-traffic applications
4. Implement token caching on client side

### Debugging Auth Issues

#### Enable Debug Logging

```bash
# Set log level to debug for detailed auth events
LOG_LEVEL=debug
```

#### Check Provider Configuration

```typescript
// Use auth config summary for safe logging
import { createConfigSummary } from './auth/auth-config.js';

const configSummary = createConfigSummary(authConfig);
console.log('Auth Configuration:', configSummary);
```

#### Validate JWKS Endpoints

```bash
# Test JWKS endpoint accessibility
curl -v "https://your-domain.auth0.com/.well-known/jwks.json"
curl -v "https://clerk.your-domain.com/.well-known/jwks.json"
```

#### Test Token Structure

```typescript
// Safely decode token to inspect claims (without verification)
const parts = token.split('.');
const header = JSON.parse(atob(parts[0]));
const payload = JSON.parse(atob(parts[1]));

console.log('Token Header:', header);
console.log('Token Payload:', payload);
```

### Checking Audit Logs

#### Key Event Types

- `AUTH_TOKEN_EXCHANGE_SUCCESS` - Successful authentications
- `AUTH_TOKEN_EXCHANGE_FAILURE` - Failed authentication attempts
- `AUTH_JWT_VERIFICATION_FAILURE` - JWT verification errors
- `AUTH_RATE_LIMIT_EXCEEDED` - Rate limiting events
- `AUTH_PROVIDER_MISMATCH` - Provider detection issues

#### Log Analysis

```bash
# Filter auth events from logs
grep "AUTH_" application.log

# Count failed attempts by IP
grep "AUTH_TOKEN_EXCHANGE_FAILURE" application.log | jq '.ip' | sort | uniq -c

# Check rate limit patterns
grep "AUTH_RATE_LIMIT_EXCEEDED" application.log | jq '{ip, userId, metadata}'
```

#### Monitoring Queries

```sql
-- Example queries for log analysis systems
SELECT COUNT(*) as failures, ip
FROM logs
WHERE event = 'AUTH_TOKEN_EXCHANGE_FAILURE'
  AND timestamp > NOW() - INTERVAL '1 hour'
GROUP BY ip
ORDER BY failures DESC;

SELECT provider, metadata->>'errorType', COUNT(*)
FROM logs
WHERE event = 'AUTH_JWT_VERIFICATION_FAILURE'
  AND timestamp > NOW() - INTERVAL '24 hours'
GROUP BY provider, metadata->>'errorType';
```

## Security Testing

### ✅ Implemented Security Features

1. **JWT Signature Verification** - Complete cryptographic validation
2. **Provider Auto-Detection** - Secure issuer validation
3. **Rate Limiting** - IP+User tracking with cleanup
4. **Audit Logging** - Comprehensive event tracking
5. **Single-Flight Coalescing** - Prevents duplicate verifications
6. **Security Headers** - Full CSP, HSTS, frame protection
7. **Development Mode** - Backwards compatible zero-config

### Required Testing

1. **JWT Vulnerability Testing** ✅
   - Malformed tokens rejected by `jose` library
   - Expired tokens handled with proper error messages
   - Modified signatures fail cryptographic verification
   - Algorithm confusion prevented by issuer validation

2. **Authentication Flow Testing** ✅
   - All providers tested with property-based tests
   - Concurrent requests handled by single-flight coalescing
   - Rate limiting tested with various request patterns
   - Session management with configurable expiration

3. **Property-Based Testing** ✅
   ```typescript
   // Existing tests in /apps/backend-api/src/auth/__tests__/
   test.prop([
     fc.string().filter(s => s.split('.').length !== 3), // Invalid format
     fc.constantFrom('auth0', 'clerk', 'supabase', 'firebase'),
   ])('rejects malformed tokens', async (token, provider) => {
     await expect(verifyJWT(token)).rejects.toThrow();
   });
   ```

### Security Test Checklist

- [ ] **Authentication bypass attempts** tested
- [ ] **Token manipulation attacks** tested
- [ ] **Session fixation attacks** tested
- [ ] **Privilege escalation attempts** tested
- [ ] **Input validation attacks** tested (SQL injection, XSS, etc.)
- [ ] **Rate limiting effectiveness** verified
- [ ] **Error handling** doesn't leak sensitive information
- [ ] **Logging** captures security events appropriately

## Incident Response

### Security Incident Categories

1. **Authentication Bypass**: Unauthorized access to protected resources
2. **Token Compromise**: JWT tokens leaked or compromised
3. **Provider Outage**: Authentication provider unavailable
4. **Rate Limit Breach**: Excessive authentication attempts detected
5. **Data Exposure**: Sensitive user data potentially exposed

### Response Procedures

#### Immediate Actions (0-15 minutes)

1. **Assess impact** and scope of incident
2. **Contain threat** (block IPs, revoke tokens if possible)
3. **Document** initial findings
4. **Notify** security team and stakeholders

#### Short-term Actions (15 minutes - 2 hours)

1. **Investigate** root cause
2. **Implement** temporary mitigations
3. **Monitor** for continued threats
4. **Communicate** with affected users if needed

#### Medium-term Actions (2-24 hours)

1. **Deploy** permanent fixes
2. **Verify** security posture restored
3. **Update** security measures
4. **Conduct** post-incident review

## Compliance Considerations

### Data Protection

- **GDPR Compliance**: User consent, data portability, right to deletion
- **CCPA Compliance**: User privacy rights, data sharing transparency
- **Industry Standards**: SOC 2, ISO 27001, PCI DSS if applicable

### Audit Requirements

- **Authentication Events**: Log all authentication attempts
- **Authorization Events**: Log access to protected resources
- **Configuration Changes**: Log security setting modifications
- **Data Access**: Log sensitive data access patterns

### Data Retention

```typescript
// Example audit log retention policy
const auditRetentionPolicy = {
  authenticationLogs: '2 years',
  securityEvents: '7 years',
  errorLogs: '1 year',
  accessLogs: '1 year',
};
```

## Security Contacts

### Reporting Security Issues

- **Email**: security@your-domain.com
- **PGP Key**: [Link to public key]
- **Response Time**: 24 hours for critical issues

### Security Team Contacts

- **Security Lead**: [Contact information]
- **DevOps Lead**: [Contact information]
- **Incident Response**: [Contact information]

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [JWT Security Best Practices](https://datatracker.ietf.org/doc/html/rfc8725)
- [Auth0 Security Documentation](https://auth0.com/docs/security)
- [Clerk Security Guide](https://clerk.com/docs/security)
- [Supabase Security](https://supabase.com/docs/guides/platform/security)
- [Firebase Security Rules](https://firebase.google.com/docs/rules)

---

**Remember**: Security is not a one-time implementation but an ongoing process. Regularly review and update security measures as your application and threat landscape evolve.
