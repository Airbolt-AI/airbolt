import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ChatWidget } from '../../src/components/ChatWidget.js';

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

describe('ChatWidget Styling', () => {
  const mockDefaults = {
    messages: [],
    input: '',
    setInput: vi.fn(),
    send: vi.fn(),
    clear: vi.fn(),
    isLoading: false,
    error: null,
    clearToken: vi.fn(),
    hasValidToken: vi.fn(() => true),
    getTokenInfo: vi.fn(() => ({ hasToken: true })),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseChat.mockReturnValue(mockDefaults);
  });

  describe('CSS Custom Properties', () => {
    it('should apply minimal theme CSS variables', () => {
      const { container } = render(
        <ChatWidget
          minimalTheme={{
            primary: '#FF6B6B',
            surface: '#F8F9FA',
            border: '#DEE2E6',
            text: '#212529',
          }}
        />
      );

      const widget = container.querySelector('[data-testid="chat-widget"]');
      expect(widget).toHaveStyle({
        '--chat-primary': '#FF6B6B',
        '--chat-surface': '#F8F9FA',
        '--chat-border': '#DEE2E6',
        '--chat-text': '#212529',
      });
    });

    it('should use inherit for typography by default', () => {
      const { container } = render(<ChatWidget />);
      const widget = container.querySelector('[data-testid="chat-widget"]');
      
      expect(widget).toHaveStyle({
        fontFamily: 'inherit',
        fontSize: 'inherit',
        lineHeight: 'inherit',
      });
    });

    it('should support legacy customTheme for backward compatibility', () => {
      const { container } = render(
        <ChatWidget
          customTheme={{
            userMessage: '#FF6B6B',
            assistantMessage: '#4ECDC4',
            border: '#DEE2E6',
            text: '#212529',
          }}
        />
      );

      const widget = container.querySelector('[data-testid="chat-widget"]');
      // Legacy theme should be converted to CSS variables
      expect(widget).toHaveStyle({
        '--chat-primary': '#FF6B6B',
        '--chat-surface': '#4ECDC4',
        '--chat-border': '#DEE2E6',
        '--chat-text': '#212529',
      });
    });
  });

  describe('Position Modes', () => {
    it('should apply inline styles by default', () => {
      const { container } = render(<ChatWidget />);
      const widget = container.querySelector('[data-testid="chat-widget"]');
      
      expect(widget).toHaveStyle({
        width: '100%',
        height: '100%',
        position: undefined, // Should not have fixed positioning
      });
    });

    it('should apply fixed positioning when specified', () => {
      const { container } = render(<ChatWidget position="fixed-bottom-right" />);
      const widget = container.querySelector('[data-testid="chat-widget"]');
      
      expect(widget).toHaveStyle({
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '380px',
      });
    });
  });

  describe('Theme Detection', () => {
    it('should detect dark mode from system preferences', () => {
      // Mock dark mode preference
      const mockMatchMedia = vi.fn().mockImplementation(() => ({
        matches: true, // Dark mode
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));
      window.matchMedia = mockMatchMedia;

      const { container } = render(<ChatWidget theme="auto" />);
      const widget = container.querySelector('[data-testid="chat-widget"]');
      
      // Should apply dark theme defaults
      expect(widget).toHaveStyle({
        '--chat-primary': '#0a84ff',
      });
    });

    it('should use light theme when explicitly set', () => {
      const { container } = render(<ChatWidget theme="light" />);
      const widget = container.querySelector('[data-testid="chat-widget"]');
      
      // Should apply light theme defaults
      expect(widget).toHaveStyle({
        '--chat-primary': '#007aff',
      });
    });
  });

  describe('Minimal Styling', () => {
    it('should not include complex animations', () => {
      const { container } = render(<ChatWidget />);
      
      // Check that no animation keyframes are injected
      const styleElements = document.querySelectorAll('style');
      styleElements.forEach(style => {
        expect(style.textContent).not.toContain('@keyframes');
        expect(style.textContent).not.toContain('animation');
      });
    });

    it('should use simple text for loading state instead of animated dots', () => {
      mockUseChat.mockReturnValue({
        ...mockDefaults,
        isLoading: true,
      });

      const { getByText } = render(<ChatWidget />);
      
      // Should show simple text instead of animated dots
      expect(getByText('Typing...')).toBeInTheDocument();
    });
  });

  describe('Custom Styles Override', () => {
    it('should allow custom styles to override defaults', () => {
      const { container } = render(
        <ChatWidget
          customStyles={{
            widget: { backgroundColor: 'red' },
            input: { fontSize: '20px' },
          }}
        />
      );

      const widget = container.querySelector('[data-testid="chat-widget"]');
      const input = container.querySelector('input');
      
      expect(widget).toHaveStyle({ backgroundColor: 'red' });
      expect(input).toHaveStyle({ fontSize: '20px' });
    });
  });
});