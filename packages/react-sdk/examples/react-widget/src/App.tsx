import { ChatWidget } from '@airbolt/react-sdk';
import { useState } from 'react';
import './App.css';

export function App() {
  const [showCustomTheme, setShowCustomTheme] = useState(false);

  return (
    <div className="app">
      <header>
        <h1>Welcome to My App</h1>
        <p>
          This example shows how easy it is to add AI chat to your application.
        </p>
      </header>

      <main>
        <section>
          <h2>About This Demo</h2>
          <p>
            The ChatWidget below is a complete chat interface that handles
            everything: authentication, message history, loading states, and
            error handling.
          </p>
          <p>
            It's just one line of code: <code>&lt;ChatWidget /&gt;</code>
          </p>
          <p className="highlight">
            <strong>New:</strong> The widget now uses only 4 CSS custom properties for theming
            and inherits typography from its parent container!
          </p>
        </section>

        <section className="controls">
          <h2>Theme Options</h2>
          <label>
            <input
              type="checkbox"
              checked={showCustomTheme}
              onChange={(e) => setShowCustomTheme(e.target.checked)}
            />
            {' '}Enable custom theme with CSS variables
          </label>
        </section>

        <section className={`widget-container ${showCustomTheme ? 'custom-theme' : ''}`}>
          <h2>Try the Chat Widget</h2>
          <ChatWidget
            baseURL="http://localhost:3000" // For production, use your deployed URL like 'https://my-ai-backend.onrender.com'
            title="AI Assistant"
            placeholder="Ask me anything..."
            position="inline"
            minimalTheme={showCustomTheme ? {
              primary: '#FF6B6B',
              surface: '#F8F9FA',
              border: '#DEE2E6',
              text: '#212529'
            } : undefined}
          />
        </section>

        {showCustomTheme && (
          <section className="code-example">
            <h3>Code Example</h3>
            <pre>
              <code>{`<ChatWidget
  baseURL="http://localhost:3000"
  title="AI Assistant"
  minimalTheme={{
    primary: '#FF6B6B',
    surface: '#F8F9FA',
    border: '#DEE2E6',
    text: '#212529'
  }}
/>`}</code>
            </pre>
            <p>Or use CSS custom properties directly:</p>
            <pre>
              <code>{`.my-chat-container {
  --chat-primary: #FF6B6B;
  --chat-surface: #F8F9FA;
  --chat-border: #DEE2E6;
  --chat-text: #212529;
}`}</code>
            </pre>
          </section>
        )}
      </main>
    </div>
  );
}
