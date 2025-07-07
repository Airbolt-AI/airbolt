#!/usr/bin/env tsx

/**
 * Airbolt SDK Vanilla TypeScript API Demo
 * 
 * This example demonstrates the TypeScript API with full type safety.
 * Make sure the backend API is running before executing this script.
 */

import { chat, createChatSession, type Message, type ChatOptions, type ChatSession } from '@airbolt/sdk';

// ANSI color codes for better output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
} as const;

function log(message: string, color: string = colors.reset): void {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title: string): void {
  console.log('\n' + '='.repeat(50));
  log(title, colors.bright + colors.cyan);
  console.log('='.repeat(50) + '\n');
}

async function demonstrateTypeScript(): Promise<void> {
  const baseURL = process.env.AIRBOLT_API_URL || 'http://localhost:3000';
  
  logSection('TypeScript Type Safety Demo');
  
  // Explicitly typed messages
  const messages: Message[] = [
    { role: 'user', content: 'Explain TypeScript benefits' }
  ];
  
  // Explicitly typed options
  const options: ChatOptions = {
    baseURL,
    system: 'You are a TypeScript expert. Keep responses concise.'
  };
  
  // Type-safe response
  const response: string = await chat(messages, options);
  log('User: Explain TypeScript benefits', colors.green);
  log(`Assistant: ${response}`, colors.blue);
  
  // Session with full type inference
  const session: ChatSession = createChatSession(baseURL);
  
  // All methods are fully typed
  const reply = await session.send('What is type inference?');
  const history = session.getMessages();
  
  log('\nUser: What is type inference?', colors.green);
  log(`Assistant: ${reply}`, colors.blue);
  log(`\nTotal messages in session: ${history.length}`, colors.yellow);
}

async function demonstrateAdvancedPatterns(): Promise<void> {
  const baseURL = process.env.AIRBOLT_API_URL || 'http://localhost:3000';
  
  logSection('Advanced Patterns Demo');
  
  // Pattern 1: Conversation branching
  log('Pattern 1: Saving and restoring conversation state', colors.magenta);
  
  const session = createChatSession(baseURL);
  await session.send('Let\'s discuss AI');
  await session.send('What are neural networks?');
  
  // Save current state
  const savedMessages = [...session.getMessages()];
  log(`Saved ${savedMessages.length} messages`, colors.yellow);
  
  // Continue with new branch
  await session.send('How do they learn?');
  
  // Restore to saved state
  session.clear();
  for (const msg of savedMessages) {
    if (msg.role === 'user') {
      await session.send(msg.content);
    }
  }
  log('Restored conversation state', colors.yellow);
  
  // Pattern 2: Multi-turn reasoning
  log('\nPattern 2: Multi-turn reasoning task', colors.magenta);
  
  const reasoningSession = createChatSession(baseURL);
  
  log('User: I have 3 apples. I eat 1 and buy 5 more. How many do I have?', colors.green);
  const step1 = await reasoningSession.send(
    'I have 3 apples. I eat 1 and buy 5 more. How many do I have?'
  );
  log(`Assistant: ${step1}`, colors.blue);
  
  log('\nUser: Now I give half to my friend. How many do I have left?', colors.green);
  const step2 = await reasoningSession.send(
    'Now I give half to my friend. How many do I have left?'
  );
  log(`Assistant: ${step2}`, colors.blue);
}

async function runDemo(): Promise<void> {
  try {
    console.log(colors.bright + colors.cyan);
    console.log('🚀 Airbolt SDK TypeScript Demo');
    console.log('==============================');
    console.log(colors.reset);

    const baseURL = process.env.AIRBOLT_API_URL || 'http://localhost:3000';
    log(`Using API endpoint: ${baseURL}`, colors.yellow);

    // Run TypeScript-specific demos
    await demonstrateTypeScript();
    await demonstrateAdvancedPatterns();

    log('\n✅ Demo completed successfully!', colors.bright + colors.green);

  } catch (error) {
    log(`\n❌ Demo failed: ${error instanceof Error ? error.message : 'Unknown error'}`, colors.bright + colors.yellow);
    
    if (error instanceof Error && (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED'))) {
      log('\n📌 Tip: Make sure the backend API is running!', colors.yellow);
      log('   Run "pnpm dev" in another terminal first.', colors.yellow);
    }
    
    console.error(error);
    process.exit(1);
  }
}

// Run the demo
runDemo();