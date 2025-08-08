# @airbolt/react-sdk

> Add secure AI chat to your React app in one line of code

Part of **[Airbolt](https://github.com/Airbolt-AI/airbolt)** - A production-ready backend for calling LLMs from your frontend securely.

**🚀 Streaming by default** - Responses stream in real-time for better UX. Set `streaming={false}` for complete responses.

```bash
# Latest stable version
npm install @airbolt/react-sdk

# Beta version (latest features)
npm install @airbolt/react-sdk@beta
```

**Just want to get started?** See the [main README](../../README.md) for the 3-step quickstart guide.

## Quick Start

First, deploy the Airbolt backend following the [main README](../../README.md#getting-started). You'll need the API URL from your deployment.

### Option 1: Use the Pre-built ChatWidget

```tsx
import { ChatWidget } from '@airbolt/react-sdk';

function App() {
  return <ChatWidget baseURL="https://your-deployment.onrender.com" />;
}
```

### Option 2: Build Your Own with useChat Hook

```tsx
import { useChat } from '@airbolt/react-sdk';

function ChatComponent() {
  const { messages, input, setInput, send, isLoading, usage } = useChat({
    baseURL: 'https://your-deployment.onrender.com',
    system: 'You are a helpful assistant',
  });

  return (
    <div>
      {messages.map((message, index) => (
        <div key={index}>
          <strong>{message.role}:</strong> {message.content}
        </div>
      ))}

      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyPress={e => e.key === 'Enter' && send()}
        placeholder="Type your message..."
        disabled={isLoading}
      />

      <button onClick={send} disabled={isLoading}>
        {isLoading ? 'Sending...' : 'Send'}
      </button>
    </div>
  );
}
```

> 💡 **Want to see it in action?** Check out our [Interactive Demo](#interactive-demo) to explore all features with live examples including streaming responses!

## Supported Auth Providers

Airbolt SDK automatically detects and integrates with popular authentication providers - **zero configuration required**:

| Provider        | Auto-Detection        | Status           |
| --------------- | --------------------- | ---------------- |
| **Clerk**       | ✅ Automatic          | Production Ready |
| **Supabase**    | ✅ Automatic          | Production Ready |
| **Auth0**       | ✅ Automatic          | Production Ready |
| **Firebase**    | ✅ Automatic          | Production Ready |
| **Custom/BYOA** | ✅ Via `getAuthToken` | Production Ready |

**Zero Configuration = Just use ChatWidget!** If your app already uses Clerk, Supabase, Auth0, or Firebase authentication, Airbolt automatically detects and uses it:

```tsx
// Your existing app with Clerk already set up somewhere
function App() {
  return (
    <ChatWidget baseURL="https://your-deployment.onrender.com" />
    // That's it! Clerk auth detected and used automatically
  );
}

// Your existing app with Supabase already set up somewhere
function App() {
  return (
    <ChatWidget baseURL="https://your-deployment.onrender.com" />
    // That's it! Supabase auth detected and used automatically
  );
}

// Custom auth - Only if you need to override or use a custom provider
<ChatWidget
  baseURL="https://your-deployment.onrender.com"
  getAuthToken={async () => myCustomAuth.getToken()}
/>;
```

## API Reference

### ChatWidget

A universally compatible chat component that inherits from parent styles by default. Zero configuration required, with only 4 CSS custom properties for theming instead of 17+ complex theme options.

```typescript
function ChatWidget(props?: ChatWidgetProps): React.ReactElement;
```

#### Props

| Prop           | Type                               | Default               | Description                                          |
| -------------- | ---------------------------------- | --------------------- | ---------------------------------------------------- |
| `baseURL`      | `string`                           | -                     | **Required**. Base URL for your Airbolt backend      |
| `system`       | `string`                           | -                     | Optional. System prompt to guide the AI's behavior   |
| `provider`     | `'openai' \| 'anthropic'`          | -                     | Optional. AI provider to use                         |
| `model`        | `string`                           | -                     | Optional. Specific model to use                      |
| `placeholder`  | `string`                           | `"Type a message..."` | Placeholder text for the input field                 |
| `title`        | `string`                           | `"AI Assistant"`      | Title displayed in the widget header                 |
| `theme`        | `'light' \| 'dark' \| 'auto'`      | `'auto'`              | Theme mode (auto follows system preference)          |
| `position`     | `'inline' \| 'fixed-bottom-right'` | `'inline'`            | Widget positioning mode                              |
| `className`    | `string`                           | -                     | Additional CSS class for custom styling              |
| `minimalTheme` | `MinimalTheme`                     | -                     | New minimal theme using CSS custom properties        |
| `customStyles` | `object`                           | -                     | Custom styles for widget elements                    |
| `streaming`    | `boolean`                          | `true`                | Enable streaming responses (set to false to disable) |

#### Example Usage

```tsx
// Minimal configuration
<ChatWidget baseURL="https://your-deployment.onrender.com" />

// With custom configuration
<ChatWidget
  baseURL="https://your-deployment.onrender.com"
  title="Support Chat"
  theme="dark"
  position="fixed-bottom-right"
  system="You are a helpful support agent"
/>

// With specific AI provider and model
<ChatWidget
  baseURL="https://your-deployment.onrender.com"
  provider="anthropic"
  model="claude-3-5-sonnet-20241022"
  system="You are a technical documentation expert"
/>

// With CSS custom properties (recommended)
<ChatWidget
  baseURL="https://your-deployment.onrender.com"
  minimalTheme={{
    primary: '#FF6B6B',    // --chat-primary
    surface: '#F8F9FA',    // --chat-surface
    border: '#DEE2E6',     // --chat-border
    text: '#212529'        // --chat-text
  }}
/>

// Or use CSS directly in your stylesheet
<style>
  .my-chat-container {
    --chat-primary: #FF6B6B;
    --chat-surface: #F8F9FA;
  }
</style>
```

### useChat

The `useChat` hook manages chat conversations with automatic state management.

```typescript
function useChat(options?: UseChatOptions): UseChatReturn;
```

#### Options

| Option            | Type                      | Description                                              |
| ----------------- | ------------------------- | -------------------------------------------------------- |
| `baseURL`         | `string`                  | **Required**. Base URL for your Airbolt backend.         |
| `system`          | `string`                  | Optional. System prompt to include with the messages.    |
| `provider`        | `'openai' \| 'anthropic'` | Optional. AI provider to use.                            |
| `model`           | `string`                  | Optional. Specific model to use.                         |
| `initialMessages` | `Message[]`               | Optional. Initial messages to populate the chat history. |
| `streaming`       | `boolean`                 | Optional. Enable streaming responses (default: true).    |
| `onChunk`         | `(chunk: string) => void` | Optional. Callback for streaming chunks.                 |

#### Return Value

| Property        | Type                      | Description                                    |
| --------------- | ------------------------- | ---------------------------------------------- |
| `messages`      | `Message[]`               | Array of all messages in the conversation.     |
| `input`         | `string`                  | Current input value.                           |
| `setInput`      | `(value: string) => void` | Function to update the input value.            |
| `isLoading`     | `boolean`                 | Whether a message is currently being sent.     |
| `isStreaming`   | `boolean`                 | Whether a response is currently streaming.     |
| `error`         | `Error \| null`           | Error from the last send attempt, if any.      |
| `usage`         | `UsageInfo \| null`       | Usage information from the last response.      |
| `send`          | `() => Promise<void>`     | Send the current input as a message.           |
| `clear`         | `() => void`              | Clear all messages and reset the conversation. |
| `clearToken`    | `() => void`              | Clear the authentication token (logout).       |
| `hasValidToken` | `() => boolean`           | Check if there's a valid authentication token. |
| `getTokenInfo`  | `() => TokenInfo`         | Get token information for debugging.           |

### Types

```typescript
interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface UseChatOptions {
  baseURL: string;
  system?: string;
  provider?: 'openai' | 'anthropic';
  model?: string;
  initialMessages?: Message[];
  streaming?: boolean;
  onChunk?: (chunk: string) => void;
}

interface UsageInfo {
  total_tokens: number;
  tokens?: {
    used: number;
    remaining: number;
    limit: number;
    resetAt: string;
  };
  requests?: {
    used: number;
    remaining: number;
    limit: number;
    resetAt: string;
  };
}
```

## Interactive Demo

Explore all the features of the Airbolt React SDK with our interactive Ladle demo:

```bash
# Navigate to the react-sdk package
cd packages/react-sdk

# Start the interactive demo
pnpm ladle
```

This will open an interactive environment where you can:

- 🎮 Experiment with all ChatWidget props using live controls
- 🎨 Try different themes and styling options
- 🔄 Switch between AI providers (OpenAI/Anthropic)
- 📝 See live code examples for each configuration
- 🪝 Explore useChat hook patterns and examples

Visit http://localhost:61000 after running the command to start exploring!

## Interactive Demo

The best way to explore all SDK features is through our interactive Ladle demo:

```bash
# Install dependencies
pnpm install

# Start the interactive demo
pnpm run ladle
```

This will open an interactive environment at http://localhost:61000 where you can:

- 🎮 Try all ChatWidget configurations with live controls
- 🌊 See streaming responses in action (now the default!)
- 🎨 Experiment with themes and positioning
- 🪝 Explore useChat hook patterns
- 📝 Copy production-ready code snippets

## Examples

### Basic Chat Interface

```tsx
import { useChat } from '@airbolt/react-sdk';

function SimpleChatApp() {
  const { messages, input, setInput, send, isLoading, error, usage } = useChat({
    baseURL: 'https://your-deployment.onrender.com',
  });

  return (
    <div className="chat-container">
      {/* Display usage info */}
      {usage && usage.tokens && (
        <div className="usage-info">
          Tokens: {usage.tokens.used}/{usage.tokens.limit}
          (resets {new Date(usage.tokens.resetAt).toLocaleTimeString()})
        </div>
      )}

      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            {msg.content}
          </div>
        ))}
      </div>

      {error && <div className="error">Error: {error.message}</div>}

      <form
        onSubmit={e => {
          e.preventDefault();
          send();
        }}
      >
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask me anything..."
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
```

### With Custom System Prompt

```tsx
const { messages, input, setInput, send, isLoading } = useChat({
  baseURL: 'https://your-deployment.onrender.com',
  system:
    'You are a knowledgeable assistant specializing in React development.',
});
```

### With Initial Messages

```tsx
const { messages, input, setInput, send, isLoading } = useChat({
  baseURL: 'https://your-deployment.onrender.com',
  initialMessages: [
    { role: 'assistant', content: 'Hello! How can I help you today?' },
  ],
});
```

### Advanced Chat with Clear Functionality

```tsx
import { useChat } from '@airbolt/react-sdk';

function AdvancedChat() {
  const { messages, input, setInput, send, clear, isLoading, error, usage } =
    useChat({
      baseURL: 'https://your-deployment.onrender.com',
      system: 'You are a helpful coding assistant.',
    });

  return (
    <div>
      <div className="chat-header">
        <h2>AI Chat</h2>
        <button onClick={clear}>Clear Chat</button>
      </div>

      <div className="chat-messages">
        {messages.length === 0 ? (
          <p>Start a conversation...</p>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`message ${msg.role}`}>
              <span className="role">{msg.role}:</span>
              <span className="content">{msg.content}</span>
            </div>
          ))
        )}

        {isLoading && <div className="typing">AI is typing...</div>}
      </div>

      {error && (
        <div className="error-banner">
          Failed to send message. Please try again.
        </div>
      )}

      <div className="chat-input">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Type your message..."
          rows={3}
          disabled={isLoading}
        />
        <button onClick={send} disabled={isLoading || !input.trim()}>
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
```

### Streaming Responses

Streaming is enabled by default for a more interactive experience. To disable streaming:

```tsx
import { useChat } from '@airbolt/react-sdk';

function NonStreamingChat() {
  const { messages, input, setInput, send, isLoading, error } = useChat({
    baseURL: 'https://your-deployment.onrender.com',
    streaming: false, // Explicitly disable streaming
  });
  // ...
}
```

For streaming mode (default), you can handle individual chunks:

```tsx
function StreamingChat() {
  const { messages, input, setInput, send, isLoading, isStreaming, error } =
    useChat({
      baseURL: 'https://your-deployment.onrender.com',
      // streaming: true is the default
      onChunk: chunk => {
        // Optional: Handle individual chunks
        console.log('Received:', chunk);
      },
    });

  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            {msg.content}
          </div>
        ))}

        {/* Show different states */}
        {isLoading && <div className="status">Connecting...</div>}
        {isStreaming && <div className="status">AI is responding...</div>}
      </div>

      <form
        onSubmit={e => {
          e.preventDefault();
          send();
        }}
      >
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={isLoading || isStreaming}
          placeholder="Type a message..."
        />
        <button type="submit" disabled={isLoading || isStreaming || !input}>
          {isStreaming ? 'Streaming...' : 'Send'}
        </button>
      </form>
    </div>
  );
}
```

## Error Handling

The hook provides built-in error handling. When an error occurs:

1. The `error` property will contain the error object
2. The failed message will be removed from the history
3. The input will be restored so the user can retry

```tsx
const { error, send } = useChat({
  baseURL: 'https://your-deployment.onrender.com',
});

// Display error to user
{
  error && (
    <Alert severity="error">
      Failed to send message: {error.message}
      <button onClick={send}>Retry</button>
    </Alert>
  );
}
```

### Cold Start Handling

When using free tier deployments (like Render), servers sleep after inactivity. The SDK automatically handles this:

```tsx
const { error, isLoading } = useChat({
  baseURL: 'https://your-app.onrender.com',
});

// Check for cold start
if (error?.code === 'COLD_START') {
  return (
    <div className="info-message">
      <span>🔄</span> Server is waking up... This happens with free tier
      deployments. Please try again in a moment.
    </div>
  );
}

// Or show during loading
if (isLoading) {
  return <div>Sending message... (may take longer if server is waking up)</div>;
}
```

## Rate Limiting & Usage Tracking

The SDK automatically handles rate limiting and provides real-time usage information:

### Display Usage Information

```tsx
const { messages, input, setInput, send, usage } = useChat({
  baseURL: 'https://your-deployment.onrender.com',
});

// Display token usage
{
  usage && usage.tokens && (
    <div className="usage-bar">
      <div className="usage-text">
        {usage.tokens.used.toLocaleString()} /{' '}
        {usage.tokens.limit.toLocaleString()} tokens used
      </div>
      <div className="usage-progress">
        <div
          className="usage-fill"
          style={{
            width: `${(usage.tokens.used / usage.tokens.limit) * 100}%`,
          }}
        />
      </div>
      <div className="usage-reset">
        Resets {new Date(usage.tokens.resetAt).toLocaleTimeString()}
      </div>
    </div>
  );
}
```

### Handle Rate Limit Errors

When rate limits are exceeded, the error will contain a 429 status:

```tsx
const { error, isLoading, usage } = useChat({
  baseURL: 'https://your-deployment.onrender.com',
});

// Check for rate limit error
if (error?.message.includes('429')) {
  return (
    <div className="rate-limit-error">
      <h3>Rate limit exceeded</h3>
      {usage?.tokens && (
        <p>
          You've used {usage.tokens.used} of {usage.tokens.limit} tokens. Try
          again after {new Date(usage.tokens.resetAt).toLocaleTimeString()}.
        </p>
      )}
    </div>
  );
}
```

### Rate Limit Configuration

The backend enforces these default limits (configurable via environment variables):

- **Token limit**: 1,000 tokens per hour per user
- **Request limit**: 10 requests per minute per user
- **Automatic retry**: The SDK automatically retries rate-limited requests with exponential backoff

## Best Practices

1. **Disable inputs while loading** to prevent multiple submissions
2. **Handle errors gracefully** by displaying user-friendly error messages
3. **Use the `clear` function** to reset conversations when needed
4. **Trim input** is handled automatically by the hook
5. **Component unmounting** is handled - pending requests are cancelled

## Migration from Vanilla SDK

If you're currently using the vanilla JavaScript SDK (`@airbolt/sdk`):

```javascript
// Before (vanilla SDK)
import { chat } from '@airbolt/sdk';

const response = await chat([{ role: 'user', content: 'Hello' }], {
  baseURL: 'https://your-deployment.onrender.com',
  system: 'You are helpful',
});

// After (React SDK)
const { messages, input, setInput, send } = useChat({
  baseURL: 'https://your-deployment.onrender.com',
  system: 'You are helpful',
});
// Use the hook's managed state and functions
```

## CSS Custom Properties

The ChatWidget uses CSS custom properties for maximum compatibility:

- `--chat-primary`: Primary color for buttons and user messages
- `--chat-surface`: Background color for surfaces and assistant messages
- `--chat-border`: Border color for inputs and dividers
- `--chat-text`: Text color (inherits from parent by default)

The widget inherits typography (font-family, font-size, line-height) from its parent container, making it blend seamlessly with any design system.

## TypeScript Support

This package is written in TypeScript and provides full type definitions. All exports are properly typed for an excellent development experience.

## Example Code

For comprehensive, interactive examples of all SDK features, run the Ladle demo:

```bash
pnpm run ladle
```

The Ladle demo is the canonical source for:

- All ChatWidget configurations and use cases
- useChat hook patterns and streaming examples
- Theme customization options
- Error handling patterns
- Authentication flows

## License

MIT © [Airbolt AI](https://github.com/Airbolt-AI)
