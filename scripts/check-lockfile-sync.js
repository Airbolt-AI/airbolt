#!/usr/bin/env node
import { execSync } from 'child_process';

try {
  // Check if lockfile is in sync with package.json files
  execSync('pnpm install --frozen-lockfile', { stdio: 'pipe' });
  console.log('✅ Lockfile is in sync with package.json files');
} catch (error) {
  console.error('❌ Lockfile out of sync with package.json files');
  console.error(
    'This typically happens after version changes or dependency updates'
  );
  console.error('');
  console.error('To fix:');
  console.error('  pnpm install           # Update lockfile');
  console.error('  git add pnpm-lock.yaml # Stage the changes');
  console.error('');
  console.error('Or use automated command:');
  console.error(
    '  pnpm release:prepare   # Handles version + lockfile + staging'
  );
  process.exit(1);
}
