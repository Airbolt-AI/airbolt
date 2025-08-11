# Clerk Authentication Setup Guide

This guide walks you through integrating Clerk authentication with Airbolt. Clerk provides a modern, developer-friendly authentication solution with zero-config development and robust production features.

## Why Choose Clerk?

### Benefits

- **Zero-config development**: Works immediately without backend setup
- **Modern UI components**: Pre-built sign-in/sign-up components
- **Comprehensive user management**: User profiles, organizations, sessions
- **Great developer experience**: Excellent documentation and TypeScript support
- **Flexible deployment**: Works with any frontend framework
- **Built-in security**: Multi-factor authentication, session management

### Best For

- New projects starting from scratch
- Applications needing rapid authentication setup
- Teams wanting modern, customizable auth UI
- Projects requiring user management features
- Applications needing organization/team features

### Use Cases

- SaaS applications with team collaboration
- Content platforms with user profiles
- E-commerce with user accounts
- Any application needing quick auth setup

## Prerequisites

- Node.js 18 or later
- A Clerk account (free tier available)
- Basic understanding of React/JavaScript
- 10 minutes for initial setup

## Step 1: Create a Clerk Application

### 1.1 Sign Up for Clerk

1. Visit [clerk.com](https://clerk.com)
2. Click **"Get Started Free"**
3. Sign up with your email or GitHub account
4. Verify your email if required

### 1.2 Create Your Application

1. From the Clerk Dashboard, click **"Add Application"**
2. Enter application details:
   - **Name**: `Airbolt Chat App` (or your preferred name)
   - **Environment**: Choose development to start
3. Click **"Create Application"**

### 1.3 Configure Application Settings

1. In your application dashboard, go to **"Settings"**
2. Under **"General"**, note your:
   - **Publishable Key**: `pk_test_...` (safe to use in frontend)
   - **Secret Key**: `sk_test_...` (keep secure, backend only)

[Screenshot Description: Clerk Dashboard showing API Keys section with publishable and secret keys highlighted]

## Step 2: Frontend Integration

### 2.1 Install Clerk SDK

```bash
npm install @clerk/nextjs
# OR for other frameworks
npm install @clerk/clerk-react
```

### 2.2 Configure Clerk Provider

Create or update your `.env.local` file:

```bash
# Frontend environment variables
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
```

Wrap your app with ClerkProvider:

```tsx
// app/layout.tsx (Next.js App Router)
import { ClerkProvider } from '@clerk/nextjs';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
```

Or for React:

```tsx
// src/main.tsx or src/App.tsx
import { ClerkProvider } from '@clerk/clerk-react';

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function App() {
  return (
    <ClerkProvider publishableKey={clerkPubKey}>
      {/* Your app components */}
    </ClerkProvider>
  );
}
```

### 2.3 Add Authentication Components

```tsx
import { SignIn, SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import { ChatWidget } from '@airbolt/react';

export default function HomePage() {
  return (
    <div>
      <SignedOut>
        <SignIn />
      </SignedOut>

      <SignedIn>
        <div className="header">
          <h1>Welcome to Airbolt Chat</h1>
          <UserButton />
        </div>

        {/* ChatWidget automatically detects Clerk authentication */}
        <ChatWidget />
      </SignedIn>
    </div>
  );
}
```

### 2.4 Zero-Config Airbolt Integration

**No additional configuration needed!** The ChatWidget automatically:

- Detects when Clerk is available (`window.Clerk`)
- Retrieves tokens using `Clerk.session.getToken()`
- Includes tokens in API requests
- Falls back to anonymous mode if not signed in

## Step 3: Backend Configuration

### 3.1 Development Mode (Zero Config)

For development, no backend configuration is required! Airbolt automatically validates Clerk tokens.

Start your Airbolt backend:

```bash
cd apps/backend-api
pnpm dev
```

You'll see a log message:

```
ℹ️  Auth mode: development (zero-config)
⚠️  Accepting JWT from any recognized provider. For production, configure specific providers.
```

### 3.2 Production Configuration

For production security, configure your backend to only accept tokens from YOUR Clerk instance.

Create `.env` in your backend directory:

```bash
# Backend environment variables for production
NODE_ENV=production
CLERK_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
CLERK_SECRET_KEY=sk_test_your_secret_key_here

# Optional: Restrict token audiences (domains that can use tokens)
CLERK_AUTHORIZED_PARTIES=localhost:3000,yourdomain.com

# JWT configuration for Airbolt's session tokens
JWT_SECRET=$(openssl rand -base64 64)  # Generate a secure secret
JWT_EXPIRES_IN=10m                     # Session token expiry
JWT_ALGORITHM=HS256                    # Signing algorithm

# Rate limiting
AUTH_RATE_LIMIT_MAX=10                 # Max auth requests per window
AUTH_RATE_LIMIT_WINDOW_MS=900000       # 15 minutes in milliseconds
```

### 3.3 Environment Variable Details

| Variable                   | Required   | Description                                      | Example                                 |
| -------------------------- | ---------- | ------------------------------------------------ | --------------------------------------- |
| `CLERK_PUBLISHABLE_KEY`    | Production | Your Clerk publishable key                       | `pk_test_...`                           |
| `CLERK_SECRET_KEY`         | Production | Your Clerk secret key (backend only)             | `sk_test_...`                           |
| `CLERK_AUTHORIZED_PARTIES` | Optional   | Comma-separated domains that can use tokens      | `localhost:3000,app.com`                |
| `JWT_SECRET`               | Required   | Secret for Airbolt session tokens (min 32 chars) | Generate with `openssl rand -base64 64` |
| `JWT_EXPIRES_IN`           | Optional   | Session token expiry                             | `10m` (default)                         |
| `AUTH_RATE_LIMIT_MAX`      | Optional   | Max auth requests per window                     | `10` (default)                          |

## Step 4: Testing Your Integration

### 4.1 Basic Authentication Test

1. Start your backend: `pnpm dev` (in `apps/backend-api`)
2. Start your frontend: `pnpm dev` (in your app directory)
3. Open your app in the browser
4. Click sign in and complete Clerk authentication
5. Verify you see the chat interface

### 4.2 Token Exchange Test

Test the authentication flow manually:

```bash
# First, get a Clerk token from your browser's developer tools
# In Console: await window.Clerk.session.getToken()
# Copy the token, then test:

curl -X POST http://localhost:3000/api/auth/exchange \
  -H "Content-Type: application/json" \
  -d '{"providerToken": "YOUR_CLERK_TOKEN_HERE"}'

# Expected response:
# {"sessionToken": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."}
```

### 4.3 Chat API Test

Test chat with the session token:

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello from authenticated user!"}'

# Expected response:
# {"response": "Hello! I can see you're authenticated..."}
```

## Step 5: Advanced Configuration

### 5.1 Custom Token Claims

If you need additional user data in tokens, configure Clerk's JWT template:

1. In Clerk Dashboard, go to **"JWT Templates"**
2. Create a new template or edit the default
3. Add custom claims:

```json
{
  "sub": "{{user.id}}",
  "email": "{{user.primary_email_address.email_address}}",
  "name": "{{user.first_name}} {{user.last_name}}",
  "custom_role": "{{user.public_metadata.role}}"
}
```

### 5.2 Organization Support

If using Clerk organizations:

```bash
# Add to backend .env
CLERK_AUTHORIZED_PARTIES=localhost:3000,yourdomain.com
```

Frontend organization handling:

```tsx
import { useOrganization } from '@clerk/nextjs';

function ChatInterface() {
  const { organization } = useOrganization();

  return (
    <ChatWidget
      // Airbolt automatically includes organization context
      className="org-chat"
    />
  );
}
```

### 5.3 Development vs Production Domains

Configure different domains for different environments:

**Development**:

```bash
CLERK_PUBLISHABLE_KEY=pk_test_development_key
CLERK_AUTHORIZED_PARTIES=localhost:3000,localhost:5173
```

**Production**:

```bash
CLERK_PUBLISHABLE_KEY=pk_live_production_key
CLERK_AUTHORIZED_PARTIES=yourdomain.com,api.yourdomain.com
```

## Common Issues and Solutions

### Issue: "Clerk not detected" in ChatWidget

**Symptoms**: ChatWidget shows "No authentication provider detected"

**Cause**: Clerk SDK not properly initialized or ChatWidget loading before Clerk

**Solutions**:

1. Ensure Clerk provider wraps your app
2. Verify publishable key is set correctly
3. Check browser console for Clerk initialization errors
4. Make sure user is signed in (use `<SignedIn>` component)

```tsx
// ✅ Correct: ChatWidget inside SignedIn
<SignedIn>
  <ChatWidget />
</SignedIn>

// ❌ Incorrect: ChatWidget outside auth context
<ChatWidget />
<SignedIn>
  <div>User content</div>
</SignedIn>
```

### Issue: "Invalid JWT signature" in backend

**Symptoms**: 401 errors when exchanging tokens

**Cause**: Token signature verification failing

**Solutions**:

1. Check that backend has correct Clerk configuration
2. Verify token is fresh (not expired)
3. Ensure no typos in environment variables
4. Check Clerk dashboard for API key issues

```bash
# Debug: Verify JWKS endpoint is accessible
curl https://clerk.your-domain.com/.well-known/jwks.json

# Should return JSON with signing keys
```

### Issue: "Unauthorized" errors in production

**Symptoms**: Tokens work in development but fail in production

**Cause**: Production environment restrictions

**Solutions**:

1. Verify `NODE_ENV=production` is set
2. Check `CLERK_PUBLISHABLE_KEY` matches your production app
3. Ensure `CLERK_SECRET_KEY` is set in production environment
4. Verify domain is in `CLERK_AUTHORIZED_PARTIES`

### Issue: Token refresh issues

**Symptoms**: Authentication works initially but fails after some time

**Cause**: Token expiration without proper refresh

**Solutions**:

1. Clerk automatically handles token refresh
2. Ensure your app doesn't cache expired tokens
3. Implement proper error handling for token refresh failures

```tsx
// ✅ Proper error handling
import { useAuth } from '@clerk/nextjs';

function ChatInterface() {
  const { getToken } = useAuth();

  const handleApiCall = async () => {
    try {
      const token = await getToken();
      // API call with fresh token
    } catch (error) {
      // Handle token refresh failure
      console.error('Token refresh failed:', error);
    }
  };
}
```

### Issue: Rate limiting in development

**Symptoms**: "Rate limit exceeded" errors during testing

**Cause**: Development hitting rate limits during testing

**Solutions**:

1. Rate limiting is disabled in development by default
2. Check `NODE_ENV` is not set to 'production'
3. Increase rate limits if needed for testing

```bash
# Increase rate limits for testing
AUTH_RATE_LIMIT_MAX=100
AUTH_RATE_LIMIT_WINDOW_MS=60000  # 1 minute window
```

## Production Checklist

### Security Configuration

- [ ] **Environment variables secured**: No secrets in client-side code
- [ ] **CLERK_SECRET_KEY set**: Backend environment only
- [ ] **Authorized parties configured**: Restrict token usage to your domains
- [ ] **JWT_SECRET generated**: Use `openssl rand -base64 64`
- [ ] **HTTPS enforced**: TLS termination configured
- [ ] **Rate limiting configured**: Appropriate limits for your traffic

### Performance Optimization

- [ ] **Token caching**: Clerk handles this automatically
- [ ] **JWKS caching**: Backend caches for 24 hours by default
- [ ] **Session management**: Configure appropriate session timeouts
- [ ] **CDN integration**: Use CDN for static assets if needed

### Monitoring and Maintenance

- [ ] **Audit logging enabled**: Authentication events logged
- [ ] **Error tracking**: Monitor authentication failures
- [ ] **Token rotation**: Clerk handles key rotation automatically
- [ ] **Backup authentication**: Consider fallback for critical apps
- [ ] **User support**: Document sign-in process for users

### Testing

- [ ] **Authentication flow tested**: Complete sign-in/sign-out process
- [ ] **Token exchange verified**: Backend properly validates tokens
- [ ] **Rate limiting tested**: Verify limits work as expected
- [ ] **Error handling tested**: Proper error messages and recovery
- [ ] **Cross-browser testing**: Ensure compatibility across browsers

## Example Code Repository

See the complete working example at:

```
/examples/clerk-authenticated/
```

This includes:

- Complete frontend setup with Clerk
- Zero-config development integration
- Production configuration examples
- Error handling and debugging tools

## Advanced Topics

### Custom Session Length

Configure Clerk session duration:

1. In Clerk Dashboard, go to **"Sessions"**
2. Set **"Maximum session duration"** as needed
3. Configure **"Inactivity timeout"** for security

### Multi-Factor Authentication

Enable MFA in Clerk Dashboard:

1. Go to **"Authentication"** → **"Multi-factor"**
2. Enable desired MFA methods (SMS, TOTP, etc.)
3. Configure enforcement rules

### Social Login Providers

Add social providers in Clerk Dashboard:

1. Go to **"Authentication"** → **"Social providers"**
2. Enable desired providers (Google, GitHub, etc.)
3. Configure OAuth credentials for each provider

### Webhooks

Set up webhooks for user events:

1. Go to **"Webhooks"** in Clerk Dashboard
2. Add endpoint URL: `https://yourapi.com/webhooks/clerk`
3. Select events to monitor (user.created, user.updated, etc.)
4. Implement webhook handler in your backend

```typescript
// Example webhook handler
app.post('/webhooks/clerk', (req, res) => {
  const { type, data } = req.body;

  switch (type) {
    case 'user.created':
      // Handle new user registration
      break;
    case 'user.updated':
      // Handle user profile updates
      break;
  }

  res.json({ received: true });
});
```

## Resources and Next Steps

### Documentation

- [Clerk Documentation](https://clerk.com/docs)
- [Clerk React SDK Reference](https://clerk.com/docs/references/react/overview)
- [JWT Template Guide](https://clerk.com/docs/backend-requests/making/jwt-templates)

### Community

- [Clerk Discord](https://discord.com/invite/clerk)
- [GitHub Discussions](https://github.com/clerkinc/javascript/discussions)
- [Twitter Support](https://twitter.com/ClerkDev)

### Next Steps

1. **Customize UI**: Use Clerk components to match your brand
2. **Add organization support**: Enable team/organization features
3. **Implement webhooks**: Sync user data with your database
4. **Set up monitoring**: Track authentication health and usage
5. **Plan for scale**: Configure appropriate rate limits and caching

## Support

If you encounter issues with your Clerk integration:

1. **Check the example**: `/examples/clerk-authenticated/` has working code
2. **Review logs**: Check both frontend console and backend logs
3. **Verify configuration**: Use the troubleshooting section above
4. **Clerk support**: Use Clerk's support channels for provider-specific issues
5. **Airbolt support**: Report integration issues in our repository

With Clerk configured, you now have a secure, scalable authentication system integrated with Airbolt! The zero-config development experience makes it perfect for rapid prototyping, while the production configuration ensures enterprise-level security.
