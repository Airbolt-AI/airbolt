# Release Process

## How to Release

Choose the appropriate version bump based on your changes:

1. **Bug fixes**: `pnpm release:patch` (0.7.0 → 0.7.1)
2. **New features**: `pnpm release:minor` (0.7.0 → 0.8.0)
3. **Breaking changes**: `pnpm release:major` (0.7.0 → 1.0.0)

This will automatically:

- Update all package versions
- Create a git commit with message "chore: release vX.Y.Z"
- Create a git tag "vX.Y.Z"
- Push the commit and tag to GitHub
- Trigger CI workflow to validate and publish to npm

## What Happens in CI

When you push a tag, GitHub Actions will:

1. Validate the tag format (must be vX.Y.Z)
2. Verify all package.json versions match the tag
3. Run quality gates:
   - Beta releases (0.x.x): Standard validation (`pnpm ai:check`)
   - Stable releases (1.x.x+): Full compliance (`pnpm ai:compliance`)
4. Publish packages to npm with provenance
5. Create a GitHub release

## Version Tags

- **Beta versions** (0.x.x): Published to npm with `@beta` tag
- **Stable versions** (1.x.x+): Published to npm with `@latest` tag

## Installation

### Beta Packages

```bash
npm install @airbolt/sdk@beta
npm install @airbolt/react-sdk@beta
```

### Stable Packages (after 1.0.0)

```bash
npm install @airbolt/sdk
npm install @airbolt/react-sdk
```

## Troubleshooting

### Version Mismatch Error

If the release workflow fails with a version mismatch error:

1. Ensure all package.json files have the same version
2. The tag version must match exactly (e.g., tag v0.7.0 requires version "0.7.0" in package.json)

### Failed Quality Gates

If validation fails:

1. Check the CI logs for specific errors
2. Fix issues locally and push changes
3. Delete the tag: `git tag -d vX.Y.Z && git push origin :vX.Y.Z`
4. Re-run the release command after fixes

### Manual Release (Emergency Only)

If automation fails, you can manually publish:

```bash
# Ensure you're on the correct commit
git checkout vX.Y.Z

# Build and publish
pnpm build
pnpm -r publish --tag beta --no-git-checks  # for 0.x versions
pnpm -r publish --no-git-checks             # for 1.x+ versions
```

## Release Checklist

Before releasing:

- [ ] All tests passing locally (`pnpm test`)
- [ ] Quality checks pass (`pnpm ai:compliance`)
- [ ] Documentation is up to date
- [ ] Breaking changes are documented (if major version)
- [ ] You have npm publish permissions

## Version History

See [GitHub Releases](https://github.com/Airbolt-AI/airbolt/releases) for full version history.
