import React, { useState, useEffect } from 'react';
import type { Story, StoryDefault } from '@ladle/react';
import { ChatWidget } from './ChatWidget.js';
import { useChat } from '../hooks/useChat.js';
import type { UsageInfo } from '@airbolt/sdk';

/**
 * Visual component to display usage information with progress bars
 */
const UsageDisplay = ({ usage }: { usage: UsageInfo | null }) => {
  if (!usage) return null;

  const formatResetTime = (resetAt: string | undefined) => {
    if (!resetAt) return 'N/A';
    try {
      const resetDate = new Date(resetAt);
      const now = new Date();
      const diffMs = resetDate.getTime() - now.getTime();

      if (isNaN(diffMs) || diffMs < 0) return 'N/A';

      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);

      if (diffHours > 0) {
        return `${diffHours}h ${diffMins % 60}m`;
      }
      return `${diffMins}m`;
    } catch (e) {
      return 'N/A';
    }
  };

  const getProgressColor = (percentage: number) => {
    if (isNaN(percentage)) return '#6b7280'; // gray for invalid
    if (percentage >= 90) return '#dc2626'; // red
    if (percentage >= 70) return '#f59e0b'; // orange
    return '#10b981'; // green
  };

  return (
    <div
      style={{
        backgroundColor: '#f3f4f6',
        padding: '16px',
        borderRadius: '8px',
        marginBottom: '16px',
        fontSize: '14px',
      }}
    >
      <h4 style={{ margin: '0 0 12px 0' }}>Usage Information</h4>

      {usage.total_tokens && usage.total_tokens > 0 && (
        <div style={{ marginBottom: '8px' }}>
          <strong>This request:</strong> {usage.total_tokens.toLocaleString()}{' '}
          tokens
        </div>
      )}

      {usage.tokens && usage.tokens.limit && (
        <div style={{ marginBottom: '12px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '4px',
            }}
          >
            <span>
              <strong>Tokens:</strong>
            </span>
            <span>
              {(usage.tokens.used || 0).toLocaleString()} /{' '}
              {usage.tokens.limit.toLocaleString()}
            </span>
          </div>
          <div
            style={{
              backgroundColor: '#e5e7eb',
              borderRadius: '4px',
              height: '20px',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <div
              style={{
                backgroundColor: getProgressColor(
                  ((usage.tokens.used || 0) / usage.tokens.limit) * 100
                ),
                height: '100%',
                width: `${Math.min(100, ((usage.tokens.used || 0) / usage.tokens.limit) * 100)}%`,
                transition: 'width 0.3s ease',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: '12px',
                fontWeight: 'bold',
                color: '#374151',
              }}
            >
              {usage.tokens.remaining !== undefined
                ? `${Math.round((usage.tokens.remaining / usage.tokens.limit) * 100)}%`
                : '0%'}{' '}
              remaining
            </div>
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
            Resets in {formatResetTime(usage.tokens.resetAt)}
          </div>
        </div>
      )}

      {usage.requests && usage.requests.limit && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '4px',
            }}
          >
            <span>
              <strong>Requests:</strong>
            </span>
            <span>
              {usage.requests.used || 0} / {usage.requests.limit}
            </span>
          </div>
          <div
            style={{
              backgroundColor: '#e5e7eb',
              borderRadius: '4px',
              height: '20px',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <div
              style={{
                backgroundColor: getProgressColor(
                  ((usage.requests.used || 0) / usage.requests.limit) * 100
                ),
                height: '100%',
                width: `${Math.min(100, ((usage.requests.used || 0) / usage.requests.limit) * 100)}%`,
                transition: 'width 0.3s ease',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: '12px',
                fontWeight: 'bold',
                color: '#374151',
              }}
            >
              {usage.requests.remaining !== undefined
                ? usage.requests.remaining
                : 0}{' '}
              remaining
            </div>
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
            Resets in {formatResetTime(usage.requests.resetAt)}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Demo component showing rate limiting with custom UI
 */
const RateLimitingDemo = ({
  baseURL = 'http://localhost:3000',
}: {
  baseURL?: string;
}) => {
  const { messages, input, setInput, send, isLoading, error, usage } = useChat({
    baseURL,
    system:
      'You are a helpful assistant. Keep responses concise to demonstrate rate limiting.',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send();
  };

  // Show warning when approaching limits
  const showWarning =
    usage &&
    ((usage.tokens &&
      usage.tokens.limit &&
      (usage.tokens.used || 0) / usage.tokens.limit > 0.8) ||
      (usage.requests &&
        usage.requests.limit &&
        (usage.requests.used || 0) / usage.requests.limit > 0.8));

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h3>Rate Limiting Demo</h3>

      {showWarning && (
        <div
          style={{
            backgroundColor: '#fef3c7',
            border: '1px solid #f59e0b',
            borderRadius: '6px',
            padding: '12px',
            marginBottom: '16px',
            fontSize: '14px',
          }}
        >
          <strong>⚠️ Warning:</strong> You're approaching your rate limits.
          Consider waiting before sending more messages.
        </div>
      )}

      <UsageDisplay usage={usage} />

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
            Send messages to see rate limiting in action!
          </div>
        )}
        {messages
          .filter(msg => msg.content !== '')
          .map((msg, i) => (
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
            AI is thinking...
          </div>
        )}
      </div>

      {error && error.message.includes('429') && (
        <div
          style={{
            backgroundColor: '#fee',
            color: '#dc2626',
            padding: '12px',
            borderRadius: '6px',
            marginBottom: '16px',
          }}
        >
          <strong>Rate Limit Exceeded!</strong>
          <br />
          {error.message}
          <br />
          {usage && (
            <div style={{ marginTop: '8px', fontSize: '14px' }}>
              {usage.tokens &&
                `Token reset: ${new Date(usage.tokens.resetAt).toLocaleTimeString()}`}
              {usage.tokens && usage.requests && ' | '}
              {usage.requests &&
                `Request reset: ${new Date(usage.requests.resetAt).toLocaleTimeString()}`}
            </div>
          )}
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

/**
 * Simulated rate limit scenario
 */
const SimulatedRateLimitDemo = () => {
  const [simulatedUsage, setSimulatedUsage] = useState<UsageInfo>({
    total_tokens: 250,
    tokens: {
      used: 750,
      remaining: 250,
      limit: 1000,
      resetAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
    },
    requests: {
      used: 3,
      remaining: 2,
      limit: 5,
      resetAt: new Date(Date.now() + 2 * 60 * 1000).toISOString(), // 2 minutes
    },
  });

  const simulateUsage = () => {
    setSimulatedUsage(prev => {
      const tokenIncrease = Math.floor(Math.random() * 200) + 50; // 50-250 tokens per request
      const newTokenUsed = Math.min(
        prev.tokens!.limit,
        prev.tokens!.used + tokenIncrease
      );
      const newRequestUsed = Math.min(
        prev.requests!.limit,
        prev.requests!.used + 1
      );

      return {
        ...prev,
        total_tokens: tokenIncrease,
        tokens: {
          ...prev.tokens!,
          used: newTokenUsed,
          remaining: Math.max(0, prev.tokens!.limit - newTokenUsed),
        },
        requests: {
          ...prev.requests!,
          used: newRequestUsed,
          remaining: Math.max(0, prev.requests!.limit - newRequestUsed),
        },
      };
    });
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <h3>Simulated Rate Limit Scenarios</h3>
      <p>
        This example uses very low limits (5 requests, 1000 tokens) to make it
        easy to test rate limiting behavior. Click "Simulate API Call" a few
        times to see the warnings and eventually hit the limits.
      </p>

      <UsageDisplay usage={simulatedUsage} />

      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={simulateUsage}
          style={{
            padding: '8px 16px',
            borderRadius: '4px',
            border: 'none',
            backgroundColor: '#007aff',
            color: 'white',
            cursor: 'pointer',
          }}
        >
          Simulate API Call
        </button>
        <button
          onClick={() => {
            setSimulatedUsage({
              total_tokens: 0,
              tokens: {
                used: 0,
                remaining: 1000,
                limit: 1000,
                resetAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
              },
              requests: {
                used: 0,
                remaining: 5,
                limit: 5,
                resetAt: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
              },
            });
          }}
          style={{
            padding: '8px 16px',
            borderRadius: '4px',
            border: '1px solid #007aff',
            backgroundColor: 'white',
            color: '#007aff',
            cursor: 'pointer',
          }}
        >
          Reset Usage
        </button>
      </div>

      <div style={{ marginTop: '20px', fontSize: '14px', color: '#6b7280' }}>
        <h4>Usage States:</h4>
        <ul>
          <li>🟢 Green (0-70%): Plenty of capacity remaining</li>
          <li>🟠 Orange (70-90%): Approaching limits, consider slowing down</li>
          <li>
            🔴 Red (90-100%): Very close to limit, likely to hit rate limits
            soon
          </li>
        </ul>
        <h4>Test Scenarios:</h4>
        <ul>
          <li>Click "Simulate API Call" 4 times to see orange warnings</li>
          <li>Click 5 times to hit the request limit</li>
          <li>Each click uses 50-250 tokens (randomly)</li>
          <li>Usually hits token limit after 5-8 clicks</li>
          <li>Use "Reset Usage" to start over</li>
        </ul>
      </div>
    </div>
  );
};

export default {
  title: 'Components/Rate Limiting',
} satisfies StoryDefault;

// Main examples
export const TokenAndRequestUsage: Story = () => <RateLimitingDemo />;
TokenAndRequestUsage.storyName = 'Token & Request Usage';

export const RateLimitScenarios: Story = () => <SimulatedRateLimitDemo />;
RateLimitScenarios.storyName = 'Rate Limit Scenarios';

export const WidgetWithRateLimiting: Story = () => (
  <div>
    <h3>ChatWidget with Rate Limiting</h3>
    <div
      style={{
        backgroundColor: '#e8f4f8',
        border: '1px solid #3b82f6',
        borderRadius: '6px',
        padding: '16px',
        marginBottom: '20px',
      }}
    >
      <strong>💡 Testing Tip:</strong> For the best experience testing rate
      limits:
      <ol style={{ marginTop: '8px', marginBottom: '0' }}>
        <li>
          Configure your backend with low limits (see Live Testing example)
        </li>
        <li>Open the chat widget below</li>
        <li>Send 4-5 quick messages like "Hi", "Test", "Hello"</li>
        <li>Watch the usage display update in the widget header</li>
        <li>See the error message when you hit the limit</li>
      </ol>
    </div>

    <p style={{ marginBottom: '20px' }}>
      The ChatWidget automatically displays usage information in its header when
      rate limiting is active. Usage info appears below the title as a compact
      display.
    </p>

    <div
      style={{
        height: '600px',
        border: '2px dashed #e5e7eb',
        borderRadius: '8px',
        position: 'relative',
        backgroundColor: '#f9fafb',
      }}
    >
      <ChatWidget
        baseURL="http://localhost:3000"
        position="bottom-right"
        theme={{
          primaryColor: '#007aff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
        system="You are a helpful assistant. Keep responses brief to conserve tokens."
      />

      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          color: '#6b7280',
        }}
      >
        <p>Click the chat button in the bottom right →</p>
      </div>
    </div>
  </div>
);
WidgetWithRateLimiting.storyName = 'Widget Integration';

// Streaming with usage updates
export const StreamingUsageUpdates: Story = () => {
  const StreamingDemo = () => {
    const { messages, input, setInput, send, isLoading, isStreaming, usage } =
      useChat({
        baseURL: 'http://localhost:3000',
        system: 'You are a helpful assistant.',
        streaming: true,
      });

    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
        <h3>Streaming with Usage Updates</h3>
        <p>Usage information is updated after the stream completes.</p>

        <UsageDisplay usage={usage} />

        <div style={{ marginBottom: '10px' }}>
          Status:{' '}
          {isStreaming
            ? '🟢 Streaming'
            : isLoading
              ? '🟡 Connecting'
              : '⚫ Ready'}
        </div>

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
          {messages
            .filter(msg => msg.content !== '')
            .map((msg, i) => (
              <div key={i} style={{ marginBottom: '8px' }}>
                <strong>{msg.role}:</strong> {msg.content}
              </div>
            ))}
        </div>

        <form
          onSubmit={e => {
            e.preventDefault();
            send();
          }}
          style={{ display: 'flex', gap: '8px' }}
        >
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Type a message..."
            disabled={isLoading || isStreaming}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '4px',
              border: '1px solid #ddd',
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
            Send
          </button>
        </form>
      </div>
    );
  };

  return <StreamingDemo />;
};
StreamingUsageUpdates.storyName = 'Streaming Usage Updates';

// Documentation
// Live rate limiting demo with configurable limits
export const LiveRateLimitDemo: Story = () => {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h3>Live Rate Limit Testing</h3>
      <div
        style={{
          backgroundColor: '#fef3c7',
          border: '1px solid #f59e0b',
          borderRadius: '6px',
          padding: '16px',
          marginBottom: '20px',
        }}
      >
        <strong>⚠️ Important:</strong> This example requires a backend
        configured with low rate limits. To test this properly, configure your
        backend with:
        <ul style={{ marginTop: '8px' }}>
          <li>
            <code>REQUEST_LIMIT_MAX=5</code> (5 requests per window)
          </li>
          <li>
            <code>TOKEN_LIMIT_MAX=1000</code> (1000 tokens per window)
          </li>
          <li>
            <code>REQUEST_LIMIT_TIME_WINDOW=300000</code> (5 minute window)
          </li>
          <li>
            <code>TOKEN_LIMIT_TIME_WINDOW=300000</code> (5 minute window)
          </li>
        </ul>
      </div>

      <p style={{ marginBottom: '20px' }}>
        Send multiple messages quickly to see rate limiting in action. With the
        recommended settings above, you should hit the request limit after 5
        messages.
      </p>

      <RateLimitingDemo baseURL="http://localhost:3000" />

      <div
        style={{
          marginTop: '20px',
          backgroundColor: '#f3f4f6',
          padding: '16px',
          borderRadius: '8px',
        }}
      >
        <h4>What to expect:</h4>
        <ol>
          <li>First 3-4 messages: Green progress bars, everything works</li>
          <li>4th message: Orange warning appears (80%+ usage)</li>
          <li>5th message: Should hit request limit, see 429 error</li>
          <li>Error message shows when limits will reset</li>
          <li>After reset time, you can send messages again</li>
        </ol>
      </div>
    </div>
  );
};
LiveRateLimitDemo.storyName = 'Live Testing';

export const RateLimitingGuide: Story = () => (
  <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
    <h2>Rate Limiting Guide</h2>

    <h3>Overview</h3>
    <p>
      Airbolt provides built-in rate limiting to protect your backend from abuse
      and manage costs. The SDK automatically handles rate limit headers and
      provides usage information to your application.
    </p>

    <h3>Types of Rate Limits</h3>
    <ul>
      <li>
        <strong>Token Limits:</strong> Maximum number of tokens (input + output)
        per time window
      </li>
      <li>
        <strong>Request Limits:</strong> Maximum number of API requests per time
        window
      </li>
    </ul>

    <h3>Usage Information Structure</h3>
    <pre
      style={{
        backgroundColor: '#f3f4f6',
        padding: '16px',
        borderRadius: '8px',
        overflow: 'auto',
      }}
    >
      {`interface UsageInfo {
  total_tokens: number;  // Tokens used in this request
  tokens?: {
    used: number;        // Total tokens used in current window
    remaining: number;   // Tokens remaining
    limit: number;       // Maximum tokens allowed
    resetAt: string;     // ISO timestamp when limit resets
  };
  requests?: {
    used: number;        // Requests made in current window
    remaining: number;   // Requests remaining
    limit: number;       // Maximum requests allowed
    resetAt: string;     // ISO timestamp when limit resets
  };
}`}
    </pre>

    <h3>Handling Rate Limits</h3>
    <p>
      When a rate limit is exceeded, the API returns a 429 status code with
      details:
    </p>
    <ul>
      <li>The SDK automatically retries with exponential backoff</li>
      <li>Error messages include when the limit will reset</li>
      <li>Usage information is still available in the error for display</li>
    </ul>

    <h3>Best Practices</h3>
    <ol>
      <li>
        <strong>Display usage information:</strong> Show users their current
        usage and limits
      </li>
      <li>
        <strong>Warn before limits:</strong> Alert users when they're
        approaching limits (e.g., 80% used)
      </li>
      <li>
        <strong>Handle errors gracefully:</strong> Show helpful messages when
        rate limits are hit
      </li>
      <li>
        <strong>Consider caching:</strong> Cache responses when appropriate to
        reduce API calls
      </li>
      <li>
        <strong>Implement client-side throttling:</strong> Prevent rapid-fire
        requests
      </li>
    </ol>

    <h3>Example: Custom Rate Limit Display</h3>
    <pre
      style={{
        backgroundColor: '#f3f4f6',
        padding: '16px',
        borderRadius: '8px',
        overflow: 'auto',
      }}
    >
      {`function RateLimitWarning({ usage }) {
  if (!usage) return null;
  
  const tokenPercentage = usage.tokens 
    ? (usage.tokens.used / usage.tokens.limit) * 100 
    : 0;
    
  if (tokenPercentage > 80) {
    return (
      <Alert severity="warning">
        You've used {tokenPercentage.toFixed(0)}% of your token limit.
        Consider waiting before sending more messages.
      </Alert>
    );
  }
  
  return null;
}`}
    </pre>
  </div>
);
RateLimitingGuide.storyName = 'Documentation';
