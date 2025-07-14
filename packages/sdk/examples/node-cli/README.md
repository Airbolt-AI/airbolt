# Node.js CLI Chat Example

This example shows the simplest way to use `@airbolt/sdk` in a Node.js command-line interface with the Airbolt secure LLM proxy.

## Prerequisites

- Node.js 18 or higher
- pnpm 10 or higher
- Airbolt backend deployed or running locally

## Setup

### Local Development

**IMPORTANT**: This example must be run from the Airbolt monorepo workspace.

1. **From the project root**, build the SDK and install dependencies:

   ```bash
   # Navigate to project root
   cd /path/to/airbolt

   # Install all workspace dependencies
   pnpm install

   # Build the SDK package
   cd packages/sdk
   pnpm build
   ```

2. Start the Airbolt backend:

   ```bash
   # From project root
   cd apps/backend-api
   pnpm dev
   ```

3. Run the example:
   ```bash
   # Navigate to the example directory
   cd packages/sdk/examples/node-cli
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

**IMPORTANT**: Make sure you're in the `packages/sdk/examples/node-cli` directory.

### JavaScript Version

```bash
pnpm start
```

### TypeScript Version

```bash
pnpm start:ts
```

### Expected Output

```bash
🤖 Airbolt Chat Example

AI: [AI response with a joke or helpful information]

✅ Success! The SDK handles authentication automatically.
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
