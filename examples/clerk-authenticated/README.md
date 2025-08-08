# Clerk Zero-Config Authentication Example

This example demonstrates how Airbolt's ChatWidget automatically detects and uses Clerk authentication without any configuration.

## 🚀 Zero Configuration Required!

```jsx
// Place ChatWidget inside your authenticated components
<ClerkProvider publishableKey="pk_test_...">
  <SignedIn>
    <ChatWidget /> {/* Automatically uses Clerk auth! */}
  </SignedIn>
</ClerkProvider>
```

No `getAuthToken` prop. No auth configuration. ChatWidget automatically detects and uses Clerk when placed inside authenticated components!

## Setup

1. **Get a Clerk account** (free at [clerk.com](https://clerk.com))

2. **Set your Clerk publishable key**:

   ```bash
   cp .env.example .env
   # Edit .env and add your VITE_CLERK_PUBLISHABLE_KEY
   ```

3. **Install and run**:

   ```bash
   pnpm install
   pnpm dev
   ```

4. **Start the backend** (in the root directory):
   ```bash
   pnpm dev:backend
   ```

## How It Works

1. **Auto-Detection**: ChatWidget detects `window.Clerk` automatically
2. **Token Fetching**: Gets tokens via `Clerk.session.getToken()`
3. **Request Headers**: Includes token in `Authorization: Bearer <token>`
4. **Backend Validation**: Auto-validates via JWKS discovery

## Features Demonstrated

- ✅ **Zero-config auth** - No auth props needed
- ✅ **Auto-detection** - Finds Clerk automatically
- ✅ **Seamless integration** - Works with Clerk's SignIn/SignedIn components
- ✅ **Type safety** - Full TypeScript support
- ✅ **Fallback support** - Falls back to anonymous if not signed in

## Production Notes

For production, configure your backend with:

```env
NODE_ENV=production
EXTERNAL_JWT_ISSUER=https://your-app.clerk.accounts.dev/
```

This ensures only your Clerk tokens are accepted.

## Troubleshooting

- **"Clerk not detected"**: Make sure you're signed in via Clerk's SignIn component
- **"Unauthorized"**: Check that your backend is running on port 3000
- **Token errors**: Ensure your Clerk app is configured correctly
