# Architecture Overview

This document describes the architectural decisions, patterns, and principles that guide the AI Fastify Template project.

## Table of Contents

- [Design Philosophy](#design-philosophy)
- [System Architecture](#system-architecture)
- [Monorepo Structure](#monorepo-structure)
- [Technology Decisions](#technology-decisions)
- [Quality Gates](#quality-gates)
- [AI-First Design](#ai-first-design)
- [Security Architecture](#security-architecture)
- [Performance Considerations](#performance-considerations)

## Design Philosophy

### Core Principles

1. **AI-First Development**
   - Constraint-driven design that guides AI agents toward correct patterns
   - Immediate feedback loops through fail-fast pipelines
   - Clear architectural boundaries that prevent violations

2. **Quality by Design**
   - Comprehensive validation at every layer
   - Fail-fast approach to catch issues early
   - Automated quality gates that prevent regressions

3. **Developer Experience**
   - Zero-config setup for common use cases
   - Clear, predictable patterns
   - Excellent tooling integration

4. **Production Ready**
   - Security-first approach
   - Performance optimized
   - Scalable architecture

### Architectural Goals

- **Maintainability**: Clear separation of concerns, minimal coupling
- **Testability**: Dependency injection, pure functions, clear interfaces
- **Scalability**: Modular design, efficient caching, parallel execution
- **Security**: Input validation, secure defaults, no secrets exposure
- **Performance**: Optimized builds, intelligent caching, minimal overhead

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Fastify Template                      │
├─────────────────────────────────────────────────────────────┤
│  Apps Layer                                                 │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │   backend-api   │  │   admin-dash    │  (Future apps)   │
│  │   (Fastify)     │  │   (Optional)    │                  │
│  └─────────────────┘  └─────────────────┘                  │
├─────────────────────────────────────────────────────────────┤
│  Packages Layer                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │     sdk     │ │   shared    │ │   config    │           │
│  │ (Generated) │ │ (Business)  │ │ (Settings)  │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
├─────────────────────────────────────────────────────────────┤
│  Infrastructure Layer                                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │   TurboRepo │ │    pnpm     │ │ESLint+Pretty│           │
│  │  (Caching)  │ │(Workspaces) │ │(Lint/Format)│           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
Request → Validation → Business Logic → Response
   ↓           ↓            ↓            ↓
 Zod       Services     Packages      Fastify
Schema    (Pure Fns)   (Shared)     (Serialization)
```

## Monorepo Structure

### Directory Organization

```
airbolt/
├── apps/                    # Deployable applications
│   ├── backend-api/         # Main Fastify API server
│   └── [future-apps]/       # Additional applications
├── packages/                # Shared libraries
│   ├── sdk/                 # Generated TypeScript SDK
│   ├── shared/              # Business logic and utilities
│   ├── config/              # Configuration schemas
│   └── [domain-packages]/   # Domain-specific packages
├── docs/                    # Documentation
├── scripts/                 # Build and utility scripts
├── .github/                 # CI/CD workflows
└── tools/                   # Development tools and configs
```

### Dependency Rules

```
Apps Layer:
  ✅ Can depend on: Packages
  ❌ Cannot depend on: Other Apps

Packages Layer:
  ✅ Can depend on: Other Packages
  ❌ Cannot depend on: Apps

Infrastructure:
  ✅ Supports: All layers
  ❌ Business logic: None
```

### Package Boundaries

Each package should have:

- **Single responsibility**: One clear purpose
- **Clear interface**: Well-defined public API
- **Minimal dependencies**: Only essential external deps
- **Independent testing**: Can be tested in isolation

## Technology Decisions

### Core Stack Rationale

| Technology            | Purpose            | Why Chosen                                               |
| --------------------- | ------------------ | -------------------------------------------------------- |
| **Fastify**           | Web framework      | High performance, TypeScript-first, extensive plugins    |
| **TypeScript**        | Language           | Type safety via @tsconfig/strictest, excellent tooling   |
| **pnpm**              | Package manager    | Fast, efficient, excellent monorepo support              |
| **TurboRepo**         | Build system       | Intelligent caching, parallel execution                  |
| **ESLint + Prettier** | Linting/Formatting | Minimal config (~40 lines), focus on runtime safety only |
| **Zod**               | Validation         | Runtime type validation, excellent TS integration        |
| **Vitest**            | Testing            | Fast, modern, great TypeScript support                   |

### Quality Tools

| Tool                   | Purpose                 | Integration                             |
| ---------------------- | ----------------------- | --------------------------------------- |
| **dependency-cruiser** | Architecture validation | Prevents circular deps, enforces layers |
| **Stryker**            | Mutation testing        | Ensures tests validate actual logic     |
| **Fern**               | SDK generation          | Auto-generates client SDKs from OpenAPI |
| **Renovate**           | Dependency updates      | Automated, safe dependency management   |

### Tooling Decision: ESLint + Prettier over Biome

**What we tried**: Initially used Biome for unified formatting + linting to reduce tool complexity.

**Why we reverted**:

1. **Runtime safety focus** - Need to enforce patterns TypeScript can't catch (env validation, request validation)
2. **Simplified approach** - Now only ~40 lines of ESLint config vs 400+ lines previously
3. **Clear separation** - TypeScript (@tsconfig/strictest) handles type safety, ESLint handles runtime safety
4. **IDE integration** - Better editor support and real-time feedback with ESLint
5. **Maintainability** - Minimal config is easier to understand and maintain

**Result**: TypeScript @tsconfig/strictest + minimal ESLint = same safety with 90% less configuration. We leverage TypeScript's built-in safety features instead of trying to replicate them in ESLint.

## Quality Gates

### Fail-Fast Pipeline

```
lint → type-check → graph → test → mutation → build
```

Each stage must pass before proceeding:

1. **Lint**: Code formatting and style consistency
2. **Type-check**: TypeScript compilation and type safety
3. **Graph**: Dependency validation and architecture rules
4. **Test**: Unit and integration test coverage
5. **Mutation**: Test quality validation
6. **Build**: Production build verification

### Quality Metrics

- **Type Coverage**: 100% (@tsconfig/strictest preset)
- **Test Coverage**: >90% line coverage
- **Mutation Score**: >90% (when available)
- **Dependency Health**: No circular dependencies
- **Performance**: Build time <2min, cache hit >80%

## AI-First Design

### Constraint-Driven Development

The architecture uses constraints to guide AI agents:

1. **TypeScript @tsconfig/strictest**: Maximum compile-time safety with zero config
2. **Minimal ESLint Rules**: Runtime safety for what TypeScript can't catch (~40 lines)
3. **Zod Validation**: Runtime type safety at system boundaries
4. **Dependency Rules**: Maintains clean architecture
5. **Testing Requirements**: Validates behavior with mutation testing

### AI-Friendly Patterns

```typescript
// ✅ Good: Explicit types, clear interfaces
interface UserService {
  createUser(data: CreateUserRequest): Promise<User>;
  getUserById(id: string): Promise<User | null>;
}

// ✅ Good: Zod validation with type inference
const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
});
type CreateUserRequest = z.infer<typeof CreateUserSchema>;

// ❌ Bad: Implicit types, unclear contracts
function createUser(data: any): any {
  // Implementation
}
```

### Feedback Loops

- **Immediate**: TypeScript errors in editor
- **Fast**: Lint/format on save
- **Quick**: Type-check on file change
- **Regular**: Full pipeline on commit
- **Comprehensive**: Mutation testing on PR

## Security Architecture

### Input Validation

```typescript
// All inputs validated with Zod schemas
const RequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// Environment variables validated
const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
});
```

### Security Layers

1. **Input Layer**: Zod validation for all requests
2. **Business Layer**: Authorization and business rules
3. **Data Layer**: Parameterized queries, input sanitization
4. **Transport Layer**: HTTPS, secure headers

### Security Principles

- **Validate everything**: All inputs, environment variables, configs
- **Fail securely**: Default to deny, explicit permissions
- **No secrets in code**: Environment variables only
- **Audit trail**: Comprehensive logging

## Performance Considerations

### Build Performance

- **Incremental builds**: Only rebuild changed packages
- **Parallel execution**: TurboRepo task parallelization
- **Intelligent caching**: Local and remote cache strategies
- **Selective testing**: Only test affected packages

### Runtime Performance

- **Fastify**: High-performance web framework
- **Streaming**: Server-sent events for real-time features
- **Efficient serialization**: JSON schema-based serialization
- **Connection pooling**: Database connection management

### Caching Strategy

```
┌─────────────────┐
│   Local Cache   │  ← TurboRepo local cache
├─────────────────┤
│  Remote Cache   │  ← Shared team cache (optional)
├─────────────────┤
│ Application     │  ← Redis/Memory cache
│     Cache       │
└─────────────────┘
```

## Scalability Patterns

### Horizontal Scaling

- **Stateless services**: No server-side session state
- **Database scaling**: Connection pooling, read replicas
- **Load balancing**: Multiple service instances
- **Caching**: Reduce database load

### Vertical Scaling

- **Efficient algorithms**: O(n) vs O(n²) considerations
- **Memory management**: Proper cleanup, no leaks
- **CPU optimization**: Async/await, non-blocking I/O
- **Bundle optimization**: Tree shaking, code splitting

## Future Considerations

### Planned Enhancements

1. **Microservices**: Split into domain services as needed
2. **Event Sourcing**: For audit trails and complex workflows
3. **GraphQL**: Alternative API layer for complex queries
4. **Observability**: Metrics, tracing, and monitoring

### Extension Points

- **Plugin System**: Fastify plugin architecture
- **Middleware**: Request/response processing
- **Hooks**: Lifecycle event handling
- **Providers**: Dependency injection containers

---

This architecture provides a solid foundation for building scalable, maintainable, and secure applications while optimizing for AI-assisted development workflows.
