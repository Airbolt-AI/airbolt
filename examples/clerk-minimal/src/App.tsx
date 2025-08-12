import {
  SignInButton,
  SignOutButton,
  useAuth,
  useUser,
} from '@clerk/clerk-react';
import { ChatWidget } from '@airbolt/react-sdk';
import './App.css';

function App() {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const baseURL =
    import.meta.env.VITE_AIRBOLT_API_URL || 'http://localhost:3000';

  if (!isLoaded) {
    return (
      <div className="app">
        <div className="loading">
          <h2>Loading...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header>
        <h1>Airbolt + Clerk Zero Config</h1>
        <p className="subtitle">
          Authenticate with Clerk, chat with AI - no backend setup needed!
        </p>
      </header>

      <main>
        {!isSignedIn ? (
          <div className="auth-section">
            <h2>Welcome!</h2>
            <p>Sign in to start chatting with AI using Airbolt + Clerk.</p>
            <SignInButton>
              <button className="auth-button">Sign In</button>
            </SignInButton>

            <div className="info-box">
              <h3>🚀 Zero Config Magic</h3>
              <ul>
                <li>✅ No backend JWT configuration needed</li>
                <li>✅ Clerk tokens auto-detected by Airbolt</li>
                <li>✅ Secure authentication out of the box</li>
                <li>✅ Just add your Clerk keys and go!</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="chat-section">
            <div className="user-info">
              <span>
                Welcome,{' '}
                {user?.firstName || user?.emailAddresses[0]?.emailAddress}!
              </span>
              <SignOutButton>
                <button className="logout-button">Sign Out</button>
              </SignOutButton>
            </div>

            <div className="chat-container">
              <ChatWidget
                baseURL={baseURL}
                position="inline"
                theme="light"
                placeholder="Ask me anything..."
              />
            </div>
          </div>
        )}
      </main>

      <footer>
        <p className="tech-info">
          🔧 Powered by Clerk + Airbolt |
          {isSignedIn ? ' Authenticated & Ready' : ' Sign in to start'}
        </p>
      </footer>
    </div>
  );
}

export default App;
