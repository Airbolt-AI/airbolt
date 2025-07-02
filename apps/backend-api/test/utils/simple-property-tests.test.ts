import { describe, it } from 'vitest';
import fc from 'fast-check';
import {
  propertyTest,
  generators,
  testFinancialFunction,
} from '@airbolt/types';

import {
  calculateTotal,
  calculateTotalWithTax,
  calculateDiscount,
  type Item,
} from '../../src/utils/calculations.js';

/**
 * Simplified Property-Based Tests for Business Logic
 *
 * Demonstrates the new simplified API for property testing.
 * This replaces complex fast-check boilerplate with readable, maintainable tests.
 */

describe('Simplified Property Tests - calculateTotal', () => {
  it('should satisfy basic financial invariants', () => {
    // Simple API: test function + generator + invariant names
    propertyTest(calculateTotal, generators.items(), ['nonNegative', 'finite']);
  });

  it('should handle empty arrays correctly', () => {
    propertyTest(calculateTotal, generators.items(), ['zeroForEmpty']);
  });

  it('should use convenience function for financial testing', () => {
    // Even simpler: one-liner for common financial function patterns
    testFinancialFunction(calculateTotal, generators.items());
  });
});

describe('Simplified Property Tests - calculateTotalWithTax', () => {
  it('should maintain tax calculation invariants', () => {
    propertyTest(
      ([items, taxRate]: [Item[], number]) =>
        calculateTotalWithTax(items, taxRate),
      // Combine generators with fc.tuple
      fc.tuple(generators.items(), generators.taxRate()),
      ['nonNegative', 'finite', 'reasonable']
    );
  });
});

describe('Simplified Property Tests - calculateDiscount', () => {
  it('should maintain discount calculation invariants', () => {
    propertyTest(
      ([amount, percentage]: [number, number]) =>
        calculateDiscount(amount, percentage),
      fc.tuple(generators.money(), generators.percentage()),
      ['nonNegative', 'finite'],
      { iterations: 500 } // Custom iteration count
    );
  });
});

describe('Integration: Multiple Functions Together', () => {
  it('should maintain consistency across calculation chain', () => {
    // Test complete business logic flow
    propertyTest(
      ([items, taxRate, discountPercent]: [Item[], number, number]) => {
        const subtotal = calculateTotal(items);
        const withTax = calculateTotalWithTax(items, taxRate);
        const discount = calculateDiscount(subtotal, discountPercent);

        // Return final amount for invariant checking
        return withTax - discount;
      },
      fc.tuple(
        generators.items(),
        generators.taxRate(),
        generators.percentage()
      ),
      ['finite', 'reasonable']
    );
  });
});
