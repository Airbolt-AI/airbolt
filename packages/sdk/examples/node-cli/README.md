# Node.js CLI Chat Example

This example shows the simplest way to use `@airbolt/sdk` in a Node.js command-line interface with the Airbolt secure LLM proxy.

## Prerequisites

- Node.js 18 or higher
- Airbolt backend deployed or running locally

## Setup

### Local Development

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Start the Airbolt backend (in the project root):
   ```bash
   cd apps/backend-api
   pnpm dev
   ```

### Production Usage

Update the `baseURL` in the example files to point to your deployed Airbolt backend:

```javascript
// In index.js or index.ts
const response = await chat(messages, {
  baseURL: 'https://your-airbolt-backend.onrender.com', // Required
});
```

## Run the Examples

### JavaScript Version

```bash
npm start
# or
pnpm start
```

### TypeScript Version

```bash
npm run start:ts
# or
pnpm start:ts
```

## What This Demonstrates

- Simple chat interaction using `chat()` function
- Automatic JWT authentication (handled by SDK)
- Secure LLM proxy (API keys stay server-side)
- Error handling
- TypeScript type safety (in the .ts version)

## Key Points

- No authentication code needed - the SDK handles JWT tokens automatically
- `baseURL` is required - points to your Airbolt backend
- Works in Node.js 18+ (requires native fetch support)
- Uses ES modules (`"type": "module"` in package.json)

## Next Steps

- Deploy your Airbolt backend and update the `baseURL`
- Try modifying the messages
- Add a system prompt to customize AI behavior
- Check out the React examples for browser usage
