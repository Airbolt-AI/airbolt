# Airbolt Examples

Working examples showing how to integrate Airbolt into your apps.

## Available Examples

### 🚀 [Anonymous Chat](./anonymous-chat)

**The simplest integration** - no auth setup required

- Zero configuration
- Start chatting immediately
- Perfect for prototypes

### ⚡ [Clerk Minimal](./clerk-minimal)

**Zero-config authentication with Clerk** - production auth in minutes

- Add Clerk publishable key and you're done
- Backend auto-detects and validates Clerk JWTs
- No backend configuration needed
- Under 80 lines of total code

### 🔐 [Auth0 Authenticated](./auth0-authenticated)

**Enterprise authentication with Auth0** - advanced features

- Auto-discovery validates Auth0 tokens automatically
- Debug panel shows token flow and validation
- Per-user rate limiting and usage tracking
- Production-ready with full observability

## Quick Start

1. **Start the backend** (from project root):

   ```bash
   cd apps/backend-api
   pnpm dev
   ```

2. **Run an example**:
   ```bash
   cd examples/clerk-minimal     # or anonymous-chat, auth0-authenticated
   pnpm install
   pnpm dev
   ```

## Which Example Should I Use?

|                     | Anonymous Chat | Clerk Minimal         | Auth0 Authenticated     |
| ------------------- | -------------- | --------------------- | ----------------------- |
| **Setup**           | None           | Clerk publishable key | Auth0 domain + clientId |
| **Backend config**  | None           | Auto-detects Clerk    | Auto-detects Auth0      |
| **Best for**        | Prototypes     | Quick production apps | Enterprise features     |
| **User tracking**   | Per session    | Per user (automatic)  | Per user (automatic)    |
| **Rate limits**     | IP-based only  | User + token limits   | User + token limits     |
| **Code complexity** | ~50 lines      | ~80 lines             | ~200 lines (w/ debug)   |
| **Key feature**     | No auth needed | Zero-config auth      | Full observability      |

## Authentication Auto-Discovery

All authenticated examples benefit from Airbolt's **zero-config authentication**:

1. **Frontend**: Your auth provider (Clerk, Auth0, etc.) provides a JWT
2. **SDK**: Automatically detects the auth provider and includes the token
3. **Backend**: Auto-discovers the token type and validates with the provider's JWKS
4. **Result**: Secure authentication with zero backend configuration

### Supported Providers

The following providers work automatically without any backend configuration:

- **Clerk** - Detected by issuer pattern `*.clerk.accounts.dev`
- **Auth0** - Detected by issuer pattern `*.auth0.com`
- **Firebase** - Detected by issuer `securetoken.google.com`
- **Supabase** - Detected by issuer pattern `*.supabase.co`

## Troubleshooting

### Backend Issues

**"Backend not running"**

- Ensure backend is started: `cd apps/backend-api && pnpm dev`
- Check it's running at http://localhost:3000

**"Missing API keys"**

- Set AI provider keys in `apps/backend-api/.env`
- Either `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` required

### Authentication Issues

**"Token validation failed"**

- In development, warnings about missing `EXTERNAL_JWT_ISSUER` are normal
- The backend auto-detects and validates tokens anyway
- For production, optionally set `EXTERNAL_JWT_ISSUER` for explicit validation

**"No validator available"**

- Token issuer not recognized by auto-discovery
- Set `EXTERNAL_JWT_ISSUER` to your provider's issuer URL

### Port Conflicts

- Backend API: http://localhost:3000
- Anonymous Chat: http://localhost:5173
- Clerk Minimal: http://localhost:3001
- Auth0 Authenticated: http://localhost:5174
