# Airbolt + Clerk Minimal Example

A minimal example showing **zero-config authentication** with Clerk and Airbolt. No backend setup required!

## 🚀 What This Demonstrates

- **Zero Config**: Just add your Clerk keys and start chatting
- **Automatic JWT Detection**: Airbolt auto-detects Clerk tokens
- **Secure by Default**: No custom auth code needed
- **Production Ready**: Works in dev and production environments

## ⚡ Quick Start

### 1. Get Your Clerk Keys

1. Sign up at [clerk.com](https://clerk.com) (free tier available)
2. Create a new application
3. Go to **API Keys** in your Clerk dashboard
4. Copy your **Publishable Key**

### 2. Configure Environment

```bash
# Copy the example env file
cp .env.example .env

# Edit .env and add your Clerk publishable key
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_actual_key_here
```

### 3. Install & Run

```bash
# Install dependencies (from the airbolt root directory)
pnpm install

# Start the backend API
cd apps/backend-api
pnpm dev

# In another terminal, start this example
cd examples/clerk-minimal
pnpm dev
```

Visit [http://localhost:3001](http://localhost:3001) and start chatting!

## 🎯 How It Works

### The Magic of Zero Config

1. **User signs in** with Clerk
2. **Clerk provides JWT** token automatically
3. **Airbolt SDK detects** the Clerk token
4. **Backend validates** the JWT without any configuration
5. **Chat works** securely with user identity

### In Development

The backend automatically accepts valid Clerk JWTs - no configuration needed! You'll see helpful warnings in the console, but everything works.

### In Production

For production security, configure your backend with:

```env
NODE_ENV=production
EXTERNAL_JWT_ISSUER=https://your-clerk-subdomain.clerk.accounts.dev/
```

## 📁 Project Structure

```
clerk-minimal/
├── src/
│   ├── App.tsx           # Main component (~60 lines!)
│   ├── main.tsx          # Clerk provider setup
│   ├── App.css           # Styling
│   └── index.css         # Base styles
├── package.json          # Minimal dependencies
├── .env.example          # Environment template
└── README.md             # This file
```

## 🔧 Key Code

The entire authentication setup is just:

```tsx
// main.tsx - Wrap your app with ClerkProvider
<ClerkProvider publishableKey={publishableKey}>
  <App />
</ClerkProvider>;

// App.tsx - Use Clerk hooks + ChatWidget
const { isSignedIn } = useAuth();

{
  isSignedIn ? (
    <ChatWidget baseURL="http://localhost:3000" />
  ) : (
    <SignInButton>
      <button>Sign In</button>
    </SignInButton>
  );
}
```

That's it! The SDK handles everything else automatically.

## 🤔 FAQ

**Q: Do I need to configure JWT validation on the backend?**  
A: No! In development, the backend auto-accepts valid Clerk tokens. In production, just set your `EXTERNAL_JWT_ISSUER`.

**Q: What if I want to customize the authentication?**  
A: Check out the full `clerk-authenticated` example for advanced patterns.

**Q: Does this work with Clerk's organizations/teams?**  
A: Yes! The JWT includes all Clerk claims automatically.

**Q: Can I use this in production?**  
A: Absolutely! Just set `NODE_ENV=production` and `EXTERNAL_JWT_ISSUER` in your backend environment.

## 🆘 Troubleshooting

**Error: "Missing Clerk publishable key"**

- Make sure you copied `.env.example` to `.env`
- Add your actual Clerk publishable key (starts with `pk_`)

**Chat not working:**

- Ensure the backend is running on `http://localhost:3000`
- Check browser console for any errors
- Verify you're signed in with Clerk

**Backend JWT warnings:**

- Normal in development! Add `EXTERNAL_JWT_ISSUER` for production

## 🔗 Next Steps

- Explore the full [Auth0 authenticated example](../auth0-authenticated/) for advanced patterns
- Read about [Airbolt's authentication system](../../docs/authentication.md)
- Check out [Clerk's React documentation](https://clerk.com/docs/references/react/overview)

---

**That's it!** You now have a working AI chat application with secure authentication in under 100 lines of code.
