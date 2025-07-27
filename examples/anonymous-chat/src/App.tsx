import { ChatWidget } from '@airbolt/react-sdk';
import './App.css';

// This is a minimal example showing Airbolt's anonymous chat
// No authentication setup required - tokens are handled automatically!

function App() {
  return (
    <div className="app">
      <header>
        <h1>Anonymous Chat</h1>
        <p className="subtitle">
          Start chatting immediately - no login required
        </p>
      </header>

      <main>
        <ChatWidget
          baseURL="http://localhost:3000"
          position="relative"
          theme={{
            primaryColor: '#007bff',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
          placeholder="Type a message..."
          welcomeMessage="Welcome! I'm ready to help. Ask me anything."
        />
      </main>

      <footer>
        <p className="hint">
          💡 Make sure your backend is running:{' '}
          <code>cd apps/backend-api && pnpm dev</code>
        </p>
      </footer>
    </div>
  );
}

export default App;
