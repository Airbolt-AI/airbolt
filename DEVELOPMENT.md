# Development Workflow Guide

This guide covers day-to-day development workflows for the Airbolt project.

## Quick Start

```bash
# One-time setup
pnpm install
pnpm setup:hooks       # Install git hooks

# Start development
pnpm dev              # Start all development servers
pnpm ai:watch         # Watch mode for validation
```

## Development Commands

### During Development

- `pnpm ai:quick` - Fast validation (lint + type-check)
- `pnpm ai:fix` - Auto-fix formatting and linting issues
- `pnpm dev:watch` - Watch mode for affected packages

### Before Committing

- `pnpm ai:check` - Standard validation with dependency graph
- `pnpm test` - Run all tests
- `pnpm test:config:verify` - Verify test configurations

### Before Pull Request

- `pnpm ai:compliance` - Full validation pipeline
- `pnpm build` - Build all packages
- `pnpm affected:all` - Run all checks on changed packages

## Git Workflow

### Starting a New Feature

```bash
git checkout main && git pull origin main
git checkout -b feature/LIN-XXX-description
```

### Committing Changes

```bash
git add .
git commit -m "feat(scope): description"
# Pre-commit hooks run automatically
```

### Pushing Changes

```bash
git push origin feature/LIN-XXX-description
# Pre-push validation runs automatically
```

## Working with the Monorepo

### Project Structure

```
apps/
  backend-api/     # Main Fastify API server
packages/
  config/          # Shared configuration utilities
  sdk/             # TypeScript SDK
  react-sdk/       # React SDK with hooks
  test-utils/      # Testing utilities
  types/           # Shared TypeScript types
```

### Nx Commands

- `nx affected:lint` - Lint only changed packages
- `nx affected:test` - Test only changed packages
- `nx affected:build` - Build only changed packages
- `nx graph` - Visualize project dependencies

## API Development

### Adding a New Endpoint

1. Create route handler in `apps/backend-api/src/routes/`
2. Update OpenAPI spec: `pnpm openapi:generate`
3. Regenerate SDK: `pnpm generate`
4. Update tests and documentation

### Environment Variables

1. Add to `.env.example` with descriptive comment
2. Update `apps/backend-api/src/plugins/env.ts` with Zod validation
3. Update documentation

## Testing

### Running Tests

- `pnpm test` - Run all tests
- `pnpm test:watch` - Watch mode
- `pnpm test:coverage` - Coverage report
- `pnpm test:mutation` - Mutation testing

### Writing Tests

- Focus on business logic validation
- Test edge cases (null, undefined, boundaries)
- Use property-based testing for complex logic
- Ensure tests fail when logic is broken

## SDK Development

### Updating the SDK

1. Make API changes
2. Run `pnpm openapi:generate` in backend-api
3. Run `pnpm generate` to update SDK
4. Update SDK wrapper functions if needed
5. Update React hooks if API usage changed

### Testing SDK Changes

- Run SDK examples to verify functionality
- Update example applications
- Test in different environments

## Troubleshooting

### Validation Failures

```bash
pnpm ai:fix          # Auto-fix formatting
pnpm type-check      # Check TypeScript errors
pnpm test           # Run failing tests
pnpm build          # Check build issues
```

### Dependency Issues

```bash
pnpm clean          # Clean all build artifacts
pnpm install        # Reinstall dependencies
nx reset           # Reset Nx cache
```

### Git Hook Issues

```bash
pnpm setup:hooks    # Reinstall git hooks
```

## Performance Tips

1. **Use Nx cache**: Commands like `ai:quick` are cached
2. **Run affected commands**: Only build/test what changed
3. **Use watch mode**: Get instant feedback on changes
4. **Parallelize tasks**: Nx runs tasks in parallel automatically

## Release Process

### Creating a Release

1. Create changeset: `pnpm changeset`
2. Prepare release: `pnpm release:prepare`
3. Commit and tag
4. Push to trigger release workflow

### Beta Releases

```bash
pnpm release:beta
git commit -m "chore: prepare beta release"
git tag v0.x.y-beta.z
git push origin v0.x.y-beta.z
```

## Best Practices

1. **Run validation frequently**: `pnpm ai:quick` is fast and cached
2. **Fix issues immediately**: Don't let problems accumulate
3. **Use conventional commits**: Helps with changelog generation
4. **Keep dependencies updated**: Regular security audits
5. **Document as you go**: Update README files with new features
