# Testing the React SDK

## Quick Test with Standalone HTML

1. **Start the backend API** (in the project root):

   ```bash
   pnpm dev
   ```

   This will start the API server at http://localhost:3000

2. **Open the HTML demo**:

   ```bash
   # From the project root
   open packages/react-sdk/examples/standalone-demo.html
   ```

   Or just double-click the file in Finder.

3. **Try it out**:
   - Type a message and press Send
   - The message will be sent to your local API
   - You'll see the AI's response appear in the chat

## Testing in a Real React App

### Option 1: Link the Package Locally

1. **Build the React SDK**:

   ```bash
   cd packages/react-sdk
   pnpm build
   ```

2. **In your React app**, link the local package:

   ```bash
   # In your React app directory
   npm link /path/to/airbolt/packages/react-sdk
   # or
   yarn link /path/to/airbolt/packages/react-sdk
   ```

3. **Use it in your app**:

   ```jsx
   import { useChat } from '@airbolt/react-sdk';

   function App() {
     const { messages, input, setInput, send, isLoading } = useChat();
     // ... rest of your component
   }
   ```

### Option 2: Create a Test App in the Monorepo

1. **Create a new app**:

   ```bash
   mkdir apps/test-react-app
   cd apps/test-react-app
   npm init -y
   npm install react react-dom
   ```

2. **Import and use the SDK**:
   ```jsx
   import { useChat } from '@airbolt/react-sdk';
   ```

## Testing with the Example Components

The package includes two example components you can copy into your React app:

1. **Simple Chat** (`examples/simple-chat.tsx`):
   - Basic chat interface
   - Shows core functionality

2. **Advanced Chat** (`examples/advanced-chat.tsx`):
   - Customizable system prompt
   - Export chat history
   - Better UX with typing indicators

Copy either example into your React app and import the `useChat` hook from the built package.

## Troubleshooting

- **"Failed to fetch" error**: Make sure the API is running (`pnpm dev`)
- **CORS errors**: The API should have CORS configured for localhost
- **TypeScript errors**: Make sure you've built the package first (`pnpm build`)

## What to Test

1. **Basic messaging**: Send messages and receive responses
2. **Error handling**: Stop the API and try sending a message
3. **Loading states**: Check the UI during message sending
4. **Clear functionality**: Clear the conversation
5. **Input restoration**: When an error occurs, your message should be restored
