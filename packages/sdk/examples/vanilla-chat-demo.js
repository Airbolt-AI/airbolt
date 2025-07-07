#!/usr/bin/env node

/**
 * Airbolt SDK Vanilla JavaScript API Demo
 * 
 * This example demonstrates the simple chat API and session management.
 * Make sure the backend API is running before executing this script.
 */

import { chat, createChatSession } from '@airbolt/sdk';

// ANSI color codes for better output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(50));
  log(title, colors.bright + colors.cyan);
  console.log('='.repeat(50) + '\n');
}

async function runDemo() {
  try {
    // Configure the API endpoint
    const baseURL = process.env.AIRBOLT_API_URL || 'http://localhost:3000';
    log(`Using API endpoint: ${baseURL}`, colors.yellow);

    // Demo 1: Simple one-off chat
    logSection('Demo 1: Simple One-off Chat');
    
    log('User: Hello, how are you?', colors.green);
    const response1 = await chat([
      { role: 'user', content: 'Hello, how are you?' }
    ], { baseURL });
    log(`Assistant: ${response1}`, colors.blue);

    // Demo 2: Chat with system prompt
    logSection('Demo 2: Chat with System Prompt');
    
    log('System: You are a comedian who tells funny jokes', colors.magenta);
    log('User: Tell me a joke about programming', colors.green);
    
    const response2 = await chat(
      [{ role: 'user', content: 'Tell me a joke about programming' }],
      { 
        system: 'You are a comedian who tells funny jokes',
        baseURL
      }
    );
    log(`Assistant: ${response2}`, colors.blue);

    // Demo 3: Session-based conversation
    logSection('Demo 3: Session-based Conversation');
    
    const session = createChatSession(baseURL);
    
    // First message
    log('User: What is 2+2?', colors.green);
    const sessionResponse1 = await session.send('What is 2+2?');
    log(`Assistant: ${sessionResponse1}`, colors.blue);
    
    // Follow-up message (maintains context)
    log('\nUser: What did I just ask you?', colors.green);
    const sessionResponse2 = await session.send('What did I just ask you?');
    log(`Assistant: ${sessionResponse2}`, colors.blue);
    
    // Another follow-up
    log('\nUser: Can you multiply that result by 10?', colors.green);
    const sessionResponse3 = await session.send('Can you multiply that result by 10?');
    log(`Assistant: ${sessionResponse3}`, colors.blue);
    
    // Show conversation history
    logSection('Conversation History');
    const messages = session.getMessages();
    messages.forEach((msg, index) => {
      const color = msg.role === 'user' ? colors.green : colors.blue;
      const prefix = msg.role === 'user' ? 'User' : 'Assistant';
      log(`${index + 1}. ${prefix}: ${msg.content}`, color);
    });
    
    // Clear session
    log('\nClearing session...', colors.yellow);
    session.clear();
    log('Session cleared. Message count: ' + session.getMessages().length, colors.yellow);

    // Demo 4: Error handling
    logSection('Demo 4: Error Handling');
    
    try {
      log('Attempting to connect to invalid endpoint...', colors.yellow);
      await chat(
        [{ role: 'user', content: 'This should fail' }],
        { baseURL: 'http://invalid-endpoint:9999' }
      );
    } catch (error) {
      log(`Error caught: ${error.message}`, colors.yellow);
      if (error.code) {
        log(`Error code: ${error.code}`, colors.yellow);
      }
    }

    log('\n✅ Demo completed successfully!', colors.bright + colors.green);

  } catch (error) {
    log(`\n❌ Demo failed: ${error.message}`, colors.bright + colors.yellow);
    
    if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
      log('\n📌 Tip: Make sure the backend API is running!', colors.yellow);
      log('   Run "pnpm dev" in another terminal first.', colors.yellow);
    }
    
    console.error(error);
    process.exit(1);
  }
}

// Run the demo
console.log(colors.bright + colors.cyan);
console.log('🚀 Airbolt SDK Vanilla JavaScript API Demo');
console.log('==========================================');
console.log(colors.reset);

runDemo();