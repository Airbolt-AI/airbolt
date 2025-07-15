#!/usr/bin/env node
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const changesetDir = '.changeset';
const changesets = readdirSync(changesetDir).filter(
  file =>
    file.endsWith('.md') && file !== 'README.md' && file !== 'beta-strategy.md'
);

let hasMajorChanges = false;
let hasBackendApi = false;

for (const changeset of changesets) {
  const content = readFileSync(join(changesetDir, changeset), 'utf8');

  if (
    content.includes('"@airbolt/sdk": major') ||
    content.includes('"@airbolt/react-sdk": major')
  ) {
    console.error(`❌ BLOCKED: Major version bump detected in ${changeset}`);
    console.error('Beta releases cannot include major version bumps.');
    console.error('Use "minor" for breaking changes during beta.');
    console.error('For 1.0 release, see RELEASES.md');
    hasMajorChanges = true;
  }

  // Check if backend-api is mentioned in changeset
  if (content.includes('"backend-api":') || content.includes('backend-api:')) {
    console.error(`❌ BLOCKED: backend-api found in changeset ${changeset}`);
    console.error(
      'backend-api is a private package and should never be published.'
    );
    console.error('Remove backend-api from the changeset.');
    hasBackendApi = true;
  }
}

if (hasMajorChanges || hasBackendApi) {
  process.exit(1);
}

console.log(
  '✅ Changeset validation passed - no premature major bumps and no backend-api'
);
