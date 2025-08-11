# Supabase Authentication Setup Guide

This guide walks you through integrating Supabase authentication with Airbolt. Supabase provides a complete backend-as-a-service with PostgreSQL database, real-time features, and built-in authentication.

## Why Choose Supabase?

### Benefits

- **Complete backend solution**: Database + Auth + Real-time + Storage
- **PostgreSQL-based**: Full SQL database with advanced features
- **Real-time capabilities**: Live updates and subscriptions
- **Developer-friendly**: Excellent TypeScript support and tooling
- **Open source**: Self-hostable, no vendor lock-in
- **Built-in security**: Row Level Security (RLS) and comprehensive auth

### Best For

- Full-stack applications needing a database
- Projects requiring real-time features
- Teams wanting rapid backend development
- Applications needing complex data relationships
- Projects requiring offline-first capabilities
- Startups needing cost-effective scaling

### Use Cases

- Social media platforms with real-time feeds
- Collaborative applications (docs, whiteboards)
- E-commerce with inventory management
- Content management systems
- IoT dashboards with real-time data
- Multi-user applications with complex permissions

## Prerequisites

- Node.js 18 or later
- A Supabase account (free tier available)
- Basic understanding of SQL and PostgreSQL
- 10 minutes for initial setup

## Step 1: Create Supabase Project

### 1.1 Sign Up for Supabase

1. Visit [supabase.com](https://supabase.com)
2. Click **"Start your project"**
3. Sign up with GitHub, Google, or email
4. Verify your email if required

### 1.2 Create New Project

1. From the Supabase Dashboard, click **"New Project"**
2. Choose or create an organization
3. Configure your project:
   - **Name**: `Airbolt Chat App` (or your preferred name)
   - **Database Password**: Generate a strong password (save this!)
   - **Region**: Choose closest to your users
   - **Pricing Plan**: Free tier for development
4. Click **"Create new project"**

Project creation takes 1-2 minutes to provision the database.

[Screenshot Description: Supabase project creation form with name, password, and region fields highlighted]

### 1.3 Configure Authentication Settings

1. Once project is ready, go to **"Authentication"** → **"Settings"**
2. In **"General settings"**:
   - **Site URL**: `http://localhost:3000` (for development)
   - **Additional Redirect URLs**: `http://localhost:5173,http://localhost:3000`
3. Under **"Email Auth"**:
   - **Enable email confirmations**: Disabled for development
   - **Enable email change confirmations**: Disabled for development
4. Click **"Save"**

## Step 2: Get Supabase Credentials

### 2.1 API Keys

1. Navigate to **"Settings"** → **"API"**
2. Copy these values:
   - **Project URL**: `https://your-project.supabase.co`
   - **Project API keys**:
     - **anon public**: Safe for client-side use
     - **service_role**: Server-side only, full access
3. Note the **JWT Settings**:
   - **JWT Secret**: Used for token validation (keep secure!)

[Screenshot Description: Supabase API settings page showing Project URL, anon key, and JWT secret]

### 2.2 Database Connection (Optional)

If you need direct database access:

1. Go to **"Settings"** → **"Database"**
2. Copy connection string and database password
3. Use for server-side database operations

## Step 3: Frontend Integration

### 3.1 Install Supabase SDK

```bash
npm install @supabase/supabase-js
```

### 3.2 Configure Environment Variables

Create or update your `.env` file:

```bash
# Frontend environment variables (.env or .env.local)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_public_key_here
VITE_AIRBOLT_API_URL=http://localhost:3000
```

### 3.3 Initialize Supabase Client

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### 3.4 Create Authentication Component

```tsx
// src/components/Auth.tsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ChatWidget } from '@airbolt/react';
import type { User } from '@supabase/supabase-js';

export function Auth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('Check your email for confirmation link!');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => supabase.auth.signOut();

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {!user ? (
        <div className="auth-form">
          <h1>Welcome to Airbolt Chat</h1>
          <form onSubmit={handleAuth}>
            <input
              type="email"
              placeholder="Your email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            <button type="submit" disabled={loading}>
              {isSignUp ? 'Sign Up' : 'Sign In'}
            </button>
          </form>
          <p>
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button type="button" onClick={() => setIsSignUp(!isSignUp)}>
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </p>
        </div>
      ) : (
        <div className="chat-app">
          <div className="header">
            <h1>Welcome, {user.email}!</h1>
            <button onClick={handleSignOut}>Sign Out</button>
          </div>

          {/* ChatWidget automatically detects Supabase authentication */}
          <ChatWidget />
        </div>
      )}
    </div>
  );
}
```

### 3.5 Zero-Config Airbolt Integration

**No additional configuration needed!** The ChatWidget automatically:

- Detects when Supabase is available (`window.supabase` or Supabase client)
- Retrieves access tokens using `supabase.auth.getSession()`
- Includes tokens in API requests
- Falls back to anonymous mode if not authenticated

## Step 4: Backend Configuration

### 4.1 Development Mode (Zero Config)

For development, no backend configuration is required! Airbolt automatically validates Supabase tokens.

Start your Airbolt backend:

```bash
cd apps/backend-api
pnpm dev
```

You'll see:

```
ℹ️  Auth mode: development (zero-config)
⚠️  Accepting JWT from any recognized provider. For production, configure specific providers.
```

### 4.2 Production Configuration

For production security, configure your backend to only accept tokens from YOUR Supabase project.

Create `.env` in your backend directory:

```bash
# Backend environment variables for production
NODE_ENV=production
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_JWT_SECRET=your_jwt_secret_from_supabase_dashboard

# JWT configuration for Airbolt's session tokens
JWT_SECRET=$(openssl rand -base64 64)  # Generate a secure secret
JWT_EXPIRES_IN=10m                     # Session token expiry
JWT_ALGORITHM=HS256                    # Signing algorithm

# Rate limiting
AUTH_RATE_LIMIT_MAX=10                 # Max auth requests per window
AUTH_RATE_LIMIT_WINDOW_MS=900000       # 15 minutes in milliseconds
```

### 4.3 Environment Variable Reference

| Variable              | Required   | Description                                      | Example                                 |
| --------------------- | ---------- | ------------------------------------------------ | --------------------------------------- |
| `SUPABASE_URL`        | Production | Your Supabase project URL                        | `https://xxx.supabase.co`               |
| `SUPABASE_JWT_SECRET` | Production | JWT secret from Supabase API settings            | Long base64 string                      |
| `JWT_SECRET`          | Required   | Secret for Airbolt session tokens (min 32 chars) | Generate with `openssl rand -base64 64` |
| `JWT_EXPIRES_IN`      | Optional   | Session token expiry                             | `10m` (default)                         |
| `AUTH_RATE_LIMIT_MAX` | Optional   | Max auth requests per window                     | `10` (default)                          |

## Step 5: Testing Your Integration

### 5.1 Basic Authentication Flow

1. Start backend: `pnpm dev` (in `apps/backend-api`)
2. Start frontend: `pnpm dev` (in your app directory)
3. Open your app in browser
4. Create account or sign in with existing credentials
5. Verify you see the chat interface after authentication

### 5.2 Token Validation Test

```bash
# Get Supabase access token from browser console:
# supabase.auth.getSession().then(r => console.log(r.data.session.access_token))
# Copy the token, then test:

curl -X POST http://localhost:3000/api/auth/exchange \
  -H "Content-Type: application/json" \
  -d '{"providerToken": "YOUR_SUPABASE_ACCESS_TOKEN_HERE"}'

# Expected response:
# {"sessionToken": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."}
```

### 5.3 Chat API Test

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello from Supabase user!"}'

# Expected response:
# {"response": "Hello! I can see you're authenticated via Supabase..."}
```

### 5.4 Verify Token Structure

```bash
# Check Supabase token claims
node -e "
const token = 'YOUR_SUPABASE_TOKEN_HERE'
const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
console.log('Issuer:', payload.iss)
console.log('Subject (User ID):', payload.sub)
console.log('Email:', payload.email)
console.log('Role:', payload.role)
"
```

## Step 6: Advanced Configuration

### 6.1 Social Authentication

Enable social login providers:

1. In Supabase Dashboard, go to **"Authentication"** → **"Providers"**
2. Enable desired providers (Google, GitHub, Discord, etc.)
3. Configure OAuth credentials for each provider
4. Update frontend to use social auth:

```typescript
// Social login buttons
const signInWithGoogle = () => {
  supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
};

const signInWithGitHub = () => {
  supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
};
```

### 6.2 Row Level Security (RLS)

Implement database-level security:

1. In Supabase Dashboard, go to **"Database"** → **"Tables"**
2. Create your tables with RLS enabled
3. Add security policies:

```sql
-- Example: User-specific chat history table
CREATE TABLE chat_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  message TEXT NOT NULL,
  response TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own chat history
CREATE POLICY "Users can view own chat history"
ON chat_history FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can insert their own chat history
CREATE POLICY "Users can insert own chat history"
ON chat_history FOR INSERT
WITH CHECK (auth.uid() = user_id);
```

### 6.3 Real-time Features

Add real-time capabilities:

```typescript
// Listen to real-time changes
const [messages, setMessages] = useState([]);

useEffect(() => {
  if (!user) return;

  // Subscribe to new messages
  const channel = supabase
    .channel('chat_messages')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_history',
        filter: `user_id=eq.${user.id}`,
      },
      payload => {
        setMessages(current => [...current, payload.new]);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [user]);
```

### 6.4 Custom User Metadata

Store additional user information:

```typescript
// Update user profile
const updateProfile = async updates => {
  const { error } = await supabase.auth.updateUser({
    data: {
      full_name: updates.fullName,
      avatar_url: updates.avatarUrl,
      // Custom fields
      plan: updates.plan,
      preferences: updates.preferences,
    },
  });
  if (error) throw error;
};

// Access user metadata in your app
const {
  data: { user },
} = await supabase.auth.getUser();
console.log(user.user_metadata.full_name);
console.log(user.user_metadata.plan);
```

## Common Issues and Solutions

### Issue: "Invalid JWT signature" errors

**Symptoms**: 401 errors when exchanging tokens, JWT validation failures

**Cause**: Incorrect JWT secret configuration

**Solution**:

1. Verify `SUPABASE_JWT_SECRET` matches the JWT secret from Supabase Dashboard
2. Check **Settings** → **API** → **JWT Settings** in Supabase
3. Ensure no extra whitespace in environment variables

```bash
# Debug: Compare JWT secrets
echo "Backend JWT Secret: $SUPABASE_JWT_SECRET"
# Compare with Supabase Dashboard → Settings → API → JWT Secret
```

### Issue: "User not confirmed" errors

**Symptoms**: Sign-up works but users can't sign in

**Cause**: Email confirmation required but not completed

**Solution**:

1. For development, disable email confirmation:
   - Go to **Authentication** → **Settings**
   - Uncheck **"Enable email confirmations"**
2. For production, set up email templates and SMTP
3. Check spam folder for confirmation emails

### Issue: CORS errors with Supabase

**Symptoms**: Browser console shows CORS errors

**Cause**: Site URL not configured correctly

**Solution**:

1. In Supabase Dashboard, go to **Authentication** → **Settings**
2. Add your frontend URLs to:
   - **Site URL**: `http://localhost:3000`
   - **Additional Redirect URLs**: Include all development and production URLs
3. Restart your frontend after changes

### Issue: "Row Level Security policy violation"

**Symptoms**: Database operations fail with RLS errors

**Cause**: Missing or incorrect RLS policies

**Solution**:

1. Check if RLS is enabled on your tables
2. Verify policies allow the intended operations
3. Test policies with different user contexts:

```sql
-- Test RLS policy as specific user
SELECT auth.uid(); -- Current user ID
SELECT * FROM your_table; -- Test query
```

### Issue: Real-time subscriptions not working

**Symptoms**: No real-time updates received

**Cause**: Missing replication or incorrect channel configuration

**Solution**:

1. Enable replication on your tables:
   ```sql
   ALTER PUBLICATION supabase_realtime ADD TABLE your_table;
   ```
2. Check channel subscription filters
3. Verify user authentication before subscribing

### Issue: Social auth redirect issues

**Symptoms**: OAuth flow fails or redirects to wrong URL

**Cause**: Incorrect redirect URL configuration

**Solution**:

1. Update OAuth provider settings (Google, GitHub, etc.) with correct redirect URLs
2. Ensure redirect URLs match between provider and Supabase settings
3. Test redirect URLs are accessible

## Production Checklist

### Security Configuration

- [ ] **JWT secret configured**: Backend uses correct Supabase JWT secret
- [ ] **RLS enabled**: Database tables have appropriate security policies
- [ ] **Environment variables secured**: No secrets in client-side code
- [ ] **JWT_SECRET generated**: Use `openssl rand -base64 64`
- [ ] **HTTPS enforced**: TLS termination configured
- [ ] **Email confirmation enabled**: For production user verification
- [ ] **Rate limiting configured**: Both Supabase and Airbolt rate limits

### Database Security

- [ ] **Row Level Security policies**: Tested and verified
- [ ] **Database backups enabled**: Point-in-time recovery configured
- [ ] **Connection limits set**: Appropriate for your traffic
- [ ] **SSL enforcement enabled**: Database connections encrypted
- [ ] **Access controls configured**: Limited database access

### Performance Optimization

- [ ] **Database indexes created**: For frequently queried columns
- [ ] **Connection pooling configured**: Efficient database connections
- [ ] **Real-time subscriptions optimized**: Only necessary subscriptions
- [ ] **CDN configured**: Static assets served efficiently
- [ ] **Caching strategy implemented**: Reduce database load

### Monitoring and Maintenance

- [ ] **Supabase Dashboard monitoring**: Track usage and performance
- [ ] **Custom metrics configured**: Application-specific monitoring
- [ ] **Log analysis setup**: Error tracking and debugging
- [ ] **Backup verification**: Regular backup restoration tests
- [ ] **Security audits scheduled**: Regular security reviews

## Example Code Repository

See a complete working example at:

```
/examples/supabase-authenticated/  # (To be created)
```

This would include:

- Complete React setup with Supabase
- Authentication flow with sign-up/sign-in
- Real-time chat features
- RLS policies for data security
- Production configuration examples

## Advanced Topics

### Self-Hosting Supabase

For organizations requiring full control:

1. **Docker setup**: Use Supabase's official Docker compose
2. **Environment configuration**: Configure all services (PostgreSQL, PostgREST, etc.)
3. **SSL certificates**: Set up TLS for production
4. **Backup strategy**: Implement regular database backups
5. **Monitoring**: Set up comprehensive monitoring stack

### Multi-Tenant Architecture

For SaaS applications with multiple tenants:

```sql
-- Tenant table
CREATE TABLE tenants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT UNIQUE,
  settings JSONB DEFAULT '{}'
);

-- User-tenant relationship
CREATE TABLE user_tenants (
  user_id UUID REFERENCES auth.users(id),
  tenant_id UUID REFERENCES tenants(id),
  role TEXT NOT NULL DEFAULT 'member',
  PRIMARY KEY (user_id, tenant_id)
);

-- RLS policy with tenant isolation
CREATE POLICY "Tenant isolation" ON chat_history
FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id FROM user_tenants
    WHERE user_id = auth.uid()
  )
);
```

### Custom Email Templates

Customize authentication emails:

1. Go to **Authentication** → **Email Templates**
2. Customize templates for:
   - Confirmation emails
   - Password reset emails
   - Magic link emails
   - Invitation emails
3. Use HTML/CSS for branded templates

### Edge Functions

Add server-side logic with Supabase Edge Functions:

```typescript
// supabase/functions/chat-webhook/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async req => {
  const { message, userId } = await req.json();

  // Process chat message, call AI services, etc.
  const response = await processMessage(message);

  // Store in database with RLS
  const { error } = await supabase
    .from('chat_history')
    .insert({ user_id: userId, message, response });

  return new Response(JSON.stringify({ response }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

### Database Migrations

Manage schema changes:

1. Use Supabase CLI for local development:

   ```bash
   npx supabase init
   npx supabase start
   npx supabase db diff --name create_chat_table
   ```

2. Apply migrations to production:
   ```bash
   npx supabase db push
   ```

## Resources and Next Steps

### Documentation

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase JavaScript SDK](https://supabase.com/docs/reference/javascript/introduction)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)

### Community and Learning

- [Supabase Discord](https://discord.supabase.com/)
- [Supabase YouTube Channel](https://www.youtube.com/c/supabase)
- [GitHub Discussions](https://github.com/supabase/supabase/discussions)
- [Supabase Blog](https://supabase.com/blog)

### Tools and Extensions

- [Supabase CLI](https://supabase.com/docs/reference/cli/introduction)
- [Database Schema Visualizer](https://supabase.com/docs/guides/database/database-schema-visualizer)
- [PostgREST API Documentation](https://postgrest.org/en/stable/)

### Next Steps

1. **Design your database schema**: Plan tables and relationships
2. **Implement Row Level Security**: Secure your data access
3. **Add real-time features**: Enhance user experience
4. **Set up monitoring**: Track performance and usage
5. **Plan for scale**: Configure connection pooling and caching
6. **Implement backup strategy**: Ensure data protection

## Support

If you encounter issues with your Supabase integration:

1. **Check Supabase logs**: Dashboard → Logs section shows detailed error information
2. **Review database schema**: Ensure tables and policies are correctly configured
3. **Verify environment variables**: Double-check all configuration values
4. **Test authentication flow**: Use browser dev tools to debug token flow
5. **Supabase community**: Very active Discord community for quick help
6. **Airbolt support**: Report integration issues in our repository

With Supabase configured, you have a complete backend solution with authentication, database, and real-time capabilities - perfect for building comprehensive chat applications with persistent data and collaborative features!
