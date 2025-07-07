# React SDK Examples

This directory contains example React applications demonstrating how to use the `@airbolt/react-sdk` package.

## Examples

### 1. Simple Chat (`simple-chat.tsx`)

A basic chat interface showing the core functionality of the `useChat` hook:

- Send and receive messages
- Loading states
- Error handling
- Clear conversation

### 2. Advanced Chat (`advanced-chat.tsx`)

An advanced chat application with additional features:

- Customizable system prompt
- Configurable API endpoint
- Export chat history to JSON
- Better UX with typing indicators
- Keyboard shortcuts (Enter to send)
- Retry on error

## Running the Examples

To run these examples in your React application:

1. Install the SDK:

```bash
npm install @airbolt/react-sdk
```

2. Copy the example code into your React application

3. Import and use the component:

```tsx
import { SimpleChatApp } from './simple-chat';
// or
import { AdvancedChatApp } from './advanced-chat';

function App() {
  return <SimpleChatApp />;
}
```

4. Make sure your Airbolt API is running at `http://localhost:3000` (or configure the `baseURL`)

## Customization

Both examples use inline styles for simplicity. In a production application, you would typically:

- Use a CSS framework (Tailwind, Material-UI, etc.)
- Extract styles to CSS modules or styled-components
- Add more sophisticated error handling
- Implement user authentication
- Add message persistence

## TypeScript Support

All examples are written in TypeScript and demonstrate proper typing with the React SDK.
