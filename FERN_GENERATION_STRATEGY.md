# Fern SDK Generation Strategy

## Overview

This document outlines the **build-time generation strategy** for the Airbolt SDK using Fern. This approach ensures clean git history, always-fresh generated code, and reliable CI/CD integration.

## Strategy: Build-Time Generation

### Decision Rationale

**Chosen Approach**: Build-time generation with Docker dependency
**Alternative Considered**: Pre-commit generation with committed generated code

**Why Build-Time Generation**:

- ✅ **Clean git history** - no generated code in version control
- ✅ **Always fresh** - generated code matches current OpenAPI spec
- ✅ **No merge conflicts** - generated code doesn't conflict during git operations
- ✅ **Explicit workflow** - developers know when they need to generate
- ✅ **CI/CD friendly** - generation happens in controlled environment

**Trade-offs Accepted**:

- ❌ **Docker dependency** - developers must have Docker installed and running
- ❌ **Explicit step** - developers must run generation before development

## Developer Workflow

### First-Time Setup

```bash
# 1. Clone repository
git clone <repository-url>
cd airbolt

# 2. Install dependencies
pnpm install

# 3. Start Docker (if not already running)
open -a Docker  # macOS
# OR
sudo systemctl start docker  # Linux

# 4. Generate SDK
pnpm generate

# 5. Start development
pnpm dev
```

### Daily Development Workflow

```bash
# When API changes or working on SDK
pnpm generate  # Regenerate from latest OpenAPI spec

# Normal development (generated code already exists)
pnpm dev
```

### Build Process

```bash
# Automatic generation before build
pnpm build  # Runs `pnpm generate` first via prebuild hook

# Manual generation
pnpm generate
pnpm sdk:check  # Validate generation without regenerating
```

## Technical Implementation

### Generated Code Location

- **Target**: `packages/sdk/generated/browser/`
- **Generator**: `fernapi/fern-typescript-sdk` v2.4.3 (Universal TypeScript SDK)
- **Client Name**: `AirboltAPI`
- **Output Format**: ESM with TypeScript declarations

### Git Configuration

Generated code is excluded from version control:

```gitignore
# Fern-generated SDK code (build-time generated)
packages/sdk/generated/
packages/*/generated/
```

### TypeScript Configuration

SDK package includes generated code in compilation:

```json
{
  "include": ["src/**/*", "generated/**/*"]
}
```

### Package.json Scripts

```json
{
  "generate": "bash scripts/sdk-generate.sh",
  "prebuild": "pnpm generate",
  "sdk:check": "bash scripts/sdk-generate.sh --check"
}
```

## Error Handling & Troubleshooting

### Docker Not Available

**Error**: "Docker is not running"
**Solution**:

1. Install Docker: https://docs.docker.com/get-docker/
2. Start Docker Desktop: `open -a Docker` (macOS)
3. Verify Docker: `docker info`

### Generation Fails

**Common causes**:

1. **Docker memory** - Ensure Docker has 4GB+ memory allocated
2. **Network issues** - Check Docker can pull images from registry
3. **OpenAPI spec** - Verify `apps/backend-api/openapi.json` is valid
4. **Fern config** - Run `pnpm fern:check` to validate configuration

### TypeScript Import Errors

**Error**: Cannot find module '@airbolt/sdk'
**Solution**:

1. Ensure generation completed: `pnpm generate`
2. Check TypeScript references in examples/tsconfig.json
3. Rebuild: `pnpm build`

## CI/CD Integration

### GitHub Actions Requirements

```yaml
- name: Start Docker
  run: |
    sudo systemctl start docker
    docker info

- name: Generate SDK
  run: pnpm generate

- name: Build and Test
  run: |
    pnpm build
    pnpm test
```

### Docker in CI

- **Required**: Docker must be available in CI environment
- **Memory**: Ensure CI has sufficient memory (4GB+ recommended)
- **Images**: Fern pulls TypeScript generator Docker images

## Validation Checklist

### Local Development

- [ ] Docker is installed and running
- [ ] `pnpm generate` completes successfully
- [ ] Generated code appears in `packages/sdk/generated/browser/`
- [ ] TypeScript compilation succeeds: `pnpm build`
- [ ] Examples can import from `@airbolt/sdk`

### CI/CD

- [ ] Docker is available in CI environment
- [ ] Generation works in CI: `pnpm generate`
- [ ] Build succeeds after generation: `pnpm build`
- [ ] Tests pass with generated code: `pnpm test`

## Next Steps

1. **Validate CI/CD** - Test generation in GitHub Actions
2. **Create examples** - Build examples using generated `AirboltAPI`
3. **Performance testing** - Measure generation time in CI
4. **Documentation** - Update main README with new workflow

## Related Files

- `scripts/sdk-generate.sh` - Main generation script
- `fern/generators.yml` - Fern generator configuration
- `packages/sdk/tsconfig.json` - TypeScript configuration for SDK
- `.gitignore` - Git exclusions for generated code
