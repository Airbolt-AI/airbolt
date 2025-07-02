# Contributing to AI Fastify Template

This document outlines the **AI-first collaboration model** for the AI Fastify Template project. AI agents handle 100% of code implementation, while humans provide strategic direction and final approval.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Quality Standards](#quality-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [AI Agent Guidelines](#ai-agent-guidelines)

## Code of Conduct

This project follows a professional, inclusive environment. Please:

- Be respectful and constructive in all interactions
- Focus on technical merit and project goals
- Help maintain a welcoming community for all contributors
- Report any unacceptable behavior to the maintainers

## Getting Started

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 10.0.0
- Git

### Setup

1. **Fork and clone the repository**

   ```bash
   git clone https://github.com/your-username/airbolt.git
   cd airbolt
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Verify setup**

   ```bash
   pnpm ai:quick
   ```

4. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

### Project Structure

```
airbolt/
├── apps/                    # Deployable applications
├── packages/                # Shared libraries
├── docs/                    # Documentation
├── scripts/                 # Utility scripts
└── .github/                 # GitHub workflows
```

### AI Agent Feature Implementation

AI agents autonomously handle complete application development with automated SDK generation:

1. **Complete Application Development**
   - Full-stack TypeScript applications with Fastify backend
   - Zod validation for all inputs and outputs
   - Comprehensive error handling and business logic
   - Service layer architecture and data models

2. **OpenAPI Specification Generation**
   - Structured API contracts for client integration
   - Type-safe request/response schemas
   - Documentation for automated tooling

3. **Quality Assurance**
   - Unit and integration tests
   - Mutation testing validation
   - Architecture compliance checks

**AI Agent Process:**

```bash
# AI agents follow this autonomous workflow:
1. Create feature branch from main
2. Implement complete application with OpenAPI specs
3. Automated SDK generation (via Fern) from API specifications
4. Write comprehensive tests
5. Run quality pipeline (pnpm ai:compliance)
6. Create PR with detailed description
```

**Automated SDK Benefits:**

- Type-safe client libraries generated automatically from OpenAPI specs
- Zero manual client code maintenance
- Contract enforcement prevents API/client mismatches
- Instant client integration for rapid development

**Human Role:**

- Provide requirements and ticket approval
- Review final implementation for business logic correctness
- Approve deployment decisions

### Architecture Guidelines

#### Apps Directory

- **Purpose**: Deployable applications
- **Dependencies**: Can depend on packages, not other apps
- **Structure**: Keep thin, delegate logic to packages
- **Example**: REST API, GraphQL server, CLI tool

#### Packages Directory

- **Purpose**: Shared, reusable code
- **Dependencies**: Can depend on other packages
- **Structure**: Single responsibility, clear interfaces
- **Example**: Database client, validation schemas, utilities

#### Dependency Rules

See [ARCHITECTURE.md](ARCHITECTURE.md#monorepo-structure) for detailed architectural rules and patterns.

## Quality Standards

### Quality Standards Philosophy

We maintain enterprise-grade quality through **simplified, focused tooling**:

- **TypeScript @tsconfig/strictest preset** - Maximum compile-time safety with zero custom configuration
- **Minimal ESLint rules (~40 lines)** - Focus only on runtime safety patterns TypeScript can't catch
- **Mutation testing for test quality** - Stryker ensures tests actually validate business logic
- **Performance optimized for rapid development** - Simplified config means faster builds and near-instant feedback
- **Architecture validation** - dependency-cruiser enforces clean boundaries
- **Security-first approach** - GitLeaks, audit-ci, and focused security rules

**Key insight**: We achieve the same safety guarantees with 90% less configuration by leveraging TypeScript's built-in features rather than trying to replicate them in external tools.

Our quality gates are designed to catch the specific failure modes of AI-generated code while enabling rapid iteration. Specific thresholds are configured in tool configuration files rather than documented, ensuring they remain accurate and maintainable.

For current quality thresholds and metrics, refer to:

- **Mutation testing thresholds**: `stryker.config.mjs`
- **Test coverage requirements**: `vitest.config.ts`
- **Performance benchmarks**: Run `pnpm ai:quick` to measure in your environment

### Code Quality

All contributions must pass the comprehensive quality pipeline:

```bash
# AI-optimized quality commands (recommended)
pnpm ai:quick       # Fast validation (lint + type-check)
pnpm ai:check       # Standard validation (+ graph validation)
pnpm ai:compliance  # Full quality pipeline (required before PR)

# Individual quality checks
pnpm lint           # ESLint + Prettier (minimal runtime-safety focus)
pnpm type-check     # TypeScript with @tsconfig/strictest preset
pnpm test           # Unit and integration tests (Vitest)
pnpm test:mutation  # Mutation testing (Stryker) - enterprise-grade quality standards
pnpm graph:validate # Architecture dependency validation
pnpm build          # Production build verification
```

### TypeScript Standards

- **@tsconfig/strictest**: All TypeScript uses the strictest community preset
- **No `any` types**: Use proper typing or `unknown` with type guards
- **Explicit return types**: For public functions and methods
- **Proper imports**: Use explicit imports, avoid barrel exports

```typescript
// ✅ Good
export function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// ❌ Bad
export function calculateTotal(items: any): any {
  return items.reduce((sum: any, item: any) => sum + item.price, 0);
}
```

### Testing Standards

- **Unit tests**: For all business logic
- **Integration tests**: For API endpoints and external integrations
- **Test coverage**: Aim for >90% coverage
- **Mutation testing**: When available, maintain >90% mutation score

```typescript
// Test structure
describe('Feature', () => {
  describe('when condition', () => {
    it('should behave correctly', () => {
      // Arrange
      const input = createTestInput();

      // Act
      const result = functionUnderTest(input);

      // Assert
      expect(result).toEqual(expectedOutput);
    });
  });
});
```

### Documentation Standards

- **README**: Update if adding new features or changing setup
- **Code comments**: For complex business logic only
- **JSDoc**: For public APIs and exported functions
- **Architecture decisions**: Document in `docs/ARCHITECTURE.md`

## Commit Guidelines

### Commit Message Format

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples

```bash
# Feature
git commit -m "feat(api): add user authentication endpoint"

# Bug fix
git commit -m "fix(validation): handle empty string in email validator"

# Documentation
git commit -m "docs: update contributing guidelines"

# Breaking change
git commit -m "feat(api)!: change user ID from number to UUID

BREAKING CHANGE: User IDs are now UUIDs instead of numbers"
```

### Commit Best Practices

- **Atomic commits**: One logical change per commit
- **Clear messages**: Describe what and why, not how
- **Reference issues**: Include issue numbers when applicable
- **Test before commit**: Ensure all quality checks pass

## Pull Request Process

### Before Submitting

1. **Ensure quality checks pass**

   ```bash
   pnpm ai:compliance    # Full quality pipeline (required before PR)
   ```

2. **Update documentation**
   - README if adding features
   - JSDoc for new public APIs
   - Architecture docs for significant changes

3. **Add tests**
   - Unit tests for new functions
   - Integration tests for new endpoints
   - Update existing tests if behavior changes

### PR Description Template

```markdown
## Summary

Brief description of changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Checklist

- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests pass locally
- [ ] No breaking changes (or properly documented)
```

### Review Process

1. **Automated checks**: All CI checks must pass
2. **Code review**: At least one maintainer approval required
3. **Testing**: Verify tests cover new functionality
4. **Documentation**: Ensure docs are updated appropriately

## AI Agent Guidelines

This project implements **fully autonomous AI development** where AI agents handle 100% of implementation tasks:

### AI Agent Workflow

The development process uses three specialized AI coding tools:

- **OpenAI Codex**: Direct access to `@AGENTS.md` guidelines
- **Cursor IDE**: Accesses via `@.cursor/rules/default.mdc` → references `AGENTS.md`
- **Claude Code**: Accesses via `@CLAUDE.md` → imports `AGENTS.md`

All AI agents receive identical comprehensive guidelines ensuring **100% consistency** across tools.

### Autonomous Development Process

1. **Requirements Gathering**: AI agents pull tickets from Linear via MCP integration
2. **Implementation**: AI agents generate complete applications with OpenAPI specs for automated SDK generation
3. **Testing**: Comprehensive test suites with >90% mutation testing scores
4. **Code Review**: Separate AI agents perform thorough code review
5. **Human Approval**: Humans provide final approval for deployment

### Quality Assurance Integration

AI agents use the comprehensive quality pipeline:

```bash
pnpm ai:quick      # Fast validation (lint + type-check)
pnpm ai:check      # Standard validation (includes security)
pnpm ai:compliance # Full compliance validation
```

### Linear MCP Integration

AI agents autonomously manage project workflow:

- **Ticket Selection**: `/get-next-ticket` - AI reviews backlog and selects optimal work
- **Implementation**: `/start-ticket` - AI moves ticket to In Progress and implements
- **Code Review**: `/code-review` - AI conducts thorough automated review
- **Progress Tracking**: Real-time updates to Linear issues during development

### Human Role

Human involvement is limited to:

- **Strategic direction** and requirement clarification
- **Final approval** of AI-generated implementations
- **Deployment decisions** and production oversight

**Key Principle**: AI agents handle 100% of coding, testing, and code review. Humans provide direction and approval.

## Getting Help

- **Documentation**: Check `docs/` directory first
- **Issues**: Search existing issues before creating new ones
- **Discussions**: Use GitHub Discussions for questions
- **Maintainers**: Tag maintainers for urgent issues only

## Recognition

Contributors will be recognized in:

- GitHub contributors list
- Release notes for significant contributions
- Project documentation for major features

Thank you for contributing to AI Fastify Template! 🚀
