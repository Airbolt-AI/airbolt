import { useEffect, useState } from 'react';
import { ChatWidget } from '@airbolt/react-sdk';
import { supabase } from './auth/supabaseClient';
import AuthDebugInfo from './auth/AuthDebugInfo';
import type { Session } from '@supabase/supabase-js';
import './App.css';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const baseURL =
    import.meta.env.VITE_AIRBOLT_API_URL || 'http://localhost:3000';

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setAuthError('Check your email for the confirmation link!');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (error: any) {
      setAuthError(error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="app">
        <div className="loading">
          <h2>Loading Supabase...</h2>
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header>
        <h1>Airbolt Supabase Authentication Example</h1>
        <p>Demonstrating Airbolt's automatic integration with Supabase Auth</p>
      </header>

      <main>
        {!session ? (
          <>
            <div className="auth-section">
              <h2>{isSignUp ? 'Sign Up' : 'Sign In'} with Supabase</h2>
              <p>
                This example shows how Airbolt automatically detects and uses
                Supabase authentication without any configuration.
              </p>

              <form onSubmit={handleAuth}>
                <div style={{ marginBottom: '1rem' }}>
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      maxWidth: '300px',
                      padding: '8px 12px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      marginBottom: '0.5rem',
                    }}
                  />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      maxWidth: '300px',
                      padding: '8px 12px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                    }}
                  />
                </div>
                <button
                  type="submit"
                  className="auth-button"
                  disabled={authLoading}
                >
                  {authLoading
                    ? 'Processing...'
                    : isSignUp
                      ? 'Sign Up'
                      : 'Sign In'}
                </button>
              </form>

              <button
                className="auth-button"
                onClick={() => setIsSignUp(!isSignUp)}
                style={{
                  background: 'transparent',
                  color: '#10b981',
                  border: '1px solid #10b981',
                }}
              >
                {isSignUp
                  ? 'Already have an account? Sign In'
                  : 'Need an account? Sign Up'}
              </button>

              {authError && (
                <div
                  style={{
                    color: '#ef4444',
                    marginTop: '1rem',
                    background: '#fef2f2',
                    padding: '0.5rem',
                    borderRadius: '6px',
                    border: '1px solid #fecaca',
                  }}
                >
                  {authError}
                </div>
              )}
            </div>

            <div className="info-section">
              <h3>How It Works</h3>
              <ol>
                <li>You authenticate with Supabase (sign in/sign up)</li>
                <li>Supabase provides a JWT token automatically</li>
                <li>Airbolt SDK detects Supabase session automatically</li>
                <li>SDK includes the token in API requests</li>
                <li>Backend validates the token via JWKS discovery</li>
              </ol>
              <div className="note">
                <strong>Zero Config:</strong> In development, the backend
                accepts Supabase tokens automatically. In production, configure
                EXTERNAL_JWT_ISSUER for security.
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="user-section">
              <div>
                <h2>Welcome, {session.user.email}!</h2>
                <p>
                  You're authenticated with Supabase. The chat below will use
                  your Supabase session token automatically.
                </p>
              </div>
              <button className="logout-button" onClick={handleSignOut}>
                Sign Out
              </button>
            </div>

            <AuthDebugInfo />

            <div className="chat-section">
              <h2>Authenticated Chat</h2>
              <div className="magic-notice">
                🎉 <strong>Look ma, no auth code!</strong> The ChatWidget
                automatically detects and uses your Supabase token. Zero
                configuration needed!
              </div>

              <div className="chat-container">
                {/* THIS IS THE MAGIC - NO AUTH CONFIGURATION! */}
                <ChatWidget
                  baseURL={baseURL}
                  position="inline"
                  theme="light"
                  placeholder={`Type a message... (authenticated as ${session.user.email})`}
                />
              </div>
            </div>

            <div className="info-section">
              <h3>Backend Configuration</h3>
              <div style={{ marginBottom: '1rem' }}>
                <h4>🚀 Development Mode (Current)</h4>
                <p>
                  No configuration needed! The backend automatically validates
                  Supabase tokens from any project.
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
EXTERNAL_JWT_ISSUER=${
                    session.user.aud === 'authenticated'
                      ? 'https://your-project.supabase.co/auth/v1'
                      : session.user.aud
                  }
EXTERNAL_JWT_AUDIENCE=authenticated`}
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
  // SDK automatically detects and uses Supabase token!
/>`}</code>
          </pre>
          <p className="note">
            The SDK automatically detects Supabase sessions and includes your
            token in every request. No auth code needed in your components!
          </p>
        </div>
      </main>
    </div>
  );
}

export default App;
