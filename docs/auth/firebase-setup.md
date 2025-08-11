# Firebase Authentication Setup Guide

This guide walks you through integrating Firebase Authentication with Airbolt. Firebase provides Google's authentication service with extensive social providers, security features, and seamless integration with other Google Cloud services.

## Why Choose Firebase?

### Benefits

- **Google ecosystem integration**: Seamless with Google services and Analytics
- **Extensive social providers**: 20+ built-in authentication providers
- **Mobile-first design**: Excellent mobile SDK support (iOS, Android, Flutter)
- **Real-time capabilities**: Firestore real-time database integration
- **Global scale**: Google's infrastructure handles any scale
- **Security features**: Advanced security monitoring and phone number verification

### Best For

- Applications using Google Cloud services
- Mobile applications (native iOS/Android or React Native)
- Projects needing extensive social login options
- Applications requiring phone number authentication
- Global applications needing multi-region deployment
- Teams already using Google Workspace

### Use Cases

- Consumer mobile apps with social login
- Cross-platform applications (web + mobile)
- Applications requiring SMS verification
- Real-time collaborative platforms
- IoT applications with device authentication
- Applications needing Google services integration

## Prerequisites

- Node.js 18 or later
- A Google account
- Basic understanding of Firebase concepts
- 15 minutes for initial setup

## Step 1: Create Firebase Project

### 1.1 Access Firebase Console

1. Visit [console.firebase.google.com](https://console.firebase.google.com)
2. Sign in with your Google account
3. Click **"Create a project"** or **"Add project"**

### 1.2 Configure Your Project

1. **Project name**: Enter `Airbolt Chat App` (or your preferred name)
2. **Google Analytics**:
   - Enable if you want usage analytics (recommended)
   - Choose or create Analytics account
3. **Location**: Select your default region for data storage
4. Click **"Create project"**

Project setup takes 1-2 minutes to complete.

[Screenshot Description: Firebase project creation wizard with project name and Analytics settings]

### 1.3 Enable Authentication

1. From the Firebase Console, select your project
2. In the left sidebar, click **"Authentication"**
3. Click **"Get started"**
4. Go to the **"Sign-in method"** tab

## Step 2: Configure Authentication Methods

### 2.1 Enable Email/Password Authentication

1. In the **"Sign-in method"** tab, click **"Email/Password"**
2. Enable **"Email/Password"**
3. Optionally enable **"Email link (passwordless sign-in)"**
4. Click **"Save"**

### 2.2 Configure Additional Providers (Optional)

Enable social authentication providers as needed:

**Google**:

1. Click **"Google"** provider
2. Enable the provider
3. Set support email and public-facing project name
4. Click **"Save"**

**GitHub**:

1. Click **"GitHub"** provider
2. Enable and enter your GitHub OAuth app credentials
3. Copy the redirect URL to your GitHub OAuth app settings

**Other Providers**:

- Twitter, Facebook, Microsoft, Apple, etc.
- Each requires OAuth app setup with the respective provider

[Screenshot Description: Firebase Authentication sign-in methods page showing enabled providers]

### 2.3 Configure Authorized Domains

1. In the **"Settings"** tab of Authentication
2. Under **"Authorized domains"**, add:
   - `localhost` (for development)
   - Your production domain(s)
3. These domains can use Firebase Auth

## Step 3: Get Firebase Configuration

### 3.1 Create Web App

1. In Firebase Console, click the **gear icon** → **"Project settings"**
2. Scroll down to **"Your apps"** section
3. Click **"Web"** button (</>) to add a web app
4. Configure your app:
   - **App nickname**: `Airbolt Web App`
   - **Firebase Hosting**: Not needed for this setup
5. Click **"Register app"**

### 3.2 Copy Configuration

Firebase will show your app configuration:

```javascript
// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: 'AIzaSyC...',
  authDomain: 'your-project.firebaseapp.com',
  projectId: 'your-project-id',
  storageBucket: 'your-project.appspot.com',
  messagingSenderId: '123456789',
  appId: '1:123456789:web:abcdef123456',
};
```

Copy this configuration - you'll need it for your frontend.

[Screenshot Description: Firebase web app configuration showing the config object]

### 3.3 Note Your Project ID

From the configuration above, note your `projectId` - this is what Airbolt uses for backend validation.

## Step 4: Frontend Integration

### 4.1 Install Firebase SDK

```bash
npm install firebase
```

### 4.2 Configure Environment Variables

Create or update your `.env` file:

```bash
# Frontend environment variables (.env or .env.local)
VITE_FIREBASE_API_KEY=AIzaSyC...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef123456
VITE_AIRBOLT_API_URL=http://localhost:3000
```

### 4.3 Initialize Firebase

```typescript
// src/lib/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
export default app;
```

### 4.4 Create Authentication Component

```tsx
// src/components/Auth.tsx
import { useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { ChatWidget } from '@airbolt/react';

const googleProvider = new GoogleAuthProvider();

export function Auth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleSignOut = () => signOut(auth);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {!user ? (
        <div className="auth-form">
          <h1>Welcome to Airbolt Chat</h1>

          {/* Google Sign In */}
          <button onClick={handleGoogleSignIn} className="google-signin-btn">
            Sign in with Google
          </button>

          <div className="separator">or</div>

          {/* Email/Password Form */}
          <form onSubmit={handleEmailAuth}>
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
              {isSignUp ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <p>
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button type="button" onClick={() => setIsSignUp(!isSignUp)}>
              {isSignUp ? 'Sign In' : 'Create Account'}
            </button>
          </p>
        </div>
      ) : (
        <div className="chat-app">
          <div className="header">
            <h1>Welcome, {user.displayName || user.email}!</h1>
            <button onClick={handleSignOut}>Sign Out</button>
          </div>

          {/* ChatWidget automatically detects Firebase authentication */}
          <ChatWidget />
        </div>
      )}
    </div>
  );
}
```

### 4.5 Zero-Config Airbolt Integration

**No additional configuration needed!** The ChatWidget automatically:

- Detects when Firebase is available (Firebase Auth instance)
- Retrieves ID tokens using `user.getIdToken()`
- Includes tokens in API requests
- Falls back to anonymous mode if not authenticated

## Step 5: Backend Configuration

### 5.1 Development Mode (Zero Config)

For development, no backend configuration is required! Airbolt automatically validates Firebase tokens.

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

### 5.2 Production Configuration

For production security, configure your backend to only accept tokens from YOUR Firebase project.

Create `.env` in your backend directory:

```bash
# Backend environment variables for production
NODE_ENV=production
FIREBASE_PROJECT_ID=your-project-id

# JWT configuration for Airbolt's session tokens
JWT_SECRET=$(openssl rand -base64 64)  # Generate a secure secret
JWT_EXPIRES_IN=10m                     # Session token expiry
JWT_ALGORITHM=HS256                    # Signing algorithm

# Rate limiting
AUTH_RATE_LIMIT_MAX=10                 # Max auth requests per window
AUTH_RATE_LIMIT_WINDOW_MS=900000       # 15 minutes in milliseconds
```

### 5.3 Environment Variable Reference

| Variable              | Required   | Description                                      | Example                                 |
| --------------------- | ---------- | ------------------------------------------------ | --------------------------------------- |
| `FIREBASE_PROJECT_ID` | Production | Your Firebase project ID                         | `your-project-id`                       |
| `JWT_SECRET`          | Required   | Secret for Airbolt session tokens (min 32 chars) | Generate with `openssl rand -base64 64` |
| `JWT_EXPIRES_IN`      | Optional   | Session token expiry                             | `10m` (default)                         |
| `AUTH_RATE_LIMIT_MAX` | Optional   | Max auth requests per window                     | `10` (default)                          |

## Step 6: Testing Your Integration

### 6.1 Basic Authentication Flow

1. Start backend: `pnpm dev` (in `apps/backend-api`)
2. Start frontend: `pnpm dev` (in your app directory)
3. Open your app in browser
4. Try different authentication methods:
   - Email/password registration
   - Email/password sign-in
   - Google sign-in (if configured)
5. Verify you see the chat interface after authentication

### 6.2 Token Validation Test

```bash
# Get Firebase ID token from browser console:
# firebase.auth().currentUser.getIdToken().then(console.log)
# Copy the token, then test:

curl -X POST http://localhost:3000/api/auth/exchange \
  -H "Content-Type: application/json" \
  -d '{"providerToken": "YOUR_FIREBASE_ID_TOKEN_HERE"}'

# Expected response:
# {"sessionToken": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."}
```

### 6.3 Chat API Test

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello from Firebase user!"}'

# Expected response:
# {"response": "Hello! I can see you're authenticated via Firebase..."}
```

### 6.4 Verify Token Structure

```bash
# Check Firebase ID token claims
node -e "
const token = 'YOUR_FIREBASE_ID_TOKEN_HERE'
const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
console.log('Issuer:', payload.iss)
console.log('Subject (User ID):', payload.sub)
console.log('Email:', payload.email)
console.log('Email Verified:', payload.email_verified)
console.log('Auth Time:', new Date(payload.auth_time * 1000))
"
```

## Step 7: Advanced Configuration

### 7.1 Custom Claims

Add custom user roles and data using Firebase Functions:

1. **Install Firebase CLI**:

   ```bash
   npm install -g firebase-tools
   firebase login
   ```

2. **Initialize Firebase Functions**:

   ```bash
   firebase init functions
   # Choose your project and TypeScript/JavaScript
   ```

3. **Create custom claims function**:

   ```typescript
   // functions/src/index.ts
   import { auth } from 'firebase-admin';
   import { https } from 'firebase-functions';

   export const setCustomClaims = https.onCall(async (data, context) => {
     // Verify admin user
     if (!context.auth?.token.admin) {
       throw new https.HttpsError('permission-denied', 'Admin access required');
     }

     const { uid, claims } = data;
     await auth().setCustomUserClaims(uid, claims);
     return { success: true };
   });

   // Automatically set role on user creation
   export const processNewUser = auth.user().onCreate(async user => {
     const customClaims = {
       role: 'user',
       plan: 'free',
     };

     await auth().setCustomUserClaims(user.uid, customClaims);
   });
   ```

4. **Deploy functions**:
   ```bash
   firebase deploy --only functions
   ```

### 7.2 Phone Number Authentication

Enable SMS-based authentication:

1. In Firebase Console, go to **Authentication** → **Sign-in method**
2. Enable **Phone** provider
3. Configure SMS settings and quotas
4. Add phone auth to your frontend:

```typescript
import {
  signInWithPhoneNumber,
  RecaptchaVerifier,
  ConfirmationResult,
} from 'firebase/auth';

// Set up reCAPTCHA
const setUpRecaptcha = () => {
  window.recaptchaVerifier = new RecaptchaVerifier(
    'recaptcha-container',
    {
      size: 'invisible',
      callback: () => {
        // reCAPTCHA solved
      },
    },
    auth
  );
};

// Send verification code
const sendVerificationCode = async (phoneNumber: string) => {
  setUpRecaptcha();
  const appVerifier = window.recaptchaVerifier;

  try {
    const confirmationResult = await signInWithPhoneNumber(
      auth,
      phoneNumber,
      appVerifier
    );
    return confirmationResult;
  } catch (error) {
    console.error('SMS not sent:', error);
  }
};

// Verify code
const verifyCode = async (
  confirmationResult: ConfirmationResult,
  code: string
) => {
  try {
    const result = await confirmationResult.confirm(code);
    return result.user;
  } catch (error) {
    console.error('Invalid code:', error);
  }
};
```

### 7.3 Multi-Factor Authentication

Enable additional security with MFA:

1. In Firebase Console, enable MFA in **Authentication** → **Settings**
2. Configure allowed factors (SMS, TOTP)
3. Implement MFA enrollment in your app:

```typescript
import {
  multiFactor,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
} from 'firebase/auth';

// Enroll user in MFA
const enrollMFA = async (user: User, phoneNumber: string) => {
  const multiFactorSession = await multiFactor(user).getSession();

  const phoneAuthCredential = PhoneAuthProvider.credential(
    verificationId,
    verificationCode
  );

  const multiFactorAssertion =
    PhoneMultiFactorGenerator.assertion(phoneAuthCredential);

  await multiFactor(user).enroll(multiFactorAssertion, 'SMS MFA');
};
```

### 7.4 Security Rules and Monitoring

Configure Firebase security features:

1. **App Check**: Protect against abuse

   ```bash
   # Enable App Check in Firebase Console
   # Add to your app:
   npm install firebase/app-check
   ```

   ```typescript
   import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

   initializeAppCheck(app, {
     provider: new ReCaptchaV3Provider('your-recaptcha-site-key'),
     isTokenAutoRefreshEnabled: true,
   });
   ```

2. **Identity and Access Management**: Set up admin roles and permissions

## Common Issues and Solutions

### Issue: "Firebase not detected" in ChatWidget

**Symptoms**: ChatWidget doesn't recognize Firebase authentication

**Cause**: Firebase not properly initialized or user not authenticated

**Solution**:

1. Ensure Firebase is initialized before your app renders
2. Verify user is signed in (`firebase.auth().currentUser`)
3. Check browser console for Firebase initialization errors

```typescript
// ✅ Proper initialization order
import { auth } from './lib/firebase'  // Initialize first
import { ChatWidget } from '@airbolt/react'

function App() {
  const [user, setUser] = useState(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser)
    return unsubscribe
  }, [])

  return user ? <ChatWidget /> : <SignIn />
}
```

### Issue: "Token validation failed" errors

**Symptoms**: 401 errors when exchanging Firebase ID tokens

**Cause**: Token expired or project ID mismatch

**Solution**:

1. Check token expiration (Firebase tokens expire after 1 hour)
2. Verify `FIREBASE_PROJECT_ID` matches your Firebase project
3. Ensure fresh tokens are used:

```typescript
// ✅ Always get fresh token
const getFirebaseToken = async () => {
  const user = auth.currentUser;
  if (!user) return null;

  try {
    // Force refresh to get new token
    const token = await user.getIdToken(true);
    return token;
  } catch (error) {
    console.error('Token refresh failed:', error);
    return null;
  }
};
```

### Issue: "popup blocked" during social sign-in

**Symptoms**: Google/social sign-in popups are blocked by browser

**Cause**: Popup blockers preventing OAuth flow

**Solution**:

1. Use redirect-based flow instead of popup:

   ```typescript
   import { signInWithRedirect, getRedirectResult } from 'firebase/auth';

   // Use redirect instead of popup
   const signInWithGoogle = () => {
     signInWithRedirect(auth, googleProvider);
   };

   // Handle redirect result
   useEffect(() => {
     getRedirectResult(auth).then(result => {
       if (result?.user) {
         setUser(result.user);
       }
     });
   }, []);
   ```

### Issue: "Firebase quota exceeded" errors

**Symptoms**: Authentication fails with quota limit messages

**Cause**: Exceeded Firebase free tier limits

**Solution**:

1. Check Firebase Console → Usage for current limits
2. Upgrade to Blaze plan for production usage
3. Implement proper error handling for quota limits
4. Optimize authentication patterns to reduce API calls

### Issue: Email verification issues

**Symptoms**: Users can't verify email addresses

**Cause**: Email delivery or configuration problems

**Solution**:

1. Check spam folders for verification emails
2. Configure custom email templates in Firebase Console
3. Set up custom SMTP for better deliverability:

```typescript
// Send custom verification email
import { sendEmailVerification } from 'firebase/auth';

const sendVerification = async (user: User) => {
  const actionCodeSettings = {
    url: 'https://yourapp.com/verify-email',
    handleCodeInApp: true,
  };

  await sendEmailVerification(user, actionCodeSettings);
};
```

## Production Checklist

### Security Configuration

- [ ] **Project ID configured**: Backend restricted to your Firebase project
- [ ] **Environment variables secured**: No secrets in client-side code
- [ ] **JWT_SECRET generated**: Use `openssl rand -base64 64`
- [ ] **HTTPS enforced**: TLS termination configured
- [ ] **App Check enabled**: Protect against automated abuse
- [ ] **Security Rules configured**: Proper access controls
- [ ] **Rate limiting configured**: Both Firebase and Airbolt limits

### Firebase Project Security

- [ ] **Authorized domains updated**: Production domains in Firebase settings
- [ ] **API key restrictions**: Limit API key usage by domain/IP
- [ ] **Audit logging enabled**: Monitor authentication events
- [ ] **Identity verification**: Email/phone verification enabled
- [ ] **MFA configured**: For high-security applications
- [ ] **Custom claims implemented**: Role-based access control

### Performance Optimization

- [ ] **Token caching optimized**: Minimize token refresh calls
- [ ] **Connection pooling**: Efficient Firebase connections
- [ ] **Bundle size optimized**: Import only needed Firebase modules
- [ ] **CDN configuration**: Serve static assets efficiently
- [ ] **Monitoring configured**: Track performance and errors

### Compliance and Monitoring

- [ ] **Privacy policy updated**: Firebase data usage disclosed
- [ ] **GDPR compliance**: User data deletion capabilities
- [ ] **Analytics configured**: Track authentication patterns
- [ ] **Error monitoring**: Comprehensive error tracking
- [ ] **Backup strategy**: Export user data regularly

## Example Code Repository

See a complete working example at:

```
/examples/firebase-authenticated/  # (To be created)
```

This would include:

- Complete React setup with Firebase
- Multiple authentication methods (email, Google, phone)
- Custom claims and role-based access
- MFA implementation
- Production configuration examples

## Advanced Topics

### Firebase Admin SDK Integration

For backend operations requiring admin privileges:

```typescript
// Backend: Firebase Admin SDK setup
import admin from 'firebase-admin';

// Initialize with service account
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'your-project-id',
});

// Verify tokens on backend
const verifyIdToken = async (idToken: string) => {
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.error('Token verification failed:', error);
    throw error;
  }
};
```

### Firestore Integration

Combine authentication with Firestore database:

```typescript
import {
  initializeFirestore,
  connectFirestoreEmulator,
} from 'firebase/firestore';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const db = initializeFirestore(app, {
  experimentalForceLongPolling: true, // For some hosting environments
});

// User profile management
const createUserProfile = async (user: User) => {
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    await setDoc(userRef, {
      displayName: user.displayName,
      email: user.email,
      createdAt: new Date(),
      chatPreferences: {
        theme: 'light',
        notifications: true,
      },
    });
  }
};
```

### Firebase Cloud Functions

Server-side logic with Firebase Functions:

```typescript
// functions/src/index.ts
import { onCall } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';

// Callable function for chat operations
export const processChatMessage = onCall(async request => {
  const { auth, data } = request;

  if (!auth) {
    throw new Error('Authentication required');
  }

  // Process message with AI service
  const response = await callAIService(data.message);

  return { response };
});

// Trigger on user creation
export const onUserCreate = onDocumentCreated('users/{userId}', async event => {
  const userId = event.params.userId;

  // Initialize user chat history
  await admin.firestore().collection('chatHistory').doc(userId).set({
    messages: [],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
});
```

### Testing Firebase Authentication

Set up comprehensive testing:

```typescript
// Test setup with Firebase emulator
import {
  initializeTestApp,
  clearFirestoreData,
} from '@firebase/rules-unit-testing';

describe('Firebase Auth Integration', () => {
  let app: any;

  beforeEach(async () => {
    app = initializeTestApp({
      projectId: 'test-project',
      auth: { uid: 'test-user', email: 'test@example.com' },
    });
  });

  afterEach(async () => {
    await clearFirestoreData({ projectId: 'test-project' });
  });

  it('should create user profile on authentication', async () => {
    // Test user creation flow
  });
});
```

## Resources and Next Steps

### Documentation

- [Firebase Authentication Documentation](https://firebase.google.com/docs/auth)
- [Firebase JavaScript SDK Reference](https://firebase.google.com/docs/reference/js/auth)
- [Firebase Security Rules](https://firebase.google.com/docs/rules)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)

### Learning Resources

- [Firebase YouTube Channel](https://www.youtube.com/firebase)
- [Firebase Codelabs](https://firebase.google.com/codelabs)
- [Google Cloud Skills Boost](https://www.cloudskillsboost.google/paths/13)

### Community and Support

- [Firebase Community Slack](https://firebase.community/)
- [Stack Overflow Firebase Tag](https://stackoverflow.com/questions/tagged/firebase)
- [Firebase GitHub Repository](https://github.com/firebase/firebase-js-sdk)
- [Google Cloud Support](https://cloud.google.com/support)

### Tools and Extensions

- [Firebase CLI](https://firebase.google.com/docs/cli)
- [Firebase Emulator Suite](https://firebase.google.com/docs/emulator-suite)
- [Firebase Extensions](https://firebase.google.com/products/extensions)
- [FlutterFire (Flutter integration)](https://firebase.flutter.dev/)

### Next Steps

1. **Configure additional auth providers**: Add social login options
2. **Implement custom claims**: Role-based access control
3. **Set up Firebase Functions**: Server-side business logic
4. **Add Firestore integration**: Persistent data storage
5. **Configure monitoring**: Performance and error tracking
6. **Plan for compliance**: GDPR, privacy policies
7. **Implement testing**: Comprehensive test coverage

## Support

If you encounter issues with your Firebase integration:

1. **Check Firebase Console**: Detailed logs and error messages available
2. **Review authentication flow**: Use browser dev tools to debug token exchange
3. **Verify project configuration**: Double-check project ID and settings
4. **Test token validity**: Use Firebase Admin SDK to verify tokens
5. **Firebase support**: Extensive documentation and community support
6. **Google Cloud support**: Enterprise support options available
7. **Airbolt support**: Report integration issues in our repository

With Firebase configured, you have access to Google's robust authentication infrastructure with extensive provider options, advanced security features, and seamless integration with other Google Cloud services - perfect for applications requiring enterprise-grade authentication with global scale!
