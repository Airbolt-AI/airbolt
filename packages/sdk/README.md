# @airbolt/sdk

> Type-safe TypeScript SDK for the AI Fastify Template API

This package contains the auto-generated TypeScript SDK for consuming the AI Fastify Template API. The SDK provides full type safety, excellent developer experience, and is automatically kept in sync with the API specification.

## Installation

```bash
npm install @airbolt/sdk
# or
yarn add @airbolt/sdk
# or
pnpm add @airbolt/sdk
```

## Quick Start

```typescript
import { AiFastifyTemplateAPI } from '@airbolt/sdk';

// Initialize the client
const client = new AiFastifyTemplateAPI({
  environment: 'http://localhost:3000', // Development
  // environment: 'https://api.yourdomain.com', // Production
});

// Make type-safe API calls
async function example() {
  try {
    // Get welcome message
    const welcome = await client.getRootMessage();
    console.log(welcome.message); // "Hello World!"

    // Get example response
    const example = await client.getExampleMessage();
    console.log(example); // "this is an example"
  } catch (error) {
    console.error('API Error:', error);
  }
}
```

## Features

### 🔒 Type Safety

- Full TypeScript support with auto-generated types
- Compile-time validation of request/response data
- IntelliSense and autocomplete in your IDE

### 🚀 Developer Experience

- Promise-based API with async/await support
- Structured error handling with specific error types
- Comprehensive documentation and examples

### 🔄 Always Up-to-Date

- Auto-generated from OpenAPI specification
- Synchronized with API changes automatically
- No manual SDK maintenance required

## API Reference

### Client Configuration

```typescript
interface ClientConfig {
  environment: string; // Base URL for the API
  timeoutInSeconds?: number; // Request timeout (default: 60)
  // Additional configuration options...
}
```

### Available Methods

#### Root Endpoints

```typescript
// GET /
client.getRootMessage(): Promise<{ message: string }>
```

Returns a welcome message for API health checks.

#### Example Endpoints

```typescript
// GET /example/
client.getExampleMessage(): Promise<string>
```

Returns an example string response.

## Error Handling

The SDK provides structured error handling:

```typescript
import { AiFastifyTemplateAPI, ApiError } from '@airbolt/sdk';

try {
  const result = await client.getRootMessage();
} catch (error) {
  if (error instanceof ApiError) {
    console.error('API Error:', {
      status: error.statusCode,
      message: error.message,
      body: error.body,
    });
  } else {
    console.error('Network Error:', error);
  }
}
```

## Advanced Usage

### Custom Configuration

```typescript
const client = new AiFastifyTemplateAPI({
  environment: process.env.API_URL,
  timeoutInSeconds: 30,
  // Add authentication headers if needed
});
```

### Request Interceptors

```typescript
// Example of adding authentication
client.setAuthToken('your-jwt-token');

// Or custom headers
client.setHeaders({
  'X-Custom-Header': 'value',
  'User-Agent': 'my-app/1.0.0',
});
```

## TypeScript Support

The SDK is built with TypeScript and provides full type definitions:

```typescript
import type { HelloWorldResponse, ApiError, ClientConfig } from '@airbolt/sdk';

// Use types in your application
function handleResponse(response: HelloWorldResponse) {
  console.log(response.message); // Type-safe access
}
```

## Development

This SDK is automatically generated from the API's OpenAPI specification. Do not edit the generated files manually.

### Regenerating the SDK

From the main project:

```bash
# Generate OpenAPI spec and SDK
pnpm sdk:generate

# Or step by step
pnpm openapi:generate  # Update OpenAPI spec
fern generate --local  # Regenerate SDK
```

## Contributing

To contribute to the API or SDK:

1. Make changes to the API in `apps/backend-api/`
2. Ensure proper OpenAPI schemas are defined
3. Run `pnpm sdk:generate` to update the SDK
4. Test the generated SDK with example applications
5. Submit a pull request with both API and SDK changes

## Support

- **API Documentation**: Available at `/docs` when running the API
- **Issues**: Report bugs in the main repository
- **Examples**: See the examples directory for usage patterns

## Version Compatibility

| SDK Version | API Version | Minimum Node.js |
| ----------- | ----------- | --------------- |
| 1.x.x       | 1.x.x       | 18.0.0          |

## License

MIT - See LICENSE file in the main repository.

---

**Note**: This package is automatically generated. The source code for the API is located in the main repository at `apps/backend-api/`.
