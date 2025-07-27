# Airbolt Examples

Working examples showing how to integrate Airbolt into your apps.

## Available Examples

### 🚀 [Anonymous Chat](./anonymous-chat)

**The simplest integration** - no auth setup required

- Zero configuration
- Start chatting immediately
- Perfect for prototypes

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
   cd examples/anonymous-chat  # or auth0-authenticated
   pnpm install
   pnpm dev
   ```

## Which Example Should I Use?

|                    | Anonymous Chat | Auth0 Authenticated    |
| ------------------ | -------------- | ---------------------- |
| **Setup**          | None           | Auth0 account + API    |
| **Backend config** | None           | None (auto-discovery!) |
| **Best for**       | Prototypes     | Production             |
| **User tracking**  | Per session    | Per user               |
| **Rate limits**    | Basic          | Per-user customizable  |

## Troubleshooting

**Backend issues?**

- Set AI provider keys in `apps/backend-api/.env`
- Backend must be running: `pnpm dev`

**Port conflicts?**

- Anonymous: http://localhost:5173
- Auth0: http://localhost:5174
