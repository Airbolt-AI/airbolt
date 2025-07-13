# React SDK Examples

This directory contains minimal, focused examples demonstrating how to use `@airbolt/react-sdk`.

## Examples

### 1. React Hooks (`react-hooks/`)

Shows how to use the `useChat` hook for custom chat interfaces:

```tsx
const { messages, input, setInput, send } = useChat({
  baseURL: 'http://localhost:3000'
});
```

- Full control over UI
- ~40 lines of code
- Perfect for custom designs

### 2. React Widget (`react-widget/`)

Demonstrates the drop-in `ChatWidget` component:

```tsx
<ChatWidget 
  baseURL="http://localhost:3000"
  title="AI Assistant"
/>
```

- Zero configuration
- ~20 lines of code
- Ready-to-use chat interface

## Running the Examples

1. **Start the backend** (from project root):
   ```bash
   cd apps/backend-api
   pnpm dev
   ```

2. **Choose an example**:
   ```bash
   # For hooks example
   cd react-hooks
   pnpm install
   pnpm dev

   # For widget example
   cd react-widget
   pnpm install
   pnpm dev
   ```

## Key Features

All examples demonstrate:
- 🔐 **Automatic authentication** - No JWT code needed
- 🚀 **Instant setup** - Works with localhost
- 📦 **Workspace dependencies** - Uses local packages
- 🎯 **Focused code** - Only essential functionality

## Which Example to Use?

- **Use `react-hooks`** when you need custom UI/UX
- **Use `react-widget`** when you want it working instantly

Both examples are production-ready patterns!