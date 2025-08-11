# Airbolt Examples

Working examples showing how to integrate Airbolt into your apps.

## Available Examples

### 🚀 [Anonymous Chat](./anonymous-chat)

**The simplest integration** - no auth setup required

- Zero configuration
- Start chatting immediately
- Perfect for prototypes

### 🔐 [Clerk Authenticated](./clerk-authenticated)

**Zero-config Clerk integration** - automatic detection

- No auth props needed
- Automatic token detection
- Works with Clerk components
- TypeScript support

### 🔐 [Auth0 Authenticated](./auth0-authenticated)

**Production-ready with Auth0** - bring your own auth

- Zero backend configuration needed
- Automatic JWKS discovery
- Per-user rate limiting
- Debug panel included

### 🔐 [Supabase Authenticated](./supabase-authenticated)

**Seamless Supabase integration** - email auth + RLS

- Email/password authentication
- Row Level Security example
- Automatic session management
- Debug panel included

### 🔐 [Firebase Authenticated](./firebase-authenticated)

**Firebase Auth integration** - Google + email auth

- Google OAuth + Email/Password
- Multiple auth providers
- Firestore security rules example
- Debug panel included

## Quick Start

1. **Start the backend** (from project root):

   ```bash
   cd apps/backend-api
   pnpm dev
   ```

2. **Run an example**:
   ```bash
   cd examples/anonymous-chat  # or any example directory
   pnpm install
   pnpm dev
   ```

## Which Example Should I Use?

| Example            | Setup Required      | Backend Config        | Best For          | User Tracking             |
| ------------------ | ------------------- | --------------------- | ----------------- | ------------------------- |
| **Anonymous Chat** | None                | None                  | Prototypes, demos | Per session               |
| **Clerk**          | Clerk account       | None (auto-discovery) | Modern SaaS apps  | Per user                  |
| **Auth0**          | Auth0 account + API | None (auto-discovery) | Enterprise apps   | Per user                  |
| **Supabase**       | Supabase project    | None (auto-discovery) | Full-stack apps   | Per user + RLS            |
| **Firebase**       | Firebase project    | None (auto-discovery) | Google ecosystem  | Per user + Security Rules |

### Port Assignments

- **Anonymous Chat**: http://localhost:5173
- **Clerk**: http://localhost:5174
- **Auth0**: http://localhost:5174
- **Supabase**: http://localhost:5175
- **Firebase**: http://localhost:5176

## Troubleshooting

**Backend issues?**

- Set AI provider keys in `apps/backend-api/.env`
- Backend must be running: `pnpm dev`

**Port conflicts?**

- Anonymous: http://localhost:5173
- Auth0: http://localhost:5174
