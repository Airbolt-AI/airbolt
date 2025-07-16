# Shell Command Tech Debt Analysis

## Overview

This document catalogs instances where we use shell commands or custom scripts instead of proper tooling. Created as part of MAR-146 investigation.

## High Priority Tech Debt

### 1. SDK Validation Test (`packages/sdk/test/fern-validation.test.ts`)

**Current**: Complex shell pipelines to analyze code

```bash
find ... | xargs grep -c "any\\|unknown" | wc -l
du -sk packages/sdk/generated/
find ... | wc -l
```

**Better**: Use TypeScript Compiler API or ts-morph for AST analysis
**Impact**: Platform dependency, fragile parsing, no Windows support

### 2. SDK Generation Script (`scripts/sdk-generate.sh`)

**Current**: 200+ line bash script with manual caching

```bash
shasum -a 256 ... | cut -d' ' -f1
```

**Better**: Use Nx caching or a Node.js build script
**Impact**: Maintenance burden, platform-specific

## Medium Priority Tech Debt

### 3. Link Checking (`scripts/check-links.js`)

**Current**: Hardcoded file list, manual output parsing

```javascript
execSync(`npx markdown-link-check ${file}`);
```

**Better**: Use markdown-link-check programmatically
**Impact**: Brittle parsing, missed files

### 4. Clean Script (`package.json`)

**Current**: Unix-only commands

```json
"clean": "nx reset && find . -name '.tsbuildinfo' -delete && find . -name 'dist' -type d -exec rm -rf {} + 2>/dev/null || true"
```

**Better**: Use rimraf or Node.js fs.rmSync
**Impact**: No Windows support (if ever needed)

### 5. OpenAPI Generation (`apps/backend-api/scripts/generate-openapi.js`)

**Current**: Creates temp file and runs via shell

```javascript
execSync(`npx tsx ${tempFilePath}`);
```

**Better**: Use programmatic API or proper build tool
**Impact**: Unnecessary complexity

## Low Priority Tech Debt

### 6. Lockfile Sync Check (`scripts/check-lockfile-sync.js`)

**Current**: Shell command with output suppression

```javascript
execSync('pnpm install --frozen-lockfile', { stdio: 'pipe' });
```

**Better**: Could use pnpm API if available
**Impact**: Minor - this is a reasonable approach

### 7. Config Validation Scripts

- `scripts/validate-vitest-configs.js` - Custom config comparison
- `scripts/validate-changeset-safety.js` - Manual markdown parsing
  **Better**: Use shared configs or validation frameworks
  **Impact**: Maintenance burden but working fine

## Patterns to Avoid

1. **Parsing shell output**: Use programmatic APIs instead
2. **Complex bash scripts**: Write in Node.js/TypeScript
3. **Manual file operations**: Use fs module or glob libraries
4. **Temporary file generation**: Use in-memory operations
5. **Platform-specific commands**: Use cross-platform tools

## Recommendations

1. **Immediate**: None critical since no Windows users
2. **Next Quarter**: Consider migrating sdk-generate.sh to Node.js
3. **As Needed**: Replace shell commands when touching those files
4. **Keep As-Is**: Git operations in hooks, pnpm commands

## Conclusion

While we have several instances of shell command usage, most are working adequately for our Linux/macOS environment. The tech debt is real but not urgent. Address opportunistically when modifying these files.
