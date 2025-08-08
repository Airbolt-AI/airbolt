import {
  ClerkProvider,
  SignIn,
  SignedIn,
  SignedOut,
  UserButton,
} from '@clerk/clerk-react';
import { ChatWidget } from '@airbolt/react-sdk';
import './App.css';

// Get Clerk publishable key from environment or use a test key
const clerkPubKey =
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ||
  'pk_test_Y2xlcmsuZXhhbXBsZS5jb20k';

function App() {
  const baseURL =
    import.meta.env.VITE_AIRBOLT_API_URL || 'http://localhost:3000';

  return (
    <ClerkProvider publishableKey={clerkPubKey}>
      <div className="app">
        <header>
          <h1>🚀 Zero-Config Clerk + Airbolt</h1>
          <div className="auth-status">
            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>
        </header>

        <main>
          <SignedOut>
            <div className="sign-in-container">
              <h2>Sign in to chat</h2>
              <p>This demo shows zero-config authentication:</p>
              <ul>
                <li>✅ No getAuthToken prop needed</li>
                <li>✅ Auto-detects Clerk</li>
                <li>✅ Tokens handled automatically</li>
              </ul>
              <SignIn />
            </div>
          </SignedOut>

          <SignedIn>
            <div className="chat-container">
              <h2>Chat (Authenticated with Clerk)</h2>
              <p className="magic-notice">
                🎉 <strong>Look ma, no auth code!</strong> The ChatWidget
                automatically detects and uses your Clerk token. Zero
                configuration needed!
              </p>

              {/* THIS IS THE MAGIC - NO AUTH CONFIGURATION! */}
              <ChatWidget
                baseURL={baseURL}
                position="inline"
                theme="light"
                placeholder="Ask me anything... (authenticated via Clerk)"
              />

              <div className="code-example">
                <h3>The entire integration code:</h3>
                <pre>{`<ClerkProvider publishableKey="pk_test_...">
  <SignedIn>
    <ChatWidget />  {/* Zero auth config needed! */}
  </SignedIn>
</ClerkProvider>`}</pre>
              </div>
            </div>
          </SignedIn>
        </main>

        <footer>
          <h3>How it works:</h3>
          <ol>
            <li>ClerkProvider wraps your app</li>
            <li>ChatWidget detects Clerk automatically</li>
            <li>Tokens are fetched and sent with every request</li>
            <li>Backend validates via JWKS auto-discovery</li>
          </ol>
          <p className="note">
            <strong>Note:</strong> In production, set EXTERNAL_JWT_ISSUER on
            your backend for enhanced security. In development, it just works!
          </p>
        </footer>
      </div>
    </ClerkProvider>
  );
}

export default App;
