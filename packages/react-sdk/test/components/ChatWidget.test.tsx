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
    error: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseChat.mockReturnValue({
      ...mockDefaults,
      messages: [],
    });
  });

  describe('XSS Prevention', () => {
    it('should escape HTML script tags in messages', () => {
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

      // Verify dangerous content is escaped
      expect(container.innerHTML).toContain(
        '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
      );
      // Ensure no actual script tag exists
      expect(container.querySelector('script')).toBeNull();
    });

    it('should escape HTML img tags with onerror attributes', () => {
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

      // Verify img tag is escaped
      expect(container.innerHTML).toContain(
        '&lt;img src=&quot;x&quot; onerror=&quot;alert(&#39;XSS&#39;)&quot;&gt;'
      );
      // Ensure no actual img tag with onerror exists
      expect(container.querySelector('img[onerror]')).toBeNull();
    });

    it('should escape all dangerous HTML characters', () => {
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

      // Verify all characters are properly escaped
      expect(container.innerHTML).toContain(
        'Test &amp; check &lt;tag&gt; &quot;quotes&quot; &#39;apostrophes&#39;'
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

      // Verify complex payload is fully escaped
      expect(container.innerHTML).toContain(
        '&lt;svg onload=&quot;alert(1)&quot;&gt;&lt;iframe src=&quot;javascript:alert(2)&quot;&gt;&lt;/iframe&gt;&lt;/svg&gt;'
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
});
