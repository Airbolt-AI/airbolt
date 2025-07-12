# Vanilla JavaScript/TypeScript Example

This example shows the simplest way to use `@airbolt/sdk` in Node.js.

## Prerequisites

- Node.js 18 or higher
- Backend API running locally

## Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Start the backend (in the project root):
   ```bash
   cd apps/backend-api
   pnpm dev
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
- Error handling
- TypeScript type safety (in the .ts version)

## Key Points

- No authentication code needed - the SDK handles JWT tokens automatically
- Works in Node.js 18+ (requires native fetch support)
- Uses ES modules (`"type": "module"` in package.json)

## Next Steps

- Try modifying the messages
- Add a system prompt to customize AI behavior
- Check out the React examples for browser usage