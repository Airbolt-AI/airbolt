import { describe, it } from 'vitest';
import {
  propertyTest,
  generators,
  testFormatterFunction,
} from '@airbolt/types/property-testing-simple';
import fc from 'fast-check';

/**
 * Example: Property testing for validation and formatting functions
 *
 * Copy this file to your test directory and adapt for your functions.
 */

// Example functions to test (replace with your actual functions)
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

function validatePassword(password: string): {
  valid: boolean;
  reason?: string;
} {
  if (password.length < 8) {
    return { valid: false, reason: 'Too short' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, reason: 'Missing uppercase' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, reason: 'Missing number' };
  }
  return { valid: true };
}

describe('Validation Functions - Property Tests', () => {
  describe('isValidEmail', () => {
    it('should always return boolean', () => {
      fc.assert(
        fc.property(fc.string(), email => {
          const result = isValidEmail(email);
          return typeof result === 'boolean';
        })
      );
    });

    it('should accept valid email format', () => {
      fc.assert(
        fc.property(generators.email(), email => {
          return isValidEmail(email) === true;
        })
      );
    });

    it('should reject clearly invalid formats', () => {
      const invalidEmails = fc.oneof(
        fc.constant(''),
        fc.constant('notanemail'),
        fc.constant('@domain.com'),
        fc.constant('user@'),
        fc.string({ minLength: 1, maxLength: 5 }).filter(s => !s.includes('@'))
      );

      fc.assert(
        fc.property(invalidEmails, email => {
          return isValidEmail(email) === false;
        })
      );
    });
  });

  describe('formatCurrency', () => {
    it('should always return non-empty string for valid amounts', () => {
      testFormatterFunction(
        amount => formatCurrency(amount),
        generators.money()
      );
    });

    it('should handle different currencies', () => {
      fc.assert(
        fc.property(
          fc.tuple(generators.money(), generators.currency()),
          ([amount, currency]) => {
            const result = formatCurrency(amount, currency);
            return typeof result === 'string' && result.length > 0;
          }
        )
      );
    });

    it('should include currency symbol', () => {
      fc.assert(
        fc.property(generators.money(), amount => {
          const result = formatCurrency(amount, 'USD');
          return result.includes('$');
        })
      );
    });
  });

  describe('validatePassword', () => {
    it('should always return object with valid boolean', () => {
      fc.assert(
        fc.property(fc.string(), password => {
          const result = validatePassword(password);
          return (
            typeof result === 'object' &&
            typeof result.valid === 'boolean' &&
            (result.valid || typeof result.reason === 'string')
          );
        })
      );
    });

    it('should reject short passwords', () => {
      fc.assert(
        fc.property(fc.string({ maxLength: 7 }), password => {
          const result = validatePassword(password);
          return result.valid === false;
        })
      );
    });

    it('should accept strong passwords', () => {
      const strongPassword = fc
        .string({ minLength: 8, maxLength: 20 })
        .map(s => s + 'A1'); // Ensure it has uppercase and number

      fc.assert(
        fc.property(strongPassword, password => {
          const result = validatePassword(password);
          return result.valid === true;
        })
      );
    });
  });
});
