#!/usr/bin/env node

/**
 * Airbolt SDK - Vanilla JavaScript Example
 *
 * This example shows the simplest way to use the Airbolt SDK.
 * Just run: npm start
 */

import { chat, chatSync } from '@airbolt/sdk';

async function main() {
  console.log('🤖 Airbolt Chat Example with Usage Tracking\n');

  try {
    // Example 1: Streaming with usage info
    console.log('📡 Streaming Example:\n');
    const messages = [
      { role: 'user', content: 'Hello! Can you tell me a short joke?' },
    ];

    console.log('User:', messages[0].content);
    console.log('\nAI: ');

    let usage;

    // Stream the response and capture usage info
    for await (const chunk of chat(messages, {
      baseURL: 'http://localhost:3000', // For production, use your deployed URL like 'https://my-ai-backend.onrender.com'
    })) {
      if (chunk.type === 'chunk') {
        process.stdout.write(chunk.content);
      } else if (chunk.type === 'done' && chunk.usage) {
        usage = chunk.usage;
      }
    }

    // Display usage information
    if (usage) {
      console.log('\n\n📊 Usage Information:');
      console.log(`  - Total tokens used: ${usage.total_tokens}`);

      if (usage.tokens) {
        console.log(
          `  - Token usage: ${usage.tokens.used}/${usage.tokens.limit}`
        );
        console.log(`  - Remaining: ${usage.tokens.remaining} tokens`);
        console.log(
          `  - Resets at: ${new Date(usage.tokens.resetAt).toLocaleTimeString()}`
        );
      }
    }

    // Example 2: Non-streaming with usage info
    console.log('\n\n🔄 Non-Streaming Example:\n');
    const response = await chatSync(
      [{ role: 'user', content: 'What is Node.js in one sentence?' }],
      { baseURL: 'http://localhost:3000' }
    );

    console.log('User: What is Node.js in one sentence?');
    console.log('\nAI:', response.content);

    if (response.usage) {
      console.log(
        `\n📊 This request used ${response.usage.total_tokens} tokens`
      );
    }

    console.log(
      '\n\n✅ Success! The SDK handles authentication, streaming, and usage tracking automatically.'
    );
  } catch (error) {
    console.error('\n❌ Error:', error.message);

    // Handle rate limit errors
    if (error.message.includes('429')) {
      console.log('\n⚠️  Rate limit exceeded!');
      console.log('The SDK automatically retries with exponential backoff.');
      console.log('If you continue to see this, wait before trying again.');
    } else {
      console.log('\nMake sure the backend is running:');
      console.log('  cd apps/backend-api && pnpm dev');
    }
  }
}

// Run the example
main();
