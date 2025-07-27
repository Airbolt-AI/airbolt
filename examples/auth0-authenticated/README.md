# Airbolt Auth0 Authentication Example

See how Airbolt integrates with Auth0 for secure, authenticated AI chat.

## What This Example Shows

- Auth0 login flow with Airbolt
- Automatic token validation (zero backend config in dev!)
- How to configure for production security
- Per-user rate limiting with Auth0 user IDs
- Debug panel to understand the integration

## Prerequisites

- Node.js 18+
- An Auth0 account ([sign up free](https://auth0.com/signup))
- 5 minutes to set it up

## Setup Guide

### Step 1: Create Your Auth0 Application

1. Log in to your [Auth0 Dashboard](https://auth0.com/)
2. Navigate to **Applications** → **Create Application**
3. Choose:
   - Name: `Airbolt Example` (or your preference)
   - Type: **Single Page Application**
4. Click **Create**

### Step 2: Configure Auth0 Settings

In your Auth0 application settings:

1. **Allowed Callback URLs**: `http://localhost:5174`
2. **Allowed Logout URLs**: `http://localhost:5174`
3. **Allowed Web Origins**: `http://localhost:5174`
4. **Save Changes**

### Step 3: Copy Your Auth0 Credentials

From the **Settings** tab, copy:

- **Domain** (e.g., `dev-xxxxx.auth0.com`)
- **Client ID**

### Step 4: Create an Auth0 API (Required!)

**Why this step?** Without an API/audience, Auth0 returns opaque tokens that cannot be validated locally, requiring a network call to Auth0 for every request.

1. Navigate to **APIs** → **Create API**
2. Set:
   - Name: `Airbolt API`
   - Identifier: `https://airbolt-api` (this is your audience)
   - Signing Algorithm: **RS256**
3. Click **Create**

### Step 5: Configure This Example

```bash
cd examples/auth0-authenticated
cp .env.example .env
```

Edit `.env` with your Auth0 details:

```
VITE_AUTH0_DOMAIN=your-tenant.auth0.com
VITE_AUTH0_CLIENT_ID=your-client-id
VITE_AUTH0_AUDIENCE=https://airbolt-api  # Required (from step 4)
VITE_AIRBOLT_API_URL=http://localhost:3000
```

### Step 6: Start the Airbolt Backend

```bash
cd apps/backend-api
pnpm dev
```

### Step 7: Run This Example

```bash
cd examples/auth0-authenticated
pnpm install
pnpm dev
```

### Step 8: Try It Out!

1. Open http://localhost:5174
2. Click "Sign In with Auth0"
3. Complete the Auth0 login flow
4. Check the debug panel (it shows what's happening)
5. Send a chat message

✨ **That's it!** You're now using Auth0 authentication with Airbolt.

## Testing Development vs Production Modes

### Development Mode (What You Just Ran)

The backend automatically validates any Auth0 token - zero configuration needed! You'll see a warning in the backend console:

```
⚠️  Accepting JWT from https://your-tenant.auth0.com/. For production, configure EXTERNAL_JWT_ISSUER.
```

This is perfect for development and trying things out.

### Production Mode (Secure Configuration)

To see how production security works:

1. **Stop the backend** (Ctrl+C)

2. **Create a `.env` file** in `apps/backend-api/`:

   ```bash
   cd apps/backend-api
   cp .env.example .env
   ```

3. **Edit the `.env`** file and add:

   ```
   NODE_ENV=production
   EXTERNAL_JWT_ISSUER=https://your-tenant.auth0.com/
   EXTERNAL_JWT_AUDIENCE=https://airbolt-api
   ```

4. **Restart the backend**:

   ```bash
   pnpm dev
   ```

5. **Try the example again** - it still works, but now ONLY accepts tokens from YOUR Auth0 tenant!

### What's the Difference?

- **Development**: Accepts any valid Auth0 token (with warnings)
- **Production**: Only accepts tokens from the configured issuer
- **Security**: Production mode prevents token substitution attacks

## Understanding the Integration

1. **User Authentication**: Auth0 handles user login and provides a JWT
2. **Automatic Detection**: Airbolt SDK detects `window.auth0` object
3. **Token Retrieval**: SDK calls `getAccessTokenSilently()` automatically
4. **API Requests**: Token is included in the Authorization header
5. **Backend Validation**:
   - Development: Auto-discovers Auth0's JWKS (zero config)
   - Production: Validates against configured issuer
6. **User Identification**: Rate limiting applied per Auth0 user ID

## The Debug Panel

This example includes a debug panel that helps you understand what's happening:

- **Auth0 Detection**: Is the Auth0 SDK loaded?
- **SDK Status**: Did Airbolt detect Auth0 automatically?
- **Token Status**: Was a token retrieved successfully?
- **Token Claims**: What's in your JWT token?
- **Backend Config**: What configuration is expected?

## Troubleshooting

### "No token returned from auth provider"

- Ensure you're logged in to Auth0
- Check that Auth0 SDK is properly initialized
- Verify audience parameter matches your API

### "Auth0 token is opaque (no audience)" Error

- This means you skipped step 4 (Create an API)
- Auth0 returns opaque tokens without an audience
- Solution: Create an API in Auth0 dashboard and set the audience in your frontend config
- The error message will include a direct link to fix this

### "Invalid authorization token" (401)

- Ensure token hasn't expired
- Check that audience claim matches your API identifier
- In production, verify `EXTERNAL_JWT_ISSUER` is set correctly

### SDK not detecting Auth0

- Make sure Auth0 SDK loads before Airbolt SDK
- Check browser console for Auth0 initialization errors
- Verify `window.auth0` exists after page load

### CORS errors

- Add your frontend URL to Auth0 allowed origins
- Ensure backend CORS allows your frontend URL

## Building Your Own App?

Now that you've seen how it works:

1. **Development**: Just add the Airbolt SDK to your Auth0 app - no backend config needed!
2. **Production**: Set those two environment variables (EXTERNAL_JWT_ISSUER and optionally EXTERNAL_JWT_AUDIENCE)
3. **Other Providers**: Clerk, Firebase, and Supabase work the same way

See the [main README](../../README.md#bring-your-own-auth-byoa) for more details.

## Resources

- [Auth0 Quickstart Guide](https://auth0.com/docs/quickstart/spa/react)
- [Understanding JWT Tokens](https://auth0.com/docs/tokens/json-web-tokens)
- [Airbolt Documentation](../../README.md)
