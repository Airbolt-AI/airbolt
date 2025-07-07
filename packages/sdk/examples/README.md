# Airbolt SDK Examples

This directory contains example scripts demonstrating how to use the Airbolt SDK.

> **⚠️ Important**: The backend API must be running for these examples to work!

## Prerequisites

1. **Backend API Running**: Make sure the Airbolt backend API is running locally:
   ```bash
   # From the project root
   pnpm dev
   ```
   The API should be available at `http://localhost:3000`

2. **SDK Built**: Ensure the SDK is built:
   ```bash
   # From the project root
   pnpm build
   ```

## Running the Examples

### JavaScript Example

The JavaScript example demonstrates basic usage of the vanilla API:

```bash
# From the SDK package directory
cd packages/sdk

# Run the JavaScript demo
node examples/vanilla-chat-demo.js
```

### TypeScript Example

The TypeScript example shows advanced patterns and type safety:

```bash
# From the SDK package directory
cd packages/sdk

# Run the TypeScript demo directly with tsx
pnpm tsx examples/vanilla-chat-demo.ts

# Or make it executable and run directly
chmod +x examples/vanilla-chat-demo.ts
./examples/vanilla-chat-demo.ts
```

### Using a Different API Endpoint

If your API is running on a different URL:

```bash
# Set the environment variable
export AIRBOLT_API_URL=https://api.your-domain.com

# Then run the examples
node examples/vanilla-chat-demo.js
```

## What the Examples Demonstrate

### JavaScript Example (`vanilla-chat-demo.js`)
- Simple one-off chat requests
- Chat with system prompts
- Session-based conversations with context
- Viewing conversation history
- Clearing sessions
- Basic error handling

### TypeScript Example (`vanilla-chat-demo.ts`)
- Full TypeScript type safety
- Explicit type annotations
- Advanced conversation patterns
- Saving and restoring conversation state
- Multi-turn reasoning tasks

## Example Output

When you run the examples, you'll see colored output showing:
- The API endpoint being used
- User messages in green
- Assistant responses in blue
- System prompts in magenta
- Status messages in yellow

## Troubleshooting

1. **Connection Refused Error**: Make sure the backend API is running (`pnpm dev`)
2. **Module Not Found**: Ensure the SDK is built (`pnpm build`)
3. **Permission Denied**: Make TypeScript files executable (`chmod +x examples/*.ts`)

## Next Steps

After running these examples, you can:
- Modify them to test different scenarios
- Use them as templates for your own applications
- Explore the class-based API for more advanced use cases
- Check out the full documentation in `USAGE.md`