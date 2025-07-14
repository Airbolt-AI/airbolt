import type { ThemeColors } from './ChatWidget.styles.legacy.js';
import type { MinimalTheme } from './ChatWidget.styles.js';

/**
 * Convert legacy ThemeColors to MinimalTheme for backward compatibility
 * Maps 17 properties down to 4 CSS variables
 */
export function convertLegacyTheme(
  legacyTheme?: Partial<ThemeColors>
): MinimalTheme | undefined {
  if (!legacyTheme) {
    return undefined;
  }

  const minimalTheme: MinimalTheme = {};

  // Map primary color (prefer button/user message colors)
  const primary = legacyTheme.buttonBackground || legacyTheme.userMessage;
  if (primary !== undefined) {
    minimalTheme.primary = primary;
  }

  // Map surface color
  const surface = legacyTheme.surface || legacyTheme.assistantMessage;
  if (surface !== undefined) {
    minimalTheme.surface = surface;
  }

  // Map border color
  const border = legacyTheme.border || legacyTheme.inputBorder;
  if (border !== undefined) {
    minimalTheme.border = border;
  }

  // Map text color
  if (legacyTheme.text !== undefined) {
    minimalTheme.text = legacyTheme.text;
  }

  return minimalTheme;
}

/**
 * Detect theme preference from system
 */
export function detectSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') {
    return 'light';
  }

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  return mediaQuery.matches ? 'dark' : 'light';
}

/**
 * Default themes for light and dark modes using minimal properties
 */
export const defaultThemes = {
  light: {
    primary: '#007aff',
    surface: '#f5f5f5',
    border: '#e0e0e0',
    text: '#000000',
  },
  dark: {
    primary: '#0a84ff',
    surface: '#2a2a2a',
    border: '#3a3a3a',
    text: '#ffffff',
  },
} as const;
