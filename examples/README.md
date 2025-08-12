# Airbolt Examples

Working examples showing how to integrate Airbolt into your apps.

## Available Examples

### 🚀 [Anonymous Chat](./anonymous-chat)

**The simplest integration** - no auth setup required

- Zero configuration
- Start chatting immediately
- Perfect for prototypes

### ⚡ [Clerk Minimal](./clerk-minimal)

**Zero-config authentication with Clerk** - the easiest way to get started

- Just add your Clerk keys and go!
- Automatic JWT detection and validation
- Under 80 lines of React code
- Perfect balance of simple + secure

### 🔐 [Auth0 Authenticated](./auth0-authenticated)

**Production-ready with Auth0** - bring your own auth

- Zero backend configuration needed (new!)
- Automatic JWKS discovery
- Per-user rate limiting
- Debug panel included

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

|                     | Anonymous Chat | Clerk Minimal       | Auth0 Authenticated    |
| ------------------- | -------------- | ------------------- | ---------------------- |
| **Setup**           | None           | Clerk account       | Auth0 account + API    |
| **Backend config**  | None           | None (zero-config!) | None (auto-discovery!) |
| **Best for**        | Prototypes     | Getting started     | Production             |
| **User tracking**   | Per session    | Per user            | Per user               |
| **Rate limits**     | Basic          | Per-user            | Per-user customizable  |
| **Code complexity** | Minimal        | Minimal (~80 lines) | Advanced               |

## Troubleshooting

**Backend issues?**

- Set AI provider keys in `apps/backend-api/.env`
- Backend must be running: `pnpm dev`

**Port conflicts?**

- Anonymous: http://localhost:5173
- Clerk Minimal: http://localhost:3001
- Auth0: http://localhost:5174
