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

**IMPORTANT**: This example must be run from the Airbolt monorepo workspace.

1. **From the project root**, install dependencies:

   ```bash
   # Navigate to project root
   cd /path/to/airbolt

   # Install all workspace dependencies
   pnpm install
   ```

2. **Set up environment variables** (CRITICAL for CORS):

   ```bash
   # From project root - create .env file if it doesn't exist
   echo "NODE_ENV=development" >> .env
   echo "OPENAI_API_KEY=your-openai-api-key" >> .env
   ```

   **⚠️ IMPORTANT**: `NODE_ENV=development` is required for CORS to work with multiple localhost ports. Without this, you'll get CORS errors.

3. Start the Airbolt backend:

   ```bash
   # From project root
   cd apps/backend-api
   pnpm dev
   ```

4. Start this example:

   ```bash
   # Navigate to the example directory
   cd packages/react-sdk/examples/hooks-demo
   pnpm dev
   ```

5. Open http://localhost:5173 in your browser

## 🚨 Troubleshooting

**"Failed to refresh token" errors?**

1. Add `NODE_ENV=development` to your `.env` file in the project root
2. Restart the backend: `cd apps/backend-api && pnpm dev`
3. Hard refresh your browser (Cmd+Shift+R)

**Backend not starting?** Ensure you're running from `apps/backend-api/` directory, not project root.

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
