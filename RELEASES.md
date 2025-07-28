# Release Process

## How to Release

### Step 1: Update Package Versions

Choose the appropriate version bump based on your changes:

1. **Bug fixes**: Patch version (0.7.0 → 0.7.1)
2. **New features**: Minor version (0.7.0 → 0.8.0)
3. **Breaking changes**: Major version (0.7.0 → 1.0.0)

Update the SDK package versions manually:

```bash
# Navigate to each package and bump version
cd packages/sdk && npm version minor --no-git-tag-version
cd ../react-sdk && npm version minor --no-git-tag-version

# Update lockfile
cd ../.. && pnpm install
```

### Step 2: Commit and Tag

```bash
# Commit the version changes
git add -A
git commit -m "chore(release): bump SDK versions to X.Y.Z"

# Create the release tag
git tag -a vX.Y.Z -m "Release vX.Y.Z"

# Push the tag (this triggers the release workflow)
git push origin vX.Y.Z
```

### Step 3: Create PR for Version Updates

Since the main branch is protected, create a PR to merge the version updates:

```bash
# Create a new branch from your local changes
git checkout -b chore/release-vX.Y.Z

# Push the branch
git push origin chore/release-vX.Y.Z

# Create a PR using GitHub CLI
gh pr create --title "chore(release): bump SDK versions to X.Y.Z" \
  --body "Updates package versions after vX.Y.Z release"
```

**Note**: The release will still work even if the version bump PR hasn't been merged yet, because the tag contains the commit with the updated versions.

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
