# Airbolt Examples

This directory contains example applications demonstrating different Airbolt integration patterns.

## Available Examples

### 🚀 [Anonymous Chat](./anonymous-chat)

**Zero-config authentication example**

- Uses Airbolt's built-in JWT authentication
- No external auth provider required
- Perfect for getting started quickly
- Demonstrates basic chat integration

[View Example →](./anonymous-chat)

### 🔐 [Auth0 Authenticated](./auth0-authenticated)

**Bring Your Own Auth (BYOA) example with Auth0**

- Shows Auth0 integration setup
- Automatic token detection and usage
- Debug panel for troubleshooting
- Per-user rate limiting based on Auth0 ID

[View Example →](./auth0-authenticated)

## Running the Examples

Each example has its own README with detailed setup instructions. The general process is:

1. **Start the Airbolt backend**:

   ```bash
   cd apps/backend-api
   pnpm dev
   ```

2. **Navigate to an example**:

   ```bash
   cd examples/anonymous-chat
   # or
   cd examples/auth0-authenticated
   ```

3. **Install and run**:
   ```bash
   pnpm install
   pnpm dev
   ```

## Key Differences

| Feature              | Anonymous Chat    | Auth0 Authenticated    |
| -------------------- | ----------------- | ---------------------- |
| **Setup Complexity** | None              | Requires Auth0 account |
| **Authentication**   | Built-in JWT      | External Auth0         |
| **User Identity**    | Anonymous session | Auth0 user ID          |
| **Rate Limiting**    | Per session       | Per user               |
| **Token Management** | Automatic         | Auth0 handles          |
| **Use Case**         | Quick prototypes  | Production apps        |

## Creating Your Own Example

To add a new example:

1. Create a new directory: `examples/your-example-name`
2. Copy the structure from `anonymous-chat` as a starting point
3. Modify for your specific use case
4. Add a comprehensive README
5. Update this file to include your example

## Common Issues

### Backend not running

All examples require the Airbolt backend to be running. Make sure you've:

1. Set up your AI provider API keys in `apps/backend-api/.env`
2. Started the backend with `pnpm dev`

### Port conflicts

Each example uses a different port:

- Anonymous Chat: http://localhost:5173
- Auth0 Authenticated: http://localhost:5174

### Dependencies not found

Make sure to run `pnpm install` in both:

- The root directory (for workspace dependencies)
- The specific example directory

## Contributing

When adding or updating examples:

- Keep them focused on a single integration pattern
- Include comprehensive error handling
- Add debug information where helpful
- Write clear documentation
- Test on a fresh clone of the repository
