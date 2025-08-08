import React, { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useChat } from '../hooks/useChat.js';
import type { UseChatOptions } from '../types/index.js';
import {
  getMergedStyles,
  themeToCSS,
  type MinimalTheme,
  detectSystemTheme,
  defaultThemes,
} from './ChatWidget.styles.js';

export type { MinimalTheme } from './ChatWidget.styles.js';

export interface ChatWidgetProps {
  /**
   * Base URL for the Airbolt API
   */
  baseURL?: string;
  /**
   * System prompt to guide the AI's behavior
   */
  system?: string;
  /**
   * AI provider to use: 'openai' or 'anthropic'
   */
  provider?: 'openai' | 'anthropic';
  /**
   * Specific model to use (e.g., 'gpt-4', 'claude-3-5-sonnet-20241022')
   */
  model?: string;
  /**
   * Placeholder text for the input field
   */
  placeholder?: string;
  /**
   * Title displayed in the widget header
   */
  title?: string;
  /**
   * Theme mode: light, dark, or auto (follows system preference)
   */
  theme?: 'light' | 'dark' | 'auto';
  /**
   * Position mode: inline (fits container) or fixed-bottom-right
   */
  position?: 'inline' | 'fixed-bottom-right';
  /**
   * Additional CSS class name for custom styling
   */
  className?: string;
  /**
   * Minimal theme using CSS custom properties (recommended)
   */
  minimalTheme?: MinimalTheme;
  /**
   * Enable streaming responses (default: true)
   * Set to false to disable streaming
   */
  streaming?: boolean;
  /**
   * Custom auth token getter function for BYOA (Bring Your Own Auth)
   * @example getAuthToken: async () => await clerk.session.getToken()
   */
  getAuthToken?: () => Promise<string> | string;
  /**
   * Custom styles for widget elements
   */
  customStyles?: {
    widget?: CSSProperties;
    header?: CSSProperties;
    messages?: CSSProperties;
    input?: CSSProperties;
    button?: CSSProperties;
  };
}

/**
 * ChatWidget - A universally compatible chat UI component
 *
 * New simplified approach:
 * - Inherits typography from parent by default
 * - Uses only 4 CSS custom properties for theming
 * - Minimal opinionated styles for maximum compatibility
 * - No complex animations or shadows
 *
 * @example
 * ```tsx
 * // Zero configuration - inherits from parent
 * <ChatWidget />
 *
 * // With minimal theme
 * <ChatWidget
 *   minimalTheme={{
 *     primary: '#FF6B6B',
 *     surface: '#F8F9FA'
 *   }}
 * />
 * ```
 */
export function ChatWidget({
  baseURL,
  system,
  provider,
  model,
  placeholder = 'Type a message...',
  title = 'AI Assistant',
  theme = 'auto',
  position = 'inline',
  className,
  minimalTheme,
  streaming = true,
  getAuthToken,
  customStyles,
}: ChatWidgetProps): React.ReactElement {
  const chatOptions: UseChatOptions = {};
  if (baseURL !== undefined) {
    chatOptions.baseURL = baseURL;
  }
  if (system !== undefined) {
    chatOptions.system = system;
  }
  if (provider !== undefined) {
    chatOptions.provider = provider;
  }
  if (model !== undefined) {
    chatOptions.model = model;
  }
  if (streaming !== undefined) {
    chatOptions.streaming = streaming;
  }
  if (getAuthToken !== undefined) {
    chatOptions.getAuthToken = getAuthToken;
  }

  const {
    messages,
    input,
    setInput,
    send,
    isLoading,
    isStreaming,
    error,
    usage,
  } = useChat(chatOptions);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>('light');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isButtonHovered, setIsButtonHovered] = useState(false);

  // Auto-detect theme
  useEffect(() => {
    if (theme === 'auto') {
      const handleChange = () => {
        setCurrentTheme(detectSystemTheme());
      };

      handleChange(); // Set initial theme

      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', handleChange);

      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      setCurrentTheme(theme);
    }
    return undefined;
  }, [theme]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Determine theme to use
  const effectiveTheme: MinimalTheme =
    minimalTheme || defaultThemes[currentTheme];

  // Get merged styles
  const styles = getMergedStyles(position, customStyles);

  // Convert theme to CSS custom properties
  const cssVars = themeToCSS(effectiveTheme);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div
      className={className}
      style={{
        ...styles['widget'],
        ...cssVars,
      }}
      data-testid="chat-widget"
      role="region"
      aria-label={title}
    >
      <div style={styles['header']} role="heading" aria-level={2}>
        {title}
      </div>

      {usage && usage.tokens && usage.tokens.limit != null && (
        <div
          style={{
            padding: '0.5rem 1rem',
            fontSize: '0.875rem',
            opacity: 0.8,
            borderBottom: '1px solid var(--airbolt-border)',
          }}
          aria-label="Usage information"
        >
          Tokens: {(usage.tokens.used ?? 0).toLocaleString()}/
          {usage.tokens.limit.toLocaleString()} • Resets{' '}
          {usage.tokens.resetAt
            ? new Date(usage.tokens.resetAt).toLocaleTimeString()
            : 'N/A'}
        </div>
      )}

      <div
        style={styles['messages']}
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
      >
        {messages
          .filter(message => message.content !== '')
          .map((message, index) => (
            <div
              key={index}
              style={{
                ...styles['message'],
                ...(message.role === 'user'
                  ? styles['userMessage']
                  : styles['assistantMessage']),
              }}
              role="article"
              aria-label={`${message.role} message`}
            >
              {message.content}
            </div>
          ))}

        {(isLoading ||
          (isStreaming && messages[messages.length - 1]?.content === '')) && (
          <div style={styles['typing']} aria-label="Assistant is thinking">
            <span>Thinking...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div style={styles['error']} role="alert" aria-live="assertive">
          {error.message}
        </div>
      )}

      <form onSubmit={handleSubmit} style={styles['form']}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsInputFocused(true)}
          onBlur={() => setIsInputFocused(false)}
          placeholder={placeholder}
          disabled={isLoading || isStreaming}
          style={{
            ...styles['input'],
            ...(isInputFocused ? styles['inputFocus'] : {}),
          }}
          aria-label="Message input"
          aria-invalid={!!error}
          aria-describedby={error ? 'chat-error' : undefined}
        />
        <button
          type="submit"
          disabled={isLoading || isStreaming || !input.trim()}
          onMouseEnter={() => setIsButtonHovered(true)}
          onMouseLeave={() => setIsButtonHovered(false)}
          style={{
            ...styles['button'],
            ...(isButtonHovered && !isLoading && !isStreaming && input.trim()
              ? styles['buttonHover']
              : {}),
            ...(isLoading || isStreaming || !input.trim()
              ? styles['buttonDisabled']
              : {}),
          }}
          aria-label="Send message"
        >
          Send
        </button>
      </form>
    </div>
  );
}
