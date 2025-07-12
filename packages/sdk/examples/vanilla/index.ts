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
      { role: 'user', content: 'What is TypeScript?' }
    ];
    
    // Send message with typed options
    const response = await chat(messages, {
      baseURL: process.env.AIRBOLT_URL || 'http://localhost:3000',
      system: 'You are a helpful assistant. Keep responses concise.'
    });
    
    console.log('AI:', response);
    console.log('\n✅ Full type safety with TypeScript!');
    
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
    console.log('\nMake sure the backend is running:');
    console.log('  cd apps/backend-api && pnpm dev');
  }
}

// Run the example
main();