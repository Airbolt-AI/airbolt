#!/usr/bin/env node

/**
 * Airbolt SDK - Vanilla JavaScript Example
 * 
 * This example shows the simplest way to use the Airbolt SDK.
 * Just run: npm start
 */

import { chat } from '@airbolt/sdk';

async function main() {
  console.log('🤖 Airbolt Chat Example\n');
  
  try {
    // Send a message to the AI
    const response = await chat([
      { role: 'user', content: 'Hello! Can you tell me a short joke?' }
    ], {
      baseURL: 'http://localhost:3000'
    });
    
    console.log('AI:', response);
    console.log('\n✅ Success! The SDK handles authentication automatically.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\nMake sure the backend is running:');
    console.log('  cd apps/backend-api && pnpm dev');
  }
}

// Run the example
main();