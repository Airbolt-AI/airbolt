import type { CSSProperties } from 'react';

/**
 * Minimal theme configuration using CSS custom properties
 * Only 4 properties instead of 17 for maximum simplicity
 */
export interface MinimalTheme {
  primary?: string;
  surface?: string;
  border?: string;
  text?: string;
}

/**
 * Convert theme to CSS custom properties
 */
export function themeToCSS(theme?: MinimalTheme): CSSProperties {
  const cssVars: Record<string, string> = {};

  if (theme?.primary) {
    cssVars['--chat-primary'] = theme.primary;
  }
  if (theme?.surface) {
    cssVars['--chat-surface'] = theme.surface;
  }
  if (theme?.border) {
    cssVars['--chat-border'] = theme.border;
  }
  if (theme?.text) {
    cssVars['--chat-text'] = theme.text;
  }

  return cssVars as CSSProperties;
}

/**
 * Base styles that inherit from parent container
 * Uses CSS custom properties with fallbacks
 */
export const baseStyles: Record<string, CSSProperties> = {
  widget: {
    // Inherit typography from parent
    fontFamily: 'inherit',
    fontSize: 'inherit',
    lineHeight: 'inherit',
    color: 'var(--chat-text, inherit)',

    // Minimal structure
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'var(--chat-surface, transparent)',
    border: '1px solid var(--chat-border, currentColor)',
    borderRadius: '8px',
    overflow: 'hidden',
    boxSizing: 'border-box',

    // Remove opinionated shadows and transitions for MVP
    // These can be added by parent if needed
  },

  header: {
    padding: '12px 16px',
    borderBottom: '1px solid var(--chat-border, currentColor)',
    fontWeight: 600,
    // Inherit font size from parent
  },

  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    minHeight: 0,
  },

  message: {
    maxWidth: '70%',
    wordWrap: 'break-word',
    padding: '8px 12px',
    borderRadius: '8px',
  },

  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: 'var(--chat-primary, #007aff)',
    color: 'white',
  },

  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: 'var(--chat-surface, #f0f0f0)',
    border: '1px solid var(--chat-border, transparent)',
  },

  form: {
    display: 'flex',
    gap: '8px',
    padding: '12px 16px',
    borderTop: '1px solid var(--chat-border, currentColor)',
  },

  input: {
    flex: 1,
    padding: '8px 12px',
    backgroundColor: 'transparent',
    color: 'inherit',
    border: '1px solid var(--chat-border, currentColor)',
    borderRadius: '6px',
    fontSize: 'inherit',
    fontFamily: 'inherit',
    outline: 'none',
  },

  inputFocus: {
    borderColor: 'var(--chat-primary, #007aff)',
  },

  button: {
    padding: '8px 16px',
    backgroundColor: 'var(--chat-primary, #007aff)',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: 'inherit',
    fontFamily: 'inherit',
    fontWeight: 500,
    cursor: 'pointer',
    outline: 'none',
  },

  buttonHover: {
    opacity: 0.9,
  },

  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },

  error: {
    margin: '0 16px 12px',
    padding: '8px 12px',
    backgroundColor: 'rgba(220, 53, 69, 0.1)',
    color: '#dc3545',
    borderRadius: '6px',
    fontSize: '0.875em',
  },

  // Simple loading indicator without complex animations
  typing: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '8px 12px',
    alignSelf: 'flex-start',
    color: 'var(--chat-text, inherit)',
    opacity: 0.6,
  },
};

/**
 * Get position-specific styles
 */
export function getPositionStyles(
  position: 'inline' | 'fixed-bottom-right'
): CSSProperties {
  if (position === 'fixed-bottom-right') {
    return {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      width: '380px',
      height: '600px',
      maxHeight: '80vh',
      zIndex: 1000,
      // Add subtle shadow only for fixed position
      boxShadow: '0 2px 12px rgba(0, 0, 0, 0.1)',
    };
  }

  return {
    width: '100%',
    height: '100%',
    maxHeight: '600px',
    minHeight: '400px',
  };
}

/**
 * Merge styles with position and custom overrides
 */
export function getMergedStyles(
  position: 'inline' | 'fixed-bottom-right',
  customStyles?: Record<string, CSSProperties>
): Record<string, CSSProperties> {
  const positionStyles = getPositionStyles(position);

  return {
    widget: {
      ...baseStyles['widget'],
      ...positionStyles,
      ...customStyles?.['widget'],
    },
    header: { ...baseStyles['header'], ...customStyles?.['header'] },
    messages: { ...baseStyles['messages'], ...customStyles?.['messages'] },
    message: { ...baseStyles['message'] },
    userMessage: { ...baseStyles['userMessage'] },
    assistantMessage: { ...baseStyles['assistantMessage'] },
    form: { ...baseStyles['form'] },
    input: { ...baseStyles['input'], ...customStyles?.['input'] },
    inputFocus: { ...baseStyles['inputFocus'] },
    button: { ...baseStyles['button'], ...customStyles?.['button'] },
    buttonHover: { ...baseStyles['buttonHover'] },
    buttonDisabled: { ...baseStyles['buttonDisabled'] },
    error: { ...baseStyles['error'] },
    typing: { ...baseStyles['typing'] },
  };
}
