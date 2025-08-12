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
# Install dependencies
pnpm install

# Copy environment configuration
cp .env.example .env
# Edit .env with your API keys

# Start development server
pnpm dev

# Run tests
pnpm test
```

The API will be available at [http://localhost:3000](http://localhost:3000)

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
| `EXTERNAL_JWT_ISSUER`       | External JWT issuer URL (for BYOA mode)        | None                    | Valid HTTPS URL                                    |
| `EXTERNAL_JWT_AUDIENCE`     | Expected audience claim for external JWTs      | None                    | Any string                                         |
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

# Production
pnpm start            # Start production server
pnpm build            # Build for production

# Testing
pnpm test             # Run all tests
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

The API supports two authentication modes:

1. **Internal JWT** (Development/Default): Generate tokens using the `/api/tokens` endpoint
2. **External JWT** (Production/BYOA): Use tokens from external providers like Clerk, Auth0, Firebase

#### POST `/api/tokens`

Generate a JWT token for API access (only available when external auth is not configured).

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

#### POST `/api/auth/exchange`

Exchange an external JWT token (from Clerk, Auth0, etc.) for an internal session token.

**Request Body:**

```json
{
  "token": "external-jwt-token-from-your-auth-provider"
}
```

**Response:**

```json
{
  "sessionToken": "eyJhbGciOiJIUzI1NiIs...",
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

- http://localhost:3000/docs

OpenAPI specification is automatically generated and available at:

- http://localhost:3000/docs/json

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
curl http://localhost:3000/

# Response
{
  "message": "Hello World!"
}
```

## Learn More

- [Fastify Documentation](https://fastify.dev/docs/latest/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Zod Documentation](https://zod.dev/)
