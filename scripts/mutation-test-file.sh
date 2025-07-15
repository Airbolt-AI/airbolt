#!/bin/bash

# Script to run mutation testing on a single file
# Usage: ./scripts/mutation-test-file.sh <file-path>

if [ -z "$1" ]; then
  echo "Usage: $0 <file-path>"
  echo "Example: $0 packages/sdk/src/core/token-manager.ts"
  exit 1
fi

FILE_PATH="$1"

if [ ! -f "$FILE_PATH" ]; then
  echo "Error: File '$FILE_PATH' not found"
  exit 1
fi

echo "🧬 Running mutation testing on: $FILE_PATH"
echo "⚡ Using optimized settings for single-file testing"

# Create temporary config with just this file
cat > .stryker-tmp-single.mjs << EOF
export default {
  packageManager: 'pnpm',
  reporters: ['clear-text', 'progress'],
  testRunner: 'command',
  commandRunner: {
    command: 'NODE_OPTIONS="--import tsx" pnpm exec vitest run --config vitest.mutation.config.ts',
  },
  coverageAnalysis: 'off',
  timeoutMS: 3000,
  timeoutFactor: 1.5,
  concurrency: 8,
  maxTestRunnerReuse: 20,
  mutate: ['$FILE_PATH'],
  mutator: {
    excludedMutations: [
      'StringLiteral',
      'ObjectLiteral',
      'ArrayDeclaration',
      'BlockStatement',
      'ConditionalExpression',
      'ArithmeticOperator',
      'UpdateOperator',
    ],
  },
  thresholds: { high: 80, low: 70, break: 60 },
  tempDirName: '.stryker-tmp',
  cleanTempDir: false,
};
EOF

# Run Stryker with the temporary config
NODE_OPTIONS='--import tsx' pnpm exec stryker run -c .stryker-tmp-single.mjs

# Clean up
rm -f .stryker-tmp-single.mjs

echo "✅ Mutation testing complete for $FILE_PATH"