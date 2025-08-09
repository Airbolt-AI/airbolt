# Security Guide for Airbolt

This document outlines security considerations, best practices, and requirements for deploying Airbolt in production environments.

## Current Security Status

### Development vs Production

**Current Implementation**: Designed for development and small-scale testing
**Production Requirements**: Requires additional security measures before deployment

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

## Critical Security TODOs

### 🚨 MUST IMPLEMENT BEFORE PRODUCTION

#### 1. JWT Signature Verification

**Current State**: JWTs are decoded but NOT verified
**Required**: Implement proper signature verification for all providers

```typescript
// ❌ Current: Unsafe decoding only
const payload = JSON.parse(atob(token.split('.')[1]));

// ✅ Required: Proper verification
const payload = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
```

**Implementation Requirements**:

- Fetch and cache provider public keys
- Verify signatures using appropriate algorithms (RS256, HS256)
- Handle key rotation gracefully
- Implement proper error handling

#### 2. Token Expiration Validation

**Required**: Check token expiration for all providers

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

**Required**: Validate token issuer and audience claims

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

**Current Risk**: Hardcoded or weak secrets
**Required**: Cryptographically secure secret generation and management

```bash
# Generate secure secret
openssl rand -base64 64

# Minimum requirements:
# - 256 bits (32 characters) minimum
# - Cryptographically random
# - Stored in secure environment variables
# - Rotation plan for production
```

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

```bash
# JWT Secrets (generate with openssl rand -base64 64)
JWT_SECRET=your-cryptographically-secure-secret

# Provider-specific secrets
AUTH0_DOMAIN=your-domain.auth0.com
AUTH0_AUDIENCE=your-api-identifier

CLERK_SECRET_KEY=your-clerk-secret-key

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_JWT_SECRET=your-supabase-jwt-secret

FIREBASE_PROJECT_ID=your-firebase-project-id
# Firebase service account credentials (JSON)
```

### Environment Security Best Practices

1. **Never commit secrets to version control**
2. **Use secure secret management in production** (AWS Secrets Manager, HashiCorp Vault, etc.)
3. **Rotate secrets regularly** (at least annually)
4. **Use different secrets per environment** (dev/staging/prod)
5. **Implement secret scanning** in CI/CD pipeline

## Production Security Checklist

### Before Deployment

- [ ] **JWT signature verification implemented** for all supported providers
- [ ] **Token expiration validation** in place
- [ ] **Issuer and audience validation** configured
- [ ] **Cryptographically secure JWT_SECRET** generated and secured
- [ ] **Environment variables secured** and rotated from defaults
- [ ] **HTTPS enforced** for all authentication endpoints
- [ ] **Security headers configured** (CORS, CSP, HSTS, etc.)
- [ ] **Rate limiting implemented** on authentication endpoints
- [ ] **Audit logging enabled** for authentication events
- [ ] **Session invalidation** implemented for logout
- [ ] **Error messages sanitized** (no sensitive data leakage)
- [ ] **Input validation comprehensive** (all request parameters)
- [ ] **Security testing completed** (penetration testing, vulnerability scanning)

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

```typescript
// Recommended rate limits
const authRateLimits = {
  '/api/auth/exchange': {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 requests per IP per window
    skipSuccessfulRequests: false,
    standardHeaders: true,
  },

  '/api/auth/validate': {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60, // 60 requests per IP per minute
    skipSuccessfulRequests: true,
  },
};
```

### Implementation Example

```typescript
import rateLimit from '@fastify/rate-limit';

// Register rate limiting
await fastify.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  skipOnError: true,
});

// Provider-specific rate limiting
fastify.register(async function (fastify) {
  await fastify.register(rateLimit, authRateLimits['/api/auth/exchange']);

  fastify.post('/api/auth/exchange', async (request, reply) => {
    // Authentication logic
  });
});
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

## Security Testing

### Required Testing

1. **JWT Vulnerability Testing**
   - Test with malformed tokens
   - Test with expired tokens
   - Test with modified signatures
   - Test algorithm confusion attacks

2. **Authentication Flow Testing**
   - Test all provider authentication flows
   - Test session management edge cases
   - Test concurrent authentication attempts
   - Test token refresh scenarios

3. **Property-Based Testing**
   ```typescript
   // Example property test for JWT validation
   test.prop([
     fc.string(), // Random token
     fc.constantFrom('auth0', 'clerk', 'supabase', 'firebase'), // Provider
   ])('rejects invalid tokens gracefully', (token, provider) => {
     expect(() => validateProviderToken(token)).toThrow();
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
