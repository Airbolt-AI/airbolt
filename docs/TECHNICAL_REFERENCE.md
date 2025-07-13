# Technical Reference

## Quick Links

- **Development Setup**: See [CONTRIBUTING.md](CONTRIBUTING.md)
- **AI Agent Guidelines**: See [AGENTS.md](../AGENTS.md)
- **Testing Strategy**: See [TESTING.md](TESTING.md)

## Architecture Overview

### System Design

```
Apps (backend-api) → Packages (sdk, react-sdk) → Infrastructure (pnpm, nx)
```

**Key Principles:**

- TypeScript (@tsconfig/strictest) for maximum safety
- Zod validation for all inputs
- Comprehensive testing with mutation testing
- AI-optimized development workflow

### Quality Gates

```
lint → type-check → test → build → mutation-test
```

## Configuration Management

### Vitest Configuration (Dual Setup)

- `vitest.base.config.ts` - Shared configuration
- `vitest.config.ts` - Workspace mode
- `vitest.mutation.config.ts` - Stryker compatibility

**Critical**: Always edit base config for shared properties.

### Validation Commands

```bash
pnpm ai:quick          # Fast validation
pnpm ci:check          # Pre-commit validation
pnpm ai:compliance     # Full quality pipeline
```

## Security & Performance

### Input Validation

All inputs validated with Zod schemas:

```typescript
const RequestSchema = z.object({
  email: z.string().email(),
  content: z.string().min(1),
});
```

### Performance Optimization

- Incremental builds with Nx
- Intelligent caching with TurboRepo
- Parallel execution for quality checks

## CI/CD Pipeline

### Local Testing

```bash
pnpm ci:doctor    # Environment validation
pnpm ci:local     # Run CI locally with act
```

### Quality Metrics

- TypeScript: 100% coverage (@tsconfig/strictest)
- Tests: >90% coverage
- Mutation: >85% score for business logic

## Technology Decisions

| Tool       | Purpose          | Why Chosen                             |
| ---------- | ---------------- | -------------------------------------- |
| Fastify    | Web framework    | High performance, TypeScript-first     |
| TypeScript | Language         | @tsconfig/strictest for maximum safety |
| Zod        | Validation       | Runtime type safety                    |
| Vitest     | Testing          | Fast, modern, great TS support         |
| Stryker    | Mutation testing | Ensures real test quality              |

## Development Patterns

### API Routes

```typescript
// Route with validation
fastify.post(
  '/api/chat',
  {
    schema: { body: ChatRequestSchema },
  },
  async (request, reply) => {
    const data = ChatRequestSchema.parse(request.body);
    // Implementation
  }
);
```

### Error Handling

```typescript
// Use Fastify error patterns
if (!user) {
  throw fastify.httpErrors.notFound('User not found');
}
```

## Troubleshooting

### Common Issues

- **CI Failures**: Run `pnpm ci:check` locally first
- **Type Errors**: Check for `any` types, use @tsconfig/strictest
- **Test Failures**: Ensure tests validate business logic, not just coverage
- **Config Issues**: Run `pnpm test:config:verify`

### Quick Fixes

```bash
pnpm lint:fix        # Auto-fix formatting
pnpm type-check      # Check TypeScript errors
pnpm ai:quick        # Fast validation
```

---

For detailed implementation guides, see individual documentation files in the `docs/` directory.
