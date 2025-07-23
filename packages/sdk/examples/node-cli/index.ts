#!/usr/bin/env tsx

/**
 * Airbolt SDK - TypeScript Example
 *
 * This example shows type-safe usage of the Airbolt SDK.
 * Run with: npm run start:ts
 */

import { chat, type Message } from '@airbolt/sdk';

async function main(): Promise<void> {
  console.log('🤖 Airbolt Chat Example (TypeScript)\n');

  try {
    // Type-safe message array
    const messages: Message[] = [
      { role: 'user', content: 'What is TypeScript?' },
    ];

    console.log('User:', messages[0].content);
    console.log('\nAI: ');

    // Stream response with typed options (default behavior)
    for await (const chunk of chat(messages, {
      baseURL: process.env.AIRBOLT_URL || 'http://localhost:3000', // For production, use your deployed URL like 'https://my-ai-backend.onrender.com'
      system: 'You are a helpful assistant. Keep responses concise.',
    })) {
      if (chunk.type === 'chunk') {
        process.stdout.write(chunk.content);
      }
    }

    console.log('\n\n✅ Full type safety with TypeScript and streaming!');
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
