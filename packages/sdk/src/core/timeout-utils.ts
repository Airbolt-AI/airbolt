/**
 * Utilities for handling request timeouts with browser compatibility
 */

/**
 * Creates an AbortSignal that will abort after the specified timeout.
 * Includes a polyfill for browsers that don't support AbortSignal.timeout()
 *
 * @param ms - Timeout in milliseconds
 * @returns AbortSignal that will abort after the timeout
 */
export function createTimeoutSignal(ms: number): AbortSignal {
  // Use native implementation if available (Chrome 103+)
  if ('timeout' in AbortSignal && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms);
  }

  // Polyfill for older browsers
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, ms);

  // Clean up timeout if signal is aborted early
  if (controller.signal.addEventListener) {
    controller.signal.addEventListener('abort', () => {
      clearTimeout(timeoutId);
    });
  }

  return controller.signal;
}

/**
 * Checks if an error is a timeout/abort error
 * @param error - The error to check (using unknown for maximum compatibility)
 */
export function isTimeoutError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  // Check for AbortError (standard)
  if ('name' in error && error.name === 'AbortError') {
    return true;
  }

  // Check for DOMException with AbortError name
  if (
    error instanceof Error &&
    error.name === 'AbortError' &&
    error.message.includes('signal is aborted')
  ) {
    return true;
  }

  // Check for timeout-specific error messages
  if (
    error instanceof Error &&
    error.message.toLowerCase().includes('timeout')
  ) {
    return true;
  }

  return false;
}
