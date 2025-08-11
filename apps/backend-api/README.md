# Airbolt Backend API

A production-ready backend for calling LLMs from your frontend securely. Built with Fastify, TypeScript, and comprehensive security features.

## Features

- **Multi-Provider Support**: Call multiple AI providers (OpenAI, Anthropic, and more) from your frontend without exposing API keys
- **JWT Authentication**: 15-minute access tokens for secure API access
- **Rate Limiting**: Configurable per-minute request limits (default: 100 req/min)
- **CORS Support**: Configure allowed origins for your frontend
- **One-Click Deploy**: Deploy to Render with a single click
- **Type Safety**: Full TypeScript with strict validation using Zod

## Quick Start

```bash
# Copy environment configuration
cp .env.example .env

# Install dependencies
pnpm install

# Start development server
pnpm dev

# Run tests
pnpm test
```

The API will be available at [http://localhost:3000](http://localhost:3000)

## Authentication

Airbolt supports multiple authentication providers with zero-config auto-detection and BYOA (Bring Your Own Auth) flexibility.

### Supported Providers

- **Clerk** - Zero-config authentication for development
- **Auth0** - Enterprise identity platform
- **Supabase** - Open-source Firebase alternative
- **Firebase** - Google's authentication service
- **Custom OIDC** - Any OpenID Connect provider

### Zero-Config Clerk Authentication

In development mode, Clerk tokens are automatically accepted without configuration:

```typescript
// Frontend: Use any Clerk token
const { getToken } = useAuth();
const token = await getToken();

// API automatically detects and validates Clerk tokens
const response = await fetch('/api/chat', {
  headers: { Authorization: `Bearer ${token}` },
});
```

**Production**: Requires explicit configuration for security.

### BYOA (Bring Your Own Auth) Configuration

#### Development Mode (Zero-Config)

```bash
# No configuration needed - all major providers work automatically
NODE_ENV=development
```

#### Production Mode (Explicit Configuration)

```bash
# Choose your authentication provider(s)
NODE_ENV=production

# Clerk
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Auth0
AUTH0_DOMAIN=your-domain.auth0.com
AUTH0_AUDIENCE=https://your-api.com

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_JWT_SECRET=your-jwt-secret

# Firebase
FIREBASE_PROJECT_ID=your-project-id

# Custom OIDC
EXTERNAL_JWT_ISSUER=https://your-provider.com/
EXTERNAL_JWT_AUDIENCE=your-api-identifier
```

### Authentication Flow

1. **Frontend**: Obtain JWT from your auth provider (Clerk, Auth0, etc.)
2. **API Exchange**: Send provider JWT to `/api/auth/exchange`
3. **Session Token**: Receive short-lived Airbolt session token
4. **API Calls**: Use session token for protected endpoints

```typescript
// Step 1: Get provider token (example with Clerk)
const providerToken = await getToken();

// Step 2: Exchange for session token
const response = await fetch('/api/auth/exchange', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token: providerToken }),
});

const { sessionToken } = await response.json();

// Step 3: Use session token for API calls
const chatResponse = await fetch('/api/chat', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${sessionToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ messages: [{ role: 'user', content: 'Hello!' }] }),
});
```

### Security Features

#### JWT Verification

- **JWKS Caching**: Public keys cached with TTL for performance
- **Single-Flight Coalescing**: Prevents duplicate JWKS requests
- **Issuer Validation**: Strict issuer matching for security
- **Algorithm Verification**: Only approved algorithms accepted

#### Rate Limiting

Authentication endpoints have dedicated rate limits:

```bash
# Auth-specific rate limiting
AUTH_RATE_LIMIT_MAX=10              # 10 exchanges per window
AUTH_RATE_LIMIT_WINDOW_MS=900000    # 15-minute window
```

#### Audit Logging

All authentication events are logged with:

- Provider detection
- Token validation results
- Rate limiting decisions
- Security violations

### Provider-Specific Configuration

#### Clerk Configuration

```bash
# Minimum for production
CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...

# Optional: Restrict authorized parties
CLERK_AUTHORIZED_PARTIES=https://your-app.com,https://admin.your-app.com
```

#### Auth0 Configuration

```bash
# Required
AUTH0_DOMAIN=your-tenant.auth0.com

# Recommended for API security
AUTH0_AUDIENCE=https://your-api-identifier

# Optional: Override auto-computed issuer
AUTH0_ISSUER=https://your-tenant.auth0.com/
```

#### Supabase Configuration

```bash
# Required
SUPABASE_URL=https://xyz.supabase.co
SUPABASE_JWT_SECRET=your-anon-or-service-role-key

# Note: Uses HS256 algorithm with shared secret
```

#### Firebase Configuration

```bash
# Required
FIREBASE_PROJECT_ID=your-project-id

# Note: Uses Google's public keys for RS256 verification
```

#### Custom OIDC Configuration

```bash
# Required
EXTERNAL_JWT_ISSUER=https://your-oidc-provider.com/

# Optional: Override JWKS discovery
EXTERNAL_JWT_JWKS_URI=https://your-provider.com/.well-known/jwks.json

# Optional: For audience validation
EXTERNAL_JWT_AUDIENCE=your-api-identifier

# For HMAC-based providers (rare)
EXTERNAL_JWT_SECRET=your-shared-secret

# For RSA without JWKS (rare)
EXTERNAL_JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----...
```

### Authentication Modes

The API operates in three authentication modes:

1. **Development Mode** (`NODE_ENV=development`)
   - Zero-config: All major providers accepted
   - Automatic token generation for testing
   - Relaxed security for rapid development

2. **Managed Mode** (Configured providers like Clerk, Auth0)
   - Provider-specific validation
   - Production security controls
   - Automatic provider detection

3. **Custom Mode** (Custom OIDC providers)
   - Full control over JWT validation
   - Custom issuer and audience validation
   - Support for non-standard providers

## Environment Configuration

All environment variables are validated using Zod schemas for type safety and runtime validation.

### Required Variables

Provide your AI provider's API key:

| Variable            | Description                            | Format       | Example                   |
| ------------------- | -------------------------------------- | ------------ | ------------------------- |
| `OPENAI_API_KEY`    | OpenAI API key (if using OpenAI)       | `sk-...`     | `sk-1234567890abcdef`     |
| `ANTHROPIC_API_KEY` | Anthropic API key (if using Anthropic) | `sk-ant-...` | `sk-ant-1234567890abcdef` |

### Optional Variables with Defaults

| Variable                    | Description                                    | Default                 | Valid Values                                       |
| --------------------------- | ---------------------------------------------- | ----------------------- | -------------------------------------------------- |
| `NODE_ENV`                  | Application environment                        | `development`           | `development`, `production`, `test`                |
| `PORT`                      | Server port                                    | `3000`                  | 1-65535                                            |
| `HOST`                      | Server host                                    | `localhost`             | Any valid hostname                                 |
| `LOG_LEVEL`                 | Logging verbosity                              | `info`                  | `fatal`, `error`, `warn`, `info`, `debug`, `trace` |
| `AI_PROVIDER`               | AI provider to use                             | `openai`                | `openai`, `anthropic`                              |
| `AI_MODEL`                  | Specific model to use                          | Provider default        | Any valid model for the selected provider          |
| `JWT_SECRET`                | Secret for JWT signing (auto-generated in dev) | Auto-generated          | Min 32 characters                                  |
| `ALLOWED_ORIGIN`            | CORS allowed origins (comma-separated)         | `*` (dev), test origins | Valid HTTP(S) URLs or `*` for all origins          |
| `SYSTEM_PROMPT`             | Custom AI system prompt                        | `""` (empty)            | Any string                                         |
| `RATE_LIMIT_MAX`            | Max requests per window (IP-based)             | `60`                    | Positive integer                                   |
| `RATE_LIMIT_TIME_WINDOW`    | Rate limit window (ms)                         | `60000` (1 minute)      | Positive integer (milliseconds)                    |
| `TOKEN_LIMIT_MAX`           | Max tokens per window (user-based)             | `100000` (100k)         | Min 1000                                           |
| `TOKEN_LIMIT_TIME_WINDOW`   | Token limit window (ms)                        | `3600000` (1 hour)      | Min 60000 (1 minute)                               |
| `REQUEST_LIMIT_MAX`         | Max requests per window (user-based)           | `100`                   | Positive integer                                   |
| `REQUEST_LIMIT_TIME_WINDOW` | Request limit window (ms)                      | `3600000` (1 hour)      | Min 60000 (1 minute)                               |

### Security Notes

- **JWT_SECRET**:
  - Automatically generated in development mode if not provided
  - **REQUIRED** in production - generate with: `openssl rand -hex 32`
  - Must be at least 32 characters for security
- **Sensitive Values**:
  - All sensitive environment variables (API keys, secrets) are automatically redacted in logs
  - Never commit `.env` files to version control

### CORS Configuration

The API supports flexible CORS configuration for different deployment scenarios:

```bash
# Allow all origins (SDK deployment model)
ALLOWED_ORIGIN=*

# Single origin
ALLOWED_ORIGIN=https://example.com

# Multiple origins (comma-separated)
ALLOWED_ORIGIN=https://example.com,https://app.example.com,http://localhost:3000
```

**Note**: The wildcard (`*`) is allowed in all environments to support the SDK deployment model where users deploy their own API instances. Security is handled through JWT tokens and rate limiting.

### Rate Limiting

The API implements dual rate limiting for comprehensive protection:

1. **IP-based rate limiting** (DDoS protection)
   - Applied to all requests
   - Default: 60 requests per minute
   - Prevents abuse from single IP addresses

2. **User-based rate limiting** (authenticated requests only)
   - **Token limits**: Track actual AI token consumption
   - **Request limits**: Track number of API calls
   - Both limits must be satisfied for requests to succeed
   - Limits are tracked by JWT `userId` (persists across token refreshes)

#### Rate Limiting Examples

```bash
# IP-based rate limiting (all requests)
RATE_LIMIT_MAX=60              # 60 requests per minute
RATE_LIMIT_TIME_WINDOW=60000   # 1 minute window

# Token-based rate limiting (authenticated users)
TOKEN_LIMIT_MAX=100000          # 100k tokens per hour
TOKEN_LIMIT_TIME_WINDOW=3600000 # 1 hour window

# Request-based rate limiting (authenticated users)
REQUEST_LIMIT_MAX=100           # 100 requests per hour
REQUEST_LIMIT_TIME_WINDOW=3600000 # 1 hour window
```

## Deployment

### Deploy to Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/markprompt/airbolt)

1. Click the button above
2. Enter your AI provider API key when prompted (OpenAI or Anthropic)
3. Render will automatically generate a secure JWT secret
4. Update `ALLOWED_ORIGIN` to match your frontend URL

### Manual Deployment

1. **Required Environment Variables**:
   - AI Provider API key (one of):
     - `OPENAI_API_KEY` - For OpenAI provider
     - `ANTHROPIC_API_KEY` - For Anthropic provider
   - `JWT_SECRET` - Generate with: `openssl rand -hex 32`
   - `NODE_ENV=production`
   - `AI_PROVIDER` - Set to `openai` or `anthropic` (defaults to `openai`)

2. **Build and Start**:
   ```bash
   pnpm install --frozen-lockfile
   pnpm build
   node apps/backend-api/dist/server.js
   ```

## Available Scripts

```bash
# Development
pnpm dev              # Start with hot reload
pnpm dev:debug        # Start with Node.js inspector

# Production
pnpm start            # Start production server
pnpm build            # Build for production

# Testing
pnpm test             # Run all tests
pnpm test:unit        # Run unit tests only
pnpm test:watch       # Run tests in watch mode
pnpm test:coverage    # Generate coverage report

# Code Quality
pnpm lint             # ESLint + Prettier check
pnpm lint:fix         # Auto-fix linting issues
pnpm type-check       # TypeScript compilation check

# OpenAPI
pnpm openapi:generate # Generate OpenAPI spec
```

## Project Structure

```
backend-api/
├── src/
│   ├── app.ts           # Fastify app factory
│   ├── server.ts        # Server entry point
│   ├── plugins/         # Fastify plugins
│   │   ├── env.ts       # Environment configuration
│   │   ├── sensible.ts  # Common utilities
│   │   ├── support.ts   # Request/reply decorators
│   │   └── swagger.ts   # API documentation
│   ├── routes/          # API routes
│   │   └── root.ts      # Health check endpoint
│   └── utils/           # Business logic utilities
├── test/                # Test suites
├── openapi.json         # Generated API spec
└── package.json         # Dependencies
```

## API Endpoints

### Authentication

#### POST `/api/auth/exchange`

Exchange your authentication provider's JWT for an Airbolt session token.

**Request Body:**

```json
{
  "token": "eyJhbGciOiJSUzI1NiIs..." // JWT from Clerk, Auth0, Supabase, etc.
}
```

**Response:**

```json
{
  "sessionToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": "10m",
  "tokenType": "Bearer",
  "provider": "clerk",
  "userId": "user_2abc123def456"
}
```

**Rate Limits:**

- 10 requests per 15-minute window (configurable)
- Applied per IP address

#### POST `/api/tokens` (Legacy)

Generate a JWT token for API access (development only).

**Request Body:**

```json
{
  "userId": "user-123" // Optional in development
}
```

**Response:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": "15m",
  "tokenType": "Bearer"
}
```

### Chat

#### POST `/api/chat`

Send chat messages to your configured AI provider.

**Headers:**

```
Authorization: Bearer <token>
```

**Request Body:**

```json
{
  "messages": [
    {
      "role": "user",
      "content": "Hello, how are you?"
    }
  ],
  "system": "Optional system prompt override"
}
```

**Response:**

```json
{
  "content": "I'm doing well, thank you! How can I help you today?",
  "usage": {
    "total_tokens": 42
  }
}
```

## API Documentation

When running in development, Swagger UI is available at:

- http://localhost:3000/documentation

OpenAPI specification is automatically generated and available at:

- http://localhost:3000/documentation/json

## Error Handling

The API uses Fastify's built-in error handling with custom error messages:

```typescript
// 400 Bad Request - Invalid input
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation error details"
}

// 404 Not Found
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "Resource not found"
}

// 500 Internal Server Error
{
  "statusCode": 500,
  "error": "Internal Server Error",
  "message": "Something went wrong"
}
```

## Architecture

- **Framework**: Fastify for high performance
- **Language**: TypeScript with strict type checking
- **Validation**: Zod for runtime validation
- **Authentication**: JWT tokens with configurable expiration
- **Rate Limiting**: Per-IP rate limiting using @fastify/rate-limit
- **Logging**: Structured JSON logging with Pino
- **Security**: CORS, Helmet, request validation

## Health Check

```bash
curl http://localhost:3000/health

# Response
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Learn More

- [Fastify Documentation](https://fastify.dev/docs/latest/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Zod Documentation](https://zod.dev/)
