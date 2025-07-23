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
    const messages = [
      { role: 'user', content: 'Hello! Can you tell me a short joke?' },
    ];

    console.log('User:', messages[0].content);
    console.log('\nAI: ');

    // Stream the response (default behavior)
    for await (const chunk of chat(messages, {
      baseURL: 'http://localhost:3000', // For production, use your deployed URL like 'https://my-ai-backend.onrender.com'
    })) {
      if (chunk.type === 'chunk') {
        process.stdout.write(chunk.content);
      }
    }

    console.log(
      '\n\n✅ Success! The SDK handles authentication and streaming automatically.'
    );
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.log('\nMake sure the backend is running:');
    console.log('  cd apps/backend-api && pnpm dev');
  }
}

// Run the example
main();
