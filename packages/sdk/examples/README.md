# SDK Examples

This directory contains minimal examples demonstrating how to use `@airbolt/sdk` in Node.js.

## Node.js CLI Chat Example

The `node-cli/` directory shows the simplest way to use the SDK:

```javascript
import { chat } from '@airbolt/sdk';

const response = await chat([{ role: 'user', content: 'Hello!' }], {
  baseURL: 'http://localhost:3000',
});
```

### Running the Example

1. **Start the backend** (from project root):

   ```bash
   cd apps/backend-api
   pnpm dev
   ```

2. **Run the example**:

   ```bash
   cd packages/sdk/examples/node-cli
   pnpm install

   # JavaScript version
   pnpm start

   # TypeScript version
   pnpm start:ts
   ```

## Key Features

- 🚀 **Simple API** - Just call `chat()` function
- 🔐 **No auth code** - SDK handles JWT automatically
- 📦 **Node.js 18+** - Uses native fetch
- 🎯 **~30 lines** - Minimal, focused example

## Requirements

- Node.js 18 or higher (for native fetch support)
- Backend API running locally

## See Also

For React examples, check out `packages/react-sdk/examples/`
