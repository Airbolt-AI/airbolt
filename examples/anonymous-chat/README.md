# Anonymous Chat Example

The simplest way to add AI chat to your app - no authentication setup required!

## Quick Start

1. **Start the backend** (from project root):

   ```bash
   cd apps/backend-api
   pnpm dev
   ```

2. **Run this example**:

   ```bash
   pnpm install
   pnpm dev
   ```

3. **Open** http://localhost:5173

That's it! Start chatting immediately.

## What This Demonstrates

- **Zero-config auth**: JWT tokens handled automatically
- **Instant chat**: No login or setup required
- **Rate limiting**: Built-in protection per session
- **Clean UI**: Minimal, focused on the chat experience

## The Code

It's just one component:

```tsx
import { ChatWidget } from '@airbolt/react-sdk';

function App() {
  return (
    <ChatWidget
      baseURL="http://localhost:3000"
      position="relative"
      welcomeMessage="Welcome! I'm ready to help."
    />
  );
}
```

## Customization Options

- **`baseURL`**: Your backend URL (required)
- **`theme`**: Colors, fonts, spacing
- **`position`**: `relative`, `fixed-bottom-right`, `fixed-bottom-left`
- **`placeholder`**: Input field hint text
- **`welcomeMessage`**: Initial bot greeting

## Common Issues

**Backend not reachable?**

- Ensure backend is running: `cd apps/backend-api && pnpm dev`
- Check your AI provider API keys are set in `.env`

**Want authentication?**

- See the [auth0-authenticated](../auth0-authenticated) example

## Next Steps

This example shows the simplest integration. For production apps, consider:

- Adding user authentication for persistent sessions
- Customizing the theme to match your brand
- Deploying the backend to a cloud provider
