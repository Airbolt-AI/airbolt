import { describe, it } from 'vitest';
import {
  propertyTest,
  generators,
  testFinancialFunction,
} from '@airbolt/types/property-testing-simple';
import fc from 'fast-check';

/**
 * Example: Property testing for financial calculation functions
 *
 * Copy this file to your test directory and adapt for your functions.
 */

// Example function to test (replace with your actual function)
function calculateTotal(
  items: Array<{ price: number; quantity: number }>
): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function calculateDiscount(amount: number, percentage: number): number {
  if (percentage < 0 || percentage > 100) {
    throw new Error('Discount percentage must be between 0 and 100');
  }
  return amount * (percentage / 100);
}

describe('Financial Functions - Property Tests', () => {
  describe('calculateTotal', () => {
    it('should satisfy basic mathematical invariants', () => {
      propertyTest(calculateTotal, generators.items(), [
        'nonNegative',
        'finite',
      ]);
    });

    it('should return zero for empty arrays', () => {
      propertyTest(calculateTotal, fc.constant([]), ['zeroForEmpty']);
    });

    it('should use convenience function for array testing', () => {
      testFinancialFunction(calculateTotal, generators.items());
    });
  });

  describe('calculateDiscount', () => {
    it('should never exceed original amount', () => {
      propertyTest(
        ([amount, percentage]) => calculateDiscount(amount, percentage),
        fc.tuple(generators.money(), generators.percentage()),
        ['nonNegative', 'finite'],
        { iterations: 500 }
      );
    });

    it('should have additional business logic validation', () => {
      fc.assert(
        fc.property(
          fc.tuple(generators.money(), generators.percentage()),
          ([amount, percentage]) => {
            const discount = calculateDiscount(amount, percentage);

            // Property: discount never exceeds original amount
            return discount <= amount;
          }
        )
      );
    });
  });
});
