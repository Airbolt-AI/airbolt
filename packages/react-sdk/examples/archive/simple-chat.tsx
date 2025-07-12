import React from 'react';
import { useChat } from '@airbolt/react-sdk';

/**
 * Simple chat application demonstrating the useChat hook
 */
export function SimpleChatApp() {
  const { messages, input, setInput, send, clear, isLoading, error } = useChat({
    system: 'You are a helpful assistant who provides concise answers.',
    baseURL: 'http://localhost:3000', // Default API endpoint
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send();
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <h1>Airbolt Chat Demo</h1>

      <div
        style={{
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          height: '400px',
          overflowY: 'auto',
          padding: '16px',
          marginBottom: '16px',
          backgroundColor: '#f5f5f5',
        }}
      >
        {messages.length === 0 && (
          <p style={{ color: '#666', textAlign: 'center' }}>
            Start a conversation by typing a message below...
          </p>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            style={{
              marginBottom: '12px',
              padding: '8px 12px',
              borderRadius: '6px',
              backgroundColor: message.role === 'user' ? '#e3f2fd' : '#f3e5f5',
              marginLeft: message.role === 'user' ? '60px' : '0',
              marginRight: message.role === 'assistant' ? '60px' : '0',
            }}
          >
            <strong
              style={{
                color: message.role === 'user' ? '#1976d2' : '#7b1fa2',
                fontSize: '12px',
                textTransform: 'uppercase',
              }}
            >
              {message.role}
            </strong>
            <p style={{ margin: '4px 0 0 0' }}>{message.content}</p>
          </div>
        ))}

        {isLoading && (
          <div
            style={{
              textAlign: 'center',
              color: '#666',
              fontStyle: 'italic',
            }}
          >
            AI is thinking...
          </div>
        )}
      </div>

      {error && (
        <div
          style={{
            backgroundColor: '#ffebee',
            color: '#c62828',
            padding: '12px',
            borderRadius: '4px',
            marginBottom: '16px',
          }}
        >
          Error: {error.message}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type your message..."
          disabled={isLoading}
          style={{
            flex: 1,
            padding: '10px',
            fontSize: '16px',
            border: '1px solid #ddd',
            borderRadius: '4px',
          }}
        />

        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: '#1976d2',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
            opacity: isLoading || !input.trim() ? 0.6 : 1,
          }}
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>

        <button
          type="button"
          onClick={clear}
          disabled={messages.length === 0}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: messages.length === 0 ? 'not-allowed' : 'pointer',
            opacity: messages.length === 0 ? 0.6 : 1,
          }}
        >
          Clear
        </button>
      </form>
    </div>
  );
}
