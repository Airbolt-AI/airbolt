# Release Management

## Beta Releases (Current)

### Daily Development

```bash
# After making changes
pnpm changeset add
# Choose: patch (fixes) | minor (features/breaking changes)
# Write: concise summary

git commit -m "feat: your change + changeset"
```

### Publishing Beta

```bash
# Tag and push triggers automatic release
git tag v0.x.y-beta.z
git push origin v0.x.y-beta.z

# Publishes to npm with @beta tag
# Creates GitHub prerelease
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
