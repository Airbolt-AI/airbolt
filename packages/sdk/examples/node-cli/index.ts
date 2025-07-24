#!/usr/bin/env tsx

/**
 * Airbolt SDK - TypeScript Example
 *
 * This example shows type-safe usage of the Airbolt SDK.
 * Run with: npm run start:ts
 */

import { chat, chatSync, type Message, type UsageInfo } from '@airbolt/sdk';

async function displayUsage(usage: UsageInfo | undefined): Promise<void> {
  if (usage) {
    console.log('\n📊 Usage Information:');
    console.log(`  - Total tokens: ${usage.total_tokens}`);

    if (usage.tokens) {
      const percentUsed = (
        (usage.tokens.used / usage.tokens.limit) *
        100
      ).toFixed(1);
      console.log(
        `  - Token usage: ${usage.tokens.used}/${usage.tokens.limit} (${percentUsed}%)`
      );
      console.log(`  - Remaining: ${usage.tokens.remaining} tokens`);
      console.log(
        `  - Resets at: ${new Date(usage.tokens.resetAt).toLocaleTimeString()}`
      );
    }

    if (usage.requests) {
      console.log(
        `  - Request usage: ${usage.requests.used}/${usage.requests.limit}`
      );
      console.log(
        `  - Resets at: ${new Date(usage.requests.resetAt).toLocaleTimeString()}`
      );
    }
  }
}

async function streamingExample(): Promise<void> {
  console.log('📡 Streaming Example:\n');

  const messages: Message[] = [
    { role: 'user', content: 'What is TypeScript in 2 sentences?' },
  ];

  console.log('User:', messages[0].content);
  console.log('\nAI: ');

  let usage: UsageInfo | undefined;

  // Stream response with typed options (default behavior)
  for await (const chunk of chat(messages, {
    baseURL: process.env.AIRBOLT_URL || 'http://localhost:3000',
    system: 'You are a helpful assistant. Keep responses concise.',
  })) {
    if (chunk.type === 'chunk') {
      process.stdout.write(chunk.content);
    } else if (chunk.type === 'done' && chunk.usage) {
      usage = chunk.usage;
    }
  }

  await displayUsage(usage);
}

async function nonStreamingExample(): Promise<void> {
  console.log('\n\n🔄 Non-Streaming Example:\n');

  const messages: Message[] = [
    { role: 'user', content: 'What is JavaScript in 2 sentences?' },
  ];

  console.log('User:', messages[0].content);

  // Get complete response at once with usage info
  const response = await chatSync(messages, {
    baseURL: process.env.AIRBOLT_URL || 'http://localhost:3000',
    system: 'You are a helpful assistant. Keep responses concise.',
  });

  console.log('\nAI:', response.content);
  await displayUsage(response.usage);
}

async function main(): Promise<void> {
  console.log('🤖 Airbolt Chat Example with Rate Limiting (TypeScript)\n');

  try {
    // Run both examples
    await streamingExample();
    await nonStreamingExample();

    console.log('\n\n✅ Full type safety with TypeScript and usage tracking!');
  } catch (error) {
    if (error instanceof Error) {
      console.error('\n❌ Error:', error.message);

      // Handle rate limit errors specifically
      if (error.message.includes('429')) {
        console.log('\n⚠️  Rate limit exceeded!');
        console.log(
          'The SDK will automatically retry with exponential backoff.'
        );
        console.log(
          'If you continue to see this error, wait a moment before trying again.'
        );
      }
    } else {
      console.error('\n❌ Unknown error:', error);
    }

    console.log('\nMake sure the backend is running:');
    console.log('  cd apps/backend-api && pnpm dev');
  }
}

// Run the example
main();
