// Global test setup for ALL tests in the monorepo
// This file is loaded before any test files are executed

import { register } from 'tsx/esm/api';

// Register tsx loader for TypeScript support in all worker processes
(register as () => void)();

// ALWAYS block fetch in ALL tests to prevent ANY network calls
// This prevents accidental network requests that would hang tests or hit real APIs
globalThis.fetch = async (input: any, _init?: any) => {
  throw new Error(
    `Network request attempted in test: ${String(input)}\n` +
      'Tests must not make real network requests. Mock this call with vi.mock() or vi.spyOn().'
  );
};

// Also block other network APIs that might be used
if (typeof globalThis.XMLHttpRequest !== 'undefined') {
  (globalThis as any).XMLHttpRequest = class {
    open() {
      throw new Error('XMLHttpRequest blocked in tests. Use mocks instead.');
    }
  };
}
