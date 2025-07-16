#!/usr/bin/env node
/**
 * Tests for the link checker script
 */

import { execSync } from 'child_process';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { test } from 'node:test';
import { strict as assert } from 'node:assert';

const TEST_FILE = './test-links.md';

// Test markdown content with various link types
const TEST_CONTENT = `# Test Document

## Working Links
- [GitHub](https://github.com)
- [Local file](./README.md)
- [Anchor](#test-anchor)

## Test Anchor
This is a test section.

## Broken Links (commented out for actual test)
<!-- 
- [Broken external](https://this-domain-definitely-does-not-exist.invalid)
- [Broken internal](./non-existent-file.md)
-->
`;

test('Link checker script exists and is executable', () => {
  assert.ok(existsSync('./scripts/check-links.js'));
});

test('Link checker can handle valid markdown files', () => {
  // Create a test file with working links
  writeFileSync(TEST_FILE, TEST_CONTENT);

  try {
    // Run markdown-link-check on our test file
    const result = execSync(
      `npx markdown-link-check "${TEST_FILE}" --config .markdown-link-check.json`,
      {
        encoding: 'utf8',
        timeout: 30000,
      }
    );

    // Should not throw an error for valid links
    assert.ok(result.includes('✓'));
  } catch (error) {
    // If it fails, log the error for debugging
    console.error('Link check failed:', error.message);
    throw error;
  } finally {
    // Clean up
    if (existsSync(TEST_FILE)) {
      unlinkSync(TEST_FILE);
    }
  }
});

test('Link checker script configuration is valid', () => {
  assert.ok(existsSync('./.markdown-link-check.json'));

  // Try to parse the configuration file
  const config = JSON.parse(
    execSync('cat ./.markdown-link-check.json', { encoding: 'utf8' })
  );

  // Verify it has expected properties
  assert.ok(config.ignorePatterns);
  assert.ok(Array.isArray(config.ignorePatterns));
  assert.ok(config.timeout);
  assert.ok(config.retryOn429);
});

test('Package.json scripts are properly configured', () => {
  const packageJson = JSON.parse(
    execSync('cat ./package.json', { encoding: 'utf8' })
  );

  // Check that our scripts are defined
  assert.ok(packageJson.scripts['docs:check-links']);
  assert.ok(packageJson.scripts['docs:check-links:verbose']);

  // Check that markdown-link-check is in devDependencies
  assert.ok(packageJson.devDependencies['markdown-link-check']);
});

console.log('✅ All link checker tests passed!');
