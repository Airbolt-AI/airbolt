# Airbolt Firebase Authentication Example

See how Airbolt integrates seamlessly with Firebase Auth for secure, authenticated AI chat.

## What This Example Shows

- Firebase Auth integration with Airbolt
- Automatic token detection (zero configuration!)
- Email/password and Google authentication
- Per-user rate limiting with Firebase user IDs
- Debug panel to understand the integration
- Production security configuration

## Prerequisites

- Node.js 18+
- A Google/Firebase account ([sign up free](https://firebase.google.com))
- 10 minutes to set it up

## Setup Guide

### Step 1: Create Your Firebase Project

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Click **"Create a project"**
3. Enter project details:
   - **Project name**: `Airbolt Example` (or your preference)
   - **Enable Google Analytics**: Optional (recommended)
4. Click **"Create project"**
5. Wait for the project to be ready

### Step 2: Enable Authentication

1. In your Firebase project, go to **Authentication** in the left sidebar
2. Click **"Get started"**
3. Go to the **"Sign-in method"** tab
4. Enable these providers:
   - **Email/Password**: Click, toggle "Enable", and save
   - **Google**: Click, toggle "Enable", add your project support email, and save

### Step 3: Configure Authorized Domains

1. Still in **Authentication** → **Settings** → **Authorized domains**
2. Click **"Add domain"**
3. Add: `localhost` (should already be there)
4. For production, you'll add your actual domain here

### Step 4: Get Your Firebase Config

1. Go to **Project Settings** (gear icon in sidebar)
2. Scroll down to **"Your apps"** section
3. Click **"Web app"** icon (`</>`)
4. Register your app:
   - **App nickname**: `Airbolt Example`
   - **Firebase Hosting**: Optional (can skip)
5. Copy the config object - you'll need these values:
   ```javascript
   const firebaseConfig = {
     apiKey: 'your-api-key',
     authDomain: 'your-project.firebaseapp.com',
     projectId: 'your-project-id',
     storageBucket: 'your-project.appspot.com',
     messagingSenderId: '123456789',
     appId: '1:123456789:web:abcdef123456',
   };
   ```

### Step 5: Configure This Example

```bash
cd examples/firebase-authenticated
cp .env.example .env
```

Edit `.env` with your Firebase config values:

```env
VITE_FIREBASE_API_KEY=your-api-key-here
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
VITE_AIRBOLT_API_URL=http://localhost:3000
```

### Step 6: Start the Airbolt Backend

```bash
cd apps/backend-api
pnpm dev
```

### Step 7: Run This Example

```bash
cd examples/firebase-authenticated
pnpm install
pnpm dev
```

### Step 8: Try It Out!

1. Open http://localhost:5176
2. Try both authentication methods:
   - **Google**: Click "Continue with Google"
   - **Email**: Create an account with email/password
3. Check the debug panel to see what's happening
4. Send a chat message

✨ **That's it!** You're now using Firebase authentication with Airbolt.

## Features Demonstrated

- ✅ **Zero-config auth** - No auth props needed on ChatWidget
- ✅ **Auto-detection** - Finds Firebase auth automatically
- ✅ **Multiple providers** - Google OAuth + Email/Password
- ✅ **Session management** - Automatic token refresh
- ✅ **Type safety** - Full TypeScript support
- ✅ **Fallback support** - Falls back to anonymous if not signed in

## Testing Development vs Production Modes

### Development Mode (What You Just Ran)

The backend automatically validates any Firebase token - zero configuration needed! You'll see a warning in the backend console:

```
⚠️  Accepting JWT from https://securetoken.google.com/your-project-id. For production, configure EXTERNAL_JWT_ISSUER.
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
   EXTERNAL_JWT_ISSUER=https://securetoken.google.com/your-project-id
   EXTERNAL_JWT_AUDIENCE=your-project-id
   ```

4. **Restart the backend**:

   ```bash
   pnpm dev
   ```

5. **Try the example again** - it still works, but now ONLY accepts tokens from YOUR Firebase project!

### What's the Difference?

- **Development**: Accepts any valid Firebase token (with warnings)
- **Production**: Only accepts tokens from the configured project
- **Security**: Production mode prevents token substitution attacks

## Understanding the Integration

1. **User Authentication**: Firebase handles sign up/in and provides a JWT
2. **Automatic Detection**: Airbolt SDK detects Firebase auth automatically
3. **Token Retrieval**: SDK gets the ID token from the current user
4. **API Requests**: Token is included in the Authorization header
5. **Backend Validation**:
   - Development: Auto-discovers Firebase's JWKS (zero config)
   - Production: Validates against configured issuer
6. **User Identification**: Rate limiting applied per Firebase user ID

## The Debug Panel

This example includes a debug panel that helps you understand what's happening:

- **Firebase Available**: Is Firebase Auth initialized?
- **User Signed In**: Is there a current authenticated user?
- **SDK Detection**: Will Airbolt detect the auth automatically?
- **User Information**: User details from Firebase
- **JWT Claims**: What's in your token?
- **Backend Config**: What production configuration is expected?

## Firebase Security Rules Example

Want to see how this works with Firestore security rules? Here's a quick example:

```javascript
// Firestore Security Rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read/write their own documents
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // User messages - can only access own messages
    match /user_messages/{messageId} {
      allow read, write: if request.auth != null &&
        request.auth.uid == resource.data.userId;
    }
  }
}
```

Now when users chat through Airbolt, their user ID (from the JWT) can be used to enforce these security rules in your Firestore database!

## Troubleshooting

### "Firebase configuration error"

- Double-check all your Firebase config values in `.env`
- Ensure there are no extra spaces or quotes
- Verify your project ID matches exactly

### "Google sign-in popup blocked"

- Allow popups for localhost in your browser
- Try using incognito/private mode
- Some browsers block popups by default

### "Email already in use"

- The email is already registered - try signing in instead
- Use the toggle to switch between sign up and sign in
- Try using "Forgot password" in a real app

### "Weak password" error

- Firebase requires passwords to be at least 6 characters
- Use a stronger password with mixed characters
- This is a Firebase security requirement

### SDK not detecting Firebase

- Make sure you're signed in (user exists)
- Check browser console for Firebase initialization errors
- Verify Firebase config is loaded correctly

### CORS errors

- Ensure your domain is in Firebase authorized domains
- Check that your backend allows your frontend URL
- For localhost, this should work automatically

## Building Your Own App?

Now that you've seen how it works:

1. **Development**: Just add the Airbolt SDK to your Firebase app - no backend config needed!
2. **Production**: Set those two environment variables (EXTERNAL_JWT_ISSUER and EXTERNAL_JWT_AUDIENCE)
3. **Database Integration**: Use the user ID from JWT tokens for Firestore security rules
4. **Other Features**: Explore Firebase's real-time database, storage, and cloud functions

See the [main README](../../README.md#bring-your-own-auth-byoa) for more details.

## Resources

- [Firebase Auth Documentation](https://firebase.google.com/docs/auth)
- [Firebase Web Setup Guide](https://firebase.google.com/docs/web/setup)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Firebase JavaScript SDK](https://firebase.google.com/docs/reference/js)
- [Airbolt Documentation](../../README.md)
