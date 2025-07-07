import React, { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useChat } from '../hooks/useChat.js';
import type { UseChatOptions } from '../types/index.js';
import {
  getStyles,
  lightTheme,
  darkTheme,
  keyframes,
  type ThemeColors,
} from './ChatWidget.styles.js';

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
   * Custom theme colors (overrides built-in themes)
   */
  customTheme?: Partial<ThemeColors>;
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
 * ChatWidget - A complete chat UI component with zero configuration required
 *
 * @example
 * ```tsx
 * // Basic usage
 * <ChatWidget />
 *
 * // With custom configuration
 * <ChatWidget
 *   title="Support Chat"
 *   theme="dark"
 *   position="fixed-bottom-right"
 *   system="You are a helpful support agent"
 * />
 * ```
 */
export function ChatWidget({
  baseURL,
  system,
  placeholder = 'Type a message...',
  title = 'AI Assistant',
  theme = 'auto',
  position = 'inline',
  className,
  customTheme,
  customStyles,
}: ChatWidgetProps): React.ReactElement {
  const chatOptions: UseChatOptions = {};
  if (baseURL !== undefined) {
    chatOptions.baseURL = baseURL;
  }
  if (system !== undefined) {
    chatOptions.system = system;
  }

  const { messages, input, setInput, send, isLoading, error } =
    useChat(chatOptions);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>('light');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isButtonHovered, setIsButtonHovered] = useState(false);

  // Auto-detect theme
  useEffect(() => {
    if (theme === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e: MediaQueryListEvent) => {
        setCurrentTheme(e.matches ? 'dark' : 'light');
      };

      setCurrentTheme(mediaQuery.matches ? 'dark' : 'light');
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

  // Get theme colors
  const themeColors: ThemeColors = {
    ...(currentTheme === 'dark' ? darkTheme : lightTheme),
    ...customTheme,
  };

  // Get styles
  const styles = getStyles(themeColors, position);

  // Inject keyframes
  useEffect(() => {
    const styleId = 'chat-widget-keyframes';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = keyframes;
      document.head.appendChild(style);
    }
    return () => {
      const style = document.getElementById(styleId);
      if (style) {
        document.head.removeChild(style);
      }
    };
  }, []);

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
        ...styles.widget,
        ...customStyles?.widget,
      }}
      data-testid="chat-widget"
      role="region"
      aria-label={title}
    >
      <div
        style={{
          ...styles.header,
          ...customStyles?.header,
        }}
        role="heading"
        aria-level={2}
      >
        {title}
      </div>

      <div
        style={{
          ...styles.messages,
          ...customStyles?.messages,
        }}
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
      >
        {messages.map((message, index) => (
          <div
            key={index}
            style={{
              ...styles.message,
              ...(message.role === 'user'
                ? styles.userMessage
                : styles.assistantMessage),
            }}
            role="article"
            aria-label={`${message.role} message`}
          >
            {message.content}
          </div>
        ))}

        {isLoading && (
          <div style={styles.typing} aria-label="Assistant is typing">
            <span style={{ ...styles.typingDot, animationDelay: '0ms' }} />
            <span style={{ ...styles.typingDot, animationDelay: '200ms' }} />
            <span style={{ ...styles.typingDot, animationDelay: '400ms' }} />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div style={styles.error} role="alert" aria-live="assertive">
          {error.message}
        </div>
      )}

      <form onSubmit={handleSubmit} style={styles.form}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsInputFocused(true)}
          onBlur={() => setIsInputFocused(false)}
          placeholder={placeholder}
          disabled={isLoading}
          style={{
            ...styles.input,
            ...(isInputFocused ? styles.inputFocus : {}),
            ...customStyles?.input,
          }}
          aria-label="Message input"
          aria-invalid={!!error}
          aria-describedby={error ? 'chat-error' : undefined}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          onMouseEnter={() => setIsButtonHovered(true)}
          onMouseLeave={() => setIsButtonHovered(false)}
          style={{
            ...styles.button,
            ...(isButtonHovered && !isLoading && input.trim()
              ? styles.buttonHover
              : {}),
            ...(isLoading || !input.trim() ? styles.buttonDisabled : {}),
            ...customStyles?.button,
          }}
          aria-label="Send message"
        >
          Send
        </button>
      </form>
    </div>
  );
}
