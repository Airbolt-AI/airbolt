# CI/CD Integration Plan for Fern SDK Generation

## Overview

This document outlines the integration plan for Fern SDK generation in CI/CD pipelines, ensuring reliable automated builds and deployments.

## GitHub Actions Integration

### Workflow Requirements

```yaml
name: SDK Build and Test

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 10

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Start Docker
        run: |
          sudo systemctl start docker
          docker info

      - name: Generate SDK
        run: pnpm generate

      - name: Validate generated code
        run: |
          # Check that generated code exists
          test -d packages/sdk/generated/browser
          # Check that generation produced TypeScript files
          find packages/sdk/generated -name "*.ts" | head -1

      - name: Build all packages
        run: pnpm build

      - name: Run tests
        run: pnpm test

      - name: Type checking
        run: pnpm type-check

      - name: Linting
        run: pnpm lint
```

### Critical CI Requirements

1. **Docker Availability**
   - Ubuntu runners have Docker pre-installed
   - Must start Docker daemon: `sudo systemctl start docker`
   - Validate Docker: `docker info`

2. **Memory Requirements**
   - Minimum 4GB RAM for Fern generation
   - GitHub Actions standard runners provide 7GB

3. **Generation Validation**
   - Verify generated directory exists
   - Check TypeScript files are created
   - Ensure build succeeds after generation

## Docker Configuration

### Runtime Requirements

```bash
# Minimum Docker memory allocation
docker system info | grep "Total Memory"  # Should show 4GB+

# Required Docker features
- Docker daemon running
- Internet access for pulling Fern images
- Sufficient disk space for TypeScript generator image (~1GB)
```

### Troubleshooting Docker in CI

```yaml
- name: Debug Docker issues
  if: failure()
  run: |
    echo "Docker version:"
    docker --version
    echo "Docker info:"
    docker info
    echo "Available memory:"
    free -h
    echo "Disk space:"
    df -h
```

## Performance Considerations

### Generation Times

Expected generation times:

- **Local (first run)**: 2-5 minutes (includes Docker image pull)
- **Local (subsequent)**: 30-60 seconds
- **CI (cold)**: 2-5 minutes
- **CI (cached)**: 1-2 minutes

### Optimization Strategies

1. **Docker Image Caching**

   ```yaml
   - name: Cache Docker images
     uses: actions/cache@v3
     with:
       path: /tmp/.docker-cache
       key: docker-${{ runner.os }}-${{ hashFiles('fern/generators.yml') }}
   ```

2. **Generated Code Validation**

   ```bash
   # Quick validation instead of full rebuild
   pnpm sdk:check  # Uses --check flag, faster than regeneration
   ```

3. **Conditional Generation**
   ```yaml
   - name: Check if generation needed
     id: check-changes
     run: |
       if git diff --name-only HEAD~1 | grep -E "(openapi\.json|fern/)" ; then
         echo "generation-needed=true" >> $GITHUB_OUTPUT
       fi

   - name: Generate SDK
     if: steps.check-changes.outputs.generation-needed == 'true'
     run: pnpm generate
   ```

## Error Handling

### Common CI Failures

1. **Docker Not Available**

   ```
   Error: Cannot connect to Docker daemon
   Solution: Add `sudo systemctl start docker` step
   ```

2. **Memory Exhaustion**

   ```
   Error: Docker container killed (OOMKilled)
   Solution: Use runners with more memory or optimize generation
   ```

3. **Network Timeouts**
   ```
   Error: Failed to pull Docker image
   Solution: Add retry logic and network debugging
   ```

### Retry Strategy

```yaml
- name: Generate SDK with retry
  uses: nick-fields/retry@v2
  with:
    timeout_minutes: 10
    max_attempts: 3
    command: pnpm generate
```

## Security Considerations

### Docker Security

- Use specific Fern generator versions (not `latest`)
- Verify Docker image checksums when available
- Run generation in isolated CI environment

### Secrets Management

- No secrets required for SDK generation
- OpenAPI spec is public (no sensitive endpoints)
- Generated code contains no secrets

## Deployment Integration

### Package Publishing

```yaml
- name: Publish packages
  if: github.ref == 'refs/heads/main'
  run: |
    # Ensure SDK is generated
    pnpm generate

    # Build all packages
    pnpm build

    # Publish to npm
    pnpm publish --access public
  env:
    NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Version Management

- Generated SDK version matches package.json
- No need to version generated code separately
- OpenAPI spec changes trigger patch releases

## Monitoring and Alerts

### Build Metrics

Track these metrics in CI:

- Generation time duration
- Docker image pull time
- Generated code size
- Build success rate

### Failure Alerts

Set up alerts for:

- Generation failures > 2 consecutive runs
- Build time > 10 minutes
- Memory usage > 80% of available

## Testing Strategy

### Validation Tests

```bash
# Post-generation validation
test -f packages/sdk/generated/browser/index.ts
test -f packages/sdk/generated/browser/Client.ts

# Type checking
tsc --noEmit packages/sdk/generated/browser/*.ts

# Import validation
node -e "require('./packages/sdk/dist/index.js')"
```

### Integration Tests

```bash
# Test generated client against real API
pnpm test:integration:sdk

# Test examples work with generated SDK
pnpm test:examples
```

## Migration Checklist

### Pre-Migration

- [ ] Docker available in CI environment
- [ ] Memory requirements met (4GB+)
- [ ] Network access for Docker registry

### Implementation

- [ ] Add generation step to CI workflow
- [ ] Configure Docker startup in CI
- [ ] Add generation validation checks
- [ ] Set up retry logic for failures

### Post-Migration

- [ ] Monitor generation performance
- [ ] Validate all builds succeed
- [ ] Check deployment pipeline works
- [ ] Update team documentation

## Rollback Plan

If CI integration fails:

1. **Immediate**: Disable generation step in CI
2. **Short-term**: Revert to pre-commit generation temporarily
3. **Investigation**: Debug Docker/memory issues
4. **Resolution**: Fix issues and re-enable

## Next Steps

1. Create GitHub Actions workflow file
2. Test workflow in feature branch
3. Monitor performance and reliability
4. Optimize based on metrics
5. Document lessons learned
