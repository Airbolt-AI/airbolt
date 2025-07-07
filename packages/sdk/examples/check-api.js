#!/usr/bin/env node

/**
 * Quick check to verify the API is running before running examples
 */

const API_URL = process.env.AIRBOLT_API_URL || 'http://localhost:3000';

console.log(`Checking if API is running at ${API_URL}...`);

fetch(`${API_URL}/`)
  .then(response => {
    if (response.ok) {
      console.log('✅ API is running! You can now run the examples.');
      process.exit(0);
    } else {
      console.log(`❌ API returned status ${response.status}`);
      process.exit(1);
    }
  })
  .catch(error => {
    console.log('❌ API is not running!');
    console.log('');
    console.log('Please start the backend first:');
    console.log('  1. Open a new terminal');
    console.log('  2. Run: pnpm dev');
    console.log('  3. Wait for "Server listening at http://0.0.0.0:3000"');
    console.log('  4. Then run the examples again');
    process.exit(1);
  });
