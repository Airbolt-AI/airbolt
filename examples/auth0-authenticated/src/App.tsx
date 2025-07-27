import { useAuth0 } from '@auth0/auth0-react';
import { ChatWidget } from '@airbolt/react-sdk';
import './App.css';
import AuthDebugInfo from './auth/AuthDebugInfo';

function App() {
  const { isLoading, isAuthenticated, loginWithRedirect, logout, user, error } =
    useAuth0();
  const baseURL =
    import.meta.env.VITE_AIRBOLT_API_URL || 'http://localhost:3000';

  if (isLoading) {
    return (
      <div className="app">
        <div className="loading">
          <h2>Loading Auth0...</h2>
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app">
        <div className="error-container">
          <h2>Authentication Error</h2>
          <p>{error.message}</p>
          <button onClick={() => window.location.reload()}>Reload Page</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header>
        <h1>Airbolt Auth0 Authenticated Example</h1>
        <p>
          This example demonstrates Airbolt's Bring Your Own Auth (BYOA)
          integration with Auth0.
        </p>
      </header>

      <main>
        {!isAuthenticated ? (
          <>
            <div className="auth-section">
              <h2>Sign In Required</h2>
              <p>
                This example requires authentication through Auth0. The SDK will
                automatically use your Auth0 token for API calls.
              </p>
              <button
                className="auth-button"
                onClick={() => loginWithRedirect()}
              >
                Sign In with Auth0
              </button>
            </div>

            <div className="info-section">
              <h3>How It Works</h3>
              <ol>
                <li>You sign in with Auth0</li>
                <li>Auth0 provides a JWT token</li>
                <li>Airbolt SDK automatically detects Auth0</li>
                <li>SDK includes the token in API requests</li>
                <li>Backend validates the token automatically!</li>
              </ol>
              <p className="note">
                <strong>Zero Config:</strong> In development, the backend
                accepts Auth0 tokens automatically. In production, configure
                EXTERNAL_JWT_ISSUER for security.
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="user-section">
              <h2>Welcome, {user?.name || user?.email}!</h2>
              <p>
                You're authenticated with Auth0. The chat below will use your
                Auth0 token.
              </p>
              <button
                className="logout-button"
                onClick={() =>
                  logout({ logoutParams: { returnTo: window.location.origin } })
                }
              >
                Sign Out
              </button>
            </div>

            <AuthDebugInfo />

            <div className="chat-section">
              <h2>Authenticated Chat</h2>
              <div className="chat-container">
                <ChatWidget
                  baseURL={baseURL}
                  position="relative"
                  theme={{
                    primaryColor: '#635BFF',
                    fontFamily: 'Inter, system-ui, sans-serif',
                  }}
                  placeholder={`Type a message... (authenticated as ${user?.email})`}
                  welcomeMessage={`Welcome ${user?.name || user?.email}! Your messages are authenticated with Auth0.`}
                />
              </div>
            </div>

            <div className="backend-config">
              <h3>Backend Configuration</h3>
              <div className="config-mode">
                <h4>🚀 Development Mode (Current)</h4>
                <p>
                  No configuration needed! The backend automatically validates
                  Auth0 tokens.
                </p>
                <p className="note">
                  You'll see warnings in the backend console - this is normal
                  for dev.
                </p>
              </div>
              <div className="config-mode">
                <h4>🔒 Production Mode</h4>
                <p>
                  For production, add to your backend <code>.env</code>:
                </p>
                <pre>
                  <code>
                    NODE_ENV=production
                    EXTERNAL_JWT_ISSUER=https://your-tenant.auth0.com/
                    EXTERNAL_JWT_AUDIENCE=https://airbolt-api
                  </code>
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
  // SDK automatically detects and uses Auth0 token!
/>`}</code>
          </pre>
          <p className="note">
            The SDK automatically detects Auth0 and includes your token in every
            request. No auth code needed in your components!
          </p>
        </div>
      </main>
    </div>
  );
}

export default App;
