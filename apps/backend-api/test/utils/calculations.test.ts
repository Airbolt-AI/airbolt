import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

import {
  calculateTotal,
  calculateTotalWithTax,
  calculateDiscount,
  type Item,
} from '../../src/utils/calculations.js';

// Trigger test config validation workflow

describe('calculateTotal', () => {
  it('should calculate total for empty array', () => {
    expect(calculateTotal([])).toBe(0);
  });

  it('should calculate total for single item', () => {
    const items: Item[] = [{ price: 10.5, quantity: 2 }];
    expect(calculateTotal(items)).toBe(21);
  });

  it('should calculate total for multiple items', () => {
    const items: Item[] = [
      { price: 10, quantity: 2 },
      { price: 5.99, quantity: 3 },
      { price: 15.5, quantity: 1 },
    ];
    expect(calculateTotal(items)).toBe(53.47);
  });

  it('should handle zero quantities', () => {
    const items: Item[] = [
      { price: 10, quantity: 0 },
      { price: 5, quantity: 3 },
    ];
    expect(calculateTotal(items)).toBe(15);
  });

  it('should handle zero prices', () => {
    const items: Item[] = [
      { price: 0, quantity: 5 },
      { price: 10, quantity: 2 },
    ];
    expect(calculateTotal(items)).toBe(20);
  });

  it('should throw error for negative price', () => {
    const items = [{ price: -10, quantity: 2 }];
    expect(() => calculateTotal(items)).toThrow('Price must be non-negative');
  });

  it('should throw error for negative quantity', () => {
    const items = [{ price: 10, quantity: -2 }];
    expect(() => calculateTotal(items)).toThrow(
      'Quantity must be a non-negative integer'
    );
  });

  it('should throw error for non-integer quantity', () => {
    const items = [{ price: 10, quantity: 2.5 }];
    expect(() => calculateTotal(items)).toThrow();
  });
});

describe('calculateTotalWithTax', () => {
  const items: Item[] = [{ price: 100, quantity: 1 }];

  it('should calculate total with tax correctly', () => {
    expect(calculateTotalWithTax(items, 0.08)).toBe(108);
  });

  it('should handle zero tax rate', () => {
    expect(calculateTotalWithTax(items, 0)).toBe(100);
  });

  it('should handle 100% tax rate', () => {
    expect(calculateTotalWithTax(items, 1)).toBe(200);
  });

  it('should throw error for negative tax rate', () => {
    expect(() => calculateTotalWithTax(items, -0.1)).toThrow(
      'Tax rate must be between 0 and 1'
    );
  });

  it('should throw error for tax rate over 100%', () => {
    expect(() => calculateTotalWithTax(items, 1.5)).toThrow(
      'Tax rate must be between 0 and 1'
    );
  });
});

describe('calculateDiscount', () => {
  it('should calculate discount correctly', () => {
    expect(calculateDiscount(100, 10)).toBe(10);
    expect(calculateDiscount(50, 20)).toBe(10);
  });

  it('should handle zero discount', () => {
    expect(calculateDiscount(100, 0)).toBe(0);
  });

  it('should handle 100% discount', () => {
    expect(calculateDiscount(100, 100)).toBe(100);
  });

  it('should throw error for negative discount percentage', () => {
    expect(() => calculateDiscount(100, -10)).toThrow(
      'Discount percentage must be between 0 and 100'
    );
  });

  it('should throw error for discount percentage over 100', () => {
    expect(() => calculateDiscount(100, 150)).toThrow(
      'Discount percentage must be between 0 and 100'
    );
  });
});

// Property-based tests
describe('Property-based tests', () => {
  describe('calculateTotal invariants', () => {
    it('should never return negative total for valid items', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              price: fc.float({ min: 0, max: Math.fround(1000), noNaN: true }),
              quantity: fc.integer({ min: 0, max: 100 }),
            })
          ),
          items => {
            const total = calculateTotal(items);
            expect(total).toBeGreaterThanOrEqual(0);
          }
        )
      );
    });

    it('should be associative (order of items should not matter)', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              price: fc.float({ min: 0, max: Math.fround(100), noNaN: true }),
              quantity: fc.integer({ min: 0, max: 10 }),
            }),
            { minLength: 2 }
          ),
          items => {
            const total1 = calculateTotal(items);
            const shuffled = [...items].reverse(); // Simple shuffle
            const total2 = calculateTotal(shuffled);
            expect(total1).toBeCloseTo(total2, 10);
          }
        )
      );
    });

    it('should equal sum of individual items', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              price: fc.float({ min: 0, max: Math.fround(100), noNaN: true }),
              quantity: fc.integer({ min: 0, max: 10 }),
            }),
            { maxLength: 5 }
          ),
          items => {
            const total = calculateTotal(items);
            const manual = items.reduce(
              (sum, item) => sum + item.price * item.quantity,
              0
            );
            expect(total).toBeCloseTo(manual, 10);
          }
        )
      );
    });
  });

  describe('calculateDiscount invariants', () => {
    it('should never return discount greater than price', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: Math.fround(10000), noNaN: true }),
          fc.float({ min: 0, max: Math.fround(100), noNaN: true }),
          (price, discountPercent) => {
            const discount = calculateDiscount(price, discountPercent);
            expect(discount).toBeLessThanOrEqual(price);
            expect(discount).toBeGreaterThanOrEqual(0);
          }
        )
      );
    });

    it('should be monotonic (higher discount % = higher discount amount)', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 1, max: Math.fround(1000), noNaN: true }),
          fc.float({ min: 0, max: Math.fround(50), noNaN: true }),
          fc.float({ min: 0, max: Math.fround(50), noNaN: true }),
          (price, discount1, discount2) => {
            const [lower, higher] =
              discount1 <= discount2
                ? [discount1, discount2]
                : [discount2, discount1];

            const discountAmount1 = calculateDiscount(price, lower);
            const discountAmount2 = calculateDiscount(price, higher);

            expect(discountAmount1).toBeLessThanOrEqual(discountAmount2);
          }
        )
      );
    });
  });

  describe('calculateTotalWithTax invariants', () => {
    it('should always be greater than or equal to base total when tax rate is positive', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              price: fc.float({ min: 0, max: Math.fround(100), noNaN: true }),
              quantity: fc.integer({ min: 0, max: 10 }),
            })
          ),
          fc.float({ min: 0, max: Math.fround(1), noNaN: true }),
          (items, taxRate) => {
            const baseTotal = calculateTotal(items);
            const totalWithTax = calculateTotalWithTax(items, taxRate);
            expect(totalWithTax).toBeGreaterThanOrEqual(baseTotal);
          }
        )
      );
    });

    it('should equal base total when tax rate is zero', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              price: fc.float({ min: 0, max: Math.fround(100), noNaN: true }),
              quantity: fc.integer({ min: 0, max: 10 }),
            })
          ),
          items => {
            const baseTotal = calculateTotal(items);
            const totalWithTax = calculateTotalWithTax(items, 0);
            expect(totalWithTax).toBeCloseTo(baseTotal, 10);
          }
        )
      );
    });
  });
});
