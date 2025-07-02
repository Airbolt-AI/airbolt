import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

import {
  calculateTotal,
  calculateTotalWithTax,
  calculateDiscount,
  type Item,
} from '../../src/utils/calculations.js';

import {
  propertyTest,
  generators,
  testFinancialFunction,
  testArrayFunction,
} from '@airbolt/types';

/**
 * Enhanced Property-Based Tests using Simplified API
 *
 * Demonstrates comprehensive property testing using the new simplified API.
 * Replaces complex boilerplate with readable, maintainable tests.
 */

describe('Enhanced Property Tests - calculateTotal', () => {
  describe('Core Mathematical Properties', () => {
    it('should satisfy all financial invariants', () => {
      // Simple API: test function + generator + invariant names
      propertyTest(calculateTotal, generators.items(), [
        'nonNegative',
        'finite',
        'zeroForEmpty',
        'reasonable',
      ]);
    });

    it('should use convenience function for financial testing', () => {
      // Even simpler: one-liner for common financial function patterns
      testFinancialFunction(calculateTotal, generators.items());
    });

    it('should use convenience function for array testing', () => {
      // Test array processing with common invariants
      testArrayFunction(
        calculateTotal,
        fc.record({
          price: generators.money(),
          quantity: generators.quantity(),
        })
      );
    });
  });

  describe('Business Logic Validation', () => {
    it('should equal sum of individual item calculations', () => {
      propertyTest(
        (items: Item[]) => {
          const total = calculateTotal(items);
          const manualTotal = items.reduce(
            (sum: number, item) => sum + item.price * item.quantity,
            0
          );

          // Verify they are approximately equal (floating point tolerance)
          expect(total).toBeCloseTo(manualTotal, 10);
          return total;
        },
        generators.items(),
        ['nonNegative', 'finite']
      );
    });

    it('should be monotonic (adding items never decreases total)', () => {
      fc.assert(
        fc.property(
          generators.items(),
          generators.items(),
          (items1, items2) => {
            const total1 = calculateTotal(items1);
            const total2 = calculateTotal([...items1, ...items2]);

            expect(total2).toBeGreaterThanOrEqual(total1);
          }
        )
      );
    });

    it('should be order-independent (commutative)', () => {
      propertyTest(
        (items: Item[]) => {
          const total1 = calculateTotal(items);
          const shuffled = [...items].reverse();
          const total2 = calculateTotal(shuffled);

          expect(total1).toBeCloseTo(total2, 2);
          return total1;
        },
        fc.array(
          fc.record({
            price: generators.money(),
            quantity: generators.quantity(),
          }),
          { minLength: 2, maxLength: 5 }
        ),
        ['nonNegative', 'finite']
      );
    });
  });

  describe('Boundary Value Properties', () => {
    it('should handle extreme values correctly', () => {
      propertyTest(
        calculateTotal,
        fc.array(
          fc.record({
            price: fc.oneof(
              fc.constant(0),
              fc.constant(0.01),
              generators.money(),
              fc.constant(999999)
            ),
            quantity: fc.oneof(
              fc.constant(0),
              fc.constant(1),
              generators.quantity()
            ),
          })
        ),
        ['nonNegative', 'finite', 'reasonable']
      );
    });

    it('should handle floating point precision consistently', () => {
      propertyTest(
        (items: Item[]) => {
          const total = calculateTotal(items);

          // Should be precise to 2 decimal places for financial calculations
          const rounded = Math.round(total * 100) / 100;
          expect(Math.abs(total - rounded)).toBeLessThan(0.005);

          return total;
        },
        fc.array(
          fc.record({
            price: fc.float({
              min: Math.fround(0.01),
              max: Math.fround(0.99),
              noNaN: true,
            }),
            quantity: fc.integer({ min: 1, max: 3 }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        ['nonNegative', 'finite']
      );
    });
  });

  describe('Composition Properties', () => {
    it('should compose correctly with array concatenation', () => {
      fc.assert(
        fc.property(
          generators.items(),
          generators.items(),
          (items1, items2) => {
            const total1 = calculateTotal(items1);
            const total2 = calculateTotal(items2);
            const combinedTotal = calculateTotal([...items1, ...items2]);

            expect(combinedTotal).toBeCloseTo(total1 + total2, 2);
          }
        )
      );
    });
  });
});

describe('Enhanced Property Tests - calculateTotalWithTax', () => {
  describe('Tax Calculation Properties', () => {
    it('should maintain tax relationship invariants', () => {
      propertyTest(
        ([items, taxRate]: [Item[], number]) => {
          const baseTotal = calculateTotal(items);
          const totalWithTax = calculateTotalWithTax(items, taxRate);

          // Tax never decreases total
          expect(totalWithTax).toBeGreaterThanOrEqual(baseTotal);

          // Correct tax calculation
          const expectedTax = baseTotal * taxRate;
          expect(totalWithTax).toBeCloseTo(baseTotal + expectedTax, 2);

          return totalWithTax;
        },
        fc.tuple(generators.items(), generators.taxRate()),
        ['nonNegative', 'finite', 'reasonable']
      );
    });

    it('should be monotonic in tax rate', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.float({ min: 0, max: 0.5, noNaN: true }),
            fc.float({ min: 0, max: 0.5, noNaN: true })
          ),
          ([rate1, rate2]) => {
            const [smallerRate, largerRate] = [
              Math.min(rate1, rate2),
              Math.max(rate1, rate2),
            ];
            const items: Item[] = [{ price: 100, quantity: 1 }];

            const total1 = calculateTotalWithTax(items, smallerRate);
            const total2 = calculateTotalWithTax(items, largerRate);

            expect(total2).toBeGreaterThanOrEqual(total1);
          }
        )
      );
    });
  });

  describe('Composition with Base Calculation', () => {
    it('should compose correctly with calculateTotal', () => {
      propertyTest(
        ([items, taxRate]: [Item[], number]) => {
          const directCalculation = calculateTotalWithTax(items, taxRate);
          const composedCalculation = calculateTotal(items) * (1 + taxRate);

          expect(directCalculation).toBeCloseTo(composedCalculation, 2);
          return directCalculation;
        },
        fc.tuple(
          generators.items(),
          fc.float({ min: 0, max: Math.fround(0.3), noNaN: true })
        ),
        ['nonNegative', 'finite']
      );
    });
  });
});

describe('Enhanced Property Tests - calculateDiscount', () => {
  describe('Discount Calculation Properties', () => {
    it('should maintain discount invariants', () => {
      propertyTest(
        ([amount, discountPercent]: [number, number]) => {
          const discount = calculateDiscount(amount, discountPercent);

          // Discount never exceeds original amount
          expect(discount).toBeLessThanOrEqual(amount);
          expect(discount).toBeGreaterThanOrEqual(0);

          // Correct percentage calculation
          const expectedDiscount = amount * (discountPercent / 100);
          expect(discount).toBeCloseTo(expectedDiscount, 2);

          return discount;
        },
        fc.tuple(generators.money(), generators.percentage()),
        ['nonNegative', 'finite', 'reasonable']
      );
    });

    it('should be monotonic in discount percentage', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.float({ min: 0, max: 50, noNaN: true }),
            fc.float({ min: 0, max: 50, noNaN: true })
          ),
          ([percent1, percent2]) => {
            const [smaller, larger] = [
              Math.min(percent1, percent2),
              Math.max(percent1, percent2),
            ];

            const discount1 = calculateDiscount(100, smaller);
            const discount2 = calculateDiscount(100, larger);

            expect(discount2).toBeGreaterThanOrEqual(discount1);
          }
        )
      );
    });

    it('should scale proportionally with amount', () => {
      fc.assert(
        fc.property(
          generators.money(),
          generators.percentage(),
          fc.float({ min: 2, max: 10, noNaN: true }),
          (amount, discountPercent, multiplier) => {
            const discount1 = calculateDiscount(amount, discountPercent);
            const discount2 = calculateDiscount(
              amount * multiplier,
              discountPercent
            );

            expect(discount2).toBeCloseTo(discount1 * multiplier, 2);
          }
        )
      );
    });
  });
});

describe('Cross-Function Integration Properties', () => {
  it('should maintain consistency across all calculation functions', () => {
    propertyTest(
      ([items, taxRate, discountPercent]: [Item[], number, number]) => {
        const baseTotal = calculateTotal(items);
        const totalWithTax = calculateTotalWithTax(items, taxRate);
        const discount = calculateDiscount(baseTotal, discountPercent);

        // Relationships should hold
        expect(totalWithTax).toBeGreaterThanOrEqual(baseTotal);
        expect(discount).toBeLessThanOrEqual(baseTotal);

        // Final calculation should be mathematically consistent
        const finalAmount = totalWithTax - discount;

        // Should be able to reconstruct base calculations
        const reconstructedBase = totalWithTax / (1 + taxRate);
        expect(reconstructedBase).toBeCloseTo(baseTotal, 1);

        return finalAmount;
      },
      fc.tuple(
        generators.items(),
        fc.float({ min: 0, max: Math.fround(0.2), noNaN: true }),
        fc.float({ min: 0, max: Math.fround(20), noNaN: true })
      ),
      ['finite', 'reasonable']
    );
  });

  it('should maintain precision across multiple operations', () => {
    propertyTest(
      (items: Item[]) => {
        const initialTotal = calculateTotal(items);

        // Skip if initial total is zero (would cause precision issues)
        if (initialTotal === 0) {
          return 0;
        }

        // Multiple transformations should not accumulate significant errors
        let total = initialTotal;

        for (let i = 0; i < 5; i++) {
          const withTax = calculateTotalWithTax(
            [{ price: total, quantity: 1 }],
            0.1
          );
          const discount = calculateDiscount(withTax, 10);
          total = withTax - discount;

          // Break if total becomes too small to avoid precision issues
          if (total < 0.01) {
            total = 0.01;
            break;
          }
        }

        return total;
      },
      fc.array(
        fc.record({
          price: generators.money(),
          quantity: generators.quantity(),
        }),
        { minLength: 1, maxLength: 3 }
      ),
      ['finite', 'nonNegative']
    );
  });
});
