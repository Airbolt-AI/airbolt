import type { CSSProperties } from 'react';

export interface ThemeColors {
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  userMessage: string;
  userMessageText: string;
  assistantMessage: string;
  assistantMessageText: string;
  inputBackground: string;
  inputBorder: string;
  buttonBackground: string;
  buttonText: string;
  buttonHover: string;
  error: string;
  errorBackground: string;
}

export const lightTheme: ThemeColors = {
  background: '#ffffff',
  surface: '#f5f5f5',
  text: '#1a1a1a',
  textSecondary: '#666666',
  border: '#e0e0e0',
  userMessage: '#007aff',
  userMessageText: '#ffffff',
  assistantMessage: '#f0f0f0',
  assistantMessageText: '#1a1a1a',
  inputBackground: '#ffffff',
  inputBorder: '#e0e0e0',
  buttonBackground: '#007aff',
  buttonText: '#ffffff',
  buttonHover: '#0056b3',
  error: '#dc3545',
  errorBackground: '#fee',
};

export const darkTheme: ThemeColors = {
  background: '#1a1a1a',
  surface: '#2a2a2a',
  text: '#ffffff',
  textSecondary: '#b0b0b0',
  border: '#3a3a3a',
  userMessage: '#0a84ff',
  userMessageText: '#ffffff',
  assistantMessage: '#2a2a2a',
  assistantMessageText: '#ffffff',
  inputBackground: '#2a2a2a',
  inputBorder: '#3a3a3a',
  buttonBackground: '#0a84ff',
  buttonText: '#ffffff',
  buttonHover: '#0056b3',
  error: '#ff453a',
  errorBackground: '#3a1a1a',
};

interface WidgetStyles {
  widget: CSSProperties;
  header: CSSProperties;
  messages: CSSProperties;
  message: CSSProperties;
  userMessage: CSSProperties;
  assistantMessage: CSSProperties;
  typing: CSSProperties;
  typingDot: CSSProperties;
  error: CSSProperties;
  form: CSSProperties;
  input: CSSProperties;
  inputFocus: CSSProperties;
  button: CSSProperties;
  buttonHover: CSSProperties;
  buttonDisabled: CSSProperties;
}

export const getStyles = (
  theme: ThemeColors,
  position: 'inline' | 'fixed-bottom-right'
): WidgetStyles => {
  const baseWidget: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: theme.background,
    color: theme.text,
    borderRadius: '12px',
    overflow: 'hidden',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: '14px',
    lineHeight: '1.5',
    boxShadow:
      position === 'fixed-bottom-right'
        ? '0 4px 24px rgba(0, 0, 0, 0.15)'
        : '0 2px 8px rgba(0, 0, 0, 0.1)',
    transition: 'all 0.3s ease',
    boxSizing: 'border-box',
  };

  const positionStyles: CSSProperties =
    position === 'fixed-bottom-right'
      ? {
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: '380px',
          height: '600px',
          maxHeight: '80vh',
          zIndex: 1000,
        }
      : {
          width: '100%',
          height: '100%',
          maxHeight: '600px',
          minHeight: '400px',
        };

  return {
    widget: {
      ...baseWidget,
      ...positionStyles,
    } as CSSProperties,

    header: {
      padding: '16px 20px',
      backgroundColor: theme.surface,
      borderBottom: `1px solid ${theme.border}`,
      fontWeight: 600,
      fontSize: '16px',
    } as CSSProperties,

    messages: {
      flex: 1,
      overflowY: 'auto',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      minHeight: 0, // Important for flex children with overflow
    } as CSSProperties,

    message: {
      maxWidth: '70%',
      wordWrap: 'break-word',
      animation: 'fadeIn 0.3s ease',
    } as CSSProperties,

    userMessage: {
      alignSelf: 'flex-end',
      backgroundColor: theme.userMessage,
      color: theme.userMessageText,
      padding: '10px 14px',
      borderRadius: '18px 18px 4px 18px',
    } as CSSProperties,

    assistantMessage: {
      alignSelf: 'flex-start',
      backgroundColor: theme.assistantMessage,
      color: theme.assistantMessageText,
      padding: '10px 14px',
      borderRadius: '18px 18px 18px 4px',
    } as CSSProperties,

    typing: {
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      padding: '10px 14px',
      alignSelf: 'flex-start',
    } as CSSProperties,

    typingDot: {
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      backgroundColor: theme.textSecondary,
      animation: 'typing 1.4s infinite',
    } as CSSProperties,

    error: {
      margin: '0 16px',
      padding: '12px',
      backgroundColor: theme.errorBackground,
      color: theme.error,
      borderRadius: '8px',
      fontSize: '13px',
    } as CSSProperties,

    form: {
      display: 'flex',
      gap: '8px',
      padding: '16px',
      borderTop: `1px solid ${theme.border}`,
      backgroundColor: theme.surface,
    } as CSSProperties,

    input: {
      flex: 1,
      padding: '10px 14px',
      backgroundColor: theme.inputBackground,
      color: theme.text,
      border: `1px solid ${theme.inputBorder}`,
      borderRadius: '24px',
      fontSize: '14px',
      outline: 'none',
      transition: 'border-color 0.2s ease',
    } as CSSProperties,

    inputFocus: {
      borderColor: theme.buttonBackground,
    } as CSSProperties,

    button: {
      padding: '10px 20px',
      backgroundColor: theme.buttonBackground,
      color: theme.buttonText,
      border: 'none',
      borderRadius: '24px',
      fontSize: '14px',
      fontWeight: 500,
      cursor: 'pointer',
      transition: 'background-color 0.2s ease',
      outline: 'none',
    } as CSSProperties,

    buttonHover: {
      backgroundColor: theme.buttonHover,
    } as CSSProperties,

    buttonDisabled: {
      opacity: 0.6,
      cursor: 'not-allowed',
    } as CSSProperties,
  };
};

export const keyframes = `
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes typing {
    0%, 60%, 100% {
      opacity: 0.3;
    }
    30% {
      opacity: 1;
    }
  }
`;
