# Release Management

## Beta Releases (Current)

### Daily Development

```bash
# After making changes
pnpm changeset add              # Add changeset after changes
git commit -m "feat: your change + changeset"
```

### Publishing Beta (Automated)

```bash
# Prepare release (handles everything automatically)
pnpm release:prepare            # Version + lockfile + stage (foolproof)
git commit -m "chore: version packages"
git tag v0.x.y-beta.z && git push origin v0.x.y-beta.z

# Alternative: Full automation
pnpm release:beta               # Guides you through entire process
```

### Manual Override (Debugging)

```bash
pnpm changeset:manual           # Version + lockfile sync only
pnpm changeset:validate         # Check for premature major bumps
pnpm lockfile:check            # Verify lockfile sync
```

### Version Strategy

- Format: `0.x.y-beta.z`
- **patch**: Bug fixes, small improvements
- **minor**: New features, breaking changes (OK in beta)
- **major**: BLOCKED (validation script prevents)

## Stable Release (Future 1.0+)

### Prerequisites

- Team approval for API stability
- Documentation complete
- Test coverage targets met
- Breaking change review

### Process

1. **Manual changeset creation** (overrides safety):

   ```bash
   echo '---
   "@airbolt/sdk": major
   "@airbolt/react-sdk": major
   ---

   Stable 1.0.0 release - API locked' > .changeset/stable-release.md
   ```

2. **Version and release**:

   ```bash
   pnpm changeset version  # Creates 1.0.0
   git commit -m "chore: stable 1.0.0 release"
   git tag v1.0.0
   git push origin v1.0.0
   ```

3. **Publishes to `@latest` tag** (default npm install)

## Installation

### Beta Users

```bash
npm install @airbolt/sdk@beta @airbolt/react-sdk@beta
```

### Stable Users (post-1.0)

```bash
npm install @airbolt/sdk @airbolt/react-sdk
```

## Safety Features

- ✅ Validation blocks accidental major bumps
- ✅ Linked versioning (SDKs stay in sync)
- ✅ Beta releases tagged separately
- ✅ Workspace dependencies resolved automatically
- ✅ Separate workflows for beta vs stable
- ✅ Pre-commit hooks prevent lockfile drift
- ✅ CI auto-fixes lockfile issues
- ✅ Automated release preparation (foolproof)
