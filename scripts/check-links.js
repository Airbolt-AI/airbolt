#!/usr/bin/env node
/**
 * Link checker script for Airbolt documentation
 * Scans all markdown files for broken links and generates a report
 */

import { execSync } from 'child_process';
import { readdirSync, statSync } from 'fs';
import path from 'path';

const MARKDOWN_FILES = [
  './.changeset/README.md',
  './.claude/commands/analyze-ticket.md',
  './.claude/commands/code-review.md',
  './.claude/commands/compact-before-review.md',
  './.claude/commands/create-ticket.md',
  './.claude/commands/get-in-progress-ticket.md',
  './.claude/commands/get-next-ticket.md',
  './.claude/commands/README.md',
  './.claude/commands/respond-to-pr.md',
  './.claude/commands/self-review.md',
  './.claude/commands/start-ticket.md',
  './.github/pull_request_template.md',
  './.github/TESTING.md',
  './AGENTS.md',
  './apps/backend-api/README.md',
  './CLAUDE.md',
  './docs/CONTRIBUTING.md',
  './packages/react-sdk/CHANGELOG.md',
  './packages/react-sdk/examples/hooks-demo/CHANGELOG.md',
  './packages/react-sdk/examples/hooks-demo/README.md',
  './packages/react-sdk/examples/widget-demo/CHANGELOG.md',
  './packages/react-sdk/examples/widget-demo/README.md',
  './packages/react-sdk/README.md',
  './packages/sdk/CHANGELOG.md',
  './packages/sdk/examples/node-cli/CHANGELOG.md',
  './packages/sdk/examples/node-cli/README.md',
  './packages/sdk/README.md',
  './README.md',
  './RELEASES.md',
];

const REPORT_FILE = 'link-check-report.json';

function checkLinks() {
  console.log('🔍 Checking links in documentation...\n');

  const results = [];
  let totalFiles = 0;
  let totalErrors = 0;

  for (const file of MARKDOWN_FILES) {
    try {
      // Check if file exists
      statSync(file);

      console.log(`Checking: ${file}`);
      totalFiles++;

      // Run markdown-link-check
      const output = execSync(
        `npx markdown-link-check "${file}" --config .markdown-link-check.json`,
        { encoding: 'utf8', timeout: 60000 }
      );

      // Parse the output to count errors
      const lines = output.split('\n');
      const errorLines = lines.filter(
        line => line.includes('✖') || line.includes('ERROR')
      );
      const errorCount = errorLines.length;

      results.push({ file, output, errorCount });

      if (errorCount > 0) {
        totalErrors += errorCount;
        console.log(`  ❌ Found ${errorCount} broken links`);
      } else {
        console.log(`  ✅ All links working`);
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(`  ⚠️  File not found: ${file}`);
      } else {
        console.log(`  ❌ Error checking ${file}: ${error.message}`);
        totalErrors++;
      }
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`Files checked: ${totalFiles}`);
  console.log(`Total broken links: ${totalErrors}`);

  if (totalErrors > 0) {
    console.log(
      `\n❌ Found ${totalErrors} broken links across ${totalFiles} files`
    );
    console.log(`Run the script with --verbose for detailed output`);
    process.exit(1);
  } else {
    console.log(`\n✅ All links are working correctly!`);
  }

  return results;
}

function generateDetailedReport(results) {
  console.log('\n📋 Detailed Link Check Report\n');

  results.forEach(({ file, output, errorCount }) => {
    if (errorCount > 0) {
      console.log(`\n🔴 ${file}:`);
      const lines = output.split('\n');
      const errorLines = lines.filter(
        line => line.includes('✖') || line.includes('ERROR')
      );
      errorLines.forEach(line => {
        console.log(`  • ${line.trim()}`);
      });
    }
  });
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const verbose = process.argv.includes('--verbose');

  try {
    const results = checkLinks();

    if (verbose) {
      generateDetailedReport(results);
    }
  } catch (error) {
    console.error('❌ Link checking failed:', error.message);
    process.exit(1);
  }
}
