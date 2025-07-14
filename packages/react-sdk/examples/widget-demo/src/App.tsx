import { ChatWidget } from '@airbolt/react-sdk';
import './App.css';

export function App() {
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
        </section>

        <section className="widget-container">
          <h2>Try the Chat Widget</h2>
          <ChatWidget
            baseURL="http://localhost:3000"
            title="AI Assistant"
            placeholder="Ask me anything..."
            position="inline"
          />
        </section>
      </main>
    </div>
  );
}
