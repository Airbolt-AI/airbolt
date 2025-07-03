# 🚀 Airbolt

> Production-ready Fastify + TypeScript monorepo optimized for AI-assisted development

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)
[![pnpm Version](https://img.shields.io/badge/pnpm-%3E%3D10.0.0-orange)](https://pnpm.io/)

## Overview

This template provides a production-ready foundation where **AI coding agents autonomously generate complete backend APIs with automatically generated type-safe client SDKs** using comprehensive guardrails that prevent technical debt and architectural violations.

### Why This Template Exists

Modern AI coding assistants are powerful but can introduce subtle bugs, architectural violations, or security issues. This template provides:

- **Immediate feedback loops** for AI agents through fail-fast pipelines
- **Constraint-driven development** that guides AI toward correct patterns
- **Comprehensive quality gates** that catch issues before they reach production
- **Clear architectural boundaries** that prevent spaghetti code

### Why AI Development Needs Different Constraints

Traditional software quality relies on experienced developers making good decisions. AI agents have different failure modes that require systematic prevention:

**🧪 The "Coverage Theater" Problem**

```typescript
// AI frequently writes tests that achieve 100% coverage but validate nothing:
it('should calculate tax', () => {
  const result = calculateTax(100, 0.1);
  expect(result).toBeDefined(); // ✅ Passes
  expect(typeof result).toBe('number'); // ✅ Passes - 100% coverage!
});

// Our enterprise-grade mutation testing standards catch this
// When logic is mutated, the test still passes, revealing it's fake
```

**🏗️ Architectural Drift Without Understanding**

```typescript
// AI doesn't understand why this is problematic:
const config = {
  port: process.env.PORT || 3000, // ❌ No validation
  secret: process.env.JWT_SECRET, // ❌ Could be undefined
};

// ESLint rules enforce proper patterns:
const config = ConfigSchema.parse(process.env); // ✅ Validation required
```

**⚡ Different Development Velocity**

- **Human pace**: Think → Code → Test → Review (minutes to hours)
- **AI pace**: Generate → Validate → Iterate (seconds)
- **Our solution**: Rapid feedback loops optimized for AI's iterative development

This template implements **constraint-based development** where quality comes from systematic guardrails, not developer experience.

### Primary Use Case

Built for **fully autonomous AI development workflows** where AI agents generate complete applications while automated tooling provides type-safe client integration. The human role is limited to:

- **Requirements collaboration** with AI agents (pulling from Linear via MCP)
- **Final approval** of AI-generated implementations
- **Deployment decisions** and production oversight

**AI agents handle 100% of development:**

- **Complete application development** (backend APIs, testing, documentation)
- **Code generation, testing, and code review** using **Cursor IDE**, **Claude Code**, and **OpenAI Codex**

**Automated SDK generation provides:**

- **Type-safe client libraries** automatically generated from API specifications (via Fern)
- **Zero client integration overhead** - consume APIs immediately with full IntelliSense
- **Contract enforcement** - breaking API changes are caught at compile-time
- **Rapid prototyping** - frontend teams get working client libraries instantly

This eliminates the traditional bottleneck where backend teams must manually write and maintain client SDKs, documentation, and coordinate API changes with frontend teams.

## Quick Start

### Prerequisites

- **Node.js** >= 20.0.0
- **pnpm** >= 10.0.0

### Installation

```bash
# Clone the repository
git clone https://github.com/Airbolt-AI/airbolt.git
cd airbolt

# Setup development environment (includes GitLeaks security scanner)
pnpm setup:dev

# Verify setup
pnpm ai:quick
```

#### Manual GitLeaks Installation

If you need to install GitLeaks separately or the automatic installation fails:

```bash
# Install GitLeaks using the enterprise installation script
pnpm setup:gitleaks

# Or manually via package manager:
# macOS: brew install gitleaks
# Ubuntu/Debian: sudo apt-get install gitleaks
# RHEL/CentOS: sudo yum install gitleaks
```

> **Note**: GitLeaks is required for the pre-commit security scanning. The setup script automatically handles installation across different platforms.

### Development

```bash
# Start development server
pnpm dev              # Start all apps in development mode

# Build and test
pnpm build            # Build all packages
pnpm test             # Run all test suites
pnpm type-check       # TypeScript compilation check

# Quality assurance
pnpm lint             # Code formatting and linting (ESLint + Prettier)
pnpm clean            # Clean build artifacts
```

## 🛡️ Local Validation - Prevent CI Failures

> **Critical**: Always validate locally before pushing. CI failures are expensive and slow.

### ⚡ Quick Commands (Use Daily)

```bash
# 🚀 FASTEST: Match CI exactly (~30 seconds)
pnpm ci:check         # Same validation as GitHub Actions

# 🔧 FIX: Auto-fix issues
pnpm lint:fix         # Fix formatting + linting

# 🎯 TARGETED: Specific checks
pnpm lint             # ESLint errors
pnpm type-check       # TypeScript compilation
pnpm test             # Test suite
pnpm build            # Production build
```

### 📊 Validation Levels

| Command              | Speed | Use Case                     | What It Checks                   |
| -------------------- | ----- | ---------------------------- | -------------------------------- |
| `pnpm ai:quick`      | ~5s   | **Constantly during coding** | lint + type-check                |
| `pnpm ci:check`      | ~30s  | **Before every commit**      | lint + type-check + test + build |
| `pnpm ai:compliance` | ~5min | **Before important PRs**     | Full pipeline + mutation testing |

### 🚨 Pre-Commit Safety

Pre-commit hooks automatically run comprehensive validation:

- 🔒 Security scanning (GitLeaks)
- 🎨 Code quality (ESLint + Prettier)
- 🔷 Type safety (TypeScript)
- 🧪 Test validation
- 🏗️ Build verification

**If pre-commit fails:**

```bash
# Fix the issues
pnpm lint:fix && pnpm ci:check

# Then commit normally (hooks will pass)
git commit -m "your message"
```

**Need to bypass? (Emergency only)**

```bash
# Provides safety guidance and requires justification
./scripts/safe-commit.sh --no-verify -m "emergency: detailed reason"
```

### 📖 Full Guide

See [docs/LOCAL_VALIDATION_GUIDE.md](docs/LOCAL_VALIDATION_GUIDE.md) for comprehensive troubleshooting and best practices.

## Project Structure

```
airbolt/
├── apps/                    # Applications ✅
│   └── backend-api/         # Fastify backend API ✅
├── packages/                # Shared packages ✅
│   └── config/              # Configuration utilities ✅
├── docs/                    # Documentation ✅
│   ├── CONTRIBUTING.md      # Contributing guidelines ✅
│   ├── DEVELOPMENT.md       # Development workflow ✅
│   └── ARCHITECTURE.md      # Architecture overview ✅
├── turbo.json              # TurboRepo configuration ✅
├── pnpm-workspace.yaml     # pnpm workspace configuration ✅
└── package.json            # Root package configuration ✅
```

## Technology Stack

| Category                    | Tool                                 | Why Critical for AI                                                                                                   | Traditional Projects      |
| --------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| **Fast streaming API**      | Fastify + fastify-sse                | AI needs real-time responses                                                                                          | Standard in many projects |
| **Linting + Formatting**    | ESLint + Prettier (minimal config)   | **Runtime safety rules only** - focusing on what TypeScript can't catch                                               | Complex rulesets          |
| **Early type safety**       | TypeScript (@tsconfig/strictest)     | AI can't use escape hatches like `any` - enforced by strictest preset                                                 | Often allows `any` types  |
| **Schema validation**       | Zod (bodies & env)                   | **Mandatory** - AI doesn't know trust boundaries                                                                      | Often optional/selective  |
| **Security scanning**       | GitLeaks + audit-ci                  | AI might commit secrets without realizing                                                                             | Manual review sufficient  |
| **Guard against spaghetti** | dependency-cruiser                   | AI creates circular dependencies without understanding                                                                | Relies on code review     |
| **High-trust tests**        | Vitest + Coverage                    | Basic foundation for testing                                                                                          | Same usage                |
| **Mutation testing**        | Stryker (enterprise-grade standards) | **Catches AI's "fake tests" that achieve coverage but test nothing - ensures tests actually validate business logic** | Rarely used (expensive)   |
| **Task caching**            | pnpm workspaces + TurboRepo          | Rapid feedback optimized for AI's iterative development                                                               | Same usage                |

## Available Scripts

### Core Development

```bash
# Development workflow
pnpm dev              # Start all apps in development mode
pnpm build            # Build all packages
pnpm clean            # Clean build artifacts

# Quality assurance
pnpm test             # Run all test suites
pnpm test:watch       # Run tests in watch mode
pnpm test:coverage    # Run tests with coverage report
pnpm type-check       # TypeScript compilation check
```

### Security & Quality Tools

```bash
# Enterprise-grade quality pipeline
pnpm ai:quick         # Fast validation (lint + type-check)
pnpm ai:check         # Standard validation (includes security)
pnpm ai:compliance    # Full compliance validation
pnpm ai:security      # Security audit of dependencies

# Security scanning
pnpm security:scan    # Run GitLeaks credential scanning
pnpm setup:gitleaks   # Install/update GitLeaks scanner

# Advanced Quality Gates
pnpm lint             # Code formatting and linting (ESLint + Prettier)
pnpm test:mutation    # Run mutation tests (enterprise-grade quality standards)
```

## Workspace Structure

### Apps Directory (`apps/`)

**Status: ✅ Active - Backend API implemented**

Contains deployable applications:

- **`backend-api/`** - Production-ready Fastify server with TypeScript
- Each app has its own `package.json`
- Apps can depend on packages but not other apps
- Apps should be thin, delegating logic to packages

### Packages Directory (`packages/`)

**Status: ✅ Active - Configuration utilities implemented**

Contains shared libraries:

- Reusable code across apps
- Can depend on other packages
- Should have clear, focused responsibilities

### Workspace Configuration

```yaml
# pnpm-workspace.yaml
packages: ['apps/*', 'packages/*']
```

## Development Workflow

### Adding New Packages

```bash
# Create new app
mkdir apps/my-app
cd apps/my-app
pnpm init

# Create new package
mkdir packages/my-package
cd packages/my-package
pnpm init
```

### Working with Dependencies

```bash
# Add dependency to specific package
pnpm add --filter my-app fastify

# Add dev dependency to workspace root
pnpm add -Dw typescript

# Install dependencies for all packages
pnpm install
```

## Architecture Principles

### AI-First Design

- **Constraint-driven development** guides AI toward correct patterns
- **Immediate feedback loops** through fail-fast pipelines
- **Clear architectural boundaries** prevent violations
- **Comprehensive validation** catches AI-generated errors

### Quality Gates (Implemented)

- **Strict TypeScript** - Using @tsconfig/strictest preset for maximum safety with minimal configuration
- **Runtime Validation** - Zod schemas for all environment variables and request inputs
- **Import Graph Validation** - dependency-cruiser prevents circular dependencies and enforces architecture
- **Comprehensive Testing** - Unit, integration tests with enterprise-grade mutation testing standards that catch logic errors traditional coverage metrics miss

### Security First (Implemented)

- Environment variable validation with Zod schemas
- Input sanitization and validation at all API boundaries
- GitLeaks pre-commit scanning for credential detection
- Dependency vulnerability scanning with audit-ci

## Current Status

This template is in **active development**. Current state:

✅ **Foundation Complete**

- Monorepo structure with pnpm + TurboRepo
- Comprehensive documentation
- AI-first development guidelines

✅ **Backend API Complete (MAR-11)**

- Production-ready Fastify server with TypeScript
- Strict TypeScript configuration with enterprise standards
- Comprehensive test setup with Vitest
- Development and production scripts

✅ **Quality Tooling Complete**

- dependency-cruiser for architectural validation
- Mutation testing with Stryker (enterprise-grade standards ensure tests validate business logic, not just achieve coverage)
- Zod validation patterns for environment and inputs
- Comprehensive testing framework with Vitest
- CI/CD pipeline with GitHub Actions

## Troubleshooting

### Common Issues

**Fast Quality Validation**

```bash
# Quick validation during development
pnpm ai:quick        # Lint + type-check (fast)
pnpm ai:check        # + dependency validation
pnpm ai:compliance   # Full quality pipeline
```

**Getting Started**

- Follow the [Quick Start](#quick-start) guide above
- The backend API is already implemented and ready to use
- Refer to [docs/](docs/) for detailed development guidelines

### Advanced Debugging

```bash
# Advanced turbo commands for debugging
pnpm build --verbosity=2     # Verbose build output with detailed logs
pnpm clean                   # Clear build artifacts and cache
turbo build --dry-run         # See what would run without executing
```

## 🤖 AI-First Development Workflow

This template is specifically designed for **autonomous AI development** where AI agents perform all coding tasks. We support three primary AI coding tools—**OpenAI Codex**, **Anthropic's Claude Code**, and **Cursor IDE**.

### AI Agent Guidelines Distribution

All AI coding agents receive the same comprehensive guidelines from `AGENTS.md`:

- **OpenAI Codex**: Direct access to `@AGENTS.md`
- **Cursor IDE**: Accesses via `@.cursor/rules/default.mdc` → references `AGENTS.md`
- **Claude Code**: Accesses via `@CLAUDE.md` → imports `AGENTS.md`

This ensures **100% consistency** across all AI coding tools with a single source of truth.

### AI Agent Workflow

1. **Requirements Gathering**: AI agents pull tickets from Linear (via MCP integration)
2. **Complete Development**: AI agents generate full applications (APIs, tests, documentation) with full TypeScript safety
3. **Automated SDK Generation**: Fern automatically generates type-safe client SDKs from API specifications
4. **Quality Validation**: Comprehensive automated quality gates ensure code quality
5. **AI Code Review**: AI agents perform thorough code review and validation
6. **Human Approval**: Humans review final output and approve for deployment

**Key Principle**: Humans specify requirements and approve results. AI agents handle 100% of development implementation, while automated tooling provides seamless client integration.

### Quality Integration

Guidelines integrate with our quality pipeline:

```bash
pnpm ai:quick      # Quick validation (lint + type-check)
pnpm ai:check      # Standard validation (includes security)
pnpm ai:compliance # Full compliance validation
```

_Always edit AGENTS.md for shared guidelines. Tool-specific files should remain minimal imports/references._

### Getting Help

- 📖 [Documentation](docs/)
- 🦀 [Rust Patterns Analysis](docs/RUST_PATTERNS_ANALYSIS.md) - How we achieve Rust-like safety in TypeScript
- 🐛 [Issue Tracker](https://github.com/Airbolt-AI/airbolt/issues)
- 💬 [Discussions](https://github.com/Airbolt-AI/airbolt/discussions)

## Contributing

See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for detailed guidelines.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Ready to build AI-powered applications?** This template provides the complete foundation you need with a production-ready Fastify backend, comprehensive testing, and AI-optimized development workflows.
