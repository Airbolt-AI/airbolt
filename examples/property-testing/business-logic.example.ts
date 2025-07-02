import { describe, it } from 'vitest';
import {
  propertyTest,
  generators,
} from '@airbolt/types/property-testing-simple';
import fc from 'fast-check';

/**
 * Example: Property testing for complex business logic
 *
 * This shows how to test functions with multiple inputs and complex business rules.
 * Copy this file to your test directory and adapt for your functions.
 */

// Example business logic functions (replace with your actual functions)
interface ShoppingCart {
  items: Array<{ id: string; price: number; quantity: number }>;
  discountCode?: string;
  taxRate: number;
}

function calculateCartTotal(cart: ShoppingCart): number {
  const subtotal = cart.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const discountAmount = cart.discountCode ? subtotal * 0.1 : 0; // 10% discount
  const afterDiscount = subtotal - discountAmount;
  const tax = afterDiscount * cart.taxRate;
  return afterDiscount + tax;
}

function applyBulkDiscount(
  items: Array<{ price: number; quantity: number }>
): number {
  const total = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  if (total > 1000) return total * 0.9; // 10% off
  if (total > 500) return total * 0.95; // 5% off
  return total;
}

function calculateShipping(weight: number, distance: number): number {
  const baseRate = 5.0;
  const weightFee = weight * 0.5;
  const distanceFee = distance * 0.1;
  return Math.max(baseRate, weightFee + distanceFee);
}

describe('Business Logic - Property Tests', () => {
  describe('calculateCartTotal', () => {
    // Custom generator for shopping carts
    const cartGenerator = fc.record({
      items: fc.array(
        fc.record({
          id: fc.uuid(),
          price: generators.money(),
          quantity: generators.quantity(),
        }),
        { maxLength: 5 }
      ),
      discountCode: fc.option(fc.constant('SAVE10')),
      taxRate: generators.taxRate(),
    });

    it('should satisfy basic financial invariants', () => {
      propertyTest(calculateCartTotal, cartGenerator, [
        'nonNegative',
        'finite',
        'reasonable',
      ]);
    });

    it('should be monotonic with respect to item prices', () => {
      fc.assert(
        fc.property(cartGenerator, cart => {
          const originalTotal = calculateCartTotal(cart);

          // Increase all prices by 10%
          const increasedCart = {
            ...cart,
            items: cart.items.map(item => ({
              ...item,
              price: item.price * 1.1,
            })),
          };
          const increasedTotal = calculateCartTotal(increasedCart);

          // Higher prices should result in higher or equal total
          return increasedTotal >= originalTotal;
        })
      );
    });

    it('should give discount when discount code is present', () => {
      fc.assert(
        fc.property(
          cartGenerator.filter(cart => cart.items.length > 0),
          cart => {
            const withoutDiscount = calculateCartTotal({
              ...cart,
              discountCode: undefined,
            });
            const withDiscount = calculateCartTotal({
              ...cart,
              discountCode: 'SAVE10',
            });

            // With discount should be less than or equal to without discount
            return withDiscount <= withoutDiscount;
          }
        )
      );
    });
  });

  describe('applyBulkDiscount', () => {
    it('should never increase the total', () => {
      fc.assert(
        fc.property(generators.items(), items => {
          const originalTotal = items.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0
          );
          const discountedTotal = applyBulkDiscount(items);

          return discountedTotal <= originalTotal;
        })
      );
    });

    it('should apply larger discount for larger orders', () => {
      // Test discount thresholds
      const largeOrder = [{ price: 600, quantity: 1 }];
      const veryLargeOrder = [{ price: 1200, quantity: 1 }];

      const largeDiscount = applyBulkDiscount(largeOrder);
      const veryLargeDiscount = applyBulkDiscount(veryLargeOrder);

      // Very large order should have proportionally larger discount
      const largeDiscountPercent = (600 - largeDiscount) / 600;
      const veryLargeDiscountPercent = (1200 - veryLargeDiscount) / 1200;

      expect(veryLargeDiscountPercent).toBeGreaterThanOrEqual(
        largeDiscountPercent
      );
    });
  });

  describe('calculateShipping', () => {
    const shippingGenerator = fc.tuple(
      fc.float({ min: 0.1, max: 100, noNaN: true }), // weight
      fc.float({ min: 1, max: 1000, noNaN: true }) // distance
    );

    it('should satisfy basic invariants', () => {
      propertyTest(
        ([weight, distance]) => calculateShipping(weight, distance),
        shippingGenerator,
        ['nonNegative', 'finite']
      );
    });

    it('should be monotonic with respect to weight and distance', () => {
      fc.assert(
        fc.property(shippingGenerator, ([weight, distance]) => {
          const baseShipping = calculateShipping(weight, distance);
          const heavierShipping = calculateShipping(weight * 2, distance);
          const fartherShipping = calculateShipping(weight, distance * 2);

          // More weight or distance should not decrease shipping cost
          return (
            heavierShipping >= baseShipping && fartherShipping >= baseShipping
          );
        })
      );
    });

    it('should respect minimum shipping cost', () => {
      fc.assert(
        fc.property(shippingGenerator, ([weight, distance]) => {
          const shipping = calculateShipping(weight, distance);
          return shipping >= 5.0; // Minimum base rate
        })
      );
    });
  });
});
