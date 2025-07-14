# Hooks Demo - useChat

This example demonstrates how to use the `useChat` hook from `@airbolt/react-sdk` with the Airbolt secure LLM proxy.

## What This Shows

- Using the `useChat` hook for chat functionality
- Managing messages, input, and loading states
- Error handling
- Clearing conversation
- Simple, clean UI with ~40 lines of code

## Setup

### Local Development

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Start the Airbolt backend (from project root):

   ```bash
   cd apps/backend-api
   pnpm dev
   ```

3. Start this example:

   ```bash
   pnpm dev
   ```

4. Open http://localhost:5173 in your browser

### Production Usage

```tsx
const { messages, input, setInput, send } = useChat({
  baseURL: 'https://my-ai-backend.onrender.com', // Required - your deployed Airbolt backend
});
```

## Key Features

- **Automatic authentication** - No JWT code needed
- **Secure LLM proxy** - Your API keys stay server-side
- **Real-time chat** - Send and receive messages
- **Loading states** - Shows when AI is responding
- **Error handling** - Graceful error display
- **Message history** - Full conversation tracking

## Code Structure

- `App.tsx` - Main component using `useChat` hook
- `App.css` - Simple styling
- `main.tsx` - React entry point
- `index.html` - HTML template

The entire chat functionality is in ~40 lines of TypeScript!
