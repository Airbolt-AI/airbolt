import React, { useState } from 'react';
import type { Story, StoryDefault } from '@ladle/react';
import { useChat } from './useChat.js';
import type { UseChatOptions } from '../types/index.js';

const ChatDemo = ({ options }: { options?: UseChatOptions }) => {
  const {
    messages,
    input,
    setInput,
    send,
    isLoading,
    error,
    clear,
    hasValidToken,
    clearToken,
  } = useChat(options);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send();
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <div
        style={{
          marginBottom: '10px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <span style={{ marginRight: '10px' }}>
            Status:{' '}
            {hasValidToken() ? '🟢 Authenticated' : '🔴 Not authenticated'}
          </span>
        </div>
        <div>
          <button onClick={clear} style={{ marginRight: '10px' }}>
            Clear Chat
          </button>
          <button onClick={clearToken}>Clear Token</button>
        </div>
      </div>

      <div
        style={{
          border: '1px solid #ddd',
          borderRadius: '8px',
          height: '400px',
          overflowY: 'auto',
          padding: '16px',
          marginBottom: '16px',
          backgroundColor: '#f9fafb',
        }}
      >
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: '#666' }}>
            No messages yet. Start a conversation!
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              marginBottom: '12px',
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: msg.role === 'user' ? '#e3f2fd' : '#f3e5f5',
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '70%',
              marginLeft: msg.role === 'user' ? 'auto' : '0',
            }}
          >
            <strong>{msg.role === 'user' ? 'You' : 'AI'}:</strong> {msg.content}
          </div>
        ))}
        {isLoading && (
          <div style={{ fontStyle: 'italic', color: '#666' }}>
            AI is typing...
          </div>
        )}
      </div>

      {error && (
        <div
          style={{
            backgroundColor: '#fee',
            color: '#c00',
            padding: '8px',
            borderRadius: '4px',
            marginBottom: '8px',
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
          placeholder="Type a message..."
          disabled={isLoading}
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: '4px',
            border: '1px solid #ddd',
            fontSize: '16px',
          }}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          style={{
            padding: '8px 16px',
            borderRadius: '4px',
            border: 'none',
            backgroundColor: '#007aff',
            color: 'white',
            cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
            opacity: isLoading || !input.trim() ? 0.6 : 1,
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default {
  title: 'Hooks/useChat',
  args: {
    baseURL: 'http://localhost:3000',
    system: 'You are a helpful assistant. Keep responses concise.',
  },
  argTypes: {
    baseURL: {
      control: { type: 'text' },
      description: 'Base URL for the Airbolt API',
    },
    system: {
      control: { type: 'text' },
      description: "System prompt to guide the AI's behavior",
    },
    provider: {
      control: { type: 'select' },
      options: ['openai', 'anthropic'],
      description: 'AI provider to use',
    },
    model: {
      control: { type: 'text' },
      description: 'Specific model to use',
    },
  },
} satisfies StoryDefault;

interface StoryArgs {
  baseURL?: string;
  system?: string;
  provider?: 'openai' | 'anthropic';
  model?: string;
}

// Basic Examples
export const Default: Story<StoryArgs> = ({
  baseURL,
  system,
  provider,
  model,
}) => {
  const options: UseChatOptions = {};
  if (baseURL !== undefined) options.baseURL = baseURL;
  if (system !== undefined) options.system = system;
  if (provider !== undefined) options.provider = provider;
  if (model !== undefined) options.model = model;

  return <ChatDemo options={options} />;
};
Default.storyName = 'Default (Interactive)';

export const BasicUsage: Story = () => (
  <div>
    <h3>Basic useChat Hook Usage</h3>
    <ChatDemo options={{ baseURL: 'http://localhost:3000' }} />
    <div
      style={{
        marginTop: '20px',
        backgroundColor: '#f5f5f5',
        padding: '20px',
        borderRadius: '8px',
      }}
    >
      <h4>Code Example:</h4>
      <pre
        style={{
          backgroundColor: '#282c34',
          color: '#abb2bf',
          padding: '16px',
          borderRadius: '4px',
          overflow: 'auto',
        }}
      >
        <code>{`import { useChat } from '@airbolt/react-sdk';

function ChatComponent() {
  const { messages, input, setInput, send, isLoading } = useChat({
    baseURL: 'http://localhost:3000'
  });

  return (
    <div>
      {messages.map((msg, i) => (
        <div key={i}>
          <b>{msg.role}:</b> {msg.content}
        </div>
      ))}
      
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyPress={e => e.key === 'Enter' && send()}
      />
      
      <button onClick={send} disabled={isLoading}>
        Send
      </button>
    </div>
  );
}`}</code>
      </pre>
    </div>
  </div>
);
BasicUsage.storyName = 'Basic Usage';

// Provider Configurations
export const ProviderOpenAI: Story = () => (
  <div>
    <h3>OpenAI Provider Example</h3>
    <ChatDemo
      options={{
        baseURL: 'http://localhost:3000',
        provider: 'openai',
        model: 'gpt-4o-mini',
        system: 'You are a helpful assistant powered by OpenAI.',
      }}
    />
  </div>
);
ProviderOpenAI.storyName = 'Provider/OpenAI';

export const ProviderAnthropic: Story = () => (
  <div>
    <h3>Anthropic Claude Example</h3>
    <ChatDemo
      options={{
        baseURL: 'http://localhost:3000',
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        system: 'You are Claude, an AI assistant created by Anthropic.',
      }}
    />
  </div>
);
ProviderAnthropic.storyName = 'Provider/Anthropic';

// System Prompt Examples
export const SystemPromptPirate: Story = () => (
  <div>
    <h3>Custom System Prompt - Pirate</h3>
    <p>This example uses a system prompt to make the AI respond as a pirate.</p>
    <ChatDemo
      options={{
        baseURL: 'http://localhost:3000',
        system:
          'You are a friendly pirate. Speak like a pirate in all your responses. Use pirate slang and expressions.',
      }}
    />
  </div>
);
SystemPromptPirate.storyName = 'System Prompt/Pirate';

// Streaming Examples
export const StreamingDemo: Story = () => {
  const ChatDemoWithStreaming = () => {
    const { messages, input, setInput, send, isLoading, isStreaming, error } =
      useChat({
        baseURL: 'http://localhost:3000',
        // streaming: true is the default
        onChunk: chunk => {
          console.log('Received chunk:', chunk);
        },
      });

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      send();
    };

    return (
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div
          style={{
            marginBottom: '10px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>
            Status:{' '}
            {isStreaming
              ? '🟢 Streaming'
              : isLoading
                ? '🟡 Connecting'
                : '⚫ Ready'}
          </span>
        </div>

        <div
          style={{
            border: '1px solid #ddd',
            borderRadius: '8px',
            height: '400px',
            overflowY: 'auto',
            padding: '16px',
            marginBottom: '16px',
            backgroundColor: '#f9fafb',
          }}
        >
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                marginBottom: '12px',
                padding: '8px 12px',
                borderRadius: '8px',
                backgroundColor: msg.role === 'user' ? '#e3f2fd' : '#f3e5f5',
                maxWidth: '70%',
                marginLeft: msg.role === 'user' ? 'auto' : '0',
              }}
            >
              <strong>{msg.role === 'user' ? 'You' : 'AI'}:</strong>{' '}
              {msg.content}
            </div>
          ))}
          {isStreaming && (
            <div
              style={{
                fontStyle: 'italic',
                color: '#059669',
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            >
              AI is streaming response...
            </div>
          )}
        </div>

        {error && (
          <div
            style={{
              backgroundColor: '#fee',
              color: '#c00',
              padding: '8px',
              borderRadius: '4px',
              marginBottom: '8px',
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
            placeholder="Ask me to tell a story..."
            disabled={isLoading || isStreaming}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '4px',
              border: '1px solid #ddd',
              fontSize: '16px',
            }}
          />
          <button
            type="submit"
            disabled={isLoading || isStreaming || !input.trim()}
            style={{
              padding: '8px 16px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: '#007aff',
              color: 'white',
              cursor:
                isLoading || isStreaming || !input.trim()
                  ? 'not-allowed'
                  : 'pointer',
              opacity: isLoading || isStreaming || !input.trim() ? 0.6 : 1,
            }}
          >
            {isStreaming ? 'Streaming...' : 'Send'}
          </button>
        </form>

        <style>{`
          @keyframes pulse {
            0% { opacity: 0.6; }
            50% { opacity: 1; }
            100% { opacity: 0.6; }
          }
        `}</style>
      </div>
    );
  };

  return (
    <div>
      <h3>Streaming Response Demo</h3>
      <p>
        Streaming is enabled by default. Watch as responses appear word-by-word!
      </p>
      <ChatDemoWithStreaming />
      <div
        style={{
          marginTop: '20px',
          backgroundColor: '#f5f5f5',
          padding: '20px',
          borderRadius: '8px',
        }}
      >
        <h4>Features demonstrated:</h4>
        <ul>
          <li>Real-time streaming indicator (green status)</li>
          <li>onChunk callback (check console)</li>
          <li>Disabled input during streaming</li>
          <li>Different states: Ready → Connecting → Streaming</li>
        </ul>
      </div>
    </div>
  );
};
StreamingDemo.storyName = 'Streaming/Live Demo';

export const StreamingVsNonStreaming: Story = () => {
  const [mode, setMode] = useState<'streaming' | 'non-streaming'>('streaming');

  return (
    <div>
      <h3>Streaming vs Non-Streaming Comparison</h3>
      <div style={{ marginBottom: '20px' }}>
        <label style={{ marginRight: '20px' }}>
          <input
            type="radio"
            name="mode"
            checked={mode === 'streaming'}
            onChange={() => setMode('streaming')}
          />
          Streaming (Default)
        </label>
        <label>
          <input
            type="radio"
            name="mode"
            checked={mode === 'non-streaming'}
            onChange={() => setMode('non-streaming')}
          />
          Non-Streaming (chatSync)
        </label>
      </div>
      <ChatDemo
        options={{
          baseURL: 'http://localhost:3000',
          streaming: mode === 'streaming',
          system:
            mode === 'streaming'
              ? 'You are a helpful assistant. When responding, provide detailed answers to showcase the streaming effect.'
              : 'You are a helpful assistant. Keep responses concise.',
        }}
      />
      <div
        style={{
          marginTop: '20px',
          backgroundColor: '#f5f5f5',
          padding: '20px',
          borderRadius: '8px',
        }}
      >
        <h4>Code Example:</h4>
        <pre
          style={{
            backgroundColor: '#282c34',
            color: '#abb2bf',
            padding: '16px',
            borderRadius: '4px',
            overflow: 'auto',
          }}
        >
          <code>
            {mode === 'streaming'
              ? `// Streaming mode (default)
const { messages, send, isStreaming } = useChat({
  baseURL: 'http://localhost:3000',
  // streaming: true is the default
  onChunk: (chunk) => {
    console.log('Received chunk:', chunk);
  }
});`
              : `// Non-streaming mode
const { messages, send, isLoading } = useChat({
  baseURL: 'http://localhost:3000',
  streaming: false  // Explicitly disable streaming
});`}
          </code>
        </pre>
      </div>
    </div>
  );
};
StreamingVsNonStreaming.storyName = 'Streaming/Comparison';

export const StreamingWithOnChunk: Story = () => {
  const [chunks, setChunks] = useState<string[]>([]);

  const ChatDemoWithChunks = () => {
    const { messages, input, setInput, send, isStreaming } = useChat({
      baseURL: 'http://localhost:3000',
      onChunk: chunk => {
        setChunks(prev => [...prev, chunk]);
      },
    });

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      setChunks([]); // Clear chunks on new message
      send();
    };

    return (
      <div style={{ display: 'flex', gap: '20px' }}>
        <div style={{ flex: 1 }}>
          <h4>Chat</h4>
          <div
            style={{
              border: '1px solid #ddd',
              borderRadius: '8px',
              height: '300px',
              overflowY: 'auto',
              padding: '16px',
              marginBottom: '16px',
              backgroundColor: '#f9fafb',
            }}
          >
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  marginBottom: '12px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  backgroundColor: msg.role === 'user' ? '#e3f2fd' : '#f3e5f5',
                  maxWidth: '70%',
                  marginLeft: msg.role === 'user' ? 'auto' : '0',
                }}
              >
                <strong>{msg.role === 'user' ? 'You' : 'AI'}:</strong>{' '}
                {msg.content}
              </div>
            ))}
          </div>
          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Type a message..."
              disabled={isStreaming}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '4px',
                border: '1px solid #ddd',
              }}
            />
            <button
              type="submit"
              disabled={isStreaming || !input.trim()}
              style={{
                padding: '8px 16px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: '#007aff',
                color: 'white',
                cursor:
                  isStreaming || !input.trim() ? 'not-allowed' : 'pointer',
                opacity: isStreaming || !input.trim() ? 0.6 : 1,
              }}
            >
              Send
            </button>
          </form>
        </div>
        <div style={{ flex: 1 }}>
          <h4>onChunk Callback Log</h4>
          <div
            style={{
              border: '1px solid #ddd',
              borderRadius: '8px',
              height: '350px',
              overflowY: 'auto',
              padding: '16px',
              backgroundColor: '#282c34',
              color: '#abb2bf',
              fontFamily: 'monospace',
              fontSize: '14px',
            }}
          >
            {chunks.length === 0 && (
              <div style={{ color: '#666' }}>Chunks will appear here...</div>
            )}
            {chunks.map((chunk, i) => (
              <div key={i} style={{ marginBottom: '4px' }}>
                <span style={{ color: '#98c379' }}>Chunk {i + 1}:</span>{' '}
                <span style={{ color: '#e06c75' }}>"{chunk}"</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <h3>onChunk Callback Demo</h3>
      <p>
        The onChunk callback lets you handle each piece of the response as it
        arrives.
      </p>
      <ChatDemoWithChunks />
    </div>
  );
};
StreamingWithOnChunk.storyName = 'Streaming/onChunk Callback';

// Advanced Features
export const AdvancedErrorHandling: Story = () => {
  const [simulateError, setSimulateError] = useState(false);

  return (
    <div>
      <h3>Error Handling Example</h3>
      <div style={{ marginBottom: '10px' }}>
        <label>
          <input
            type="checkbox"
            checked={simulateError}
            onChange={e => setSimulateError(e.target.checked)}
          />
          Simulate API Error (use wrong baseURL)
        </label>
      </div>
      <ChatDemo
        options={{
          baseURL: simulateError
            ? 'http://invalid-url:9999'
            : 'http://localhost:3000',
          system: 'You are a helpful assistant.',
        }}
      />
    </div>
  );
};
AdvancedErrorHandling.storyName = 'Advanced/Error Handling';

export const AdvancedInitialMessages: Story = () => {
  const initialMessages = [
    {
      role: 'assistant' as const,
      content: "Hello! I'm your AI assistant. How can I help you today?",
    },
    { role: 'user' as const, content: 'Can you explain what Airbolt is?' },
    {
      role: 'assistant' as const,
      content:
        'Airbolt is a production-ready backend solution that allows you to securely call AI language models (LLMs) from your frontend applications. It acts as a proxy between your frontend and AI providers like OpenAI and Anthropic, keeping your API keys secure on the backend while providing features like authentication, rate limiting, and usage tracking.',
    },
  ];

  const ChatDemoWithInitial = () => {
    const { messages, input, setInput, send, isLoading } = useChat({
      baseURL: 'http://localhost:3000',
      initialMessages,
    });

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      send();
    };

    return (
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div
          style={{
            border: '1px solid #ddd',
            borderRadius: '8px',
            height: '400px',
            overflowY: 'auto',
            padding: '16px',
            marginBottom: '16px',
            backgroundColor: '#f9fafb',
          }}
        >
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                marginBottom: '12px',
                padding: '8px 12px',
                borderRadius: '8px',
                backgroundColor: msg.role === 'user' ? '#e3f2fd' : '#f3e5f5',
                maxWidth: '70%',
                marginLeft: msg.role === 'user' ? 'auto' : '0',
              }}
            >
              <strong>{msg.role === 'user' ? 'You' : 'AI'}:</strong>{' '}
              {msg.content}
            </div>
          ))}
          {isLoading && (
            <div style={{ fontStyle: 'italic', color: '#666' }}>
              AI is typing...
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Continue the conversation..."
            disabled={isLoading}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '4px',
              border: '1px solid #ddd',
              fontSize: '16px',
            }}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            style={{
              padding: '8px 16px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: '#007aff',
              color: 'white',
              cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
              opacity: isLoading || !input.trim() ? 0.6 : 1,
            }}
          >
            Send
          </button>
        </form>
      </div>
    );
  };

  return (
    <div>
      <h3>Chat with Initial Messages</h3>
      <p>
        This example shows how to pre-populate the chat with an existing
        conversation.
      </p>
      <ChatDemoWithInitial />
    </div>
  );
};
AdvancedInitialMessages.storyName = 'Advanced/Initial Messages';

export const StreamingPerformance: Story = () => (
  <div>
    <h3>Streaming Performance Tips</h3>
    <div
      style={{
        backgroundColor: '#f5f5f5',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '20px',
      }}
    >
      <h4>Best Practices:</h4>
      <ul>
        <li>
          <strong>Default behavior:</strong> Streaming is enabled by default for
          better UX
        </li>
        <li>
          <strong>Network efficiency:</strong> Streaming uses Server-Sent Events
          (SSE) for real-time updates
        </li>
        <li>
          <strong>Error resilience:</strong> Connection drops are handled
          gracefully
        </li>
        <li>
          <strong>State management:</strong> Use isStreaming to show appropriate
          UI feedback
        </li>
      </ul>
      <h4>When to disable streaming:</h4>
      <ul>
        <li>When you need the complete response before processing</li>
        <li>For simple yes/no answers where streaming adds no value</li>
        <li>When integrating with systems that expect complete responses</li>
      </ul>
    </div>
    <ChatDemo
      options={{
        baseURL: 'http://localhost:3000',
        system:
          'You are a performance-focused assistant. Explain the benefits of streaming responses.',
      }}
    />
  </div>
);
StreamingPerformance.storyName = 'Streaming/Performance Guide';
