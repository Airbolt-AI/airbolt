import { useEffect, useState } from 'react';
import { ChatWidget } from '@airbolt/react-sdk';
import { auth } from './auth/firebase';
import AuthDebugInfo from './auth/AuthDebugInfo';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  type User,
} from 'firebase/auth';
import './App.css';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  const baseURL =
    import.meta.env.VITE_AIRBOLT_API_URL || 'http://localhost:3000';
  const googleProvider = new GoogleAuthProvider();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    setAuthSuccess(null);

    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
        setAuthSuccess('Account created successfully!');
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        setAuthSuccess('Signed in successfully!');
      }
      setEmail('');
      setPassword('');
    } catch (error: any) {
      setAuthError(error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    setAuthError(null);
    setAuthSuccess(null);

    try {
      await signInWithPopup(auth, googleProvider);
      setAuthSuccess('Signed in with Google successfully!');
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user') {
        setAuthError(error.message);
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setAuthSuccess('Signed out successfully!');
    } catch (error: any) {
      setAuthError(error.message);
    }
  };

  if (loading) {
    return (
      <div className="app">
        <div className="loading">
          <h2>Loading Firebase...</h2>
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header>
        <h1>Airbolt Firebase Authentication Example</h1>
        <p>Demonstrating Airbolt's automatic integration with Firebase Auth</p>
      </header>

      <main>
        {!user ? (
          <>
            <div className="auth-section">
              <h2>{isSignUp ? 'Create Account' : 'Sign In'} with Firebase</h2>
              <p>
                This example shows how Airbolt automatically detects and uses
                Firebase authentication without any configuration.
              </p>

              <div className="auth-form">
                <div className="provider-buttons">
                  <button
                    className="google-button"
                    onClick={handleGoogleSignIn}
                    disabled={authLoading}
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18">
                      <path
                        fill="#4285F4"
                        d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"
                      />
                      <path
                        fill="#34A853"
                        d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.04a4.8 4.8 0 0 1-2.7.75 4.8 4.8 0 0 1-4.52-3.36H1.83v2.07A8 8 0 0 0 8.98 17z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M4.46 10.41a4.8 4.8 0 0 1 0-2.82V5.52H1.83a8 8 0 0 0 0 6.96l2.63-2.07z"
                      />
                      <path
                        fill="#EA4335"
                        d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 8.98 1 8 8 0 0 0 1.83 5.52L4.46 7.6a4.8 4.8 0 0 1 4.52-3.42z"
                      />
                    </svg>
                    {authLoading ? 'Signing in...' : 'Continue with Google'}
                  </button>
                </div>

                <div className="divider">
                  <span>or</span>
                </div>

                <form onSubmit={handleEmailAuth}>
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    disabled={authLoading}
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    disabled={authLoading}
                    minLength={6}
                  />
                  <button
                    type="submit"
                    className="auth-button"
                    disabled={authLoading}
                  >
                    {authLoading
                      ? 'Processing...'
                      : isSignUp
                        ? 'Create Account'
                        : 'Sign In'}
                  </button>
                </form>

                <button
                  className="toggle-button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  disabled={authLoading}
                >
                  {isSignUp
                    ? 'Already have an account? Sign In'
                    : 'Need an account? Sign Up'}
                </button>

                {authError && <div className="error-message">{authError}</div>}

                {authSuccess && (
                  <div className="success-message">{authSuccess}</div>
                )}
              </div>
            </div>

            <div className="info-section">
              <h3>How It Works</h3>
              <ol>
                <li>
                  You authenticate with Firebase (email/password or Google)
                </li>
                <li>Firebase provides a JWT token automatically</li>
                <li>Airbolt SDK detects Firebase auth automatically</li>
                <li>SDK includes the token in API requests</li>
                <li>Backend validates the token via JWKS discovery</li>
              </ol>
              <div className="note">
                <strong>Zero Config:</strong> In development, the backend
                accepts Firebase tokens automatically. In production, configure
                EXTERNAL_JWT_ISSUER for security.
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="user-section">
              <div>
                <h2>Welcome, {user.displayName || user.email}!</h2>
                <p>
                  You're authenticated with Firebase. The chat below will use
                  your Firebase token automatically.
                </p>
              </div>
              <button className="logout-button" onClick={handleSignOut}>
                Sign Out
              </button>
            </div>

            {authSuccess && (
              <div className="success-message">{authSuccess}</div>
            )}

            <AuthDebugInfo />

            <div className="chat-section">
              <h2>Authenticated Chat</h2>
              <div className="magic-notice">
                🎉 <strong>Look ma, no auth code!</strong> The ChatWidget
                automatically detects and uses your Firebase token. Zero
                configuration needed!
              </div>

              <div className="chat-container">
                {/* THIS IS THE MAGIC - NO AUTH CONFIGURATION! */}
                <ChatWidget
                  baseURL={baseURL}
                  position="inline"
                  theme="light"
                  placeholder={`Type a message... (authenticated as ${user.email})`}
                />
              </div>
            </div>

            <div className="info-section">
              <h3>Backend Configuration</h3>
              <div style={{ marginBottom: '1rem' }}>
                <h4>🚀 Development Mode (Current)</h4>
                <p>
                  No configuration needed! The backend automatically validates
                  Firebase tokens from any project.
                </p>
                <p
                  className="note"
                  style={{ fontSize: '0.9rem', color: '#6b7280' }}
                >
                  You'll see warnings in the backend console - this is normal
                  for dev.
                </p>
              </div>
              <div>
                <h4>🔒 Production Mode</h4>
                <p>
                  For production, add to your backend <code>.env</code>:
                </p>
                <pre
                  style={{
                    background: '#1f2937',
                    color: 'white',
                    padding: '1rem',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                  }}
                >
                  {`NODE_ENV=production
EXTERNAL_JWT_ISSUER=https://securetoken.google.com/${import.meta.env.VITE_FIREBASE_PROJECT_ID || 'your-project-id'}
EXTERNAL_JWT_AUDIENCE=${import.meta.env.VITE_FIREBASE_PROJECT_ID || 'your-project-id'}`}
                </pre>
              </div>
            </div>
          </>
        )}

        <div className="code-section">
          <h2>How Simple Is It?</h2>
          <pre>
            <code>{`// That's it! Just add the ChatWidget
import { ChatWidget } from '@airbolt/react-sdk';

<ChatWidget
  baseURL="http://localhost:3000"
  // SDK automatically detects and uses Firebase token!
/>`}</code>
          </pre>
          <p className="note">
            The SDK automatically detects Firebase auth and includes your token
            in every request. No auth code needed in your components!
          </p>
        </div>
      </main>
    </div>
  );
}

export default App;
