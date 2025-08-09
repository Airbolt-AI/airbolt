# Production Deployment Guide

Simple, actionable steps for deploying Airbolt's JWT validation in production.

## Quick Start

### Required Environment Variables

```bash
# Core Configuration (REQUIRED)
NODE_ENV=production
JWT_SECRET=your-64-char-hex-secret  # Generate: node -p "require('crypto').randomBytes(32).toString('hex')"
ALLOWED_ORIGIN=https://yourdomain.com
AI_PROVIDER=openai
OPENAI_API_KEY=sk-your-key

# JWT Validation (REQUIRED)
VALIDATE_JWT=true
EXTERNAL_JWT_ISSUER=https://your-tenant.auth0.com/  # Or your auth provider's issuer
```

### Optional Configuration

```bash
# Rate Limiting
RATE_LIMIT_MAX=60                    # Requests per window (default: 60)
RATE_LIMIT_TIME_WINDOW=60000        # Window in ms (default: 1 minute)

# Token Limits
TOKEN_LIMIT_MAX=100000              # Tokens per window (default: 100k)
TOKEN_LIMIT_TIME_WINDOW=3600000     # Window in ms (default: 1 hour)

# Auth Provider Specific (choose one)
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=https://your-api-identifier

CLERK_PUBLISHABLE_KEY=pk_your_key
CLERK_SECRET_KEY=sk_your_key

FIREBASE_PROJECT_ID=your-project-id

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_JWT_SECRET=your-32-char-secret
```

## JWT Validation Behavior

### Development Mode (`NODE_ENV=development`)

- **VALIDATE_JWT=false** by default (auto-configured)
- Basic token decoding only
- Provider detection from claims
- Perfect for rapid development

### Production Mode (`NODE_ENV=production`)

- **VALIDATE_JWT=true** required
- Full signature verification
- Token expiration checking
- Issuer/audience validation

## Security Features

### Auto-Configuration

✅ JWT secrets auto-generated in development  
✅ CORS origins validated (HTTPS required in production)  
✅ API key format validation  
✅ Rate limiting enabled by default

### Production Validation

✅ Strong JWT secret enforcement (32+ characters)  
✅ HTTPS-only CORS origins  
✅ Issuer URL validation  
✅ Token expiration checks

## Upgrade Path: When You Hit 1000+ Users

Current setup handles 100-1000 users perfectly. For larger scale:

### Performance Optimizations

1. **Enable JWT caching** - Add Redis for token validation
2. **Scale horizontally** - Deploy multiple instances behind load balancer
3. **Database optimization** - Consider read replicas for user data

### Enhanced Security

1. **Signature verification** - Already enabled with `VALIDATE_JWT=true`
2. **Token rotation** - Implement refresh token flow
3. **Rate limit per user** - Individual user quotas (already supported)

### Monitoring & Observability

1. **Request logging** - Built-in structured logging
2. **Error tracking** - Comprehensive error handling with context
3. **Performance metrics** - Add APM integration

## Common Configurations

### Auth0 Production Setup

```bash
NODE_ENV=production
VALIDATE_JWT=true
EXTERNAL_JWT_ISSUER=https://your-tenant.auth0.com/
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=https://your-api-identifier
JWT_SECRET=your-generated-secret
ALLOWED_ORIGIN=https://yourdomain.com
```

### Clerk Production Setup

```bash
NODE_ENV=production
VALIDATE_JWT=true
CLERK_PUBLISHABLE_KEY=pk_your_key
CLERK_SECRET_KEY=sk_your_key
JWT_SECRET=your-generated-secret
ALLOWED_ORIGIN=https://yourdomain.com
```

### Custom JWT Provider

```bash
NODE_ENV=production
VALIDATE_JWT=true
EXTERNAL_JWT_ISSUER=https://your-auth-server.com/
EXTERNAL_JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----..."  # OR
EXTERNAL_JWT_SECRET=your-secret  # For HMAC
EXTERNAL_JWT_AUDIENCE=your-api-audience
JWT_SECRET=your-generated-secret
ALLOWED_ORIGIN=https://yourdomain.com
```

## Deployment Checklist

### Before You Deploy

- [ ] `JWT_SECRET` is 32+ characters (required in production)
- [ ] `ALLOWED_ORIGIN` is your HTTPS domain (not localhost)
- [ ] `VALIDATE_JWT=true` is set explicitly
- [ ] Auth provider issuer URL is configured
- [ ] API keys are valid and active
- [ ] Rate limits are appropriate for your use case

### After Deployment

- [ ] Test authentication flow end-to-end
- [ ] Verify rate limiting works as expected
- [ ] Check error logging captures issues properly
- [ ] Monitor token validation performance

## Troubleshooting

### "JWT_SECRET is required in production"

Generate a secure secret:

```bash
node -p "require('crypto').randomBytes(32).toString('hex')"
```

### "ALLOWED_ORIGIN required in production"

Set your frontend domain:

```bash
ALLOWED_ORIGIN=https://yourdomain.com
```

### "Token issuer mismatch"

Ensure `EXTERNAL_JWT_ISSUER` matches your auth provider exactly:

```bash
# Auth0 example
EXTERNAL_JWT_ISSUER=https://dev-abc123.auth0.com/
```

### "JWT validation failed"

Check that `VALIDATE_JWT=true` and auth provider is configured properly.

## Why This Architecture?

**Toyota Camry Philosophy**: Reliable, maintainable, gets the job done.

- **Simple**: One config file, clear defaults
- **Secure**: Production-ready validation out of the box
- **Scalable**: Handles 1000+ users, upgrade path documented
- **Debuggable**: Comprehensive logging and error messages
- **Flexible**: Works with any JWT provider
