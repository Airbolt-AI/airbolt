# AI Coding Guidelines for Airbolt

This document defines the core principles and philosophy for AI agents working on the Airbolt project. For specific implementation details, see:

- **[DEVELOPMENT.md](./DEVELOPMENT.md)** - Day-to-day development workflows and commands
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Technical patterns and architectural decisions
- **[.claude/README.md](./.claude/README.md)** - Claude Code specific configuration

## 🚨 Core Principle: Zero CI Failures

Our development process is designed with multiple validation layers to ensure code quality before it reaches CI. The goal is simple: **You cannot push code that will fail CI**.

### Four-Layer Defense System

1. **Immediate Feedback** - Real-time validation as you code
2. **During Development** - Fast validation commands with caching
3. **Before Commit** - Automatic pre-commit hooks
4. **Before Push** - Comprehensive pre-push validation

This layered approach catches issues early, saving time and maintaining code quality.

## Quick Start

For detailed setup and commands, see [DEVELOPMENT.md](./DEVELOPMENT.md). The essential workflow:

1. Install dependencies and hooks
2. Use fast validation during development
3. Let git hooks handle validation automatically
4. Fix any issues before they reach CI

## 🧠 Decision-Making Philosophy

**Before implementing any solution, pause to think:**

- What are all the possible approaches to solve this?
- Which approach is clearest and simplest?
- Which delivers maximum value to users and developers?
- Which minimizes technical debt and maintenance burden?

**Choose the option that best balances these factors.** The best code is often the code you don't write.

## Core Principles

### 1. Type Safety First

- Use TypeScript's strictest settings
- No `any` types - use specific types or `unknown` with guards
- Explicit return types for public APIs
- Handle null/undefined cases explicitly

### 2. Validate All External Input

- Every API endpoint must validate request data
- Environment variables must be validated on startup
- Use schema validation (Zod) for runtime safety
- Never trust external data sources

### 3. Fail Fast, Fail Clear

- Validate early in the request lifecycle
- Provide clear, actionable error messages
- Use framework-specific error patterns
- Log errors with appropriate context

### 4. Maintain Clean Architecture

- Separate concerns (routes, services, data access)
- Keep business logic in service layer
- Use dependency injection for testability
- Follow consistent patterns across the codebase

For specific implementation patterns and code examples, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## 🚨 API Contract Stability

**CRITICAL: Never break existing API contracts without explicit human approval.**

Airbolt is deployed by users with production applications. Breaking changes can cause production outages.

### Golden Rule of API Evolution

**You can ADD, but you cannot REMOVE or CHANGE.**

### Safe Changes (No Approval Needed)

- Adding new endpoints
- Adding optional request fields
- Adding response fields (clients must ignore unknown fields)
- Adding optional query parameters
- Expanding enums (if clients handle unknowns gracefully)

### Breaking Changes (Require Human Approval)

- Removing or renaming anything
- Changing field types or formats
- Modifying validation rules
- Changing authentication methods
- Altering error response structures

### If Breaking Changes Are Necessary

1. **STOP** - Consult with a human first
2. Plan versioning strategy (e.g., `/api/v2/`)
3. Implement migration path
4. Document compatibility clearly
5. Maintain old version for deprecation period

For detailed versioning strategies, see [ARCHITECTURE.md](./ARCHITECTURE.md#api-versioning-strategy).

## Testing Philosophy

### The Goal: Confidence, Not Coverage

Tests should give you confidence that your code works correctly. A test that doesn't fail when the logic is broken is worse than no test at all.

### Key Testing Principles

1. **Test Behavior, Not Implementation**
   - Focus on what the code does, not how it does it
   - Tests should survive refactoring

2. **Edge Cases Are Mandatory**
   - Always test null, undefined, empty values
   - Test boundary conditions
   - Consider error scenarios

3. **Mutation Testing for Critical Logic**
   - Authentication checks
   - Authorization decisions
   - Rate limiting calculations
   - Business rule validations

4. **Integration Over Unit Tests**
   - Test complete workflows
   - Verify components work together
   - Catch real-world issues

For specific testing patterns and examples, see [ARCHITECTURE.md](./ARCHITECTURE.md#testing-architecture).

## Development Workflow Principles

### Quality Gates at Every Stage

1. **During Development** - Fast, cached validation
2. **Before Commit** - Automatic formatting and linting
3. **Before Push** - Comprehensive validation matching CI
4. **Before PR** - Full compliance including security checks

### Working with Linear

When creating issues, always include the project ID and track cascading updates. Many changes require updates across multiple files - document these dependencies in the issue description.

### Commit Best Practices

- Use conventional commits: `feat:`, `fix:`, `docs:`, etc.
- Reference Linear tickets: `feat(auth): add login (LIN-123)`
- Keep commits focused and atomic
- Write clear, descriptive messages

For detailed workflow commands and examples, see [DEVELOPMENT.md](./DEVELOPMENT.md).

## Cascading Updates Principle

**Many changes require updates across multiple files.** This is by design - it ensures consistency and type safety across the monorepo.

### Common Update Patterns

1. **API Changes** → OpenAPI spec → SDK generation → Types → Tests → Docs
2. **Environment Variables** → .env.example → Validation schema → Tests → Docs
3. **Type Changes** → All consumers → Runtime validation → Tests
4. **New Features** → Implementation → Tests → Examples → Documentation

### The Golden Rule

**When you change something, search for all its usages and update them.**

Our tooling helps:

- TypeScript catches type mismatches
- ESLint enforces validation patterns
- Pre-push hooks regenerate SDKs
- CI validates everything works together

### Priority: What Must Be Updated

**CI Will Fail Without These:**

- API contract changes require SDK regeneration
- New environment variables need validation schemas
- Type changes must be propagated everywhere
- Tests must match implementation

**Best Practices (Won't Block CI):**

- Update examples when APIs change
- Document new features in READMEs
- Add tests for bug fixes
- Keep deployment docs current

For detailed checklists by change type, see [DEVELOPMENT.md](./DEVELOPMENT.md#cascading-updates).

## Key Technical Decisions

### Environment Configuration

All environment access goes through validated schemas. Direct `process.env` access is prevented by ESLint rules. This ensures type safety and validation at startup.

### Monorepo Dependencies

- Apps can depend on packages
- Packages can depend on other packages
- Apps cannot depend on other apps
- Packages cannot depend on apps

### Type Safety with Branded Types

We use branded types to prevent ID mixing bugs at compile time. A `UserId` cannot be accidentally passed where an `OrderId` is expected.

### Runtime Safety with ESLint

Our minimal ESLint configuration focuses on catching runtime issues that TypeScript cannot:

- Enforces environment validation
- Requires request validation
- Prevents direct environment access
- Ensures proper error handling

For implementation details and examples, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## Success Metrics

**Your code is successful when:**

- All validation passes on first try
- Tests actually catch bugs when logic changes
- Other developers can understand and modify it
- It handles edge cases gracefully
- It follows established patterns consistently

## Final Thoughts

These principles are designed to help AI agents (and humans) write high-quality code that:

- Passes all quality gates immediately
- Is maintainable and understandable
- Prevents common production issues
- Scales with the project's growth

The specific tools and commands may change, but these principles remain constant. When in doubt, prioritize clarity, safety, and maintainability over cleverness or brevity.

**Remember**: The best code is code that works correctly, is easy to understand, and is a joy to maintain.
