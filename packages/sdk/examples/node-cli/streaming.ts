#!/usr/bin/env tsx

/**
 * Airbolt SDK - Streaming Example
 *
 * This example shows how to use streaming responses with the Airbolt SDK.
 * Run with: npm run stream
 */

import { chatStream, type Message } from '@airbolt/sdk';

async function main(): Promise<void> {
  console.log('🤖 Airbolt Streaming Chat Example\n');

  try {
    // Type-safe message array
    const messages: Message[] = [
      { role: 'user', content: 'Tell me a short story about a brave robot.' },
    ];

    console.log('User:', messages[0].content);
    console.log('\nAI: ');

    // Stream the response
    for await (const chunk of chatStream(messages, {
      baseURL: process.env.AIRBOLT_URL || 'http://localhost:3000',
      system:
        'You are a creative storyteller. Keep stories brief but engaging.',
    })) {
      if (chunk.type === 'chunk') {
        // Write each chunk as it arrives
        process.stdout.write(chunk.content);
      } else if (chunk.type === 'done') {
        console.log('\n\n✅ Streaming complete!');
      }
    }
  } catch (error) {
    console.error(
      '\n❌ Error:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    console.log('\nMake sure the backend is running:');
    console.log('  cd apps/backend-api && pnpm dev');
  }
}

// Run the example
main();
