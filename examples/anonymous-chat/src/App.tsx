import { useState } from 'react';
import { ChatWidget } from '@airbolt/react-sdk';
import './App.css';

function App() {
  const [showChat, setShowChat] = useState(false);
  const [baseURL, setBaseURL] = useState('http://localhost:3000');

  return (
    <div className="app">
      <header>
        <h1>Airbolt Anonymous Chat Example</h1>
        <p>
          This example demonstrates Airbolt's built-in JWT authentication - no
          external auth provider needed!
        </p>
      </header>

      <main>
        <div className="config-section">
          <h2>Configuration</h2>
          <div className="config-item">
            <label htmlFor="baseURL">Backend URL:</label>
            <input
              id="baseURL"
              type="text"
              value={baseURL}
              onChange={e => setBaseURL(e.target.value)}
              placeholder="http://localhost:3000"
            />
          </div>
          <p className="info">
            Make sure your Airbolt backend is running at this URL.
            <br />
            Run <code>cd apps/backend-api && pnpm dev</code> to start it.
          </p>
        </div>

        <div className="demo-section">
          <h2>Try It Out</h2>
          {!showChat ? (
            <button className="start-button" onClick={() => setShowChat(true)}>
              Start Anonymous Chat
            </button>
          ) : (
            <div className="chat-container">
              <ChatWidget
                baseURL={baseURL}
                position="relative"
                theme={{
                  primaryColor: '#007bff',
                  fontFamily: 'Inter, system-ui, sans-serif',
                }}
                placeholder="Type a message... (anonymous user)"
                welcomeMessage="Welcome! You're chatting anonymously with Airbolt's built-in authentication."
              />
            </div>
          )}
        </div>

        <div className="features-section">
          <h2>What's Happening?</h2>
          <ul>
            <li>✅ No login required - instant access</li>
            <li>✅ Automatic JWT token generation</li>
            <li>✅ Built-in rate limiting per anonymous session</li>
            <li>✅ Full streaming support</li>
            <li>✅ Usage tracking and display</li>
          </ul>
        </div>

        <div className="code-section">
          <h2>Integration Code</h2>
          <pre>
            <code>{`import { ChatWidget } from '@airbolt/react-sdk';

function App() {
  return (
    <ChatWidget
      baseURL="http://localhost:3000"
      position="relative"
      theme={{
        primaryColor: '#007bff',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
      placeholder="Type a message..."
      welcomeMessage="Welcome to Airbolt!"
    />
  );
}`}</code>
          </pre>
        </div>
      </main>
    </div>
  );
}

export default App;
