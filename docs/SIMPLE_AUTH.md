# Simple Authentication for Small Scale (100-1000 Users)

## Overview: The Toyota Camry Approach

This is our **pragmatic authentication strategy** for small-scale applications. Like choosing a reliable Toyota Camry over a Mercedes - it gets you where you need to go without unnecessary complexity.

**Philosophy**: Optimize for developer productivity and operational simplicity at 100-1000 user scale, not enterprise-grade complexity.

## The Three-Layer Solution

### 1. Client-Side Provider Token Caching (55 minutes)

```typescript
// Client manages provider tokens with 55-minute cache
const tokenManager = {
  cache: new Map(),

  async getToken(provider: 'auth0' | 'clerk') {
    const cached = this.cache.get(provider);
    if (cached && cached.expiresAt > Date.now() + 5 * 60 * 1000) {
      return cached.token; // 5min buffer before expiry
    }

    const fresh = await this.refreshFromProvider(provider);
    this.cache.set(provider, {
      token: fresh,
      expiresAt: Date.now() + 55 * 60 * 1000, // 55 minutes
    });
    return fresh;
  },
};
```

### 2. Session Token Exchange Endpoint

```typescript
// Single endpoint: POST /api/auth/exchange
fastify.post('/api/auth/exchange', async request => {
  const { providerToken, provider } = request.body;

  // Validate with provider (cached for 55min on client)
  const user = await validateWithProvider(providerToken, provider);

  // Return short-lived session token
  return {
    sessionToken: jwt.sign({ userId: user.id }, secret, { expiresIn: '1h' }),
    user,
  };
});
```

### 3. Simple LRU Session Cache

```typescript
// In-memory LRU cache - perfect for this scale
const sessionCache = new LRU({
  max: 2000, // 2x max users
  ttl: 1000 * 60 * 60, // 1 hour
});

// Validate session tokens
async function validateSession(sessionToken: string) {
  const cached = sessionCache.get(sessionToken);
  if (cached) return cached;

  const payload = jwt.verify(sessionToken);
  sessionCache.set(sessionToken, payload);
  return payload;
}
```

## Why This Works at 100-1000 Users

### Scale Math

- **1000 users** × **8 hours active** × **1 auth per hour** = **8,000 auth calls/day**
- **Provider limits**: Auth0/Clerk handle 100K+ calls/day easily
- **Memory usage**: 2000 cached sessions = ~2MB RAM
- **Response time**: In-memory cache = <1ms lookup

### 98% Reduction in Provider Calls

Without caching:

- User opens 10 tabs = 10 provider calls
- User refreshes page = another provider call
- **Result**: 50+ provider calls per active user

With our approach:

- Provider token cached 55 minutes client-side
- Session token cached 1 hour server-side
- **Result**: ~1 provider call per user per hour

## Simple Usage Examples

### React Client

```typescript
// App.tsx
function App() {
  const { sessionToken, getSessionToken } = useAuth();

  return (
    <AirboltChatWidget
      sessionToken={sessionToken}
      onTokenRefresh={getSessionToken}
      apiUrl="https://your-api.com"
    />
  );
}

// useAuth.ts - handles the 55min caching automatically
const useAuth = () => {
  const [sessionToken, setSessionToken] = useState(null);

  const getSessionToken = async () => {
    const providerToken = await auth0.getTokenSilently(); // Cached 55min
    const response = await fetch('/api/auth/exchange', {
      method: 'POST',
      body: JSON.stringify({ providerToken, provider: 'auth0' })
    });
    const { sessionToken } = await response.json();
    setSessionToken(sessionToken);
    return sessionToken;
  };

  return { sessionToken, getSessionToken };
};
```

### Server Validation

```typescript
// Middleware - simple and fast
fastify.decorateRequest('user', null);

fastify.addHook('preHandler', async request => {
  const token = request.headers.authorization?.replace('Bearer ', '');
  if (!token) throw fastify.httpErrors.unauthorized();

  const user = sessionCache.get(token) || jwt.verify(token);
  if (!user) throw fastify.httpErrors.unauthorized();

  sessionCache.set(token, user); // Refresh cache
  request.user = user;
});
```

## When to Scale Up

Consider more complexity when you hit these indicators:

### User Scale Indicators

- **5000+ active users**: In-memory cache memory pressure
- **50+ auth calls/second**: Need distributed session storage
- **Multi-region deployment**: Need centralized session management

### Operational Indicators

- **Multiple server instances**: Sessions don't sync across servers
- **Frequent memory issues**: LRU cache eviction causing performance problems
- **Provider rate limits**: Actually hitting Auth0/Clerk limits (rare but possible)

### Business Indicators

- **Enterprise customers**: Demanding SSO, audit logs, session management
- **Compliance requirements**: Need session auditing, forced logouts
- **Security team requirements**: Want circuit breakers, detailed monitoring

## What We Intentionally DON'T Have

### No Circuit Breakers

**Why**: Provider downtime is rare, and graceful degradation is overkill at this scale. If Auth0/Clerk is down, your users can't log in anyway.

### No Rate Limiting

**Why**: Auth0/Clerk's built-in rate limits are sufficient. Adding our own just creates another failure point.

### No Complex Monitoring

**Why**: Watch your logs. If users can't authenticate, you'll know immediately. APM tools are overkill for auth at this scale.

### No Redis/External Cache

**Why**: In-memory is faster, simpler, and sufficient. One less service to maintain, monitor, and debug.

### No Session Persistence Across Restarts

**Why**: Server restarts are rare, and users can re-authenticate seamlessly. The complexity isn't worth it.

### No Distributed Session Management

**Why**: Single server instance handles 1000 users easily. Premature optimization leads to premature complexity.

## Success Metrics

You'll know this approach is working when:

- **Developer experience**: New developers understand auth flow in 10 minutes
- **Operations**: Zero auth-related incidents or debugging sessions
- **Performance**: Sub-10ms authentication validation
- **Costs**: Minimal provider API costs, no additional infrastructure
- **User experience**: Seamless, invisible authentication

## Migration Path (When You Outgrow This)

When you need to scale:

1. **Redis sessions**: Replace LRU with Redis for multi-server
2. **Distributed caching**: Add Redis cluster for global session sync
3. **Circuit breakers**: Add resilience patterns for high-availability needs
4. **Audit logging**: Add session tracking for compliance
5. **Session management APIs**: Add admin controls for enterprise features

But until then, keep it simple. Your users and your team will thank you.

## Security Considerations

### Current Security Measures

This simple authentication approach includes several security layers:

#### 1. JWT Token Validation

- **Client-side tokens**: Provider tokens cached for 55 minutes
- **Session tokens**: Server-issued tokens with 1-hour expiration
- **Token format validation**: Proper JWT structure verification

#### 2. Provider Integration Security

- **Multi-provider support**: Auth0, Clerk, Supabase, Firebase
- **Token exchange pattern**: Secure provider token → session token conversion
- **Provider detection**: Automatic provider identification from token claims

#### 3. Session Management

- **Short-lived sessions**: 1-hour session token expiration
- **LRU cache**: Memory-efficient session storage with automatic cleanup
- **Cache refresh**: Session validation refreshes cache TTL

### Security TODOs for Production

**CRITICAL**: The following security measures MUST be implemented before production deployment:

#### 1. JWT Signature Verification

```typescript
// TODO: Current implementation only decodes JWTs without verification
// MUST implement proper signature verification for production:

// Auth0: Verify using public keys from /.well-known/jwks.json
// Clerk: Verify using Clerk's public keys
// Supabase: Verify using project JWT secret
// Firebase: Verify using Google's public keys
```

#### 2. Token Expiration Checks

```typescript
// TODO: Implement token expiration validation
if (claims.exp && claims.exp < Date.now() / 1000) {
  throw new Error('Token has expired');
}
```

#### 3. Issuer and Audience Validation

```typescript
// TODO: Validate token issuer and audience
if (claims.iss !== expectedIssuer) {
  throw new Error('Invalid token issuer');
}
if (claims.aud !== expectedAudience) {
  throw new Error('Invalid token audience');
}
```

#### 4. Secure JWT_SECRET Management

- **Generate cryptographically secure secret**: Use `openssl rand -base64 64`
- **Environment variable**: Store in secure environment variables
- **Rotation**: Plan for secret rotation in production
- **Length**: Minimum 256 bits (32 characters) for HS256

### Production Security Checklist

Before deploying to production, ensure:

- [ ] **JWT signature verification** implemented for all providers
- [ ] **Token expiration validation** in place
- [ ] **Issuer/audience validation** configured
- [ ] **Strong JWT_SECRET** generated and secured
- [ ] **HTTPS only** for all authentication endpoints
- [ ] **Rate limiting** on auth endpoints (optional but recommended)
- [ ] **Security headers** configured (CORS, CSP, etc.)
- [ ] **Audit logging** for authentication events
- [ ] **Session invalidation** on logout

### Provider-Specific Security Notes

#### Auth0

- Verify tokens against Auth0's JWKS endpoint
- Validate audience matches your Auth0 application
- Check custom claims namespace if used

#### Clerk

- Use Clerk's official JWT verification
- Validate against your Clerk application
- Handle Clerk-specific claims properly

#### Supabase

- Use project-specific JWT secret
- Validate RLS policies are properly configured
- Check email confirmation status if required

#### Firebase

- Verify against Google's public keys
- Validate Firebase project ID
- Check Firebase-specific security rules

### Rate Limiting Recommendations

While not implemented in the basic version, consider adding:

```typescript
// Optional: Rate limiting for auth endpoints
const authRateLimit = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window per IP
  skipSuccessfulRequests: true,
};
```

### Session Security Best Practices

#### Session Token Security

- **Short expiration**: 1-hour maximum for session tokens
- **Secure storage**: HttpOnly cookies preferred over localStorage
- **Token refresh**: Implement seamless token refresh flow

#### Cache Security

- **Memory limits**: LRU cache prevents memory exhaustion
- **Secure cleanup**: Ensure sensitive data is cleared on eviction
- **No persistent storage**: In-memory only for this scale

### Monitoring and Alerting

For production deployment, monitor:

- **Failed authentication attempts**: Track provider validation failures
- **Token validation errors**: Monitor JWT verification failures
- **Session creation/validation rates**: Detect unusual patterns
- **Provider API errors**: Track upstream authentication issues

### Compliance Considerations

Depending on your requirements:

- **Data residency**: Ensure provider data handling meets requirements
- **Audit trails**: Log authentication events for compliance
- **Session management**: Implement forced logout capabilities
- **Data retention**: Plan for user data deletion/export

Remember: This simple approach is designed for 100-1000 users. As you scale, additional security measures and compliance requirements may necessitate more complex authentication patterns.
