# Bring Your Own Auth (BYOA) Guide

Airbolt now supports using your existing authentication provider (Clerk, Auth0, Firebase, Supabase) with zero configuration for common providers.

## Quick Start

### Common Auth Providers (Zero Config)

If you're using Clerk, Auth0, Firebase, or Supabase, the SDK will automatically detect and use your auth tokens:

```javascript
// Frontend - SDK auto-detects your auth provider!
import { chat } from '@airbolt/sdk';

const response = await chat([{ role: 'user', content: 'Hello!' }]);
```

For the backend, add your public key:

```bash
# For RS256 providers (Clerk, Auth0, Firebase)
EXTERNAL_JWT_PUBLIC_KEY=pk_test_abc123...

# For HS256 providers (Supabase with shared secret)
EXTERNAL_JWT_SECRET=your-supabase-jwt-secret
```

### Custom Auth Providers

For other auth providers or server-side rendering:

```javascript
// Pass your token getter function
const response = await chat(messages, {
  getAuthToken: () => myAuth.getToken(),
});
```

## Supported Providers

### Clerk

- Auto-detected via `window.Clerk`
- Uses RS256 tokens
- Set `EXTERNAL_JWT_PUBLIC_KEY` on backend

### Auth0

- Auto-detected via `window.auth0`
- Uses RS256 tokens
- Set `EXTERNAL_JWT_PUBLIC_KEY` on backend

### Firebase Auth

- Auto-detected via `window.firebase`
- Uses RS256 tokens
- Set `EXTERNAL_JWT_PUBLIC_KEY` on backend

### Supabase Auth

- Auto-detected via `window.supabase`
- Can use RS256 (recommended) or HS256
- For RS256: Set `EXTERNAL_JWT_PUBLIC_KEY`
- For HS256: Set `EXTERNAL_JWT_SECRET`

## How It Works

1. **SDK Detection**: The SDK automatically detects common auth providers in the browser
2. **Token Retrieval**: When making requests, the SDK gets fresh tokens from your provider
3. **Backend Validation**: The server validates tokens using your configured public key/secret
4. **User Identification**: The `sub` claim (or `email` as fallback) is used for rate limiting

## Security

- Tokens are validated on every request
- Rate limiting is applied per user (using token's `sub` claim)
- Invalid tokens are rejected with 401 errors
- Supports both RS256 (asymmetric) and HS256 (symmetric) algorithms

## Troubleshooting

### "No token returned from auth provider"

- Ensure user is logged in to your auth provider
- Check that the auth provider SDK is loaded before Airbolt SDK

### "Invalid authorization token"

- Verify your `EXTERNAL_JWT_PUBLIC_KEY` or `EXTERNAL_JWT_SECRET` is correct
- Ensure the token hasn't expired
- Check that the issuer matches your auth provider

### Rate limiting not working

- Ensure your tokens include a `sub` or `email` claim
- Check that the same user ID is being extracted consistently
