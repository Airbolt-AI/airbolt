# Airbolt Anonymous Chat Example

This example demonstrates Airbolt's built-in JWT authentication for anonymous users. No external auth provider setup required!

## Features

- 🚀 Zero-config authentication
- 💬 Real-time chat with AI
- 📊 Usage tracking and rate limiting
- 🌊 Streaming responses
- 🎨 Customizable UI

## Quick Start

1. **Start the Airbolt backend** (from project root):

   ```bash
   cd apps/backend-api
   pnpm dev
   ```

2. **Install dependencies** (from this directory):

   ```bash
   pnpm install
   ```

3. **Start the example app**:

   ```bash
   pnpm dev
   ```

4. **Open your browser** to http://localhost:5173

## How It Works

This example uses Airbolt's built-in authentication system:

1. The SDK automatically requests a JWT token from the backend
2. The backend generates a token for anonymous users
3. Rate limiting is applied per anonymous session
4. No external auth provider configuration needed!

## Code Overview

```tsx
import { ChatWidget } from '@airbolt/react-sdk';

function App() {
  return (
    <ChatWidget
      baseURL="http://localhost:3000"
      position="relative"
      theme={{
        primaryColor: '#007bff',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
      placeholder="Type a message..."
      welcomeMessage="Welcome to Airbolt!"
    />
  );
}
```

## Customization

You can customize the chat widget with:

- **Theme**: Colors, fonts, and spacing
- **Position**: `relative`, `fixed-bottom-right`, or `fixed-bottom-left`
- **Messages**: Welcome message and placeholder text
- **Backend URL**: Point to your deployed Airbolt instance

## Next Steps

- Deploy your own Airbolt backend
- Add persistent user sessions
- Integrate with your existing auth system
- See the `auth0-authenticated` example for external auth integration

## Troubleshooting

**"Backend is not running" error**

- Make sure the Airbolt backend is running at `http://localhost:3000`
- Check that you've set up your AI provider API keys in the backend `.env` file

**Rate limit errors**

- Anonymous users have default rate limits
- Wait a moment and try again
- Or implement user authentication for higher limits
