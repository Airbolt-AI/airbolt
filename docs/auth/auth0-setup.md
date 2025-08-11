# Auth0 Authentication Setup Guide

This guide walks you through integrating Auth0 authentication with Airbolt. Auth0 is an enterprise-grade identity platform that provides comprehensive authentication and authorization services.

## Why Choose Auth0?

### Benefits

- **Enterprise-ready**: Battle-tested in production environments
- **Extensive integrations**: Connects with hundreds of identity providers
- **Compliance ready**: SOC 2, GDPR, HIPAA compliance features
- **Advanced security**: Anomaly detection, brute force protection
- **Scalable**: Handles millions of users and authentications
- **Flexible**: Supports any tech stack and authentication flow

### Best For

- Enterprise applications with complex auth requirements
- Applications needing social login providers
- Companies with existing SSO infrastructure
- Applications requiring compliance certifications
- Multi-tenant applications
- APIs needing fine-grained access control

### Use Cases

- B2B SaaS with enterprise SSO
- Consumer apps with social login
- APIs with complex authorization rules
- Applications requiring audit trails
- Multi-region deployments
- Applications needing customizable login flows

## Prerequisites

- Node.js 18 or later
- An Auth0 account (free tier available)
- Basic understanding of OAuth 2.0 and JWT tokens
- 15 minutes for initial setup

## Step 1: Create Auth0 Application

### 1.1 Sign Up for Auth0

1. Visit [auth0.com](https://auth0.com)
2. Click **"Sign Up"** and choose your plan (free tier available)
3. Complete registration and verify your email
4. Choose your region for data residency

### 1.2 Create a Single Page Application

1. From the Auth0 Dashboard, navigate to **"Applications"**
2. Click **"Create Application"**
3. Configure your application:
   - **Name**: `Airbolt Chat App` (or your preferred name)
   - **Application Type**: **Single Page Application** (SPA)
4. Click **"Create"**

[Screenshot Description: Auth0 Dashboard showing "Create Application" dialog with SPA option selected]

### 1.3 Configure Application Settings

1. In your application's **"Settings"** tab, configure:
   - **Allowed Callback URLs**: `http://localhost:5173/callback,http://localhost:3000/callback`
   - **Allowed Logout URLs**: `http://localhost:5173,http://localhost:3000`
   - **Allowed Web Origins**: `http://localhost:5173,http://localhost:3000`
   - **Allowed Origins (CORS)**: `http://localhost:5173,http://localhost:3000`
2. Click **"Save Changes"**

### 1.4 Note Your Credentials

From the **"Settings"** tab, copy these values:

- **Domain**: `your-tenant.auth0.com`
- **Client ID**: `your_client_id_here`

[Screenshot Description: Auth0 Application Settings page with Domain and Client ID highlighted]

## Step 2: Create Auth0 API (Critical for JWT Validation)

**⚠️ Important**: This step is required for local JWT validation. Without an API audience, Auth0 returns opaque tokens that require network calls for validation.

### 2.1 Create API

1. Navigate to **"APIs"** in the Auth0 Dashboard
2. Click **"Create API"**
3. Configure your API:
   - **Name**: `Airbolt API`
   - **Identifier**: `https://airbolt-api` (this becomes your audience claim)
   - **Signing Algorithm**: **RS256**
4. Click **"Create"**

### 2.2 Configure API Settings

1. In the API's **"Settings"** tab:
   - **Token Expiration**: Set to `86400` (24 hours) for development
   - **Allow Skipping User Consent**: Enabled (for your own application)
   - **Allow Offline Access**: Enabled if you need refresh tokens
2. Click **"Save"**

[Screenshot Description: Auth0 API creation form with identifier and RS256 algorithm highlighted]

## Step 3: Frontend Integration

### 3.1 Install Auth0 SDK

```bash
# For React applications
npm install @auth0/auth0-react

# For vanilla JavaScript or other frameworks
npm install @auth0/auth0-spa-js
```

### 3.2 Configure Environment Variables

Create or update your `.env` file:

```bash
# Frontend environment variables (.env or .env.local)
VITE_AUTH0_DOMAIN=your-tenant.auth0.com
VITE_AUTH0_CLIENT_ID=your_client_id_here
VITE_AUTH0_AUDIENCE=https://airbolt-api        # REQUIRED: Must match API identifier
VITE_AIRBOLT_API_URL=http://localhost:3000     # Your Airbolt backend URL
```

### 3.3 Configure Auth0 Provider (React)

```tsx
// src/main.tsx or src/App.tsx
import { Auth0Provider } from '@auth0/auth0-react';
import { ChatWidget } from '@airbolt/react';

const domain = import.meta.env.VITE_AUTH0_DOMAIN!;
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID!;
const audience = import.meta.env.VITE_AUTH0_AUDIENCE!;

function App() {
  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: audience, // CRITICAL: Required for JWT validation
      }}
    >
      <MainApp />
    </Auth0Provider>
  );
}

function MainApp() {
  const { isAuthenticated, isLoading, loginWithRedirect, logout } = useAuth0();

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      {!isAuthenticated ? (
        <div className="login-page">
          <h1>Welcome to Airbolt Chat</h1>
          <button onClick={loginWithRedirect}>Sign In with Auth0</button>
        </div>
      ) : (
        <div className="chat-page">
          <div className="header">
            <h1>Airbolt Chat</h1>
            <button
              onClick={() =>
                logout({
                  logoutParams: { returnTo: window.location.origin },
                })
              }
            >
              Sign Out
            </button>
          </div>

          {/* ChatWidget automatically detects Auth0 */}
          <ChatWidget />
        </div>
      )}
    </div>
  );
}
```

### 3.4 Zero-Config Airbolt Integration

**No additional configuration needed!** The ChatWidget automatically:

- Detects when Auth0 is available (`window.auth0`)
- Retrieves access tokens using `getAccessTokenSilently()`
- Includes tokens in API requests with proper audience
- Falls back to anonymous mode if not authenticated

## Step 4: Backend Configuration

### 4.1 Development Mode (Zero Config)

For development, no backend configuration is required! Airbolt automatically validates Auth0 tokens from any tenant.

Start your Airbolt backend:

```bash
cd apps/backend-api
pnpm dev
```

You'll see:

```
ℹ️  Auth mode: development (zero-config)
⚠️  Accepting JWT from any Auth0 tenant. For production, configure AUTH0_DOMAIN.
```

### 4.2 Production Configuration

For production security, configure your backend to only accept tokens from YOUR Auth0 tenant.

Create `.env` in your backend directory:

```bash
# Backend environment variables for production
NODE_ENV=production
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=https://airbolt-api         # Must match frontend audience
AUTH0_ISSUER=https://your-tenant.auth0.com/  # Optional: computed from domain

# JWT configuration for Airbolt's session tokens
JWT_SECRET=$(openssl rand -base64 64)      # Generate a secure secret
JWT_EXPIRES_IN=10m                         # Session token expiry
JWT_ALGORITHM=HS256                        # Signing algorithm

# Rate limiting
AUTH_RATE_LIMIT_MAX=10                     # Max auth requests per window
AUTH_RATE_LIMIT_WINDOW_MS=900000           # 15 minutes in milliseconds
```

### 4.3 Environment Variable Reference

| Variable              | Required   | Description                                      | Example                                 |
| --------------------- | ---------- | ------------------------------------------------ | --------------------------------------- |
| `AUTH0_DOMAIN`        | Production | Your Auth0 tenant domain                         | `your-tenant.auth0.com`                 |
| `AUTH0_AUDIENCE`      | Optional   | API identifier for audience validation           | `https://airbolt-api`                   |
| `AUTH0_ISSUER`        | Optional   | Token issuer (computed from domain if not set)   | `https://your-tenant.auth0.com/`        |
| `JWT_SECRET`          | Required   | Secret for Airbolt session tokens (min 32 chars) | Generate with `openssl rand -base64 64` |
| `JWT_EXPIRES_IN`      | Optional   | Session token expiry                             | `10m` (default)                         |
| `AUTH_RATE_LIMIT_MAX` | Optional   | Max auth requests per window                     | `10` (default)                          |

## Step 5: Testing Your Integration

### 5.1 Basic Authentication Flow

1. Start backend: `pnpm dev` (in `apps/backend-api`)
2. Start frontend: `pnpm dev` (in your app directory)
3. Open your app in browser
4. Click "Sign In with Auth0"
5. Complete Auth0 authentication flow
6. Verify you're redirected back and see chat interface

### 5.2 Token Validation Test

Manually test the authentication:

```bash
# Get access token from browser console:
# After auth: window.auth0.getAccessTokenSilently().then(console.log)
# Copy the token, then test:

curl -X POST http://localhost:3000/api/auth/exchange \
  -H "Content-Type: application/json" \
  -d '{"providerToken": "YOUR_AUTH0_ACCESS_TOKEN_HERE"}'

# Expected response:
# {"sessionToken": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."}
```

### 5.3 Chat API Test

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello from Auth0 user!"}'

# Expected response:
# {"response": "Hello! I can see you're authenticated via Auth0..."}
```

### 5.4 Verify JWT Structure

```bash
# Check that your token has the correct audience claim
node -e "
const token = 'YOUR_ACCESS_TOKEN_HERE'
const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
console.log('Audience:', payload.aud)
console.log('Issuer:', payload.iss)
console.log('Subject:', payload.sub)
"
```

## Step 6: Advanced Configuration

### 6.1 Custom Scopes and Claims

Add custom claims to your tokens:

1. In Auth0 Dashboard, go to **"Auth Pipeline"** → **"Rules"**
2. Create a new rule:

```javascript
function addCustomClaims(user, context, callback) {
  const namespace = 'https://airbolt-api/';

  context.accessToken[namespace + 'role'] = user.app_metadata?.role || 'user';
  context.accessToken[namespace + 'plan'] = user.user_metadata?.plan || 'free';

  callback(null, user, context);
}
```

3. Save and enable the rule

### 6.2 Social Connections

Enable social login providers:

1. Go to **"Authentication"** → **"Social"**
2. Enable desired providers (Google, GitHub, LinkedIn, etc.)
3. Configure OAuth credentials for each provider
4. Test social login flows

### 6.3 Enterprise Connections

For enterprise SSO:

1. Go to **"Authentication"** → **"Enterprise"**
2. Choose connection type (SAML, AD/LDAP, Azure AD, etc.)
3. Configure connection settings
4. Test with enterprise credentials

### 6.4 Multi-Factor Authentication

Enable MFA:

1. Go to **"Security"** → **"Multi-factor Auth"**
2. Enable desired factors (SMS, TOTP, Push, etc.)
3. Configure MFA policies and rules
4. Test MFA flow

## Common Issues and Solutions

### Issue: "Auth0 token is opaque (no audience)" Error

**Symptoms**: Error message about opaque tokens, authentication fails

**Cause**: Frontend not configured with audience, Auth0 returns opaque access tokens

**Solution**:

1. Ensure `VITE_AUTH0_AUDIENCE` is set in frontend environment
2. Verify audience value matches your Auth0 API identifier
3. Check that `authorizationParams.audience` is passed to Auth0Provider

```tsx
// ✅ Correct: Include audience in Auth0Provider
<Auth0Provider
  domain={domain}
  clientId={clientId}
  authorizationParams={{
    redirect_uri: window.location.origin,
    audience: 'https://airbolt-api'  // REQUIRED
  }}
>
```

### Issue: "Invalid audience" JWT validation error

**Symptoms**: 401 errors, JWT audience validation failures

**Cause**: Backend audience configuration doesn't match frontend

**Solution**:

1. Verify `AUTH0_AUDIENCE` in backend matches frontend `VITE_AUTH0_AUDIENCE`
2. Check Auth0 API identifier matches both configurations
3. Ensure audience claim exists in JWT token

```bash
# Debug: Check token audience
node -e "
const token = 'YOUR_TOKEN'
const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64'))
console.log('Token audience:', payload.aud)
"
```

### Issue: "No token returned from auth provider"

**Symptoms**: ChatWidget shows authentication errors

**Cause**: Auth0 SDK not properly initialized or user not authenticated

**Solution**:

1. Check Auth0Provider is properly configured
2. Ensure user has completed authentication flow
3. Verify domain and clientId are correct
4. Check browser network tab for Auth0 API errors

### Issue: CORS errors with Auth0

**Symptoms**: Browser console shows CORS errors when communicating with Auth0

**Cause**: Auth0 application settings don't include your domain

**Solution**:

1. In Auth0 Dashboard, update application settings:
   - **Allowed Web Origins**: Add your frontend URL
   - **Allowed Origins (CORS)**: Add your frontend URL
2. Include both development and production URLs

### Issue: Token refresh failures

**Symptoms**: Authentication works initially but fails after token expires

**Cause**: Token expiration without proper refresh handling

**Solution**:

```tsx
// ✅ Proper token refresh handling
import { useAuth0 } from '@auth0/auth0-react';

function ChatInterface() {
  const { getAccessTokenSilently } = useAuth0();

  const handleApiCall = async () => {
    try {
      const token = await getAccessTokenSilently({
        audience: 'https://airbolt-api',
        scope: 'read:messages write:messages',
      });
      // Use fresh token for API call
    } catch (error) {
      console.error('Token refresh failed:', error);
      // Handle refresh failure (redirect to login, show error, etc.)
    }
  };
}
```

### Issue: "Invalid issuer" in production

**Symptoms**: Tokens work in development but fail in production

**Cause**: Production configuration mismatch

**Solution**:

1. Verify `AUTH0_DOMAIN` matches your Auth0 tenant
2. Check `AUTH0_ISSUER` includes trailing slash if set manually
3. Ensure production environment variables are loaded correctly

## Production Checklist

### Security Configuration

- [ ] **Auth0 domain configured**: Backend restricted to your tenant
- [ ] **Audience validation enabled**: Prevents token misuse
- [ ] **Environment variables secured**: No secrets in client-side code
- [ ] **JWT_SECRET generated**: Use `openssl rand -base64 64`
- [ ] **HTTPS enforced**: TLS termination configured
- [ ] **Rate limiting configured**: Appropriate limits for your traffic
- [ ] **CORS properly configured**: Frontend domains in Auth0 settings

### Auth0 Application Security

- [ ] **Application URLs updated**: Production domains in callback/logout URLs
- [ ] **Token lifetime configured**: Appropriate expiration for your use case
- [ ] **Advanced settings reviewed**: Grant types, OIDC conformance
- [ ] **Allowed origins set**: CORS origins match your frontend domains

### Monitoring and Maintenance

- [ ] **Auth0 logs configured**: Monitor authentication events
- [ ] **Anomaly detection enabled**: Auth0's built-in security features
- [ ] **Rate limiting configured**: Auth0 and Airbolt rate limits
- [ ] **Health checks implemented**: Monitor Auth0 service availability
- [ ] **Backup authentication**: Consider fallback for critical apps

### Performance Optimization

- [ ] **Token caching configured**: Auth0 SDK handles this automatically
- [ ] **JWKS caching optimized**: Backend caches keys for 24 hours
- [ ] **Connection pooling**: Efficient HTTPS connections to Auth0
- [ ] **CDN integration**: Serve static assets from CDN

## Example Code Repository

See the complete working example at:

```
/examples/auth0-authenticated/
```

This includes:

- Complete React setup with Auth0
- Debug panel showing token information
- Zero-config development integration
- Production configuration examples
- Error handling and troubleshooting tools

## Advanced Topics

### Custom Domains

Configure custom domains for Auth0:

1. In Auth0 Dashboard, go to **"Branding"** → **"Custom Domains"**
2. Add your custom domain (e.g., `auth.yourdomain.com`)
3. Complete domain verification
4. Update frontend configuration to use custom domain

### Passwordless Authentication

Enable passwordless login:

1. Go to **"Authentication"** → **"Passwordless"**
2. Enable Email or SMS passwordless
3. Customize email/SMS templates
4. Configure frontend for passwordless flow

### Machine-to-Machine Applications

For backend services that need Auth0 tokens:

1. Create **"Machine to Machine"** application
2. Configure API access and scopes
3. Use client credentials flow for authentication

```bash
# Get M2M token
curl -X POST https://your-tenant.auth0.com/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "your_m2m_client_id",
    "client_secret": "your_m2m_client_secret",
    "audience": "https://airbolt-api",
    "grant_type": "client_credentials"
  }'
```

### Organizations (Auth0 Organizations)

For multi-tenant applications:

1. Enable Organizations in Auth0 Dashboard
2. Create organizations for your tenants
3. Configure organization-specific branding and connections
4. Update frontend to handle organization context

```tsx
// Organization-aware Auth0Provider
<Auth0Provider
  domain={domain}
  clientId={clientId}
  authorizationParams={{
    redirect_uri: window.location.origin,
    audience: audience,
    organization: 'org_xxxxx'  // Specific organization
  }}
>
```

### Actions (Replacing Rules)

Modern approach using Auth0 Actions:

1. Go to **"Actions"** → **"Flows"**
2. Create custom actions for login, pre-user registration, etc.
3. Use modern JavaScript runtime with npm packages
4. Better debugging and testing capabilities

```javascript
// Example Login Action
exports.onExecutePostLogin = async (event, api) => {
  const namespace = 'https://airbolt-api/';

  if (event.user.app_metadata?.role) {
    api.accessToken.setCustomClaim(
      namespace + 'role',
      event.user.app_metadata.role
    );
  }

  // Add organization info
  if (event.organization) {
    api.accessToken.setCustomClaim(namespace + 'org', event.organization.name);
  }
};
```

## Resources and Next Steps

### Documentation

- [Auth0 Documentation](https://auth0.com/docs)
- [Auth0 React SDK](https://auth0.com/docs/libraries/auth0-react)
- [Auth0 SPA SDK](https://auth0.com/docs/libraries/auth0-spa-js)
- [JWT Best Practices](https://auth0.com/blog/a-look-at-the-latest-draft-for-jwt-bcp/)

### Community and Support

- [Auth0 Community](https://community.auth0.com/)
- [Auth0 Support](https://support.auth0.com/)
- [GitHub Discussions](https://github.com/auth0/auth0-spa-js/discussions)

### Monitoring and Analytics

- [Auth0 Dashboard Analytics](https://manage.auth0.com/#/analytics)
- [Custom Analytics with Auth0 Logs API](https://auth0.com/docs/api/management/v2#!/Logs)
- [Integration with monitoring tools](https://auth0.com/docs/monitoring)

### Next Steps

1. **Customize branding**: Match Auth0 login pages to your brand
2. **Add social providers**: Enable additional login options
3. **Implement organization support**: Multi-tenant features
4. **Set up monitoring**: Track authentication health and usage
5. **Configure advanced security**: Anomaly detection, bot detection
6. **Plan for compliance**: GDPR, SOC 2, other requirements

## Support

If you encounter issues with your Auth0 integration:

1. **Check the example**: `/examples/auth0-authenticated/` has complete working code
2. **Review Auth0 logs**: Check Auth0 Dashboard logs for authentication errors
3. **Debug tokens**: Use JWT.io to inspect token structure and claims
4. **Verify configuration**: Double-check environment variables and Auth0 settings
5. **Auth0 support**: Use Auth0's support channels for provider-specific issues
6. **Airbolt support**: Report integration issues in our repository

With Auth0 configured, you have an enterprise-grade authentication system with comprehensive security features, perfect for production applications requiring robust authentication and authorization!
