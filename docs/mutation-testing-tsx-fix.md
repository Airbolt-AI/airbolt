# Mutation Testing with TypeScript Fix

## Problem

When using Stryker's Vitest runner with TypeScript files and tsx loader, tests fail with:

```
Unknown file extension ".ts" for /path/to/file.ts
```

This happens because:

1. Stryker spawns Vitest with `--import tsx` flag
2. Vitest spawns worker threads/processes for test execution
3. Node.js v20+ doesn't propagate loader flags to these workers
4. Workers can't handle TypeScript files

## Solution

Use a Vitest setup file to register tsx inside every worker process:

### 1. Create `vitest.setup.mutation.ts`

```typescript
import { register } from 'tsx/esm/api';
register();
```

### 2. Add to `vitest.mutation.config.ts`

```typescript
test: {
  setupFiles: ['./vitest.setup.mutation.ts'],
  // ... rest of config
}
```

### 3. Keep `testRunnerNodeArgs` in `stryker.config.mjs`

```javascript
testRunnerNodeArgs: ['--import', require.resolve('tsx')],
```

## Why This Works

- Setup files run inside every Vitest worker process
- `register()` programmatically installs the TypeScript loader
- No dependency on Node.js flag propagation
- Works with Node.js v20+ security restrictions

## Performance Impact

- **Command runner**: ~20-30 minutes (runs all tests for every mutant)
- **Vitest runner**: ~5 minutes (uses perTest coverage analysis)
- **Speed improvement**: 4-6x faster

## Additional Optimizations

```javascript
// stryker.config.mjs
{
  concurrency: 12,           // Increase parallel workers
  disableTypeChecks: true,   // Skip TS checking on mutants
  incremental: true,         // 80-95% faster repeat runs
}
```

With these optimizations:

- Fresh runs: ~2-3 minutes
- Incremental runs: <30 seconds
