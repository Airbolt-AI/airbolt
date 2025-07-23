# @airbolt/sdk

> Core TypeScript SDK for Airbolt - A production-ready backend for calling LLMs from your frontend securely

**🚀 Streaming by default** - Responses stream in real-time for better UX. Use `chatSync()` for non-streaming.

```bash
npm install @airbolt/sdk
```

**Looking for React components?** Use [@airbolt/react-sdk](../react-sdk/) instead for the easiest integration.

**Just want to get started?** See the [main README](../../README.md) for the 3-step quickstart guide.

## Quick Start

```typescript
import { chat } from '@airbolt/sdk';

// Simple streaming example (default)
for await (const chunk of chat([
  { role: 'user', content: 'Hello! Tell me a joke.' },
])) {
  process.stdout.write(chunk.content);
}
// Output streams in real-time: "Why don't scientists trust atoms? Because they make up everything!"

// Non-streaming example
import { chatSync } from '@airbolt/sdk';

const response = await chatSync(
  [{ role: 'user', content: 'What is TypeScript?' }],
  {
    baseURL: 'https://your-airbolt-backend.onrender.com',
    system: 'You are a helpful assistant. Keep responses concise.',
  }
);
console.log(response); // Complete response at once
```

## Features

### 🔒 Secure by Design

- Your AI provider API keys stay on your backend
- JWT tokens automatically handled
- No API keys in frontend code

### 🚀 Developer Experience

- Simple `chat()` function with streaming by default
- Full TypeScript support with type safety
- Works in Node.js, browsers, and edge runtimes

### 🔄 Zero Configuration

- No environment variables needed
- Pass `baseURL` when you need a custom backend
- Handles authentication automatically

## API Reference

### Main Functions

#### `chat(messages, options?)` - Streaming (Default)

Stream AI responses in real-time for a better user experience. This is the default behavior.

```typescript
async function* chat(
  messages: Message[],
  options?: ChatOptions
): AsyncGenerator<{ content: string; type: 'chunk' | 'done' | 'error' }>;
```

**Parameters:**

- `messages` - Array of chat messages
- `options` - Optional configuration
  - `baseURL` - Your Airbolt backend URL (default: `http://localhost:3000`)
  - `system` - System prompt to set AI behavior
  - `provider` - AI provider to use: `'openai'` or `'anthropic'` (default: uses backend environment setting)
  - `model` - Specific model to use (e.g., `'gpt-4'`, `'claude-3-5-sonnet-20241022'`). Defaults to provider's default model

**Returns:** An async generator that yields streaming chunks

#### `chatSync(messages, options?)` - Non-Streaming

Get the complete AI response at once (traditional behavior).

```typescript
function chatSync(messages: Message[], options?: ChatOptions): Promise<string>;
```

**Parameters:**

- Same as `chat()` function

**Returns:** The complete AI assistant's response as a string

**Example:**

```typescript
import { chat } from '@airbolt/sdk';

// Stream the response (default behavior)
for await (const chunk of chat([
  { role: 'user', content: 'Tell me a story' },
])) {
  if (chunk.type === 'chunk') {
    process.stdout.write(chunk.content); // Print as it arrives
  } else if (chunk.type === 'done') {
    console.log('\nStreaming complete!');
  }
}
```

#### `createChatSession(options?)`

Create a persistent chat session for maintaining conversation context.

```typescript
function createChatSession(options?: ChatOptions): ChatSession;
```

**Returns:** A chat session object with methods for sending messages

## Error Handling

The SDK provides clear error messages:

```typescript
import { chat, ColdStartError } from '@airbolt/sdk';

try {
  const response = await chat([{ role: 'user', content: 'Hello!' }]);
} catch (error) {
  if (error instanceof ColdStartError) {
    console.log('Server is waking up from sleep. This may take a moment...');
  } else if (error.message.includes('fetch failed')) {
    console.error('Backend is not running. Start it with: pnpm dev');
  } else if (error.message.includes('401')) {
    console.error('Authentication failed. Token may be expired.');
  } else {
    console.error('Error:', error.message);
  }
}
```

### Cold Start Handling

When using free tier deployments (like Render's free tier), servers sleep after inactivity. The SDK automatically handles this:

- Detects timeout on first request
- Retries with extended timeout (120s)
- Shows helpful console message
- Throws `ColdStartError` if server still doesn't respond

## Advanced Usage

### Chat Sessions

Maintain conversation context across multiple messages:

```typescript
import { createChatSession } from '@airbolt/sdk';

// Create a session
const session = createChatSession({
  baseURL: 'https://your-backend.onrender.com',
  system: 'You are a helpful coding assistant',
});

// Send messages
const response1 = await session.send('What is React?');
const response2 = await session.send('Show me a simple example');
// response2 remembers the context from response1
```

### Token Management

The SDK handles JWT tokens automatically, but you can also manage them:

```typescript
import { clearAuthToken, hasValidToken, getTokenInfo } from '@airbolt/sdk';

// Check if authenticated
if (hasValidToken()) {
  const info = getTokenInfo();
  console.log('Token expires at:', info.expiresAt);
}

// Clear token (logout)
clearAuthToken();
```

## TypeScript Support

The SDK is built with TypeScript and provides full type definitions:

```typescript
import type { Message, ChatOptions, ChatSession } from '@airbolt/sdk';

// Type-safe message arrays
const messages: Message[] = [
  { role: 'system', content: 'You are a helpful assistant' },
  { role: 'user', content: 'Hello!' },
  { role: 'assistant', content: 'Hi! How can I help you?' },
];

// Type-safe options
const options: ChatOptions = {
  baseURL: 'https://api.example.com',
  system: 'Be concise and friendly',
};
```

## Examples

### Basic Chat

```javascript
import { chat } from '@airbolt/sdk';

// Streaming (default)
for await (const chunk of chat([{ role: 'user', content: 'What is 2 + 2?' }])) {
  process.stdout.write(chunk.content);
}
// Output: "2 + 2 equals 4"
```

### Custom System Prompt

```javascript
for await (const chunk of chat(
  [{ role: 'user', content: 'Write a haiku about coding' }],
  {
    system: 'You are a poet who writes haikus about technology',
  }
)) {
  process.stdout.write(chunk.content);
}
```

### Using with Your Deployed Backend

```javascript
for await (const chunk of chat([{ role: 'user', content: 'Hello!' }], {
  baseURL: 'https://your-app.onrender.com',
})) {
  process.stdout.write(chunk.content);
}
```

### Selecting AI Provider and Model

```javascript
// Use Anthropic Claude
for await (const chunk of chat(
  [{ role: 'user', content: 'Explain quantum computing' }],
  {
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
  }
)) {
  process.stdout.write(chunk.content);
}

// Use OpenAI GPT-4
for await (const chunk of chat(
  [{ role: 'user', content: 'Write a TypeScript function' }],
  {
    provider: 'openai',
    model: 'gpt-4',
  }
)) {
  process.stdout.write(chunk.content);
}
```

## Running Examples

The SDK includes working examples:

```bash
# Clone the repository
git clone https://github.com/Airbolt-AI/airbolt
cd airbolt/packages/sdk/examples/node-cli

# Install dependencies
npm install

# Run JavaScript example
npm start

# Run TypeScript example
npm run start:ts
```

## Environment Support

The SDK works in multiple environments:

- **Node.js 18+** - Full support
- **Browsers** - Via bundlers (Webpack, Vite, etc.)
- **Edge Runtimes** - Cloudflare Workers, Vercel Edge Functions
- **Deno** - Via npm specifiers

## License

MIT - See LICENSE file in the main repository.

---

**Note**: This SDK provides the core functionality used by [@airbolt/react-sdk](../react-sdk/). For React applications, we recommend using the React SDK for the best developer experience.
