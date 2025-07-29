# @airbolt/core

> Secure LLM proxy as a reusable Fastify plugin - the core of Airbolt's backend for calling AI providers without exposing API keys

```bash
# Latest stable version
npm install @airbolt/core

# Beta version (latest features)
npm install @airbolt/core@beta
```

**Part of [Airbolt](https://github.com/Airbolt-AI/airbolt)** - A production-ready backend for calling LLMs from your frontend securely.

## When to Use This Package

Use `@airbolt/core` when you want to:

- **Integrate Airbolt into an existing Fastify application**
- **Customize authentication beyond JWT** (bring your own auth)
- **Add custom middleware or routes** alongside Airbolt
- **Build a multi-tenant AI service** with dynamic API keys

If you just need a standalone API server, use the [main Airbolt deployment](../../README.md) instead.

## Quick Start

```typescript
import Fastify from 'fastify';
import { createAirboltCore } from '@airbolt/core';

const fastify = Fastify({ logger: true });

// Register Airbolt as a plugin
await fastify.register(createAirboltCore, {
  // Required: JWT secret for token signing
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key',

  // Required: Function to retrieve API keys
  getApiKey: async provider => {
    if (provider === 'openai') return process.env.OPENAI_API_KEY!;
    if (provider === 'anthropic') return process.env.ANTHROPIC_API_KEY!;
    throw new Error(`Unknown provider: ${provider}`);
  },

  // Optional: Configure allowed origins (default: ['*'])
  allowedOrigins: ['https://myapp.com', 'http://localhost:3000'],

  // Optional: Set system prompt
  systemPrompt: 'You are a helpful assistant.',
});

await fastify.listen({ port: 3000 });
```

## Features

### 🔒 Secure by Design

- **JWT Authentication**: Issues time-limited tokens (15min default)
- **No API Keys in Frontend**: Keys stay on your server
- **Rate Limiting**: Both IP-based and user-based limits
- **CORS Protection**: Configure allowed origins

### 🚀 Production Ready

- **Multi-Provider Support**: OpenAI, Anthropic, and more via [AI SDK](https://sdk.vercel.ai/)
- **Streaming Responses**: Real-time streaming with Server-Sent Events
- **Error Handling**: Fastify error patterns with proper status codes
- **TypeScript**: Full type safety with strict mode

### 🛠️ Highly Configurable

- **Dynamic API Keys**: Fetch keys from database, vault, or env
- **Custom Rate Limits**: Configure per-user or per-tenant limits
- **External JWT Support**: Integrate with Auth0, Clerk, etc.
- **Flexible CORS**: Support multiple origins or wildcards

## Configuration Options

```typescript
interface CoreOptions {
  // Required
  jwtSecret: string;
  getApiKey: (provider: string, userId?: string) => Promise<string> | string;

  // Optional with defaults
  allowedOrigins?: string[]; // Default: ['*']
  systemPrompt?: string; // Default: undefined
  rateLimitMax?: number; // Default: 60 req/min
  rateLimitTimeWindow?: number; // Default: 60000 (1 min)
  trustProxy?: boolean; // Default: false

  // User-based limits
  tokenLimitMax?: number; // Default: 100000 tokens/hour
  tokenLimitTimeWindow?: number; // Default: 3600000 (1 hour)
  requestLimitMax?: number; // Default: 100 req/hour
  requestLimitTimeWindow?: number; // Default: 3600000 (1 hour)

  // External JWT integration
  externalJwtIssuer?: string; // e.g., 'https://your-tenant.auth0.com/'
  externalJwtPublicKey?: string; // RS256 public key
  externalJwtSecret?: string; // HS256 shared secret
  externalJwtAudience?: string; // Expected audience
}
```

## Advanced Usage

### Dynamic API Keys per User

```typescript
await fastify.register(createAirboltCore, {
  jwtSecret: process.env.JWT_SECRET!,

  // Fetch API keys based on user context
  getApiKey: async (provider, userId) => {
    // Example: Fetch from database based on user's organization
    const user = await db.users.findById(userId);
    const org = await db.orgs.findById(user.orgId);

    if (provider === 'openai') return org.openaiKey;
    if (provider === 'anthropic') return org.anthropicKey;
    throw new Error(`No API key for provider: ${provider}`);
  },
});
```

### External JWT Integration (Auth0, Clerk, etc.)

```typescript
await fastify.register(createAirboltCore, {
  jwtSecret: process.env.JWT_SECRET!,
  getApiKey: async provider =>
    process.env[`${provider.toUpperCase()}_API_KEY`]!,

  // Configure external JWT validation
  externalJwtIssuer: 'https://your-tenant.auth0.com/',
  externalJwtPublicKey: process.env.AUTH0_PUBLIC_KEY,
  externalJwtAudience: 'https://api.yourapp.com',
});
```

### Custom Rate Limits

```typescript
await fastify.register(createAirboltCore, {
  jwtSecret: process.env.JWT_SECRET!,
  getApiKey: async provider =>
    process.env[`${provider.toUpperCase()}_API_KEY`]!,

  // IP-based rate limiting (DDoS protection)
  rateLimitMax: 100, // 100 requests
  rateLimitTimeWindow: 60000, // per minute

  // User-based rate limiting
  tokenLimitMax: 50000, // 50k tokens
  tokenLimitTimeWindow: 3600000, // per hour
  requestLimitMax: 200, // 200 requests
  requestLimitTimeWindow: 3600000, // per hour
});
```

### Adding Custom Routes

```typescript
const fastify = Fastify();

// Register Airbolt
await fastify.register(createAirboltCore, {
  /* config */
});

// Add your own routes
fastify.get('/custom/endpoint', async (request, reply) => {
  // Access Airbolt's services
  const usage = await fastify.getUserUsage(request.user.userId);
  return { usage };
});
```

## API Endpoints

Once registered, Airbolt adds these routes to your Fastify app:

### `POST /api/tokens`

Generate JWT tokens for API access.

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

### `POST /api/chat`

Send messages to AI providers.

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
      "content": "Hello!"
    }
  ],
  "system": "Optional system prompt override"
}
```

**Response:**

```json
{
  "content": "Hello! How can I help you today?",
  "usage": {
    "total_tokens": 42
  }
}
```

### `POST /api/chat/stream`

Stream responses using Server-Sent Events.

Same request format as `/api/chat`, but returns:

```
data: {"content":"Hello","usage":null}
data: {"content":"! How can I","usage":null}
data: {"content":" help you?","usage":{"total_tokens":42}}
data: [DONE]
```

## Exported Types and Utilities

```typescript
import {
  // Types
  type Message,
  type ProviderConfig,
  type CoreOptions,

  // Schemas (Zod)
  MessageSchema,
  ChatResponseSchema,
  ProviderConfigSchema,

  // Services
  AIProviderService,
  AIProviderError,

  // Constants
  PROVIDER_FEATURES,
} from '@airbolt/core';
```

## Error Handling

Airbolt uses Fastify's error handling patterns:

```typescript
try {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages }),
  });

  if (!response.ok) {
    const error = await response.json();
    // Handle specific errors
    switch (error.statusCode) {
      case 401:
        // Token expired or invalid
        break;
      case 429:
        // Rate limit exceeded
        console.log('Usage:', error.usage);
        break;
      case 500:
        // Server error
        break;
    }
  }
} catch (error) {
  // Network error
}
```

## Testing

When testing applications that use @airbolt/core:

```typescript
import { createTestEnv } from '@airbolt/test-utils';
import Fastify from 'fastify';
import { createAirboltCore } from '@airbolt/core';

beforeEach(() => {
  createTestEnv({
    OPENAI_API_KEY: 'sk-test-key',
  });
});

test('chat endpoint works', async () => {
  const app = Fastify();

  await app.register(createAirboltCore, {
    jwtSecret: 'test-secret',
    getApiKey: () => 'sk-test-key',
  });

  // Generate token
  const tokenResponse = await app.inject({
    method: 'POST',
    url: '/api/tokens',
    payload: { userId: 'test-user' },
  });

  const { token } = JSON.parse(tokenResponse.payload);

  // Test chat
  const chatResponse = await app.inject({
    method: 'POST',
    url: '/api/chat',
    headers: {
      authorization: `Bearer ${token}`,
    },
    payload: {
      messages: [{ role: 'user', content: 'Hello' }],
    },
  });

  expect(chatResponse.statusCode).toBe(200);
});
```

## Security Best Practices

1. **Always use environment variables** for sensitive configuration
2. **Generate strong JWT secrets** in production: `openssl rand -hex 32`
3. **Configure CORS** to only allow your frontend domains
4. **Monitor rate limits** to prevent abuse
5. **Rotate API keys** regularly using the dynamic `getApiKey` function
6. **Use HTTPS** in production with proper SSL certificates

## Learn More

- [Airbolt Documentation](https://github.com/Airbolt-AI/airbolt)
- [Fastify Documentation](https://fastify.dev)
- [AI SDK Documentation](https://sdk.vercel.ai)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
