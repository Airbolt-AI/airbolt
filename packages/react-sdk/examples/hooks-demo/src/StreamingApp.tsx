import { useChat } from '@airbolt/react-sdk';
import './App.css';

export function StreamingApp() {
  const {
    messages,
    input,
    setInput,
    send,
    isLoading,
    isStreaming,
    error,
    clear,
  } = useChat({
    baseURL: 'http://localhost:3000', // For production, use your deployed URL
    system: 'You are a helpful assistant. Keep responses concise.',
    streaming: true, // Enable streaming
    onChunk: chunk => {
      // Optional: Handle individual chunks (e.g., for debugging)
      console.log('Received chunk:', chunk);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send();
  };

  return (
    <div className="app">
      <h1>Airbolt Streaming Chat Demo</h1>
      <p className="subtitle">Watch responses stream in real-time!</p>

      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            <strong>{msg.role}:</strong> {msg.content}
          </div>
        ))}
        {isLoading && <div className="loading">Connecting...</div>}
        {isStreaming && (
          <div className="streaming">AI is streaming response...</div>
        )}
      </div>

      {error && <div className="error">Error: {error.message}</div>}

      <form onSubmit={handleSubmit} className="input-form">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type a message..."
          disabled={isLoading || isStreaming}
        />
        <button
          type="submit"
          disabled={isLoading || isStreaming || !input.trim()}
        >
          {isStreaming ? 'Streaming...' : 'Send'}
        </button>
        <button type="button" onClick={clear}>
          Clear
        </button>
      </form>

      <div className="status">
        Status:{' '}
        {isStreaming
          ? '🟢 Streaming'
          : isLoading
            ? '🟡 Connecting'
            : '⚫ Ready'}
      </div>
    </div>
  );
}
