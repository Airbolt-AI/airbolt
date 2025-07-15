/**
 * Vitest setup file for mutation testing
 *
 * This file runs inside every Vitest worker process to register
 * the tsx TypeScript loader. This is necessary because Node.js v20+
 * doesn't propagate loader flags to child processes.
 */
import { register } from 'tsx/esm/api';

// Register tsx loader for TypeScript support
(register as () => void)();
