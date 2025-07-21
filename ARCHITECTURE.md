# Architecture & Technical Patterns

This document describes the architectural decisions and technical patterns used in the Airbolt project.

## Core Architecture

### Tech Stack

- **Framework**: Fastify (high-performance Node.js web framework)
- **Language**: TypeScript with @tsconfig/strictest preset
- **Validation**: Zod for runtime type safety
- **Monorepo**: Nx for efficient builds and task orchestration
- **Testing**: Vitest + Mutation Testing
- **Package Manager**: pnpm for efficient dependency management

### Monorepo Structure

```
airbolt/
├── apps/                    # Deployable applications
│   └── backend-api/        # Main Fastify API server
├── packages/               # Shared libraries
│   ├── config/            # Environment configuration utilities
│   ├── sdk/               # TypeScript SDK (auto-generated)
│   ├── react-sdk/         # React hooks and components
│   ├── test-utils/        # Testing utilities
│   └── types/             # Shared TypeScript types & branded types
└── tools/                  # Build and development tools
```

### Dependency Rules

- **Apps → Packages**: ✅ Allowed
- **Packages → Packages**: ✅ Allowed
- **Apps → Apps**: ❌ Forbidden
- **Packages → Apps**: ❌ Forbidden

## Design Patterns

### Input Validation Pattern

All external inputs MUST be validated using Zod schemas:

```typescript
// Define schema
const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
});

// Use in route
fastify.post(
  '/users',
  {
    schema: { body: CreateUserSchema },
  },
  handler
);
```

### Error Handling Pattern

Use Fastify's built-in HTTP errors:

```typescript
if (!resource) {
  throw fastify.httpErrors.notFound('Resource not found');
}
```

### Service Layer Pattern

Business logic separated from routes:

```typescript
// Route handler (thin controller)
async function handler(request, reply) {
  const data = Schema.parse(request.body);
  const result = await fastify.services.users.create(data);
  return reply.code(201).send(result);
}

// Service (business logic)
class UserService {
  async create(data: CreateUserDto): Promise<User> {
    // Business logic here
  }
}
```

### Environment Configuration Pattern

Centralized, validated environment configuration:

```typescript
// env.ts
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  DATABASE_URL: z.string().url(),
  // ... other vars
});

export const env = EnvSchema.parse(process.env);
```

### Branded Types Pattern

Prevent ID type mixing at compile time:

```typescript
// Define branded types
type UserId = Brand<string, 'UserId'>;
type OrderId = Brand<string, 'OrderId'>;

// Usage prevents errors
function processOrder(orderId: OrderId) {
  /* ... */
}
processOrder(userId); // ❌ TypeScript Error
```

## API Design Principles

### RESTful Conventions

- Use proper HTTP methods (GET, POST, PUT, DELETE)
- Return appropriate status codes
- Use consistent URL patterns
- Version APIs when breaking changes are necessary

### Response Format

Consistent JSON response structure:

```typescript
// Success response
{
  "data": { /* resource data */ },
  "meta": { /* pagination, etc */ }
}

// Error response
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": { /* field-specific errors */ }
  }
}
```

### API Versioning Strategy

- Maintain backward compatibility whenever possible
- Use URL versioning for major changes: `/api/v1/`, `/api/v2/`
- Deprecate gradually with clear migration paths
- Document compatibility in SDK releases

## Security Patterns

### Authentication & Authorization

- JWT-based authentication
- Role-based access control (RBAC)
- Secure token storage and rotation
- Rate limiting per user/IP

### Input Sanitization

- Zod schemas validate structure and content
- Prevent SQL injection via parameterized queries
- XSS prevention through proper encoding
- CORS configuration for API access

### Secret Management

- Environment variables for configuration
- Never commit secrets to repository
- Use secure key rotation practices
- Audit access to sensitive operations

## Testing Architecture

### Test Categories

1. **Unit Tests**: Business logic in isolation
2. **Integration Tests**: API endpoints and workflows
3. **Property Tests**: Invariants and edge cases
4. **Mutation Tests**: Test quality validation

### Test Organization

```
src/
  users/
    user.service.ts
    user.service.test.ts      # Unit tests
    user.routes.ts
    user.routes.test.ts       # Integration tests
    user.properties.test.ts   # Property-based tests
```

### Testing Principles

- Test behavior, not implementation
- Ensure tests fail when logic breaks
- Cover edge cases comprehensively
- Use test utilities for consistency

## Performance Considerations

### Caching Strategy

- Nx build cache for development speed
- Redis for application-level caching
- CDN for static assets
- Database query optimization

### Async Patterns

- Proper async/await usage
- Avoid blocking operations
- Use streams for large data
- Implement request timeouts

### Monitoring & Observability

- Structured logging with context
- OpenTelemetry for tracing
- Health check endpoints
- Performance metrics collection

## Code Quality Standards

### TypeScript Configuration

- Strict mode enabled
- No implicit any
- Explicit return types
- Exhaustive switch cases

### Linting & Formatting

- ESLint for code quality
- Prettier for consistent formatting
- Security-focused lint rules
- Automated fixes in git hooks

### Documentation Standards

- JSDoc for public APIs
- README in each package
- Architecture decision records
- Example code for complex features

## Deployment Architecture

### Container Strategy

- Docker for consistent environments
- Multi-stage builds for optimization
- Security scanning in CI/CD
- Minimal production images

### Environment Management

- Separate configs per environment
- Feature flags for gradual rollout
- Blue-green deployments
- Automated rollback capability

### Scalability Considerations

- Horizontal scaling ready
- Stateless application design
- Database connection pooling
- Queue-based job processing

## Decision Records

### Why Fastify?

- High performance (2x faster than Express)
- Built-in TypeScript support
- Schema-based validation
- Excellent plugin ecosystem

### Why Nx?

- Efficient incremental builds
- Powerful affected commands
- Consistent tooling setup
- Great monorepo support

### Why Zod?

- Runtime type safety
- Excellent TypeScript inference
- Composable schemas
- Wide ecosystem support

### Why Branded Types?

- Prevent ID mixing bugs
- Compile-time safety
- Zero runtime overhead
- Self-documenting code
