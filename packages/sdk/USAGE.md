# Airbolt SDK Usage Guide

The Airbolt SDK provides multiple levels of abstraction for interacting with the Airbolt API.

## Quick Start - Vanilla JavaScript API

The simplest way to use the SDK is through the vanilla JavaScript API:

```javascript
import { chat, createChatSession } from '@airbolt/sdk';

// Simple one-off chat
const response = await chat([
  { role: 'user', content: 'Hello, how are you?' }
]);
console.log(response); // "I'm doing well, thank you!"

// With system prompt
const jokeResponse = await chat(
  [{ role: 'user', content: 'Tell me a joke' }],
  { 
    system: 'You are a comedian who tells funny jokes',
    baseURL: 'https://api.airbolt.dev' // optional
  }
);

// Session-based conversations
const session = createChatSession();

const response1 = await session.send('What is 2+2?');
console.log(response1); // "2+2 equals 4"

const response2 = await session.send('What did I just ask?');
console.log(response2); // "You asked what 2+2 equals"

// View conversation history
console.log(session.getMessages());
// [
//   { role: 'user', content: 'What is 2+2?' },
//   { role: 'assistant', content: '2+2 equals 4' },
//   { role: 'user', content: 'What did I just ask?' },
//   { role: 'assistant', content: 'You asked what 2+2 equals' }
// ]

// Clear session and start fresh
session.clear();
```

## Advanced Usage - Class-based API

For more control, use the class-based API:

```javascript
import { AirboltClient, TokenManager } from '@airbolt/sdk';

// Create a client with custom configuration
const client = new AirboltClient({
  baseURL: 'https://api.airbolt.dev',
  userId: 'user-123',
  timeout: 30000,
  maxRetries: 3
});

// Make a chat request
const response = await client.chat({
  messages: [
    { role: 'system', content: 'You are a helpful assistant' },
    { role: 'user', content: 'What is the weather like?' }
  ]
});

console.log(response.content);
console.log(response.usage?.total_tokens);

// Manual token management
const tokenManager = new TokenManager({
  baseURL: 'https://api.airbolt.dev',
  userId: 'user-123'
});

const token = await tokenManager.getToken();
```

## Configuration

### Environment Variables

- `AIRBOLT_API_URL` - Default base URL for the API (defaults to `http://localhost:3000`)

### Chat Options

- `baseURL` - API endpoint URL
- `system` - System prompt to set assistant behavior

### Session Options

- `baseURL` - API endpoint URL passed to all chat calls in the session

## TypeScript Support

The SDK is written in TypeScript and provides full type definitions:

```typescript
import { Message, ChatOptions, ChatSession } from '@airbolt/sdk';

const messages: Message[] = [
  { role: 'user', content: 'Hello' }
];

const options: ChatOptions = {
  baseURL: 'https://api.airbolt.dev',
  system: 'You are a helpful assistant'
};

const response: string = await chat(messages, options);
```

## Error Handling

The SDK provides typed error classes:

```javascript
import { chat, AirboltError, TokenError } from '@airbolt/sdk';

try {
  const response = await chat([
    { role: 'user', content: 'Hello' }
  ]);
} catch (error) {
  if (error instanceof AirboltError) {
    console.error('API error:', error.message, error.statusCode);
  } else if (error instanceof TokenError) {
    console.error('Authentication error:', error.message);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Browser vs Node.js

The SDK works in both browser and Node.js environments. The core functionality automatically adapts based on the environment.