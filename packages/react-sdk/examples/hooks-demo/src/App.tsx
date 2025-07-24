import { useChat } from '@airbolt/react-sdk';
import './App.css';

export function App() {
  const { messages, input, setInput, send, isLoading, error, clear, usage } =
    useChat({
      baseURL: 'http://localhost:3000', // For production, use your deployed URL like 'https://my-ai-backend.onrender.com'
      system: 'You are a helpful assistant. Keep responses concise.',
    });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send();
  };

  return (
    <div className="app">
      <h1>Airbolt Chat Demo</h1>

      {/* Display usage information when available */}
      {usage && usage.tokens && (
        <div className="usage-info">
          <div className="usage-text">
            Tokens: {usage.tokens.used.toLocaleString()} /{' '}
            {usage.tokens.limit.toLocaleString()}
          </div>
          <div className="usage-progress">
            <div
              className="usage-fill"
              style={{
                width: `${(usage.tokens.used / usage.tokens.limit) * 100}%`,
              }}
            />
          </div>
          <div className="usage-reset">
            Resets at {new Date(usage.tokens.resetAt).toLocaleTimeString()}
          </div>
        </div>
      )}

      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            <strong>{msg.role}:</strong> {msg.content}
          </div>
        ))}
        {isLoading && <div className="loading">AI is typing...</div>}
      </div>

      {error && (
        <div
          className={`error ${error.message.includes('429') ? 'rate-limit' : ''}`}
        >
          {error.message.includes('429') ? (
            <>
              Rate limit exceeded.
              {usage?.tokens && (
                <>
                  {' '}
                  Try again after{' '}
                  {new Date(usage.tokens.resetAt).toLocaleTimeString()}.
                </>
              )}
            </>
          ) : (
            <>Error: {error.message}</>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="input-form">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type a message..."
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading || !input.trim()}>
          Send
        </button>
        <button type="button" onClick={clear}>
          Clear
        </button>
      </form>
    </div>
  );
}
