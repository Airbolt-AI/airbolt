# Widget Demo - ChatWidget

This example demonstrates the simplest way to add AI chat to your React app using the pre-built `ChatWidget` component from Airbolt.

## What This Shows

- Drop-in `ChatWidget` component that **inherits your app's styling**
- Automatically adopts parent fonts, colors, and spacing
- Zero configuration needed - just works with your existing design
- Optional CSS custom properties for chat-specific theming

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
   echo "AI_PROVIDER=openai" >> .env  # or 'anthropic'
   echo "OPENAI_API_KEY=your-openai-api-key" >> .env  # or ANTHROPIC_API_KEY for Anthropic
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
   cd packages/react-sdk/examples/widget-demo
   pnpm dev
   ```

5. Open http://localhost:5174 in your browser

## 🚨 Troubleshooting

**"Failed to refresh token" errors?**

1. Add `NODE_ENV=development` to your `.env` file in the project root
2. Restart the backend: `cd apps/backend-api && pnpm dev`
3. Hard refresh your browser (Cmd+Shift+R)

**Backend not starting?** Ensure you're running from `apps/backend-api/` directory, not project root.

### Production Usage

```tsx
<ChatWidget
  baseURL="https://my-ai-backend.onrender.com" // Required - your deployed Airbolt backend
  title="AI Assistant"
  placeholder="Ask me anything..."
/>
```

## The Magic Line

```tsx
<ChatWidget
  baseURL="https://my-ai-backend.onrender.com" // Required
  title="AI Assistant"
  placeholder="Ask me anything..."
/>
```

That's it! This single component provides:

- 🔐 Automatic authentication
- 🔒 Secure LLM proxy (API keys stay server-side)
- 💬 Message interface
- ⏳ Loading states
- ❌ Error handling
- 🎨 Professional styling
- 📱 Responsive design

## Styling Philosophy

**The ChatWidget inherits your app's design automatically:**

- Uses parent's `font-family`, `font-size`, `line-height`
- Adapts to parent's text color by default
- Minimal, non-intrusive styling that blends with any design system

## Customization Options

- `baseURL` - Your Airbolt backend URL (required)
- `title` - Widget header title
- `placeholder` - Input placeholder text
- `position` - "inline" or "fixed-bottom-right"

## Optional Theming

If you need chat-specific colors, use CSS custom properties:

```css
.my-container {
  --chat-primary: #your-brand-color;
  --chat-surface: #your-background;
  --chat-border: #your-border-color;
  --chat-text: #your-text-color;
}
```

## Next Steps

- Deploy your Airbolt backend and update the `baseURL`
- Try changing the position to "fixed-bottom-right"
- Customize the theme colors
- Check the useChat hook example for more control
