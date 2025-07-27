# Airbolt Auth0 Authenticated Example

This example demonstrates Airbolt's Bring Your Own Auth (BYOA) integration with Auth0. It shows how to use your existing Auth0 authentication with Airbolt's chat API.

## Features

- 🔐 Auth0 authentication flow
- 🔍 Automatic Auth0 token detection
- 💬 Authenticated chat with AI
- 🐛 Debug information for troubleshooting
- 📊 Per-user rate limiting based on Auth0 user ID

## Prerequisites

1. An Auth0 account (free tier is fine)
2. An Auth0 Single Page Application (SPA)
3. Airbolt backend running locally

## Auth0 Setup

### 1. Create an Auth0 Application

1. Log in to your [Auth0 Dashboard](https://auth0.com/)
2. Navigate to **Applications** → **Create Application**
3. Choose:
   - Name: `Airbolt Example` (or your preference)
   - Type: **Single Page Application**
4. Click **Create**

### 2. Configure Application Settings

In your Auth0 application settings:

1. **Allowed Callback URLs**: `http://localhost:5174`
2. **Allowed Logout URLs**: `http://localhost:5174`
3. **Allowed Web Origins**: `http://localhost:5174`
4. **Save Changes**

### 3. Get Your Configuration

From the **Settings** tab, copy:

- **Domain** (e.g., `dev-xxxxx.auth0.com`)
- **Client ID**

### 4. Create an API (Optional but Recommended)

1. Navigate to **APIs** → **Create API**
2. Set:
   - Name: `Airbolt API`
   - Identifier: `https://airbolt-api` (this is your audience)
   - Signing Algorithm: **RS256**
3. Click **Create**

### 5. Get Your Public Key

1. Go to **Applications** → Your App → **Settings**
2. Scroll to **Advanced Settings** → **Certificates**
3. Click **Download Certificate** and choose **PEM** format
4. This is your `EXTERNAL_JWT_PUBLIC_KEY` for the backend

## Quick Start

### 1. Configure the Example App

```bash
cd examples/auth0-authenticated
cp .env.example .env
```

Edit `.env` with your Auth0 details:

```
VITE_AUTH0_DOMAIN=your-tenant.auth0.com
VITE_AUTH0_CLIENT_ID=your-client-id
VITE_AUTH0_AUDIENCE=https://airbolt-api  # Optional but recommended
VITE_AIRBOLT_API_URL=http://localhost:3000
```

### 2. Configure the Airbolt Backend

In your backend `.env` file, add:

```
EXTERNAL_JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
-----END PUBLIC KEY-----"
```

### 3. Start the Backend

```bash
cd apps/backend-api
pnpm dev
```

### 4. Install Dependencies and Run

```bash
cd examples/auth0-authenticated
pnpm install
pnpm dev
```

### 5. Test the Integration

1. Open http://localhost:5174
2. Click "Sign In with Auth0"
3. Complete the Auth0 login flow
4. Check the debug information panel
5. Try sending a chat message

## How It Works

1. **User Authentication**: Auth0 handles user login and provides a JWT
2. **Automatic Detection**: Airbolt SDK detects `window.auth0` object
3. **Token Retrieval**: SDK calls `getAccessTokenSilently()` automatically
4. **API Requests**: Token is included in the Authorization header
5. **Backend Validation**: Server validates token using your public key
6. **User Identification**: Rate limiting applied per Auth0 user ID

## Debugging

The example includes a debug panel that shows:

- ✓ Auth0 global object detection
- ✓ SDK auto-detection status
- ✓ Token retrieval success/failure
- ✓ Decoded token claims
- ✓ Expected backend configuration

## Common Issues

### "No token returned from auth provider"

- Ensure you're logged in to Auth0
- Check that Auth0 SDK is properly initialized
- Verify audience parameter matches your API

### "Invalid authorization token" (401)

- Verify `EXTERNAL_JWT_PUBLIC_KEY` in backend matches your Auth0 certificate
- Ensure token hasn't expired
- Check that audience claim matches expectations

### SDK not detecting Auth0

- Make sure Auth0 SDK loads before Airbolt SDK
- Check browser console for Auth0 initialization errors
- Verify `window.auth0` exists after page load

### CORS errors

- Add your frontend URL to Auth0 allowed origins
- Ensure backend CORS allows your frontend URL

## Security Notes

- Never commit `.env` files
- Keep your Auth0 credentials secure
- Use HTTPS in production
- Rotate your certificates periodically

## Next Steps

- Deploy to production with proper domains
- Implement role-based access control (RBAC)
- Add user metadata to customize experience
- Set up Auth0 Actions for custom claims

## Resources

- [Auth0 SPA Quickstart](https://auth0.com/docs/quickstart/spa/react)
- [Auth0 JWT Validation](https://auth0.com/docs/tokens/json-web-tokens/validate-json-web-tokens)
- [Airbolt BYOA Documentation](../../docs/BYOA.md)
