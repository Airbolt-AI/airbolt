# AI Coding Guidelines for airbolt

## 🚨 CRITICAL: Zero CI Failures Guaranteed

**Four-Layer Defense System** prevents any CI failures:

1. **Immediate Feedback** (Claude Code hooks):
   - Automatic: Validates on every file edit (<2s)
   - Shows errors/warnings inline during AI sessions
   - Auto-formats code and provides contextual alerts
2. **During Development**:
   - Manual: `pnpm ai:quick` (run frequently, <5s)
   - Automatic: `pnpm ai:watch` (continuous validation on file save)
3. **Before Commit**: Pre-commit hooks (automatic, ~30s)
4. **Before Push**: Pre-push validation (mandatory, matches CI exactly)

**You CANNOT push code that will fail CI** - multiple layers ensure quality.

**Development validation pipeline:**

```bash
# Manual validation
pnpm ai:quick          # Fast feedback during coding (~5s): lint + type-check (Nx cached)
pnpm ai:check          # Standard validation (~30s): + graph validation
pnpm ai:compliance     # Full validation (~3min): + tests + build + mutation testing + security
pnpm ai:mutation       # Run mutation testing directly (focused on business logic)

# Test configuration validation (CRITICAL)
pnpm test:config:verify    # Full validation: property comparison + test execution
pnpm test:config:quick     # Fast validation for pre-push hooks

# Continuous validation (runs on file save)
pnpm ai:watch          # Watch all files, run ai:quick on changes
pnpm dev:watch         # Watch all files, run affected lint+type-check

# Nx affected commands - only run on changed packages
pnpm affected:lint     # Lint only changed packages
pnpm affected:test     # Test only changed packages
pnpm affected:build    # Build only changed packages
pnpm affected:all      # Run all tasks on changed packages

# Release management commands (automated)
pnpm release:prepare   # Version + lockfile sync + stage (foolproof)
pnpm release:beta      # Full beta release preparation
pnpm changeset:manual  # Manual version + lockfile sync (debugging)
```

**Fix issues immediately:**

```bash
pnpm lint:fix          # Auto-fix formatting and linting
```

**Key Rule**: The pre-push hook automatically runs `pnpm ci:check` - you literally cannot push failing code.

## Quick Start Essentials

**Tech Stack**: Fastify + TypeScript + Zod + Nx monorepo with comprehensive quality guardrails

**Project Structure**:

- `apps/backend-api/` - Main Fastify API server
- `packages/` - Shared libraries and utilities

**Essential Development Flow**:

```bash
# One-time setup (for pre-push validation)
pnpm setup:hooks       # Installs both pre-commit and pre-push hooks

# Start feature
git checkout main && git pull origin main
git checkout -b feature/your-feature-name

# Develop with instant feedback
pnpm ai:quick          # Run constantly during coding (Nx cached for speed)

# Commit (pre-commit hooks run automatically)
git add . && git commit -m "feat(scope): description"

# Push (pre-push validation runs automatically)
git push               # Will run full CI validation before push
```

**If Validation Fails During Push:**

```bash
# The push will be blocked with clear error messages
# Fix the issues locally:
pnpm lint:fix          # Auto-fix formatting
pnpm type-check        # See TypeScript errors
pnpm test              # Run failing tests

# Then commit fixes and push again
git add . && git commit -m "fix: resolve validation errors"
git push               # Pre-push will run again
```

## 🧠 Decision-Making Philosophy

**Before implementing any solution, pause to ultrathink:**

- What are all the possible approaches to solve this?
- Which approach is clearest and simplest?
- Which delivers maximum value to users and developers?
- Which minimizes technical debt and maintenance burden?

**Choose the option that best balances these factors.** The best code is often the code you don't write.

## 🚨 MANDATORY Architecture Rules

### TypeScript: @tsconfig/strictest Preset

- **No `any` types** - Use specific types or `unknown` with type guards
- **Explicit return types** - For all public functions and methods
- **Strict null checks** - Handle `null` and `undefined` explicitly

```typescript
// ✅ Good: Explicit types and safety
function createUser(data: CreateUserRequest): Promise<User> {
  // Implementation with proper error handling
}

// ❌ Bad: Unsafe patterns
function createUser(data: any): any {
  // Unsafe implementation
}
```

### Zod Validation: MANDATORY for All Inputs

- **All inputs validated** - Request bodies, query params, environment variables
- **ESLint enforces** - No direct `process.env` access or unvalidated requests

```typescript
// ✅ Good: Zod schema with validation
const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
});

// Route with validation
fastify.post(
  '/users',
  {
    schema: { body: CreateUserSchema },
  },
  async (request, reply) => {
    const userData = CreateUserSchema.parse(request.body);
  }
);

// ❌ Bad: Unvalidated input
fastify.post('/users', async req => {
  const data = req.body; // ESLint error
});
```

### Error Handling: Fastify Patterns Only

```typescript
// ✅ Good: Fastify error handling
if (!user) {
  throw fastify.httpErrors.notFound('User not found');
}

// ❌ Bad: Generic error throwing
throw new Error('Something went wrong'); // Too generic!
```

## Code Templates

### Route Template

```typescript
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const RequestSchema = z.object({
  // Define request schema
});

const routes: FastifyPluginAsync = async fastify => {
  fastify.post(
    '/endpoint',
    {
      schema: {
        body: RequestSchema,
        response: { 201: ResponseSchema },
      },
    },
    async (request, reply) => {
      const data = RequestSchema.parse(request.body);
      const result = await fastify.service.operation(data);
      return reply.code(201).send(result);
    }
  );
};

export default routes;
```

### Service Layer Template

```typescript
export class ServiceImplementation {
  constructor(
    private readonly db: DatabaseClient,
    private readonly logger: Logger
  ) {}

  async operation(data: InputType): Promise<OutputType> {
    this.logger.info({ data: sanitizedData }, 'Starting operation');

    try {
      const result = await this.db.collection.operation(data);
      this.logger.info({ resultId: result.id }, 'Operation completed');
      return result;
    } catch (error) {
      this.logger.error({ error, data: sanitizedData }, 'Operation failed');
      throw error;
    }
  }
}
```

### Environment Configuration Template

```typescript
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.string().regex(/^\d+$/).transform(Number).default('3000'),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
});

export const env = EnvSchema.parse(process.env);
```

## 🚨 CRITICAL: Mutation Testing for Critical Decision Points

**Philosophy**: Mutation testing validates critical decision points only (see `.github/TESTING.md`)

**Focus Areas**:

- Authentication checks - `if (!isValid) throw`
- Rate limit calculations - `requests > limit`
- Retry conditions - `shouldRetry(error)`
- Token expiration logic - `isExpired(token)`

**Skip Mutations On**:

- Error messages
- Configuration objects
- Data transformations
- Logging statements

**Commands**:

- `pnpm ai:mutation` - Run mutation testing
- `pnpm ai:compliance` - Full pipeline including mutations

**Why**: The goal isn't coverage, it's confidence that critical logic is properly tested.

**Testing Philosophy**: See [.github/TESTING.md](/.github/TESTING.md) for comprehensive testing guidelines.

## 🚨 CRITICAL: Testing Anti-Patterns

**The goal is not coverage, it's confidence.** Tests that don't fail when logic is broken are worse than no tests.

### AI Testing Anti-Patterns to Avoid

```typescript
// ❌ BAD: Coverage theater - achieves coverage but tests nothing
it('should work', () => {
  const result = calculateTax(100);
  expect(result).toBeDefined();
  expect(typeof result).toBe('number');
});

// ✅ GOOD: Logic validation
it('should calculate 10% tax on standard items', () => {
  const result = calculateTax(100, 'standard');
  expect(result).toBe(10);
});

it('should throw error for negative amounts', () => {
  expect(() => calculateTax(-100, 'standard')).toThrow(
    'Amount must be positive'
  );
});

// ❌ BAD: Testing framework instead of business logic
it('should return 200', async () => {
  const response = await app.inject({ method: 'GET', url: '/users' });
  expect(response.statusCode).toBe(200);
});

// ✅ GOOD: Testing complete workflow
it('should create and retrieve user', async () => {
  // Create user
  const createResponse = await app.inject({
    method: 'POST',
    url: '/users',
    payload: { email: 'test@example.com', name: 'Test User' },
  });

  expect(createResponse.statusCode).toBe(201);
  const { id } = JSON.parse(createResponse.payload);

  // Retrieve created user
  const getResponse = await app.inject({
    method: 'GET',
    url: `/users/${id}`,
  });

  expect(getResponse.statusCode).toBe(200);
  const user = JSON.parse(getResponse.payload);
  expect(user).toMatchObject({
    id,
    email: 'test@example.com',
    name: 'Test User',
  });
});
```

### Test Quality Checklist

- [ ] **Does the test fail when the business logic is broken?**
- [ ] **Would this test catch common production bugs?**
- [ ] **Are all edge cases covered?** (null, undefined, empty, boundary values)
- [ ] **Do integration tests verify complete workflows?**

### Testing Requirements

- **Unit tests**: For all business logic and utility functions
- **Integration tests**: For all API routes - full CRUD workflows
- **Edge cases MANDATORY**: Every function MUST test null, undefined, empty, boundary values
- **Property-based testing**: Use fast-check for business logic functions (ESLint enforced)

## AI Agent Workflow

### Development Process

1. **Run validation constantly**: `pnpm ai:quick` during development
2. **Before every commit**: `pnpm ci:check` (MUST pass)
3. **Before pushing**: Git pre-push hook runs `pnpm pre-push` automatically
   - Validates test configurations match
   - Ensures mutation testing will work in CI
4. **Before PR submission**: `pnpm ai:compliance` (includes mutation testing gate)
5. **Create proper branches**: `git checkout -b feature/LIN-XXX-description`
6. **Conventional commits**: `feat(scope): description`
7. **Quality gates**: ALL checks must pass including mutation testing on critical decision points

### Local Validation Commands

- `pnpm test:config:verify` - Validate test configs match
- `pnpm pre-push` - Complete pre-push validation

### Linear MCP Integration Rules

**🚨 CRITICAL: Always include `projectId` when creating issues**

```typescript
// ✅ CORRECT: Always specify projectId
mcp__linear__create_issue({
  teamId: '...',
  projectId: '...', // REQUIRED - determine from context
  title: '...',
  description: '...',
});

// ❌ WRONG: Missing projectId creates orphaned issues
```

**When creating tickets, include cascading update requirements in the description:**

For features with API changes, include subtasks like:

- [ ] Update OpenAPI specification
- [ ] Regenerate SDK types
- [ ] Update SDK wrapper functions
- [ ] Update React hooks if needed
- [ ] Update example applications
- [ ] Update package documentation

For features with new environment variables:

- [ ] Update .env.example
- [ ] Update env.ts schema
- [ ] Update deployment documentation
- [ ] Update backend README

This helps ensure all necessary updates are tracked and completed.

### GitHub CLI Integration

```bash
# Create PR with proper formatting
gh pr create --title "feat(auth): implement user authentication (LIN-123)" \
             --body "## Summary\n- Add user authentication\n\n## Testing\n- Unit tests added\n\nCloses LIN-123"
```

## 🚨 CRITICAL: Cascading Updates Checklist

**When making code changes, multiple files often need updates to maintain consistency.** This section provides comprehensive checklists for different types of changes to ensure nothing is missed.

### API Endpoint Changes

When modifying any API endpoint (adding, changing, or removing):

- [ ] Update route handler in `apps/backend-api/src/routes/`
- [ ] Update OpenAPI spec: Run `pnpm openapi:generate` in backend-api directory
- [ ] Regenerate SDK: Run `pnpm generate` in packages/sdk (automatic via pre-push)
- [ ] Update SDK wrapper functions in `packages/sdk/src/api/` if needed
- [ ] Update React hooks in `packages/react-sdk/src/hooks/` if API usage changed
- [ ] Update all example code that uses the endpoint
- [ ] Update tests: unit, integration, and property tests for all affected code
- [ ] Update README documentation in affected packages
- [ ] Update API documentation comments

### API Contract Stability

**🚨 CRITICAL: Never break existing API contracts.** Airbolt is deployed by users with production applications depending on the API.

#### Backward Compatibility is Mandatory

- **Never** remove or rename existing endpoints
- **Never** change required fields to optional or vice versa
- **Never** change response structure in breaking ways
- **Never** change authentication mechanisms without migration path

#### Safe Changes vs Breaking Changes

**Safe Changes** (can be made freely):

- Adding optional request fields
- Adding new response fields (clients should ignore unknown fields)
- Adding new endpoints
- Adding new optional query parameters
- Expanding enums with new values (if clients handle unknown values)

**Breaking Changes** (require versioning strategy):

- Removing or renaming fields
- Changing field types
- Changing error response formats
- Removing endpoints
- Changing authentication requirements
- Modifying validation rules for existing fields

#### API Versioning Strategy

If breaking changes are absolutely necessary:

- Consider implementing versioned endpoints (e.g., `/api/v1/chat`, `/api/v2/chat`)
- Use deprecation warnings for features that will be removed
- Maintain old versions for a reasonable deprecation period (minimum 6 months)
- Document version compatibility in SDK releases
- Include upgrade guides in release notes

#### Documentation Requirements for API Changes

- Mark all deprecated features clearly with `@deprecated` comments
- Provide migration timelines in deprecation notices
- Document which SDK versions work with which API versions
- Include before/after examples for any changes
- Update all affected example code

### Environment Variable Changes

When adding or modifying environment variables:

- [ ] Update `.env.example` with new variable and descriptive comment
- [ ] Update `apps/backend-api/src/plugins/env.ts` Zod schema with validation
- [ ] Update backend-api README configuration section
- [ ] Update deployment docs (`render.yaml` if deployment-specific)
- [ ] Update test setup files that use the environment variable
- [ ] If breaking change, follow API versioning strategy instead
- [ ] Add default values in env.ts schema when appropriate
- [ ] Update any example configurations

### AI Provider Additions

When adding a new AI provider:

- [ ] Add provider implementation in `apps/backend-api/src/services/ai-provider.ts`
- [ ] Update `AI_PROVIDER` enum in `apps/backend-api/src/plugins/env.ts`
- [ ] Add API key validation pattern in env.ts
- [ ] Update `.env.example` with provider configuration example
- [ ] Add comprehensive provider tests:
  - Unit tests for provider logic
  - Integration tests for API calls
  - Property tests for edge cases
- [ ] Update OpenAPI spec provider enum
- [ ] Regenerate SDK to include new provider types
- [ ] Update SDK and React SDK type definitions
- [ ] Update all documentation mentioning available providers
- [ ] Update README with provider setup instructions

### Type/Interface Changes

When modifying types or interfaces:

- [ ] Update TypeScript interfaces in source files
- [ ] Update corresponding Zod schemas for runtime validation
- [ ] Update branded types in `packages/types` if applicable
- [ ] Regenerate SDK if API contract types changed
- [ ] Update type exports in package index files
- [ ] Update all example code using the types
- [ ] Update all tests using the types
- [ ] Update documentation showing type usage
- [ ] Verify no type mismatches across package boundaries

### Feature Additions

When adding new features:

- [ ] Create feature flag in env.ts if feature should be toggleable
- [ ] Add feature documentation to relevant README files
- [ ] Create example usage in example applications
- [ ] Add integration tests demonstrating the feature
- [ ] Update package.json if new dependencies added
- [ ] Update CHANGELOG.md or create changeset
- [ ] Add feature to main README if user-facing
- [ ] Update any getting started guides

### Breaking Changes

When making breaking changes (try to avoid these!):

- [ ] Follow API versioning strategy defined above
- [ ] Create detailed migration guide in documentation
- [ ] Include before/after code examples
- [ ] Document all affected APIs
- [ ] Create deprecation notices if doing phased rollout
- [ ] Update all examples to use new patterns
- [ ] Consider backwards compatibility layer
- [ ] Plan communication strategy for users
- [ ] Maintain old version for deprecation period

### Update Priority Matrix

**MUST Update (CI will fail if not done):**

- API contract changes → OpenAPI spec + SDK regeneration
- New required env vars → env.ts schema + .env.example
- Breaking changes → Follow API versioning strategy
- Type changes → All dependent code must be updated
- Test changes → All test configs must stay in sync

**SHOULD Update (Best practices, may not block CI):**

- New features → Examples and README documentation
- New providers/models → All provider documentation
- Performance improvements → Mention in relevant docs
- Bug fixes → Add regression tests
- Configuration changes → Update deployment docs

### Pre-Commit Checklist

Before committing any code changes, verify:

- [ ] All tests updated and passing (`pnpm test`)
- [ ] OpenAPI regenerated if routes changed: `pnpm openapi:generate`
- [ ] SDK regenerated if API changed: `pnpm generate` in packages/sdk
- [ ] Examples updated if public API changed
- [ ] Documentation updated in all affected locations
- [ ] Environment variables documented if added
- [ ] No orphaned code or documentation
- [ ] Lint and type-check pass: `pnpm ai:quick`

### Common Cascading Patterns

1. **Route Change** → OpenAPI → SDK → Types → Examples → Tests → Docs
2. **Env Variable** → .env.example → env.ts → Tests → Deployment → Docs
3. **New Provider** → ai-provider.ts → env.ts → Types → SDK → Examples → Docs
4. **Type Change** → All imports → Zod schemas → Tests → Examples → Docs

**Remember**: When in doubt, search for all usages of what you're changing and update them all.

## 🚨 CRITICAL: Environment Handling Standards

**MANDATORY**: Use centralized utilities (ESLint enforced):

```typescript
// ✅ Source code: Use @airbolt/config utilities
import { isDevelopment, isProduction, isTest } from '@airbolt/config';
if (isDevelopment()) {
  /* dev logic */
}

// ✅ Tests: Use @airbolt/test-utils standardized setup
import { createTestEnv, TEST_ENV_PRESETS } from '@airbolt/test-utils';
beforeEach(() => createTestEnv()); // Standard test setup
beforeEach(() => TEST_ENV_PRESETS.production()); // Test prod behavior

// ❌ WRONG: Direct environment checks (ESLint error)
if (process.env.NODE_ENV === 'development') {
  /* NO */
}
process.env.NODE_ENV = 'test'; // Manual setup - inconsistent
```

**Environment Mapping**: `production|prod` → `production`, `test` → `test`, `dev|development|undefined|*` → `development`

**Test Patterns**: `createTestEnv()` (standard), `createTestEnv({KEY: 'val'})` (custom), `TEST_ENV_PRESETS.production()` (behavior testing)

## ESLint Runtime Safety Rules

Our ESLint is **minimal** (~40 lines) and focused on runtime safety that TypeScript can't catch:

```typescript
// ✅ Environment validation required
const env = EnvSchema.parse(process.env);

// ❌ Direct access forbidden
const port = process.env.PORT; // ESLint error

// ✅ Request validation required
fastify.post(
  '/users',
  {
    schema: { body: CreateUserSchema },
  },
  handler
);

// ❌ Unvalidated requests forbidden
fastify.post('/users', async req => {
  const data = req.body; // ESLint error
});

// ✅ Environment utilities enforced
import { isDevelopment } from '@airbolt/config';

// ❌ Direct checks forbidden in source code
if (process.env.NODE_ENV === 'development') {
  /* ESLint warning */
}
```

## Monorepo Structure Rules

- **Apps → Packages**: ✅ Apps can depend on packages
- **Packages → Packages**: ✅ Packages can depend on other packages
- **Apps → Apps**: ❌ Apps cannot depend on other apps
- **Packages → Apps**: ❌ Packages cannot depend on apps

## Branded Types (Enterprise ID Safety)

Prevent ID mixups at compile time:

```typescript
import { UserId, OrderId, ZodBrandedSchemas } from '@airbolt/types';

// ✅ Type-safe ID creation
const userId = UserId('550e8400-e29b-41d4-a716-446655440000');
const orderId = OrderId('660e8400-e29b-41d4-a716-446655440000');

// ❌ Compile error: Cannot mix ID types
processOrder(userId); // TypeScript Error

// ✅ Zod integration for routes
const GetUserParams = z.object({
  userId: ZodBrandedSchemas.UserId,
});
```

## Troubleshooting Common Issues

### Quality Check Failures

```bash
# If ci:check fails
pnpm lint:fix          # Auto-fix formatting issues
pnpm type-check        # Check TypeScript errors
pnpm test              # Run failing tests
pnpm build             # Check build issues
```

### TypeScript Errors

- Check for missing types, incorrect imports
- Ensure Zod schemas match TypeScript interfaces
- Verify no `any` types are used

### Test Failures

- Verify mocks and test data setup
- Ensure tests validate business logic, not just coverage
- Check edge cases are covered

### Build Errors

- Check for circular dependencies: `pnpm graph:validate`
- Verify import/export statements

## Success Metrics

**First-Try Success Indicators**:

- ✅ `pnpm ci:check` passes immediately
- ✅ All TypeScript strict mode checks pass
- ✅ All Zod validations in place
- ✅ Tests validate business logic (not just coverage)
- ✅ Proper error handling with Fastify patterns
- ✅ Clean separation of concerns

Remember: These guidelines exist to help AI agents generate high-quality, maintainable code that passes all quality gates on the first try (or at least minimize the number of iterations to pass all quality gates).

## Claude Code Specific Features

### Automatic Hooks Integration

When using Claude Code, you get additional real-time feedback through hooks configured in `.claude-code/settings.json`:

#### 🔄 What Happens Automatically

1. **After Every Edit**:
   - Runs `ai:quick` validation (10s timeout)
   - Auto-formats TypeScript/JavaScript files with Prettier
   - Alerts when utils require mutation testing
   - Reminds about test quality for test files

2. **Before File Modifications**:
   - Blocks direct env/secrets modifications
   - Prevents writes to system directories
   - Detects and blocks path traversal attempts
   - Protects against symlink bypasses

3. **During Your Session**:
   - Logs all bash commands for audit trail
   - Records notifications with timestamps
   - Provides session summary on completion
   - Suggests next steps based on git status

#### 🚫 Security Blocks

Claude Code will prevent you from:

- Modifying `.env` files directly (use Zod schemas)
- Writing to `node_modules/`, `dist/`, `.git/`
- Creating files with path traversal (`../`)
- Modifying symbolic links

#### 💡 Working with Hooks

- **Hooks are non-blocking**: Validation has a 10s timeout
- **Smart skipping**: Generated/vendor files are ignored
- **Immediate feedback**: Errors shown inline as you work
- **Learn from patterns**: Hooks teach best practices

See `.claude-code/README.md` for detailed hook documentation and troubleshooting.
