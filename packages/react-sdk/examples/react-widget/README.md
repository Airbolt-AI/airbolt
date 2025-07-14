# React Widget Example - ChatWidget

This example demonstrates the simplest way to add AI chat to your React app using the pre-built `ChatWidget` component from Airbolt.

## What This Shows

- Drop-in `ChatWidget` component
- Zero configuration needed
- Customizable props (title, placeholder, position)
- Complete chat UI with just one component

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

4. Open http://localhost:5174 in your browser

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

## Customization Options

- `baseURL` - Your Airbolt backend URL (required)
- `title` - Widget header title
- `placeholder` - Input placeholder text
- `position` - "inline" or "fixed-bottom-right"
- `theme` - "light", "dark", or "auto"
- `minimalTheme` - NEW: Use only 4 CSS custom properties for theming
- `customTheme` - Legacy: Override specific colors (17 properties)

## NEW: Simplified Theming with CSS Custom Properties

The ChatWidget now supports a minimal theme approach using only 4 CSS custom properties:

```tsx
<ChatWidget
  baseURL="https://my-ai-backend.onrender.com"
  minimalTheme={{
    primary: '#FF6B6B',    // Buttons and user messages
    surface: '#F8F9FA',    // Backgrounds and assistant messages
    border: '#DEE2E6',     // Borders and dividers
    text: '#212529'        // Text color
  }}
/>
```

Or use CSS directly:

```css
.my-chat-container {
  --chat-primary: #FF6B6B;
  --chat-surface: #F8F9FA;
  --chat-border: #DEE2E6;
  --chat-text: #212529;
}
```

The widget inherits typography (font-family, font-size) from its parent container, making it blend seamlessly with any design system.

## Next Steps

- Deploy your Airbolt backend and update the `baseURL`
- Try changing the position to "fixed-bottom-right"
- Customize the theme colors
- Check the useChat hook example for more control
