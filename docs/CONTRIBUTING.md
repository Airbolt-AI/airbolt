# Contributing to Airbolt

Thank you for your interest in contributing to Airbolt! This guide will help you get started quickly.

## Quick Start

```bash
# Clone and install
git clone https://github.com/Airbolt-AI/airbolt.git
cd airbolt
pnpm install

# Start development
pnpm dev              # Start backend API on http://localhost:3000
pnpm dev:sdk          # Watch and rebuild SDKs on changes

# Run quality checks
pnpm lint             # Check code style
pnpm test             # Run tests
pnpm type-check       # Check TypeScript
pnpm docs:check-links # Validate documentation links
```

## Project Structure

```
airbolt/
├── apps/backend-api/     # Fastify backend server
├── packages/sdk/         # Core TypeScript SDK
├── packages/react-sdk/   # React components and hooks
└── examples/             # Example applications
```

## Development Workflow

1. **Create a feature branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write code following existing patterns
   - Add tests for new functionality
   - Update documentation if needed

3. **Validate your changes**

   ```bash
   pnpm ci:check         # Run all validation (must pass)
   ```

4. **Submit a pull request**
   - Clear description of what changed and why
   - Link any related issues
   - Ensure all checks pass

## Code Style

- **TypeScript**: We use strict mode - no `any` types
- **Formatting**: Prettier handles this automatically
- **Imports**: Use ES modules with `.js` extensions
- **Testing**: Every new feature needs tests

## Testing

We take testing seriously. See [TESTING.md](../.github/TESTING.md) for our testing philosophy.

```bash
pnpm test             # Run all tests
pnpm test:watch       # Watch mode for development
pnpm test:coverage    # Generate coverage report
```

## Common Tasks

### Adding a new API endpoint

1. Add route in `apps/backend-api/src/routes/`
2. Add Zod schema for validation
3. Update OpenAPI spec: `pnpm openapi:generate`
4. Regenerate SDKs: `pnpm generate`

### Updating SDKs

After API changes:

```bash
pnpm generate         # Regenerate TypeScript SDKs
pnpm sdk:check        # Verify SDKs are up to date
```

### Running examples

```bash
cd packages/react-sdk/examples/react-widget
pnpm install
pnpm dev
```

## Questions?

- Check existing [issues](https://github.com/Airbolt-AI/airbolt/issues)
- Join the [discussion](https://github.com/Airbolt-AI/airbolt/discussions)
- Review the [main README](../README.md) for project overview

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
