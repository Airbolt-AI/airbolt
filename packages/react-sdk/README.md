# @airbolt/react-sdk

React hooks and utilities for the Airbolt API with built-in state management.

## Installation

```bash
npm install @airbolt/react-sdk
# or
yarn add @airbolt/react-sdk
# or
pnpm add @airbolt/react-sdk
```

## Requirements

- React 16.8 or higher (hooks support required)
- Node.js 18.0.0 or higher

## Quick Start

### Option 1: Use the Pre-built ChatWidget (Zero Configuration)

```tsx
import { ChatWidget } from '@airbolt/react-sdk';

function App() {
  return <ChatWidget />;
}
```

### Option 2: Build Your Own with useChat Hook

```tsx
import { useChat } from '@airbolt/react-sdk';

function ChatComponent() {
  const { messages, input, setInput, send, isLoading } = useChat({
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

A pre-built, customizable chat component with zero configuration required.

```typescript
function ChatWidget(props?: ChatWidgetProps): React.ReactElement;
```

#### Props

| Prop           | Type                               | Default               | Description                                        |
| -------------- | ---------------------------------- | --------------------- | -------------------------------------------------- |
| `baseURL`      | `string`                           | -                     | Optional. Base URL for the Airbolt API             |
| `system`       | `string`                           | -                     | Optional. System prompt to guide the AI's behavior |
| `placeholder`  | `string`                           | `"Type a message..."` | Placeholder text for the input field               |
| `title`        | `string`                           | `"AI Assistant"`      | Title displayed in the widget header               |
| `theme`        | `'light' \| 'dark' \| 'auto'`      | `'auto'`              | Theme mode (auto follows system preference)        |
| `position`     | `'inline' \| 'fixed-bottom-right'` | `'inline'`            | Widget positioning mode                            |
| `className`    | `string`                           | -                     | Additional CSS class for custom styling            |
| `customTheme`  | `Partial<ThemeColors>`             | -                     | Custom theme colors to override defaults           |
| `customStyles` | `object`                           | -                     | Custom styles for widget elements                  |

#### Example Usage

```tsx
// Zero configuration
<ChatWidget />

// With custom configuration
<ChatWidget
  title="Support Chat"
  theme="dark"
  position="fixed-bottom-right"
  system="You are a helpful support agent"
/>

// With custom theme colors
<ChatWidget
  customTheme={{
    userMessage: '#FF6B6B',
    assistantMessage: '#4ECDC4'
  }}
/>
```

### useChat

The `useChat` hook manages chat conversations with automatic state management.

```typescript
function useChat(options?: UseChatOptions): UseChatReturn;
```

#### Options

| Option            | Type        | Description                                                                                 |
| ----------------- | ----------- | ------------------------------------------------------------------------------------------- |
| `baseURL`         | `string`    | Optional. Base URL for the Airbolt API. Defaults to environment variable or production URL. |
| `system`          | `string`    | Optional. System prompt to include with the messages.                                       |
| `initialMessages` | `Message[]` | Optional. Initial messages to populate the chat history.                                    |

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
  baseURL?: string;
  system?: string;
  initialMessages?: Message[];
}
```

## Examples

### Basic Chat Interface

```tsx
import { useChat } from '@airbolt/react-sdk';

function SimpleChatApp() {
  const { messages, input, setInput, send, isLoading, error } = useChat();

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
  system:
    'You are a knowledgeable assistant specializing in React development.',
});
```

### With Initial Messages

```tsx
const { messages, input, setInput, send, isLoading } = useChat({
  initialMessages: [
    { role: 'assistant', content: 'Hello! How can I help you today?' },
  ],
});
```

### With Custom API Endpoint

```tsx
const { messages, input, setInput, send, isLoading } = useChat({
  baseURL: 'https://api.custom-domain.com',
});
```

### Advanced Chat with Clear Functionality

```tsx
import { useChat } from '@airbolt/react-sdk';

function AdvancedChat() {
  const { messages, input, setInput, send, clear, isLoading, error } = useChat({
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
const { error, send } = useChat();

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

## Best Practices

1. **Disable inputs while loading** to prevent multiple submissions
2. **Handle errors gracefully** by displaying user-friendly error messages
3. **Use the `clear` function** to reset conversations when needed
4. **Trim input** is handled automatically by the hook
5. **Component unmounting** is handled - pending requests are cancelled

## Migration from Vanilla SDK

If you're currently using the vanilla JavaScript SDK:

```javascript
// Before (vanilla SDK)
import { chat } from '@airbolt/sdk';

const response = await chat([{ role: 'user', content: 'Hello' }], {
  system: 'You are helpful',
});

// After (React SDK)
const { messages, input, setInput, send } = useChat({
  system: 'You are helpful',
});
// Use the hook's managed state and functions
```

## TypeScript Support

This package is written in TypeScript and provides full type definitions. All exports are properly typed for an excellent development experience.

## License

MIT © Airbolt AI
