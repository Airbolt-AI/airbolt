# AI Agent Development Workflow

This document outlines the **fully autonomous AI development workflow** for the AI Fastify Template project. AI agents handle 100% of development tasks from requirements to code review.

## Table of Contents

- [AI Agent Workflow](#ai-agent-workflow)
- [Environment Setup](#environment-setup)
- [Linear MCP Integration](#linear-mcp-integration)
- [Custom Slash Commands](#custom-slash-commands)
- [Quality Assurance](#quality-assurance)
- [Turbo Pipeline](#turbo-pipeline)
- [Human Oversight](#human-oversight)

## AI Agent Workflow

This template implements a **fully autonomous development process** where AI agents handle all implementation tasks:

### 1. Ticket Selection & Planning

```bash
# Human initiates the process
/get-next-ticket          # AI agent reviews backlog and selects next priority ticket
```

The AI agent:

- Reviews the Linear project board using MCP integration
- Analyzes priority, dependencies, and project goals
- Selects the optimal next ticket with clear rationale
- Presents recommendation to human for approval

### 2. Autonomous Implementation

```bash
# Human approves ticket selection
/start-ticket            # AI agent implements complete feature end-to-end
```

The AI agent autonomously:

- Creates fresh branch off main with proper naming convention
- Implements complete feature including:
  - Complete application development (APIs, business logic, data models)
  - OpenAPI specification generation for client SDK automation
  - Comprehensive test suites (unit + integration + mutation)
  - Documentation updates
  - All with TypeScript @tsconfig/strictest safety guarantees
- Runs all quality gates (`pnpm ai:compliance`)
- Commits with conventional commit messages
- Opens pull request with detailed description

### 3. AI Code Review

```bash
# Separate AI agent performs code review
/code-review             # AI agent conducts thorough code review
```

The reviewing AI agent:

- Defines exceptional code review criteria
- Analyzes implementation against strict quality standards
- Posts detailed review comments on the PR
- If changes needed: implements fixes autonomously
- Ensures all quality gates pass before approval

### 4. Human Oversight

Human role is limited to:

- **Initial approval** of ticket selection
- **Final approval** of completed implementation
- **Deployment decisions** and production oversight
- **Strategic direction** and requirement clarification

**Key Principle**: AI agents handle 100% of coding, testing, and code review. Humans provide direction and final approval.

## Environment Setup

### Prerequisites

Ensure you have the required tools installed:

```bash
# Check versions
node --version    # >= 20.0.0
pnpm --version    # >= 10.0.0
git --version     # >= 2.0.0
```

### Initial Setup

1. **Clone and install**

   ```bash
   git clone https://github.com/Airbolt-AI/airbolt.git
   cd airbolt
   pnpm install
   ```

2. **Verify installation**

   ```bash
   # Check workspace structure
   pnpm list --depth=0

   # Verify development environment
   pnpm ai:quick
   ```

3. **Set up development environment**

   ```bash
   # Configure your editor for TypeScript
   # VS Code: Install recommended extensions
   # Cursor: AI rules are already configured via AGENTS.md
   ```

4. **Initialize git hooks** (Quality Gates)

   ```bash
   # Initialize husky git hooks
   pnpm setup:dev

   # Or manually:
   npx husky init

   # Test hooks are working
   git add . && git commit -m "test: verify hooks work" --dry-run
   ```

   The git hooks provide automated quality gates:
   - 🎨 **ESLint + Prettier** - Auto-fixes formatting issues on staged files
   - 📝 **Conventional Commits** - Enforces commit message format
   - 🔄 **Auto-staging** - Modified files are automatically re-staged after fixes
   - ⚡ **Fast execution** - Only processes staged files, not entire codebase

## Linear MCP Integration

The template integrates with Linear project management through MCP (Model Context Protocol) tools, enabling AI agents to autonomously interact with project boards.

### Available Commands

AI agents use these commands to manage the development workflow:

```bash
/get-next-ticket          # Review backlog and select optimal next ticket
/get-in-progress-ticket   # Check current ticket status and associated PR
/start-ticket            # Move ticket to In Progress and implement complete feature
/code-review             # Perform thorough code review of PR
```

### MCP Linear Tools

The following Linear MCP tools are available to AI agents:

- `mcp__linear__list_issues` - List and filter issues
- `mcp__linear__get_issue` - Get detailed issue information
- `mcp__linear__create_issue` - Create new issues
- `mcp__linear__update_issue` - Update issue status and details
- `mcp__linear__create_comment` - Add comments to issues
- `mcp__linear__list_projects` - List projects
- `mcp__linear__list_teams` - List teams

### Ticket Lifecycle

1. **Backlog Management**: AI agents analyze Linear board for priority tickets
2. **Ticket Selection**: `/get-next-ticket` command selects optimal work
3. **Implementation**: `/start-ticket` moves to In Progress and implements
4. **Code Review**: `/code-review` provides thorough automated review
5. **Human Approval**: Human approves final implementation for merge

## Custom Slash Commands

The workflow commands referenced above are now included in the project as custom slash commands in `.claude/commands/`. These represent workflow patterns that have proven effective in practice with Claude Code.

### Available Commands

```bash
/get-next-ticket          # Analyze backlog and recommend next priority ticket
/get-in-progress-ticket   # Check status of current in-progress work
/start-ticket            # Move ticket to In Progress and implement complete feature
/code-review             # Perform thorough code review with quality criteria
```

### Philosophy: Meta-Prompts Over Prescriptive Steps

These commands demonstrate a **meta-prompt approach** rather than prescriptive step-by-step instructions. Each command asks Claude to:

1. **First define quality standards** (e.g., "define the qualities of an exceptional implementation")
2. **Then apply those standards** to the specific task

This approach is more effective than detailed instructions because it:

- **Teaches Claude to think** about the problem domain
- **Adapts to different contexts** rather than following rigid steps
- **Produces higher quality results** by establishing criteria first
- **Scales better** as requirements evolve

### Customization and Evolution

**These are examples, not requirements.** You can:

- **Modify existing commands** to match your workflow preferences
- **Create new commands** for your specific use cases
- **Remove commands** that don't fit your development style
- **Adapt the meta-prompt pattern** to other domains

**These will continue to evolve** based on what works in practice. They represent current workflow patterns, not definitive best practices.

### When Specific Callouts Are Needed

While meta-prompts are preferred, sometimes explicit instructions are necessary when patterns emerge where Claude Code doesn't follow expected behavior:

**Common examples:**

- **Unnecessary file creation**: Claude Code may create documentation files when not requested, despite instructions to avoid this
- **TodoWrite tool usage**: For complex multi-step tasks, Claude Code may not use the TodoWrite tool even when it would be helpful for tracking progress
- **Over-explanation**: Providing lengthy explanations when a concise response was requested

These specific callouts are added to project guidelines (like `AGENTS.md`) when patterns consistently emerge.

### Command Implementation

Each command is implemented as a simple markdown file containing the prompt:

```bash
# View command implementations
ls .claude/commands/
cat .claude/commands/start-ticket.md
```

The files are minimal and focused, following the meta-prompt philosophy of teaching Claude to think rather than providing detailed steps.

### Scientific Optimization Framework

**Motivation**: Transform prompt engineering from subjective art into empirical optimization using measurable loss functions, aligning with enterprise LLM evaluation best practices.

**Approach**: Each command has defined objectives optimized through systematic measurement:

```typescript
// Example: /start-ticket loss function
L = w₁ × (1 - first_try_pass_rate) + w₂ × time_to_completion + w₃ × human_interventions_needed
```

**Implementation**: See [MAR-54](https://linear.app/markwatson/issue/MAR-54) for comprehensive framework development.

**Future Work**:

- Multi-objective optimization with Pareto frontiers
- Reinforcement learning for dynamic prompt adaptation
- Cross-project benchmarking for command effectiveness
- Academic research on systematic prompt optimization methodologies

This scientific approach enables data-driven improvement of AI-assisted development workflows, transitioning from experimental tooling to engineering discipline with measurable ROI.

## Creating New Features (AI Agent Process)

When implementing features, AI agents follow this process:

1. **Create feature branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Add new packages as needed**

   ```bash
   # New app
   mkdir apps/my-app
   cd apps/my-app
   pnpm init

   # New shared package
   mkdir packages/my-package
   cd packages/my-package
   pnpm init
   ```

3. **Install dependencies**

   ```bash
   # App-specific dependency
   pnpm add --filter my-app fastify

   # Workspace dev dependency
   pnpm add -Dw @types/node

   # Package dependency
   pnpm add --filter @airbolt/my-package zod
   ```

### AI Agent Development Loop

AI agents autonomously handle the complete development cycle:

1. **Code Generation**
   - Generate TypeScript code following strict mode requirements
   - Create comprehensive test suites (unit + integration + mutation)
   - Update documentation automatically
   - Generate OpenAPI specifications for automated SDK generation

2. **Quality Validation**

   ```bash
   # AI agents run quality checks continuously
   pnpm ai:quick      # Fast validation (lint + type-check)
   pnpm ai:check      # Standard validation (includes graph validation)
   pnpm ai:compliance # Full quality pipeline including mutation testing
   ```

3. **Autonomous Commits**

   ```bash
   # AI agents commit with conventional commit format
   git add .
   git commit -m "feat(scope): description of changes"

   # AI agents create PR with detailed description
   gh pr create --title "..." --body "..."
   ```

### Conventional Commit Format

This project enforces conventional commit messages using Commitlint. All commits must follow this format:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

**Allowed Types:**

- `feat` - New features
- `fix` - Bug fixes
- `docs` - Documentation changes
- `style` - Code style changes (formatting, etc.)
- `refactor` - Code refactoring
- `test` - Adding or updating tests
- `chore` - Maintenance tasks
- `ci` - CI/CD changes
- `perf` - Performance improvements
- `build` - Build system changes

**Allowed Scopes:**

- `api` - Backend API changes
- `backend` - Backend-specific changes
- `frontend` - Frontend-specific changes
- `docs` - Documentation changes
- `config` - Configuration changes
- `test` - Test-related changes
- `ci` - CI/CD pipeline changes
- `scripts` - Build/utility scripts
- `deps` - Dependency updates
- `security` - Security-related changes

**Examples:**

✅ **Valid Commits:**

```bash
feat(api): add user authentication endpoint
fix(backend): resolve database connection timeout
docs(readme): update installation instructions
chore(deps): upgrade fastify to v4.28.0
ci(hooks): implement pre-commit validation
```

❌ **Invalid Commits:**

```bash
# Missing scope
git commit -m "feat: add new feature"

# Invalid scope
git commit -m "feat(invalid-scope): add feature"

# Uppercase/incorrect case
git commit -m "Feat(api): Add new feature"

# Missing colon
git commit -m "feat(api) add new feature"

# Too long (>100 characters)
git commit -m "feat(api): this is a very long commit message that exceeds the maximum allowed length and will be rejected"
```

## Quality Assurance

### Quality Checks

The project implements a comprehensive fail-fast pipeline:

```
lint → type-check → graph:validate → test → test:mutation → build
```

**Current Status**: ✅ Full quality pipeline implemented with simplified configuration:

- TypeScript safety via @tsconfig/strictest preset (zero custom config)
- ESLint focused on runtime safety only (~40 lines vs 400+)
- Same safety guarantees with 90% less configuration complexity

### Running Quality Checks

```bash
# AI-optimized commands (recommended)
pnpm ai:quick       # Fast validation (lint + type-check)
pnpm ai:check       # Standard validation (+ graph validation)
pnpm ai:compliance  # Full quality pipeline including mutation testing

# Individual commands
pnpm lint           # ESLint + Prettier (minimal runtime-safety focus)
pnpm type-check     # TypeScript with @tsconfig/strictest preset
pnpm test           # Unit and integration tests (Vitest)
pnpm test:mutation  # Mutation testing (Stryker) - enterprise-grade quality standards
pnpm graph:validate # Dependency architecture validation
pnpm build          # Production build verification
```

### Quality Standards

- **TypeScript**: @tsconfig/strictest preset - maximum safety, minimal config
- **Testing**: >90% coverage, comprehensive test suites
- **Architecture**: Clean dependencies, no cycles
- **Performance**: Optimized builds, efficient caching

### Git Hooks Troubleshooting

**Common Issues:**

1. **Hooks not running**

   ```bash
   # Re-initialize husky
   npx husky init

   # Check hook installation
   ls -la .git/hooks/
   cat .git/hooks/pre-commit
   ```

2. **Formatting/linting issues during commit**

   ```bash
   # Run lint-staged manually to see what's happening
   npx lint-staged

   # Run individual tools manually
   pnpm lint:fix
   ```

3. **Commit message format errors**

   ```bash
   # Check your commit message format
   # Must be: type(scope): description
   # Example: feat(api): add new endpoint
   ```

4. **Hook execution fails**

   ```bash
   # Skip hooks for emergency commits (use sparingly)
   git commit --no-verify -m "emergency: message"

   # Debug hook execution
   git commit -m "test" --dry-run
   ```

## Turbo Pipeline

### Understanding Turbo

TurboRepo provides intelligent caching and parallel execution:

```bash
# View pipeline configuration
cat turbo.json

# Standard commands (use these)
pnpm build              # Build all packages
pnpm clean              # Clear build artifacts and cache

# Advanced debugging (when needed)
pnpm build --verbosity=2  # Verbose output with detailed logs
pnpm clean                 # Clear cache and build artifacts
```

### Pipeline Configuration

**Current turbo.json** (foundation only):

```json
{
  "tasks": {
    "build": { "outputs": ["dist/**"] },
    "dev": { "cache": false, "persistent": true },
    "lint": { "outputs": [] },
    "clean": { "cache": false }
  }
}
```

**Optimized pipeline** (current):

```json
{
  "tasks": {
    "lint": { "outputs": [] },
    "type-check": { "dependsOn": ["^build"], "outputs": [] },
    "graph:validate": { "dependsOn": ["^build"], "outputs": [] },
    "test": { "dependsOn": ["^build"], "outputs": ["coverage/**"] },
    "test:mutation": { "dependsOn": ["test"], "outputs": ["reports/**"] },
    "build": {
      "dependsOn": ["^build", "type-check"],
      "outputs": ["dist/**"]
    }
  }
}
```

### Caching Benefits

- **Local caching**: Skips unchanged tasks
- **Remote caching**: Share cache across team (when configured)
- **Incremental builds**: Only rebuild what changed

```bash
# First run (cache miss)
pnpm build
# → Takes full time

# Second run (cache hit)
pnpm build
# → Nearly instant with "FULL TURBO"
```

## Debugging

### Common Issues

**TypeScript Errors**

```bash
# Check specific package
pnpm --filter my-app type-check

# View detailed errors
pnpm tsc --noEmit --pretty
```

**Dependency Issues**

```bash
# Check dependency graph
pnpm graph

# View workspace dependencies
pnpm list --depth=1

# Clear and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

**Turbo Cache Issues**

```bash
# Clear turbo cache
pnpm clean
rm -rf .turbo

# Force rebuild (advanced)
pnpm build --force
```

**Import/Export Errors**

```bash
# Check for circular dependencies
pnpm graph

# Verify package exports
cat packages/my-package/package.json
```

### Debug Tools

```bash
# Standard debugging
pnpm build              # Standard build
pnpm clean              # Clear cache

# Advanced debugging
pnpm build --verbosity=2     # Verbose output with detailed logs
pnpm build --dry-run         # See what would run without executing

# Dependency analysis
pnpm why package-name
pnpm list --depth=0
```

## Performance

### Build Performance

```bash
# Measure build time
time pnpm build

# Advanced analysis (when needed)
pnpm build --summarize          # Cache efficiency analysis
pnpm build --profile            # Performance profiling
```

### Development Performance

- **Incremental compilation**: TypeScript project references
- **Hot reloading**: Fast refresh in development
- **Selective execution**: Only run affected packages

### Optimization Tips

1. **Use filtering for large workspaces (advanced)**

   ```bash
   # Only build affected packages (when multiple packages exist)
   pnpm build --filter=...my-app

   # Build specific package and dependencies
   pnpm build --filter=my-app...
   ```

2. **Leverage caching**

   ```bash
   # Ensure outputs are configured correctly
   # Check turbo.json for proper output patterns
   ```

3. **Optimize dependencies**

   ```bash
   # Use exact versions for stability
   pnpm add --save-exact package-name

   # Audit bundle size
   pnpm dlx bundle-analyzer
   ```

## Release Process

### Pre-Release Checklist

1. **Quality assurance**

   ```bash
   # Run all available quality checks
   pnpm lint
   pnpm build

   # Coming with MAR-11+: Full pipeline
   # pnpm test && pnpm type-check
   ```

2. **Documentation updates**
   - Update README if needed
   - Update CHANGELOG
   - Verify all docs are current

3. **Version management**
   ```bash
   # Update version in package.json
   # Follow semantic versioning
   ```

### Release Steps

1. **Create release branch**

   ```bash
   git checkout -b release/v1.0.0
   ```

2. **Final testing**

   ```bash
   # Run all quality checks
   pnpm lint
   pnpm build

   # Coming with MAR-11+: Full testing
   # pnpm test
   # pnpm test:e2e  # When available
   ```

3. **Create release**

   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

4. **Deploy** (automated via GitHub Actions)

### Post-Release

1. **Monitor deployment**
2. **Update documentation**
3. **Communicate changes**

## Best Practices

### Code Organization

- **Single responsibility**: Each package has one clear purpose
- **Clear interfaces**: Well-defined APIs between packages
- **Minimal coupling**: Reduce dependencies between packages

### Testing Strategy

- **Unit tests**: Test individual functions and classes
- **Integration tests**: Test package interactions
- **End-to-end tests**: Test complete workflows

### Documentation

- **Code comments**: Only for complex business logic
- **README files**: For each package with public API
- **Architecture docs**: For significant design decisions

### Performance

- **Bundle analysis**: Regular checks on bundle size
- **Dependency audits**: Keep dependencies minimal and current
- **Caching strategy**: Leverage turbo caching effectively

## Troubleshooting

### Getting Help

1. **Check documentation**: Start with `docs/` directory
2. **Search issues**: Look for similar problems
3. **Run diagnostics**: Use built-in debugging tools
4. **Ask for help**: Create detailed issue reports

### Common Solutions

- **Clean install**: `rm -rf node_modules pnpm-lock.yaml && pnpm install`
- **Clear cache**: `pnpm clean`
- **Reset git**: `git clean -fdx` (careful!)
- **Update tools**: Ensure latest versions of Node.js and pnpm

---

This workflow ensures consistent, high-quality development while leveraging the full power of the monorepo setup and AI-assisted development capabilities.
