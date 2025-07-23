import { ChatWidget } from '@airbolt/react-sdk';
import './App.css';

export function StreamingApp() {
  return (
    <div className="app">
      <header>
        <h1>Streaming Chat Widget Demo</h1>
        <p>Experience real-time streaming responses with the ChatWidget!</p>
      </header>

      <main>
        <section>
          <h2>About Streaming</h2>
          <p>
            With streaming enabled, you'll see AI responses appear word-by-word
            as they're generated, providing a more interactive experience.
          </p>
          <p>
            Just add <code>streaming</code> prop to enable it!
          </p>
        </section>

        <section className="widget-container">
          <h2>Try the Streaming Chat Widget</h2>
          <ChatWidget
            baseURL="http://localhost:3000"
            title="Streaming AI Assistant"
            placeholder="Ask me to tell a story..."
            position="inline"
            streaming={true}
          />
        </section>

        <section>
          <h3>Compare with Non-Streaming</h3>
          <p>Here's a regular chat widget for comparison:</p>
          <ChatWidget
            baseURL="http://localhost:3000"
            title="Regular AI Assistant"
            placeholder="Ask me anything..."
            position="inline"
            streaming={false}
          />
        </section>
      </main>
    </div>
  );
}
