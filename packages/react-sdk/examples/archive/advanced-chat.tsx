import React, { useState } from 'react';
import { useChat } from '@airbolt/react-sdk';

/**
 * Advanced chat application with system prompt customization
 */
export function AdvancedChatApp() {
  const [systemPrompt, setSystemPrompt] = useState(
    'You are a helpful assistant.'
  );
  const [apiUrl, setApiUrl] = useState('http://localhost:3000');
  const [showSettings, setShowSettings] = useState(false);

  const { messages, input, setInput, send, clear, isLoading, error } = useChat({
    system: systemPrompt,
    baseURL: apiUrl,
    initialMessages: [
      {
        role: 'assistant',
        content: "Hello! I'm your AI assistant. How can I help you today?",
      },
    ],
  });

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const exportChat = () => {
    const chatData = {
      system: systemPrompt,
      messages,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(chatData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
        }}
      >
        <h1>Advanced Airbolt Chat</h1>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setShowSettings(!showSettings)}
            style={{
              padding: '8px 16px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            {showSettings ? 'Hide' : 'Show'} Settings
          </button>

          <button
            onClick={exportChat}
            disabled={messages.length === 0}
            style={{
              padding: '8px 16px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: messages.length === 0 ? 'not-allowed' : 'pointer',
              opacity: messages.length === 0 ? 0.6 : 1,
            }}
          >
            Export Chat
          </button>

          <button
            onClick={clear}
            disabled={messages.length === 0}
            style={{
              padding: '8px 16px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: messages.length === 0 ? 'not-allowed' : 'pointer',
              opacity: messages.length === 0 ? 0.6 : 1,
            }}
          >
            Clear Chat
          </button>
        </div>
      </header>

      {showSettings && (
        <div
          style={{
            backgroundColor: '#f8f9fa',
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '20px',
          }}
        >
          <h3>Settings</h3>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px' }}>
              API Endpoint:
            </label>
            <input
              type="text"
              value={apiUrl}
              onChange={e => setApiUrl(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px' }}>
              System Prompt:
            </label>
            <textarea
              value={systemPrompt}
              onChange={e => setSystemPrompt(e.target.value)}
              rows={3}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                resize: 'vertical',
              }}
            />
          </div>

          <p
            style={{
              marginTop: '8px',
              fontSize: '14px',
              color: '#666',
            }}
          >
            Note: Changes will apply to new conversations. Clear chat to start
            fresh.
          </p>
        </div>
      )}

      <div
        style={{
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          height: '500px',
          overflowY: 'auto',
          padding: '16px',
          marginBottom: '16px',
          backgroundColor: '#ffffff',
        }}
      >
        {messages.map((message, index) => (
          <div
            key={index}
            style={{
              marginBottom: '16px',
              display: 'flex',
              justifyContent:
                message.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              style={{
                maxWidth: '70%',
                padding: '12px 16px',
                borderRadius: '12px',
                backgroundColor:
                  message.role === 'user' ? '#007bff' : '#e9ecef',
                color: message.role === 'user' ? 'white' : 'black',
              }}
            >
              <div
                style={{
                  fontSize: '12px',
                  opacity: 0.8,
                  marginBottom: '4px',
                }}
              >
                {message.role === 'user' ? 'You' : 'Assistant'}
              </div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{message.content}</div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-start',
              marginBottom: '16px',
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '12px',
                backgroundColor: '#e9ecef',
                color: '#666',
              }}
            >
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div
          style={{
            backgroundColor: '#f8d7da',
            color: '#721c24',
            padding: '12px',
            borderRadius: '4px',
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>Failed to send message: {error.message}</span>
          <button
            onClick={send}
            style={{
              padding: '4px 12px',
              backgroundColor: '#721c24',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px' }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your message... (Press Enter to send, Shift+Enter for new line)"
          disabled={isLoading}
          rows={3}
          style={{
            flex: 1,
            padding: '12px',
            fontSize: '16px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            resize: 'vertical',
          }}
        />

        <button
          onClick={send}
          disabled={isLoading || !input.trim()}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
            opacity: isLoading || !input.trim() ? 0.6 : 1,
            alignSelf: 'flex-end',
          }}
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </div>

      <style>{`
        .typing-indicator {
          display: flex;
          gap: 4px;
        }
        .typing-indicator span {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background-color: #666;
          animation: typing 1.4s infinite;
        }
        .typing-indicator span:nth-child(2) {
          animation-delay: 0.2s;
        }
        .typing-indicator span:nth-child(3) {
          animation-delay: 0.4s;
        }
        @keyframes typing {
          0%, 60%, 100% {
            opacity: 0.3;
          }
          30% {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
