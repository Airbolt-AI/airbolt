# @airbolt/react-sdk

> Add secure AI chat to your React app in one line of code

Part of **[Airbolt](https://github.com/Airbolt-AI/airbolt)** - A production-ready backend for calling LLMs from your frontend securely.

```bash
npm install @airbolt/react-sdk
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
  const { messages, input, setInput, send, isLoading } = useChat({
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

## API Reference

### ChatWidget

A universally compatible chat component that inherits from parent styles by default. Zero configuration required, with only 4 CSS custom properties for theming instead of 17+ complex theme options.

```typescript
function ChatWidget(props?: ChatWidgetProps): React.ReactElement;
```

#### Props

| Prop           | Type                               | Default               | Description                                        |
| -------------- | ---------------------------------- | --------------------- | -------------------------------------------------- |
| `baseURL`      | `string`                           | -                     | **Required**. Base URL for your Airbolt backend    |
| `system`       | `string`                           | -                     | Optional. System prompt to guide the AI's behavior |
| `provider`     | `'openai' \| 'anthropic'`          | -                     | Optional. AI provider to use                       |
| `model`        | `string`                           | -                     | Optional. Specific model to use                    |
| `placeholder`  | `string`                           | `"Type a message..."` | Placeholder text for the input field               |
| `title`        | `string`                           | `"AI Assistant"`      | Title displayed in the widget header               |
| `theme`        | `'light' \| 'dark' \| 'auto'`      | `'auto'`              | Theme mode (auto follows system preference)        |
| `position`     | `'inline' \| 'fixed-bottom-right'` | `'inline'`            | Widget positioning mode                            |
| `className`    | `string`                           | -                     | Additional CSS class for custom styling            |
| `minimalTheme` | `MinimalTheme`                     | -                     | New minimal theme using CSS custom properties      |
| `customStyles` | `object`                           | -                     | Custom styles for widget elements                  |

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

#### Return Value

| Property    | Type                      | Description                                    |
| ----------- | ------------------------- | ---------------------------------------------- |
| `messages`  | `Message[]`               | Array of all messages in the conversation.     |
| `input`     | `string`                  | Current input value.                           |
| `setInput`  | `(value: string) => void` | Function to update the input value.            |
| `isLoading` | `boolean`                 | Whether a message is currently being sent.     |
| `error`     | `Error \| null`           | Error from the last send attempt, if any.      |
| `send`      | `() => Promise<void>`     | Send the current input as a message.           |
| `clear`     | `() => void`              | Clear all messages and reset the conversation. |

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
}
```

## Examples

### Basic Chat Interface

```tsx
import { useChat } from '@airbolt/react-sdk';

function SimpleChatApp() {
  const { messages, input, setInput, send, isLoading, error } = useChat({
    baseURL: 'https://your-deployment.onrender.com',
  });

  return (
    <div className="chat-container">
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
  const { messages, input, setInput, send, clear, isLoading, error } = useChat({
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

## More Examples

Check out our example applications:

- **[React Widget Example](examples/widget-demo/)** - Shows how to use the pre-built ChatWidget
- **[React Hooks Example](examples/hooks-demo/)** - Demonstrates building a custom chat interface with useChat
- **[Node.js CLI Example](../sdk/examples/node-cli/)** - Command-line chat using the core SDK

## License

MIT © [Airbolt AI](https://github.com/Airbolt-AI)
