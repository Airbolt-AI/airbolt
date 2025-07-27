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
              <h3>How BYOA Works</h3>
              <ol>
                <li>User signs in with Auth0</li>
                <li>Auth0 provides a JWT access token</li>
                <li>Airbolt SDK automatically detects Auth0</li>
                <li>SDK includes the token in API requests</li>
                <li>Backend validates the token using your public key</li>
              </ol>
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
                  placeholder="Type a message... (authenticated as ${user?.email})"
                  welcomeMessage={`Welcome ${user?.name || user?.email}! Your messages are authenticated with Auth0.`}
                />
              </div>
            </div>

            <div className="backend-config">
              <h3>Backend Configuration Required</h3>
              <p>
                Make sure your Airbolt backend has the Auth0 public key
                configured:
              </p>
              <pre>
                <code>
                  EXTERNAL_JWT_PUBLIC_KEY="-----BEGIN PUBLIC
                  KEY-----\n...\n-----END PUBLIC KEY-----"
                </code>
              </pre>
              <p>
                Get your public key from Auth0 Dashboard → Applications → Your
                App → Settings → Show Advanced Settings → Certificates →
                Download Certificate (PEM format)
              </p>
            </div>
          </>
        )}

        <div className="code-section">
          <h2>Integration Code</h2>
          <pre>
            <code>{`// main.tsx - Auth0 Provider Setup
import { Auth0Provider } from '@auth0/auth0-react';

<Auth0Provider
  domain={domain}
  clientId={clientId}
  authorizationParams={{
    redirect_uri: window.location.origin,
    audience: audience,
    scope: 'openid profile email',
  }}
>
  <App />
</Auth0Provider>

// App.tsx - Using ChatWidget (no auth code needed!)
import { ChatWidget } from '@airbolt/react-sdk';

<ChatWidget
  baseURL="http://localhost:3000"
  // SDK automatically detects and uses Auth0 token
/>`}</code>
          </pre>
        </div>
      </main>
    </div>
  );
}

export default App;
