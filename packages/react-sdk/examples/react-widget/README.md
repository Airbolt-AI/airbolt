# React Widget Example - ChatWidget

This example demonstrates the simplest way to add AI chat to your React app using the pre-built `ChatWidget` component.

## What This Shows

- Drop-in `ChatWidget` component
- Zero configuration needed
- Customizable props (title, placeholder, position)
- Complete chat UI with just one component

## Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Start the backend (from project root):
   ```bash
   cd apps/backend-api
   pnpm dev
   ```

3. Start this example:
   ```bash
   pnpm dev
   ```

4. Open http://localhost:5174 in your browser

## The Magic Line

```tsx
<ChatWidget 
  baseURL="http://localhost:3000"
  title="AI Assistant"
  placeholder="Ask me anything..."
/>
```

That's it! This single component provides:
- 🔐 Automatic authentication
- 💬 Message interface
- ⏳ Loading states
- ❌ Error handling
- 🎨 Professional styling
- 📱 Responsive design

## Customization Options

- `baseURL` - Your backend URL
- `title` - Widget header title
- `placeholder` - Input placeholder text
- `position` - "inline" or "fixed-bottom-right"
- `theme` - "light", "dark", or "auto"
- `customTheme` - Override specific colors

## Next Steps

- Try changing the position to "fixed-bottom-right"
- Customize the theme colors
- Check the useChat hook example for more control