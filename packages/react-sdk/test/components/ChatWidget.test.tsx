import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ChatWidget } from '../../src/components/ChatWidget.js';
import type { Message } from '@airbolt/sdk';

// Mock DOM methods not available in happy-dom
Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  value: vi.fn(),
  writable: true,
});

// Mock matchMedia for theme detection
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(() => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
});

// Mock the useChat hook
vi.mock('../../src/hooks/useChat.js', () => ({
  useChat: vi.fn(),
}));

import { useChat } from '../../src/hooks/useChat.js';
const mockUseChat = vi.mocked(useChat);

describe('ChatWidget XSS Protection', () => {
  const mockDefaults = {
    input: '',
    setInput: vi.fn(),
    send: vi.fn(),
    clear: vi.fn(),
    isLoading: false,
    isStreaming: false,
    error: null,
    usage: null,
    clearToken: vi.fn(),
    hasValidToken: vi.fn(() => true),
    getTokenInfo: vi.fn(() => ({ hasToken: true })),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseChat.mockReturnValue({
      ...mockDefaults,
      messages: [],
    });
  });

  describe('XSS Prevention', () => {
    it('should render HTML script tags as plain text (React XSS protection)', () => {
      const maliciousMessages: Message[] = [
        {
          role: 'user',
          content: '<script>alert("XSS")</script>',
        },
      ];

      mockUseChat.mockReturnValue({
        ...mockDefaults,
        messages: maliciousMessages,
      });

      const { container } = render(<ChatWidget />);

      // Verify dangerous content is escaped as HTML entities
      const messageElement = container.querySelector(
        '[aria-label="user message"]'
      );
      expect(messageElement?.textContent).toBe('<script>alert("XSS")</script>');
      // Ensure no actual script tag exists
      expect(container.querySelector('script')).toBeNull();
    });

    it('should render HTML img tags as plain text (React XSS protection)', () => {
      const maliciousMessages: Message[] = [
        {
          role: 'user',
          content: '<img src="x" onerror="alert(\'XSS\')">',
        },
      ];

      mockUseChat.mockReturnValue({
        ...mockDefaults,
        messages: maliciousMessages,
      });

      const { container } = render(<ChatWidget />);

      // Verify img tag is escaped as HTML entities
      const messageElement = container.querySelector(
        '[aria-label="user message"]'
      );
      expect(messageElement?.textContent).toBe(
        '<img src="x" onerror="alert(\'XSS\')">'
      );
      // Ensure no actual img tag with onerror exists
      expect(container.querySelector('img[onerror]')).toBeNull();
    });

    it('should render HTML characters as plain text without encoding', () => {
      const maliciousMessages: Message[] = [
        {
          role: 'user',
          content: 'Test & check <tag> "quotes" \'apostrophes\'',
        },
      ];

      mockUseChat.mockReturnValue({
        ...mockDefaults,
        messages: maliciousMessages,
      });

      const { container } = render(<ChatWidget />);

      // Verify all characters are properly escaped as HTML entities
      const messageElement = container.querySelector(
        '[aria-label="user message"]'
      );
      expect(messageElement?.textContent).toBe(
        'Test & check <tag> "quotes" \'apostrophes\''
      );
    });

    it('should preserve normal text content without modification', () => {
      const normalMessages: Message[] = [
        {
          role: 'user',
          content: 'Hello! How are you today?',
        },
      ];

      mockUseChat.mockReturnValue({
        ...mockDefaults,
        messages: normalMessages,
      });

      const { container } = render(<ChatWidget />);

      // Verify normal text is preserved
      expect(container.textContent).toContain('Hello! How are you today?');
    });

    it('should handle complex XSS payloads safely', () => {
      const complexMessages: Message[] = [
        {
          role: 'assistant',
          content:
            '<svg onload="alert(1)"><iframe src="javascript:alert(2)"></iframe></svg>',
        },
      ];

      mockUseChat.mockReturnValue({
        ...mockDefaults,
        messages: complexMessages,
      });

      const { container } = render(<ChatWidget />);

      // Verify complex payload is fully escaped as HTML entities
      const messageElement = container.querySelector(
        '[aria-label="assistant message"]'
      );
      expect(messageElement?.textContent).toBe(
        '<svg onload="alert(1)"><iframe src="javascript:alert(2)"></iframe></svg>'
      );
      // Ensure no dangerous elements exist
      expect(container.querySelector('svg')).toBeNull();
      expect(container.querySelector('iframe')).toBeNull();
    });
  });

  describe('Basic Component Functionality', () => {
    it('should render without XSS vulnerabilities', () => {
      mockUseChat.mockReturnValue({
        ...mockDefaults,
        messages: [{ role: 'user', content: 'Safe message' }],
      });

      // Should render without throwing
      expect(() => render(<ChatWidget />)).not.toThrow();
    });
  });

  describe('Special Character Rendering', () => {
    it('should render apostrophes correctly', () => {
      const messages: Message[] = [
        {
          role: 'user',
          content: "It's working! I'm happy!",
        },
      ];

      mockUseChat.mockReturnValue({
        ...mockDefaults,
        messages,
      });

      const { container } = render(<ChatWidget />);
      const messageElement = container.querySelector(
        '[aria-label="user message"]'
      );
      expect(messageElement?.textContent).toBe("It's working! I'm happy!");
    });

    it('should render quotes and other special characters correctly', () => {
      const messages: Message[] = [
        {
          role: 'assistant',
          content: 'He said "Hello" & waved < smiled > then left.',
        },
      ];

      mockUseChat.mockReturnValue({
        ...mockDefaults,
        messages,
      });

      const { container } = render(<ChatWidget />);
      const messageElement = container.querySelector(
        '[aria-label="assistant message"]'
      );
      expect(messageElement?.textContent).toBe(
        'He said "Hello" & waved < smiled > then left.'
      );
    });

    it('should render mixed special characters from both user and assistant', () => {
      const messages: Message[] = [
        {
          role: 'user',
          content: "What's 2 + 2?",
        },
        {
          role: 'assistant',
          content: '2 + 2 = 4. It\'s simple math! "Easy as pie" they say.',
        },
      ];

      mockUseChat.mockReturnValue({
        ...mockDefaults,
        messages,
      });

      const { container } = render(<ChatWidget />);

      const userMessage = container.querySelector(
        '[aria-label="user message"]'
      );
      expect(userMessage?.textContent).toBe("What's 2 + 2?");

      const assistantMessage = container.querySelector(
        '[aria-label="assistant message"]'
      );
      expect(assistantMessage?.textContent).toBe(
        '2 + 2 = 4. It\'s simple math! "Easy as pie" they say.'
      );
    });
  });
});
