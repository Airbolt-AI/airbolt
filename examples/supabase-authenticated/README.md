# Airbolt Supabase Authentication Example

See how Airbolt integrates seamlessly with Supabase Auth for secure, authenticated AI chat.

## What This Example Shows

- Supabase Auth integration with Airbolt
- Automatic token detection (zero configuration!)
- Email/password authentication flow
- Per-user rate limiting with Supabase user IDs
- Debug panel to understand the integration
- Production security configuration

## Prerequisites

- Node.js 18+
- A Supabase account ([sign up free](https://supabase.com))
- 5 minutes to set it up

## Setup Guide

### Step 1: Create Your Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **"New Project"**
3. Choose your organization
4. Fill in project details:
   - **Name**: `Airbolt Example` (or your preference)
   - **Database Password**: Create a secure password
   - **Region**: Choose closest to you
5. Click **"Create new project"**
6. Wait for the project to be ready (usually 1-2 minutes)

### Step 2: Configure Authentication

1. In your Supabase dashboard, go to **Authentication** → **Settings**
2. Under **Site URL**, add: `http://localhost:5175`
3. Under **Redirect URLs**, add: `http://localhost:5175`
4. Scroll down and click **Save**

### Step 3: Get Your Project Credentials

1. Go to **Settings** → **API**
2. Copy the **Project URL** (e.g., `https://abcdefgh.supabase.co`)
3. Copy the **anon public** key

### Step 4: Configure This Example

```bash
cd examples/supabase-authenticated
cp .env.example .env
```

Edit `.env` with your Supabase details:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key-here
VITE_AIRBOLT_API_URL=http://localhost:3000
```

### Step 5: Start the Airbolt Backend

```bash
cd apps/backend-api
pnpm dev
```

### Step 6: Run This Example

```bash
cd examples/supabase-authenticated
pnpm install
pnpm dev
```

### Step 7: Try It Out!

1. Open http://localhost:5175
2. Sign up with your email and password
3. Check your email and confirm your account (if required)
4. Sign in with your credentials
5. Check the debug panel to see what's happening
6. Send a chat message

✨ **That's it!** You're now using Supabase authentication with Airbolt.

## Features Demonstrated

- ✅ **Zero-config auth** - No auth props needed on ChatWidget
- ✅ **Auto-detection** - Finds Supabase session automatically
- ✅ **Email/Password auth** - Complete authentication flow
- ✅ **Session management** - Automatic token refresh
- ✅ **Type safety** - Full TypeScript support
- ✅ **Fallback support** - Falls back to anonymous if not signed in

## Testing Development vs Production Modes

### Development Mode (What You Just Ran)

The backend automatically validates any Supabase token - zero configuration needed! You'll see a warning in the backend console:

```
⚠️  Accepting JWT from https://your-project.supabase.co/auth/v1. For production, configure EXTERNAL_JWT_ISSUER.
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

   ```env
   NODE_ENV=production
   EXTERNAL_JWT_ISSUER=https://your-project-id.supabase.co/auth/v1
   EXTERNAL_JWT_AUDIENCE=authenticated
   ```

4. **Restart the backend**:

   ```bash
   pnpm dev
   ```

5. **Try the example again** - it still works, but now ONLY accepts tokens from YOUR Supabase project!

### What's the Difference?

- **Development**: Accepts any valid Supabase token (with warnings)
- **Production**: Only accepts tokens from the configured project
- **Security**: Production mode prevents token substitution attacks

## Understanding the Integration

1. **User Authentication**: Supabase handles user sign up/in and provides a JWT
2. **Automatic Detection**: Airbolt SDK detects Supabase session automatically
3. **Token Retrieval**: SDK gets the access token from the active session
4. **API Requests**: Token is included in the Authorization header
5. **Backend Validation**:
   - Development: Auto-discovers Supabase's JWKS (zero config)
   - Production: Validates against configured issuer
6. **User Identification**: Rate limiting applied per Supabase user ID

## The Debug Panel

This example includes a debug panel that helps you understand what's happening:

- **Supabase Client**: Is the Supabase client initialized?
- **Active Session**: Is there a current authenticated session?
- **SDK Detection**: Will Airbolt detect the auth automatically?
- **JWT Claims**: What's in your token?
- **Backend Config**: What production configuration is expected?

## Row Level Security (RLS) Example

Want to see how this works with Supabase's Row Level Security? Here's a quick example:

```sql
-- Create a simple messages table
CREATE TABLE user_messages (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own messages
CREATE POLICY "Users can view own messages" ON user_messages
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own messages
CREATE POLICY "Users can insert own messages" ON user_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

Now when users chat through Airbolt, their user ID (from the JWT) can be used to enforce these policies!

## Troubleshooting

### "Invalid Supabase URL or key"

- Double-check your project URL and anon key
- Ensure there are no extra spaces in your .env file
- Verify the URL starts with `https://` and ends with `.supabase.co`

### "Email not confirmed"

- Check your spam folder for the confirmation email
- In Supabase dashboard, go to Auth → Users to manually confirm
- For development, you can disable email confirmation in Auth settings

### "Session expired" or token errors

- Supabase tokens auto-refresh, but check your session settings
- Try signing out and signing back in
- Ensure your backend is running on port 3000

### SDK not detecting Supabase

- Make sure you're signed in (session exists)
- Check browser console for Supabase initialization errors
- Verify the session is active using the debug panel

### CORS errors

- Ensure your site URL is configured correctly in Supabase
- Check that redirect URLs include your development URL
- Backend CORS should allow your frontend URL

## Building Your Own App?

Now that you've seen how it works:

1. **Development**: Just add the Airbolt SDK to your Supabase app - no backend config needed!
2. **Production**: Set those two environment variables (EXTERNAL_JWT_ISSUER and EXTERNAL_JWT_AUDIENCE)
3. **Database Integration**: Use the user ID from JWT tokens for Row Level Security
4. **Other Features**: Explore Supabase's real-time features, storage, and edge functions

See the [main README](../../README.md#bring-your-own-auth-byoa) for more details.

## Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
- [Airbolt Documentation](../../README.md)
